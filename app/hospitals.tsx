
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";

type Town = {
  id: string;
  name: string;
};

type Hospital = {
  id: string;
  name: string;
  town_id: string;
  address: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  facility_type: string;
  description: string | null;
  operating_hours: string | null;
  is_active: boolean;
  created_at: string;
};

type HospitalForm = {
  name: string;
  town_id: string;
  address: string;
  phone: string;
  latitude: string;
  longitude: string;
  facility_type: string;
  description: string;
  operating_hours: string;
};

const facilityTypes = ["Hospital", "Clinic", "Health Centre"];

const emptyForm: HospitalForm = {
  name: "",
  town_id: "",
  address: "",
  phone: "",
  latitude: "",
  longitude: "",
  facility_type: "Hospital",
  description: "",
  operating_hours: "",
};

export default function HospitalsScreen() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [towns, setTowns] = useState<Town[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [townFilter, setTownFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");

  const [formVisible, setFormVisible] = useState(false);
  const [townPickerVisible, setTownPickerVisible] = useState(false);
  const [townSearch, setTownSearch] = useState("");

  const [editingHospital, setEditingHospital] =
    useState<Hospital | null>(null);

  const [form, setForm] = useState<HospitalForm>(emptyForm);

  // Load towns and hospitals.
  const loadData = useCallback(async () => {
    try {
      const [townResult, hospitalResult] = await Promise.all([
        supabase
          .from("towns")
          .select("id, name")
          .order("name"),

        supabase
          .from("hospitals")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      if (townResult.error) {
        console.log("Town loading error:", townResult.error.message);
        Alert.alert("Towns could not load", townResult.error.message);
      } else {
        setTowns(townResult.data ?? []);
      }

      if (hospitalResult.error) {
        throw hospitalResult.error;
      }

      setHospitals((hospitalResult.data ?? []) as Hospital[]);
    } catch (error: any) {
      console.log("Hospital loading error:", error.message);

      Alert.alert(
        "Loading failed",
        error.message || "Could not load hospitals."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const updateForm = (
    field: keyof HospitalForm,
    value: string
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const getTownName = (townId: string) => {
    return (
      towns.find((town) => town.id === townId)?.name ??
      "Unknown town"
    );
  };

  const filteredHospitals = useMemo(() => {
    return hospitals.filter((hospital) => {
      const searchText = search.toLowerCase();

      const matchesSearch =
        hospital.name.toLowerCase().includes(searchText) ||
        (hospital.address ?? "").toLowerCase().includes(searchText) ||
        getTownName(hospital.town_id)
          .toLowerCase()
          .includes(searchText);

      const matchesTown =
        townFilter === "all" ||
        hospital.town_id === townFilter;

      const matchesStatus =
        activeFilter === "all" ||
        (activeFilter === "active" && hospital.is_active) ||
        (activeFilter === "inactive" && !hospital.is_active);

      return matchesSearch && matchesTown && matchesStatus;
    });
  }, [hospitals, search, townFilter, activeFilter, towns]);

  const filteredTowns = useMemo(() => {
    const searchText = townSearch.trim().toLowerCase();

    return towns.filter((town) =>
      town.name.toLowerCase().includes(searchText)
    );
  }, [towns, townSearch]);

  const activeCount = hospitals.filter(
    (hospital) => hospital.is_active
  ).length;

  const selectedTown = towns.find(
    (town) => town.id === form.town_id
  );

  const openAddForm = () => {
    setEditingHospital(null);
    setForm(emptyForm);
    setTownSearch("");
    setTownPickerVisible(false);
    setFormVisible(true);
  };

  const openEditForm = (hospital: Hospital) => {
    setEditingHospital(hospital);

    setForm({
      name: hospital.name,
      town_id: hospital.town_id,
      address: hospital.address ?? "",
      phone: hospital.phone ?? "",
      latitude:
        hospital.latitude !== null
          ? String(hospital.latitude)
          : "",
      longitude:
        hospital.longitude !== null
          ? String(hospital.longitude)
          : "",
      facility_type: hospital.facility_type || "Hospital",
      description: hospital.description ?? "",
      operating_hours: hospital.operating_hours ?? "",
    });

    setTownSearch("");
    setTownPickerVisible(false);
    setFormVisible(true);
  };

  const openTownPicker = () => {
    setTownSearch("");
    setTownPickerVisible(true);
  };

  const closeTownPicker = () => {
    setTownPickerVisible(false);
    setTownSearch("");
  };

  const closeForm = () => {
    if (saving) return;

    setFormVisible(false);
    setTownPickerVisible(false);
    setTownSearch("");
    setEditingHospital(null);
    setForm(emptyForm);
  };

  const handleModalClose = () => {
    if (townPickerVisible) {
      closeTownPicker();
      return;
    }

    closeForm();
  };

  const selectTown = (town: Town) => {
    updateForm("town_id", town.id);
    setTownPickerVisible(false);
    setTownSearch("");
  };

  const saveHospital = async () => {
    const name = form.name.trim();

    if (!name) {
      Alert.alert(
        "Hospital name required",
        "Enter the hospital name."
      );
      return;
    }

    if (!form.town_id) {
      Alert.alert(
        "Town required",
        "Select the town where the facility is located."
      );
      return;
    }

    const latitudeText = form.latitude.trim();
    const longitudeText = form.longitude.trim();

    if (
      (latitudeText && !longitudeText) ||
      (!latitudeText && longitudeText)
    ) {
      Alert.alert(
        "Incomplete GPS coordinates",
        "Enter both latitude and longitude, or leave both empty."
      );
      return;
    }

    let latitude: number | null = null;
    let longitude: number | null = null;

    if (latitudeText && longitudeText) {
      latitude = Number(latitudeText);
      longitude = Number(longitudeText);

      if (
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90
      ) {
        Alert.alert(
          "Invalid latitude",
          "Enter a latitude between -90 and 90."
        );
        return;
      }

      if (
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180
      ) {
        Alert.alert(
          "Invalid longitude",
          "Enter a longitude between -180 and 180."
        );
        return;
      }
    }

    // Only use columns that actually exist in public.hospitals.
    const hospitalData = {
      name,
      town_id: form.town_id,
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      latitude,
      longitude,
      facility_type: form.facility_type,
      description: form.description.trim() || null,
      operating_hours: form.operating_hours.trim() || null,
    };

    setSaving(true);

    try {
      if (editingHospital) {
        const { data, error } = await supabase
          .from("hospitals")
          .update(hospitalData)
          .eq("id", editingHospital.id)
          .select("id");

        if (error) throw error;

        if (!data || data.length === 0) {
          throw new Error(
            "The hospital was not updated. Check your administrator permissions."
          );
        }

        Alert.alert(
          "Updated",
          "Hospital information has been updated."
        );
      } else {
        const { data, error } = await supabase
          .from("hospitals")
          .insert(hospitalData)
          .select("id");

        if (error) throw error;

        if (!data || data.length === 0) {
          throw new Error("The hospital could not be added.");
        }

        Alert.alert(
          "Added",
          "Hospital has been added successfully."
        );
      }

      setFormVisible(false);
      setTownPickerVisible(false);
      setTownSearch("");
      setEditingHospital(null);
      setForm(emptyForm);

      await loadData();
    } catch (error: any) {
      Alert.alert(
        "Save failed",
        error.message || "Could not save hospital information."
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleHospitalStatus = (hospital: Hospital) => {
    const nextStatus = !hospital.is_active;

    Alert.alert(
      nextStatus ? "Activate hospital" : "Deactivate hospital",
      nextStatus
        ? "This facility will become visible to citizens."
        : "This facility will no longer appear in the active citizen listings.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: nextStatus ? "Activate" : "Deactivate",
          onPress: async () => {
            try {
              const { data, error } = await supabase
                .from("hospitals")
                .update({
                  is_active: nextStatus,
                })
                .eq("id", hospital.id)
                .select("id");

              if (error) throw error;

              if (!data || data.length === 0) {
                throw new Error("Status update was not applied.");
              }

              await loadData();
            } catch (error: any) {
              Alert.alert("Update failed", error.message);
            }
          },
        },
      ]
    );
  };

  const deleteHospital = (hospital: Hospital) => {
    Alert.alert(
      "Delete hospital",
      `Are you sure you want to delete ${hospital.name}? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { data, error } = await supabase
                .from("hospitals")
                .delete()
                .eq("id", hospital.id)
                .select("id");

              if (error) throw error;

              if (!data || data.length === 0) {
                throw new Error(
                  "The hospital was not deleted. Check permissions or linked records."
                );
              }

              Alert.alert(
                "Deleted",
                "Hospital has been deleted."
              );

              await loadData();
            } catch (error: any) {
              Alert.alert(
                "Delete failed",
                error.message ||
                  "Could not delete this hospital. It may be linked to other records."
              );
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#176B45"]}
            tintColor="#176B45"
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>ADMINISTRATION</Text>
            <Text style={styles.title}>
              Hospitals & Health Centres
            </Text>
            <Text style={styles.subtitle}>
              Manage healthcare facilities across Igbo-Eze North.
            </Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>
              Total facilities
            </Text>
            <Text style={styles.summaryNumber}>
              {hospitals.length}
            </Text>
          </View>

          <View style={styles.summaryDivider} />

          <View>
            <Text style={styles.summaryLabel}>
              Active facilities
            </Text>
            <Text style={styles.summaryNumber}>
              {activeCount}
            </Text>
          </View>

          <View style={styles.summaryIcon}>
            <Text style={styles.summaryEmoji}>🏥</Text>
          </View>
        </View>

        <Pressable
          onPress={openAddForm}
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.addButtonText}>
            ＋ Add hospital or health centre
          </Text>
        </Pressable>

        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search hospitals, addresses or towns..."
            placeholderTextColor="#98A39C"
            style={styles.searchInput}
          />
        </View>

        <Text style={styles.filterHeading}>
          Facility status
        </Text>

        <View style={styles.filterRow}>
          {[
            { label: "All", value: "all" },
            { label: "Active", value: "active" },
            { label: "Inactive", value: "inactive" },
          ].map((filter) => (
            <Pressable
              key={filter.value}
              onPress={() => setActiveFilter(filter.value)}
              style={[
                styles.filterButton,
                activeFilter === filter.value &&
                  styles.filterButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  activeFilter === filter.value &&
                    styles.filterTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.filterHeading}>
          Filter by town
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.townFilters}
        >
          <Pressable
            onPress={() => setTownFilter("all")}
            style={[
              styles.townFilter,
              townFilter === "all" && styles.townFilterActive,
            ]}
          >
            <Text
              style={[
                styles.townFilterText,
                townFilter === "all" &&
                  styles.townFilterTextActive,
              ]}
            >
              All towns
            </Text>
          </Pressable>

          {towns.map((town) => (
            <Pressable
              key={town.id}
              onPress={() => setTownFilter(town.id)}
              style={[
                styles.townFilter,
                townFilter === town.id &&
                  styles.townFilterActive,
              ]}
            >
              <Text
                style={[
                  styles.townFilterText,
                  townFilter === town.id &&
                    styles.townFilterTextActive,
                ]}
              >
                {town.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.listHeading}>
          <Text style={styles.listTitle}>
            Registered facilities
          </Text>
          <Text style={styles.listCount}>
            {filteredHospitals.length} found
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#176B45" />
            <Text style={styles.loadingText}>
              Loading hospitals...
            </Text>
          </View>
        ) : filteredHospitals.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🏥</Text>
            <Text style={styles.emptyTitle}>
              No hospitals found
            </Text>
            <Text style={styles.emptyDescription}>
              Add a facility or change your search and filters.
            </Text>
          </View>
        ) : (
          <View style={styles.hospitalList}>
            {filteredHospitals.map((hospital) => (
              <View
                key={hospital.id}
                style={styles.hospitalCard}
              >
                <View style={styles.hospitalTop}>
                  <View style={styles.hospitalIcon}>
                    <Text style={styles.hospitalEmoji}>🏥</Text>
                  </View>

                  <View style={styles.hospitalInfo}>
                    <Text style={styles.hospitalName}>
                      {hospital.name}
                    </Text>
                    <Text style={styles.hospitalType}>
                      {hospital.facility_type}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      hospital.is_active
                        ? styles.activeBadge
                        : styles.inactiveBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        hospital.is_active
                          ? styles.activeText
                          : styles.inactiveText,
                      ]}
                    >
                      {hospital.is_active ? "Active" : "Inactive"}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailLine}>
                  <Text style={styles.detailIcon}>📍</Text>
                  <Text style={styles.detailText}>
                    {getTownName(hospital.town_id)}
                    {hospital.address
                      ? ` · ${hospital.address}`
                      : ""}
                  </Text>
                </View>

                {hospital.phone && (
                  <View style={styles.detailLine}>
                    <Text style={styles.detailIcon}>☎</Text>
                    <Text style={styles.detailText}>
                      {hospital.phone}
                    </Text>
                  </View>
                )}

                {hospital.operating_hours && (
                  <View style={styles.detailLine}>
                    <Text style={styles.detailIcon}>🕒</Text>
                    <Text style={styles.detailText}>
                      {hospital.operating_hours}
                    </Text>
                  </View>
                )}

                <View style={styles.gpsInfo}>
                  <Text style={styles.gpsText}>
                    {hospital.latitude !== null &&
                    hospital.longitude !== null
                      ? "✓ GPS coordinates saved"
                      : "GPS coordinates not added"}
                  </Text>
                </View>

                <View style={styles.cardActions}>
                  <Pressable
                    onPress={() => openEditForm(hospital)}
                    style={[
                      styles.actionButton,
                      styles.editButton,
                    ]}
                  >
                    <Text style={styles.editButtonText}>
                      Edit
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      toggleHospitalStatus(hospital)
                    }
                    style={[
                      styles.actionButton,
                      hospital.is_active
                        ? styles.deactivateButton
                        : styles.activateButton,
                    ]}
                  >
                    <Text
                      style={
                        hospital.is_active
                          ? styles.deactivateText
                          : styles.activateText
                      }
                    >
                      {hospital.is_active
                        ? "Deactivate"
                        : "Activate"}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => deleteHospital(hospital)}
                    style={[
                      styles.actionButton,
                      styles.deleteButton,
                    ]}
                  >
                    <Text style={styles.deleteButtonText}>
                      Delete
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.footer}>
          IGBO-EZE-NORTH ADMINISTRATION
        </Text>
      </ScrollView>

      <Modal
        visible={formVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleModalClose}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <KeyboardAvoidingView
            style={styles.modalSafeArea}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            {townPickerVisible ? (
              <View style={styles.pickerScreen}>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>
                      Select town
                    </Text>
                    <Text style={styles.modalSubtitle}>
                      Choose where this facility is located.
                    </Text>
                  </View>

                  <Pressable
                    onPress={closeTownPicker}
                    style={styles.closeButton}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </Pressable>
                </View>

                <View style={styles.pickerContent}>
                  <TextInput
                    value={townSearch}
                    onChangeText={setTownSearch}
                    placeholder="Search towns..."
                    style={styles.pickerSearch}
                    placeholderTextColor="#9AA59E"
                    autoCorrect={false}
                    returnKeyType="search"
                  />

                  {towns.length === 0 ? (
                    <View style={styles.noTownsContainer}>
                      <Text style={styles.noTownText}>
                        No towns are available.
                      </Text>
                      <Text style={styles.noTownHint}>
                        Check that your towns table contains records
                        and that your administrator has permission
                        to read them.
                      </Text>
                    </View>
                  ) : filteredTowns.length === 0 ? (
                    <View style={styles.noTownsContainer}>
                      <Text style={styles.noTownText}>
                        No towns found.
                      </Text>
                      <Text style={styles.noTownHint}>
                        Try another search.
                      </Text>
                    </View>
                  ) : (
                    <ScrollView
                      style={styles.pickerList}
                      contentContainerStyle={
                        styles.pickerListContent
                      }
                      showsVerticalScrollIndicator
                      keyboardShouldPersistTaps="handled"
                      nestedScrollEnabled
                    >
                      {filteredTowns.map((town) => {
                        const isSelected =
                          form.town_id === town.id;

                        return (
                          <Pressable
                            key={town.id}
                            onPress={() => selectTown(town)}
                            style={[
                              styles.pickerTown,
                              isSelected &&
                                styles.pickerTownSelected,
                            ]}
                          >
                            <Text
                              style={[
                                styles.pickerTownText,
                                isSelected &&
                                  styles.pickerTownTextSelected,
                              ]}
                            >
                              {town.name}
                            </Text>

                            {isSelected && (
                              <Text style={styles.pickerCheck}>
                                ✓
                              </Text>
                            )}
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              </View>
            ) : (
              <>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>
                      {editingHospital
                        ? "Edit facility"
                        : "Add facility"}
                    </Text>
                    <Text style={styles.modalSubtitle}>
                      Enter the facility information below.
                    </Text>
                  </View>

                  <Pressable
                    onPress={closeForm}
                    disabled={saving}
                    style={styles.closeButton}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </Pressable>
                </View>

                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.formContent}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.inputLabel}>
                    Hospital name *
                  </Text>
                  <TextInput
                    value={form.name}
                    onChangeText={(value) =>
                      updateForm("name", value)
                    }
                    placeholder="Enter hospital name"
                    style={styles.input}
                    placeholderTextColor="#9AA59E"
                  />

                  <Text style={styles.inputLabel}>Town *</Text>
                  <Pressable
                    onPress={openTownPicker}
                    style={styles.selectInput}
                  >
                    <Text
                      style={
                        selectedTown
                          ? styles.selectText
                          : styles.selectPlaceholder
                      }
                    >
                      {selectedTown?.name ?? "Select a town"}
                    </Text>
                    <Text style={styles.selectArrow}>⌄</Text>
                  </Pressable>

                  <Text style={styles.inputLabel}>
                    Facility type *
                  </Text>
                  <View style={styles.typeOptions}>
                    {facilityTypes.map((type) => (
                      <Pressable
                        key={type}
                        onPress={() =>
                          updateForm("facility_type", type)
                        }
                        style={[
                          styles.typeOption,
                          form.facility_type === type &&
                            styles.typeOptionActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.typeOptionText,
                            form.facility_type === type &&
                              styles.typeOptionTextActive,
                          ]}
                        >
                          {type}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.inputLabel}>
                    Full address
                  </Text>
                  <TextInput
                    value={form.address}
                    onChangeText={(value) =>
                      updateForm("address", value)
                    }
                    placeholder="Enter the facility address"
                    style={styles.input}
                    placeholderTextColor="#9AA59E"
                  />

                  <Text style={styles.inputLabel}>
                    Phone number
                  </Text>
                  <TextInput
                    value={form.phone}
                    onChangeText={(value) =>
                      updateForm("phone", value)
                    }
                    placeholder="Enter contact number"
                    keyboardType="phone-pad"
                    style={styles.input}
                    placeholderTextColor="#9AA59E"
                  />

                  <View style={styles.formSectionHeading}>
                    <Text style={styles.formSectionTitle}>
                      GPS coordinates
                    </Text>
                    <Text style={styles.optionalText}>
                      Optional
                    </Text>
                  </View>

                  <Text style={styles.helperText}>
                    Add verified coordinates for more accurate map
                    directions.
                  </Text>

                  <Text style={styles.inputLabel}>Latitude</Text>
                  <TextInput
                    value={form.latitude}
                    onChangeText={(value) =>
                      updateForm("latitude", value)
                    }
                    placeholder="Example: 6.123456"
                    keyboardType="decimal-pad"
                    style={styles.input}
                    placeholderTextColor="#9AA59E"
                  />

                  <Text style={styles.inputLabel}>Longitude</Text>
                  <TextInput
                    value={form.longitude}
                    onChangeText={(value) =>
                      updateForm("longitude", value)
                    }
                    placeholder="Example: 7.123456"
                    keyboardType="decimal-pad"
                    style={styles.input}
                    placeholderTextColor="#9AA59E"
                  />

                  <Text style={styles.inputLabel}>
                    Operating hours
                  </Text>
                  <TextInput
                    value={form.operating_hours}
                    onChangeText={(value) =>
                      updateForm("operating_hours", value)
                    }
                    placeholder="Example: Monday - Friday, 8am - 5pm"
                    style={styles.input}
                    placeholderTextColor="#9AA59E"
                  />

                  <Text style={styles.inputLabel}>
                    Description
                  </Text>
                  <TextInput
                    value={form.description}
                    onChangeText={(value) =>
                      updateForm("description", value)
                    }
                    placeholder="Describe the healthcare facility..."
                    style={[
                      styles.input,
                      styles.descriptionInput,
                    ]}
                    multiline
                    textAlignVertical="top"
                    placeholderTextColor="#9AA59E"
                  />

                  <Pressable
                    onPress={saveHospital}
                    disabled={saving}
                    style={({ pressed }) => [
                      styles.saveButton,
                      pressed && styles.pressed,
                      saving && styles.disabledButton,
                    ]}
                  >
                    {saving ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveButtonText}>
                        {editingHospital
                          ? "Save changes"
                          : "Add hospital"}
                      </Text>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={closeForm}
                    disabled={saving}
                    style={styles.cancelButton}
                  >
                    <Text style={styles.cancelButtonText}>
                      Cancel
                    </Text>
                  </Pressable>
                </ScrollView>
              </>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F6F8F6",
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 15,
    paddingBottom: 35,
  },
  header: {
    marginBottom: 20,
  },
  headerText: {
    gap: 5,
  },
  eyebrow: {
    color: "#8A988F",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  title: {
    color: "#1B2C22",
    fontSize: 23,
    fontWeight: "900",
  },
  subtitle: {
    color: "#89948D",
    fontSize: 12,
    lineHeight: 18,
  },
  summaryCard: {
    backgroundColor: "#176B45",
    borderRadius: 19,
    padding: 19,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  summaryLabel: {
    color: "#D8EDE1",
    fontSize: 11,
    fontWeight: "600",
  },
  summaryNumber: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 5,
  },
  summaryDivider: {
    width: 1,
    height: 43,
    backgroundColor: "#5B9275",
    marginHorizontal: 23,
  },
  summaryIcon: {
    marginLeft: "auto",
  },
  summaryEmoji: {
    fontSize: 35,
  },
  addButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "#176B45",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 17,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  searchContainer: {
    minHeight: 49,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7ECE8",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    marginBottom: 19,
  },
  searchIcon: {
    fontSize: 25,
    color: "#75857A",
    marginRight: 9,
  },
  searchInput: {
    flex: 1,
    color: "#203329",
    fontSize: 12,
    paddingVertical: 10,
  },
  filterHeading: {
    color: "#34483B",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 9,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 17,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7ECE8",
  },
  filterButtonActive: {
    backgroundColor: "#176B45",
    borderColor: "#176B45",
  },
  filterText: {
    color: "#65736A",
    fontSize: 11,
    fontWeight: "700",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  townFilters: {
    gap: 8,
    paddingBottom: 17,
  },
  townFilter: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7ECE8",
  },
  townFilterActive: {
    backgroundColor: "#E4F2E9",
    borderColor: "#176B45",
  },
  townFilterText: {
    color: "#65736A",
    fontSize: 11,
    fontWeight: "700",
  },
  townFilterTextActive: {
    color: "#176B45",
  },
  listHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 13,
  },
  listTitle: {
    color: "#1B2C22",
    fontSize: 16,
    fontWeight: "900",
  },
  listCount: {
    color: "#89948D",
    fontSize: 11,
  },
  loadingContainer: {
    paddingVertical: 45,
    alignItems: "center",
  },
  loadingText: {
    color: "#89948D",
    fontSize: 12,
    marginTop: 10,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EAF0EB",
  },
  emptyIcon: {
    fontSize: 38,
  },
  emptyTitle: {
    color: "#203329",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 12,
  },
  emptyDescription: {
    color: "#89948D",
    fontSize: 11,
    textAlign: "center",
    marginTop: 6,
  },
  hospitalList: {
    gap: 12,
  },
  hospitalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    padding: 15,
    borderWidth: 1,
    borderColor: "#E8EEE9",
  },
  hospitalTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 13,
  },
  hospitalIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: "#EAF4FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 11,
  },
  hospitalEmoji: {
    fontSize: 22,
  },
  hospitalInfo: {
    flex: 1,
  },
  hospitalName: {
    color: "#203329",
    fontSize: 13,
    fontWeight: "900",
  },
  hospitalType: {
    color: "#89948D",
    fontSize: 10,
    marginTop: 4,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  activeBadge: {
    backgroundColor: "#E7F5EB",
  },
  inactiveBadge: {
    backgroundColor: "#FFF0F0",
  },
  statusText: {
    fontSize: 9,
    fontWeight: "800",
  },
  activeText: {
    color: "#267848",
  },
  inactiveText: {
    color: "#BC3A3A",
  },
  detailLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  detailIcon: {
    width: 22,
    fontSize: 12,
  },
  detailText: {
    flex: 1,
    color: "#66746B",
    fontSize: 11,
    lineHeight: 17,
  },
  gpsInfo: {
    marginTop: 3,
    marginBottom: 12,
  },
  gpsText: {
    color: "#718478",
    fontSize: 10,
    fontWeight: "600",
  },
  cardActions: {
    flexDirection: "row",
    gap: 7,
    borderTopWidth: 1,
    borderTopColor: "#EDF1EE",
    paddingTop: 12,
  },
  actionButton: {
    flex: 1,
    minHeight: 35,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 9,
  },
  editButton: {
    backgroundColor: "#EAF4FF",
  },
  editButtonText: {
    color: "#1877C9",
    fontSize: 10,
    fontWeight: "800",
  },
  deactivateButton: {
    backgroundColor: "#FFF7E5",
  },
  deactivateText: {
    color: "#9B701B",
    fontSize: 10,
    fontWeight: "800",
  },
  activateButton: {
    backgroundColor: "#E7F5EB",
  },
  activateText: {
    color: "#267848",
    fontSize: 10,
    fontWeight: "800",
  },
  deleteButton: {
    backgroundColor: "#FFF0F0",
  },
  deleteButtonText: {
    color: "#BC3A3A",
    fontSize: 10,
    fontWeight: "800",
  },
  footer: {
    textAlign: "center",
    color: "#A0AAA3",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 25,
  },
  pressed: {
    opacity: 0.75,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: "#F6F8F6",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 19,
    paddingVertical: 17,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E9EFEB",
  },
  modalTitle: {
    color: "#1B2C22",
    fontSize: 19,
    fontWeight: "900",
  },
  modalSubtitle: {
    color: "#89948D",
    fontSize: 11,
    marginTop: 4,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#EEF2EF",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    color: "#43544A",
    fontSize: 17,
    fontWeight: "700",
  },
  formContent: {
    padding: 19,
    paddingBottom: 45,
  },
  inputLabel: {
    color: "#34483B",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 15,
  },
  input: {
    minHeight: 49,
    backgroundColor: "#FFFFFF",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#E3EAE5",
    paddingHorizontal: 13,
    color: "#203329",
    fontSize: 12,
  },
  selectInput: {
    minHeight: 49,
    backgroundColor: "#FFFFFF",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#E3EAE5",
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: {
    color: "#203329",
    fontSize: 12,
  },
  selectPlaceholder: {
    color: "#9AA59E",
    fontSize: 12,
  },
  selectArrow: {
    color: "#65736A",
    fontSize: 19,
  },
  typeOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeOption: {
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAE5",
  },
  typeOptionActive: {
    backgroundColor: "#E5F2E9",
    borderColor: "#176B45",
  },
  typeOptionText: {
    color: "#65736A",
    fontSize: 11,
    fontWeight: "700",
  },
  typeOptionTextActive: {
    color: "#176B45",
  },
  formSectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 25,
  },
  formSectionTitle: {
    color: "#203329",
    fontSize: 14,
    fontWeight: "900",
  },
  optionalText: {
    color: "#89948D",
    fontSize: 10,
  },
  helperText: {
    color: "#89948D",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 6,
  },
  descriptionInput: {
    minHeight: 105,
    paddingTop: 13,
  },
  saveButton: {
    minHeight: 52,
    backgroundColor: "#176B45",
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 25,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.6,
  },
  cancelButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  cancelButtonText: {
    color: "#718078",
    fontSize: 12,
    fontWeight: "700",
  },
  pickerScreen: {
    flex: 1,
    backgroundColor: "#F6F8F6",
  },
  pickerContent: {
    flex: 1,
    padding: 19,
    minHeight: 0,
  },
  pickerSearch: {
    minHeight: 49,
    backgroundColor: "#FFFFFF",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#E3EAE5",
    paddingHorizontal: 13,
    color: "#203329",
    fontSize: 13,
    marginBottom: 12,
  },
  pickerList: {
    flex: 1,
    minHeight: 0,
  },
  pickerListContent: {
    paddingBottom: 25,
  },
  pickerTown: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 11,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E9EFEB",
  },
  pickerTownSelected: {
    backgroundColor: "#EAF4EE",
    borderColor: "#176B45",
  },
  pickerTownText: {
    color: "#34483B",
    fontSize: 13,
    fontWeight: "600",
  },
  pickerTownTextSelected: {
    color: "#176B45",
    fontWeight: "800",
  },
  pickerCheck: {
    color: "#176B45",
    fontSize: 19,
    fontWeight: "900",
  },
  noTownsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  noTownText: {
    textAlign: "center",
    color: "#34483B",
    fontWeight: "800",
    padding: 10,
    fontSize: 14,
  },
  noTownHint: {
    textAlign: "center",
    color: "#89948D",
    fontSize: 11,
    lineHeight: 17,
  },
});
