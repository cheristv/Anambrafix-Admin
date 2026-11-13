
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { supabase } from "../lib/supabase";

type Citizen = {
  id: string;
  surname: string;
  other_names: string;
  phone: string;
  email: string;
  gender: string;
  date_of_birth: string;
  town: string;
  village: string;
  state: string;
  created_at: string;
};

type CitizenField =
  | "surname"
  | "other_names"
  | "phone"
  | "email"
  | "gender"
  | "date_of_birth"
  | "town"
  | "village"
  | "state";

const fields: { key: CitizenField; label: string; placeholder: string }[] = [
  { key: "surname", label: "Surname", placeholder: "Enter surname" },
  { key: "other_names", label: "Other names", placeholder: "Enter other names" },
  { key: "phone", label: "Phone number", placeholder: "Enter phone number" },
  { key: "email", label: "Email address", placeholder: "Enter email" },
  { key: "gender", label: "Gender", placeholder: "Enter gender" },
  {
    key: "date_of_birth",
    label: "Date of birth",
    placeholder: "YYYY-MM-DD",
  },
  { key: "town", label: "Town", placeholder: "Enter town" },
  { key: "village", label: "Village", placeholder: "Enter village" },
  { key: "state", label: "State", placeholder: "Enter state" },
];

export default function CitizensScreen() {
  const [citizens, setCitizens] = useState<Citizen[]>([]);
  const [filteredCitizens, setFilteredCitizens] = useState<Citizen[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCitizen, setSelectedCitizen] = useState<Citizen | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  async function fetchCitizens() {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setCitizens((data ?? []) as Citizen[]);
    } catch (error: any) {
      Alert.alert("Unable to load citizens", error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchCitizens();
  }, []);

  useEffect(() => {
    const searchText = search.trim().toLowerCase();

    if (!searchText) {
      setFilteredCitizens(citizens);
      return;
    }

    const results = citizens.filter((citizen) => {
      const searchableText = [
        citizen.surname,
        citizen.other_names,
        citizen.phone,
        citizen.email,
        citizen.town,
        citizen.village,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(searchText);
    });

    setFilteredCitizens(results);
  }, [search, citizens]);

  function openCitizen(citizen: Citizen) {
    setSelectedCitizen({ ...citizen });
    setEditModalVisible(true);
  }

  function updateField(field: CitizenField, value: string) {
    setSelectedCitizen((previous) =>
      previous ? { ...previous, [field]: value } : previous
    );
  }

  async function saveCitizen() {
    if (!selectedCitizen) return;

    const requiredFields: CitizenField[] = [
      "surname",
      "other_names",
      "phone",
      "email",
      "gender",
      "date_of_birth",
      "town",
      "village",
      "state",
    ];

    for (const field of requiredFields) {
      if (!selectedCitizen[field]?.trim()) {
        Alert.alert("Missing information", `Please enter ${field.replace("_", " ")}.`);
        return;
      }
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedCitizen.date_of_birth)) {
      Alert.alert("Invalid date", "Use the YYYY-MM-DD format for date of birth.");
      return;
    }

    setSaving(true);

    try {
      const {
        id,
        surname,
        other_names,
        phone,
        email,
        gender,
        date_of_birth,
        town,
        village,
        state,
      } = selectedCitizen;

      const { data, error } = await supabase
        .from("profiles")
        .update({
          surname: surname.trim(),
          other_names: other_names.trim(),
          phone: phone.trim(),
          email: email.trim(),
          gender: gender.trim(),
          date_of_birth,
          town: town.trim(),
          village: village.trim(),
          state: state.trim(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      setCitizens((previous) =>
        previous.map((citizen) =>
          citizen.id === id ? (data as Citizen) : citizen
        )
      );

      setSelectedCitizen(data as Citizen);
      setEditModalVisible(false);

      Alert.alert("Updated", "Citizen information has been updated successfully.");
    } catch (error: any) {
      Alert.alert("Update failed", error.message);
    } finally {
      setSaving(false);
    }
  }

  function formatDate(date: string) {
    if (!date) return "Not available";

    return new Date(date).toLocaleDateString();
  }

  function renderCitizen({ item }: { item: Citizen }) {
    const fullName = `${item.surname} ${item.other_names}`;

    return (
      <Pressable style={styles.citizenCard} onPress={() => openCitizen(item)}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.surname?.charAt(0)?.toUpperCase() || "C"}
          </Text>
        </View>

        <View style={styles.citizenInfo}>
          <Text style={styles.citizenName}>{fullName}</Text>
          <Text style={styles.citizenDetails}>{item.phone}</Text>
          <Text style={styles.citizenDetails}>
            {item.town} · {item.village}
          </Text>
        </View>

        <Text style={styles.arrow}>›</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Citizens Management</Text>
        <Text style={styles.headerSubtitle}>
          View and manage registered citizens of Igbo-Eze North.
        </Text>
      </View>

      <View style={styles.statsCard}>
        <Text style={styles.statsLabel}>Total registered citizens</Text>
        <Text style={styles.statsNumber}>{citizens.length}</Text>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Search name, phone, email or town..."
        placeholderTextColor="#89938D"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
      />

      <View style={styles.listHeading}>
        <Text style={styles.sectionTitle}>Registered Citizens</Text>
        <Text style={styles.resultCount}>{filteredCitizens.length} found</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#087A45" />
          <Text style={styles.loadingText}>Loading citizens...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCitizens}
          keyExtractor={(item) => item.id}
          renderItem={renderCitizen}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchCitizens();
          }}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No citizens found</Text>
              <Text style={styles.emptyText}>
                Try another search or refresh the list.
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={editModalVisible}
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Citizen Details</Text>
              <Text style={styles.modalSubtitle}>
                View and update citizen information.
              </Text>
            </View>

            <Pressable
              onPress={() => setEditModalVisible(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>

          {selectedCitizen && (
            <ScrollView
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.idCard}>
                <Text style={styles.idLabel}>Citizen ID</Text>
                <Text style={styles.idValue}>{selectedCitizen.id}</Text>
                <Text style={styles.idLabel}>Registration date</Text>
                <Text style={styles.idValue}>
                  {formatDate(selectedCitizen.created_at)}
                </Text>
              </View>

              {fields.map((field) => (
                <View key={field.key} style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{field.label}</Text>
                  <TextInput
                    style={styles.input}
                    value={selectedCitizen[field.key] ?? ""}
                    onChangeText={(value) => updateField(field.key, value)}
                    placeholder={field.placeholder}
                    placeholderTextColor="#89938D"
                    autoCapitalize={
                      field.key === "email" ? "none" : "words"
                    }
                    keyboardType={
                      field.key === "phone"
                        ? "phone-pad"
                        : field.key === "email"
                          ? "email-address"
                          : "default"
                    }
                  />
                </View>
              ))}

              <Pressable
                style={[styles.saveButton, saving && styles.disabledButton]}
                onPress={saveCitizen}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.cancelButton}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F8F6",
    paddingTop: 55,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#123D2B",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#6B7770",
    marginTop: 6,
    lineHeight: 20,
  },
  statsCard: {
    backgroundColor: "#087A45",
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 18,
  },
  statsLabel: {
    color: "#E2F4E9",
    fontSize: 13,
  },
  statsNumber: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "800",
    marginTop: 7,
  },
  searchInput: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
    borderWidth: 1,
    borderColor: "#E3EAE5",
    color: "#173D2B",
    fontSize: 14,
  },
  listHeading: {
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#173D2B",
  },
  resultCount: {
    fontSize: 12,
    color: "#718078",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    flexGrow: 1,
  },
  citizenCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E9EFEB",
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#E2F2E8",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#087A45",
    fontSize: 19,
    fontWeight: "800",
  },
  citizenInfo: {
    flex: 1,
    marginLeft: 12,
  },
  citizenName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#173D2B",
  },
  citizenDetails: {
    fontSize: 12,
    color: "#718078",
    marginTop: 4,
  },
  arrow: {
    fontSize: 27,
    color: "#899B90",
    marginLeft: 8,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#718078",
    marginTop: 10,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 45,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#173D2B",
  },
  emptyText: {
    color: "#718078",
    fontSize: 13,
    marginTop: 7,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#F5F8F6",
    paddingTop: Platform.OS === "ios" ? 55 : 35,
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#123D2B",
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#718078",
    marginTop: 5,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#E6EEE9",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    color: "#173D2B",
    fontSize: 17,
    fontWeight: "700",
  },
  formContent: {
    paddingHorizontal: 20,
    paddingBottom: 50,
  },
  idCard: {
    backgroundColor: "#E8F3EC",
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  idLabel: {
    color: "#5C7666",
    fontSize: 11,
    marginBottom: 5,
  },
  idValue: {
    color: "#173D2B",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#294B38",
    marginBottom: 7,
  },
  input: {
    height: 49,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DCE7DF",
    paddingHorizontal: 13,
    color: "#173D2B",
    fontSize: 14,
  },
  saveButton: {
    height: 52,
    backgroundColor: "#087A45",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  cancelButton: {
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  cancelButtonText: {
    color: "#65756B",
    fontWeight: "600",
  },
});
