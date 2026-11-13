
import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Keyboard,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
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

type EmergencyContact = {
  id: string;
  town_id: string;
  contact_type: string;
  name: string;
  phone: string;
  address: string | null;
  description: string | null;
  is_published: boolean;
  created_at: string;
};

type ContactForm = {
  town_id: string;
  contact_type: string;
  name: string;
  phone: string;
  address: string;
  description: string;
  is_published: boolean;
};

const emptyForm: ContactForm = {
  town_id: "",
  contact_type: "security",
  name: "",
  phone: "",
  address: "",
  description: "",
  is_published: true,
};

// Display labels are friendly; values match Supabase exactly.
const contactTypes = [
  { label: "Police", value: "police" },
  { label: "Security", value: "security" },
  { label: "Medical", value: "medical" },
  { label: "Other", value: "other" },
];

export default function EmergencyScreen() {
  const [towns, setTowns] = useState<Town[]>([]);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formVisible, setFormVisible] = useState(false);
  const [townPickerVisible, setTownPickerVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ContactForm>(emptyForm);

  const [search, setSearch] = useState("");
  const [townSearch, setTownSearch] = useState("");

  const loadData = useCallback(async () => {
    try {
      const { data: townsData, error: townsError } = await supabase
        .from("towns")
        .select("id, name")
        .order("name", { ascending: true });

      if (townsError) throw townsError;

      const { data: contactsData, error: contactsError } = await supabase
        .from("emergency_contacts")
        .select("*")
        .order("created_at", { ascending: false });

      if (contactsError) throw contactsError;

      setTowns(townsData ?? []);
      setContacts(contactsData ?? []);
    } catch (error: any) {
      console.error("Emergency loading error:", error);

      Alert.alert(
        "Loading error",
        error.message ?? "Could not load emergency information."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateForm = (key: keyof ContactForm, value: any) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const openAddForm = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setTownPickerVisible(false);
    setTownSearch("");
    setFormVisible(true);
  };

  const openEditForm = (contact: EmergencyContact) => {
    setEditingId(contact.id);

    setForm({
      town_id: contact.town_id,
      contact_type: contact.contact_type,
      name: contact.name ?? "",
      phone: contact.phone ?? "",
      address: contact.address ?? "",
      description: contact.description ?? "",
      is_published: contact.is_published,
    });

    setTownPickerVisible(false);
    setTownSearch("");
    setFormVisible(true);
  };

  const openTownPicker = () => {
    Keyboard.dismiss();
    setTownSearch("");
    setTownPickerVisible((previous) => !previous);
  };

  const saveContact = async () => {
    if (!form.town_id || !form.name.trim() || !form.phone.trim()) {
      Alert.alert(
        "Missing information",
        "Please select a town and enter the contact name and phone number."
      );
      return;
    }

    // Ensure the value sent to Supabase is one of its permitted values.
    const allowedTypes = ["police", "security", "medical", "other"];

    if (!allowedTypes.includes(form.contact_type)) {
      Alert.alert(
        "Invalid category",
        "Please select Police, Security, Medical, or Other."
      );
      return;
    }

    setSaving(true);

    try {
      const payload = {
        town_id: form.town_id,
        contact_type: form.contact_type,
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim() || null,
        description: form.description.trim() || null,
        is_published: form.is_published,
      };

      const result = editingId
        ? await supabase
            .from("emergency_contacts")
            .update(payload)
            .eq("id", editingId)
            .select()
        : await supabase
            .from("emergency_contacts")
            .insert(payload)
            .select();

      if (result.error) throw result.error;

      if (!result.data || result.data.length === 0) {
        throw new Error(
          "No contact was saved. Check your admin permissions."
        );
      }

      const wasEditing = Boolean(editingId);

      setFormVisible(false);
      setTownPickerVisible(false);
      setEditingId(null);
      setForm({ ...emptyForm });

      await loadData();

      Alert.alert(
        "Success",
        wasEditing
          ? "Contact updated successfully."
          : "Contact added successfully."
      );
    } catch (error: any) {
      console.error("Save contact error:", error);

      Alert.alert(
        "Error",
        error.message ?? "Could not save contact."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteContact = (contact: EmergencyContact) => {
    Alert.alert(
      "Delete contact",
      `Are you sure you want to delete ${contact.name}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const { data, error } = await supabase
              .from("emergency_contacts")
              .delete()
              .eq("id", contact.id)
              .select("id");

            if (error) {
              Alert.alert("Error", error.message);
              return;
            }

            if (!data || data.length === 0) {
              Alert.alert(
                "Not deleted",
                "The contact was not deleted. Check your admin permissions."
              );
              return;
            }

            await loadData();

            Alert.alert(
              "Deleted",
              "Emergency contact deleted successfully."
            );
          },
        },
      ]
    );
  };

  const togglePublished = async (contact: EmergencyContact) => {
    const { data, error } = await supabase
      .from("emergency_contacts")
      .update({
        is_published: !contact.is_published,
      })
      .eq("id", contact.id)
      .select("id");

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    if (!data || data.length === 0) {
      Alert.alert(
        "Not updated",
        "The publishing status could not be changed."
      );
      return;
    }

    await loadData();
  };

  const selectedTown = towns.find(
    (town) => town.id === form.town_id
  );

  const filteredContacts = contacts.filter((contact) => {
    const townName =
      towns.find((town) => town.id === contact.town_id)?.name ?? "";

    const query = search.toLowerCase();

    return (
      contact.name.toLowerCase().includes(query) ||
      contact.phone.toLowerCase().includes(query) ||
      townName.toLowerCase().includes(query) ||
      contact.contact_type.toLowerCase().includes(query)
    );
  });

  const filteredTowns = towns.filter((town) =>
    town.name.toLowerCase().includes(townSearch.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Emergency & Security
        </Text>

        <Text style={styles.headerSubtitle}>
          Manage emergency contacts for your communities.
        </Text>
      </View>

      <View style={styles.summary}>
        <View>
          <Text style={styles.summaryNumber}>
            {contacts.length}
          </Text>
          <Text style={styles.summaryLabel}>
            Total contacts
          </Text>
        </View>

        <View>
          <Text style={styles.summaryNumber}>
            {contacts.filter((item) => item.is_published).length}
          </Text>
          <Text style={styles.summaryLabel}>
            Published
          </Text>
        </View>

        <View>
          <Text style={styles.summaryNumber}>
            {towns.length}
          </Text>
          <Text style={styles.summaryLabel}>
            Towns
          </Text>
        </View>
      </View>

      <Pressable
        style={styles.addButton}
        onPress={openAddForm}
      >
        <Text style={styles.addButtonText}>
          + Add Emergency Contact
        </Text>
      </Pressable>

      <TextInput
        style={styles.searchInput}
        placeholder="Search contacts or towns..."
        placeholderTextColor="#8A968E"
        value={search}
        onChangeText={setSearch}
      />

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#176B43"
          style={{ marginTop: 40 }}
        />
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadData();
              }}
            />
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No emergency contacts found.
            </Text>
          }
          renderItem={({ item }) => {
            const townName =
              towns.find((town) => town.id === item.town_id)?.name ??
              "Unknown town";

            const typeLabel =
              contactTypes.find(
                (type) => type.value === item.contact_type
              )?.label ?? item.contact_type;

            return (
              <View style={styles.contactCard}>
                <View style={styles.contactTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactName}>
                      {item.name}
                    </Text>

                    <Text style={styles.contactType}>
                      {typeLabel} · {townName}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      item.is_published
                        ? styles.published
                        : styles.unpublished,
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {item.is_published ? "Published" : "Hidden"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.contactPhone}>
                  {item.phone}
                </Text>

                {!!item.address && (
                  <Text style={styles.contactDetail}>
                    {item.address}
                  </Text>
                )}

                {!!item.description && (
                  <Text style={styles.contactDetail}>
                    {item.description}
                  </Text>
                )}

                <View style={styles.contactActions}>
                  <Pressable
                    style={styles.editButton}
                    onPress={() => openEditForm(item)}
                  >
                    <Text style={styles.editButtonText}>
                      Edit
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.publishButton}
                    onPress={() => togglePublished(item)}
                  >
                    <Text style={styles.publishButtonText}>
                      {item.is_published ? "Hide" : "Publish"}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.deleteButton}
                    onPress={() => deleteContact(item)}
                  >
                    <Text style={styles.deleteButtonText}>
                      Delete
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* ADD / EDIT CONTACT FORM */}
      <Modal
        visible={formVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setFormVisible(false);
          setTownPickerVisible(false);
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingId ? "Edit Contact" : "Add Contact"}
            </Text>

            <Pressable
              onPress={() => {
                setFormVisible(false);
                setTownPickerVisible(false);
              }}
            >
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            contentContainerStyle={styles.formContent}
          >
            <Text style={styles.label}>Town</Text>

            {/* TOWN SELECTOR */}
            <Pressable
              style={styles.selectInput}
              onPress={openTownPicker}
            >
              <Text
                style={
                  selectedTown
                    ? styles.selectText
                    : styles.placeholderText
                }
              >
                {selectedTown?.name ?? "Select a town"}
              </Text>

              <Text style={styles.dropdownArrow}>
                {townPickerVisible ? "⌃" : "⌄"}
              </Text>
            </Pressable>

            {/* INLINE TOWN LIST */}
            {townPickerVisible && (
              <View style={styles.townDropdown}>
                <TextInput
                  style={styles.townSearch}
                  placeholder="Search available towns..."
                  placeholderTextColor="#8A968E"
                  value={townSearch}
                  onChangeText={setTownSearch}
                />

                {towns.length === 0 ? (
                  <Text style={styles.emptyText}>
                    No towns found. Check your Supabase connection.
                  </Text>
                ) : filteredTowns.length === 0 ? (
                  <Text style={styles.emptyText}>
                    No matching towns found.
                  </Text>
                ) : (
                  <ScrollView
                    style={styles.townList}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator
                  >
                    {filteredTowns.map((town) => (
                      <Pressable
                        key={town.id}
                        style={[
                          styles.townOption,
                          form.town_id === town.id &&
                            styles.townOptionSelected,
                        ]}
                        onPress={() => {
                          updateForm("town_id", town.id);
                          setTownPickerVisible(false);
                          setTownSearch("");
                          Keyboard.dismiss();
                        }}
                      >
                        <Text
                          style={[
                            styles.townOptionText,
                            form.town_id === town.id &&
                              styles.townOptionTextSelected,
                          ]}
                        >
                          {town.name}
                        </Text>

                        {form.town_id === town.id && (
                          <Text style={styles.selectedCheck}>
                            ✓
                          </Text>
                        )}
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            <Text style={styles.label}>
              Contact category
            </Text>

            <View style={styles.typeContainer}>
              {contactTypes.map((type) => (
                <Pressable
                  key={type.value}
                  style={[
                    styles.typeButton,
                    form.contact_type === type.value &&
                      styles.typeButtonActive,
                  ]}
                  onPress={() =>
                    updateForm("contact_type", type.value)
                  }
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      form.contact_type === type.value &&
                        styles.typeButtonTextActive,
                    ]}
                  >
                    {type.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Contact name</Text>

            <TextInput
              style={styles.input}
              placeholder="Enter contact name"
              value={form.name}
              onChangeText={(value) =>
                updateForm("name", value)
              }
            />

            <Text style={styles.label}>Phone number</Text>

            <TextInput
              style={styles.input}
              placeholder="Enter phone number"
              keyboardType="phone-pad"
              value={form.phone}
              onChangeText={(value) =>
                updateForm("phone", value)
              }
            />

            <Text style={styles.label}>
              Address (optional)
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Enter address"
              value={form.address}
              onChangeText={(value) =>
                updateForm("address", value)
              }
            />

            <Text style={styles.label}>
              Description (optional)
            </Text>

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter additional information"
              multiline
              value={form.description}
              onChangeText={(value) =>
                updateForm("description", value)
              }
            />

            <View style={styles.switchRow}>
              <Text style={styles.label}>
                Publish contact
              </Text>

              <Switch
                value={form.is_published}
                onValueChange={(value) =>
                  updateForm("is_published", value)
                }
                trackColor={{
                  false: "#D5DDD8",
                  true: "#8BC7A5",
                }}
                thumbColor={
                  form.is_published ? "#176B43" : "#F4F4F4"
                }
              />
            </View>

            <Pressable
              style={[
                styles.saveButton,
                saving && { opacity: 0.6 },
              ]}
              onPress={saveContact}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {editingId ? "Save Changes" : "Add Contact"}
                </Text>
              )}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F8F6",
    paddingHorizontal: 18,
  },
  header: {
    paddingTop: 15,
    paddingBottom: 18,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#173D2B",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#748078",
    marginTop: 5,
  },
  summary: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 17,
    marginBottom: 15,
  },
  summaryNumber: {
    fontSize: 22,
    fontWeight: "800",
    color: "#176B43",
  },
  summaryLabel: {
    fontSize: 11,
    color: "#748078",
    marginTop: 3,
  },
  addButton: {
    backgroundColor: "#176B43",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 13,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  searchInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 48,
    marginBottom: 14,
    color: "#173D2B",
  },
  emptyText: {
    textAlign: "center",
    color: "#7A887F",
    padding: 20,
  },
  contactCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    padding: 16,
    marginBottom: 12,
  },
  contactTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  contactName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#173D2B",
  },
  contactType: {
    fontSize: 12,
    color: "#748078",
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
  },
  published: {
    backgroundColor: "#E4F4E9",
  },
  unpublished: {
    backgroundColor: "#FCECE8",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#176B43",
  },
  contactPhone: {
    fontSize: 15,
    fontWeight: "700",
    color: "#176B43",
    marginTop: 13,
  },
  contactDetail: {
    fontSize: 12,
    color: "#748078",
    marginTop: 6,
  },
  contactActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 15,
  },
  editButton: {
    backgroundColor: "#E9F2EC",
    padding: 10,
    borderRadius: 8,
    flex: 1,
    alignItems: "center",
  },
  editButtonText: {
    color: "#176B43",
    fontWeight: "700",
  },
  publishButton: {
    backgroundColor: "#EDF2F5",
    padding: 10,
    borderRadius: 8,
    flex: 1,
    alignItems: "center",
  },
  publishButtonText: {
    color: "#385A70",
    fontWeight: "700",
  },
  deleteButton: {
    backgroundColor: "#FCECE8",
    padding: 10,
    borderRadius: 8,
    flex: 1,
    alignItems: "center",
  },
  deleteButtonText: {
    color: "#B54132",
    fontWeight: "700",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#F5F8F6",
  },
  modalHeader: {
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#173D2B",
  },
  closeText: {
    color: "#176B43",
    fontWeight: "700",
  },
  formContent: {
    padding: 20,
    paddingBottom: 45,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#294A37",
    marginBottom: 8,
    marginTop: 15,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E9E3",
    borderRadius: 11,
    paddingHorizontal: 14,
    minHeight: 49,
    color: "#173D2B",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
    paddingTop: 13,
  },
  selectInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E9E3",
    borderRadius: 11,
    paddingHorizontal: 14,
    height: 49,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: {
    color: "#173D2B",
    fontSize: 14,
  },
  placeholderText: {
    color: "#929C95",
    fontSize: 14,
  },
  dropdownArrow: {
    color: "#176B43",
    fontSize: 22,
  },
  typeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeButton: {
    borderWidth: 1,
    borderColor: "#DCE7DF",
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
  },
  typeButtonActive: {
    backgroundColor: "#176B43",
    borderColor: "#176B43",
  },
  typeButtonText: {
    fontSize: 12,
    color: "#526359",
    fontWeight: "600",
  },
  typeButtonTextActive: {
    color: "#FFFFFF",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 15,
  },
  saveButton: {
    backgroundColor: "#176B43",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 25,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  // INLINE TOWN DROPDOWN
  townDropdown: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE7DF",
    borderRadius: 11,
    marginTop: 6,
    overflow: "hidden",
  },
  townSearch: {
    height: 45,
    backgroundColor: "#F3F7F4",
    borderRadius: 9,
    margin: 10,
    paddingHorizontal: 13,
    color: "#173D2B",
  },
  townList: {
    maxHeight: 250,
  },
  townOption: {
    minHeight: 50,
    borderTopWidth: 1,
    borderTopColor: "#EDF1EE",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
  },
  townOptionSelected: {
    backgroundColor: "#EAF5EE",
  },
  townOptionText: {
    fontSize: 14,
    color: "#294A37",
  },
  townOptionTextSelected: {
    color: "#176B43",
    fontWeight: "800",
  },
  selectedCheck: {
    color: "#176B43",
    fontSize: 18,
    fontWeight: "800",
  },
});
