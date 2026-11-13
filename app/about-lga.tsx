
import * as ImagePicker from "expo-image-picker";
import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";

type TabKey = "sections" | "communities" | "history" | "gallery";

type TableName =
  | "lga_about_sections"
  | "lga_communities"
  | "lga_history_events"
  | "lga_heritage_media";

type RecordItem = {
  id: string;
  title?: string;
  name?: string;
  slug?: string;
  short_description?: string;
  content?: string;
  community_type?: string;
  parent_id?: string | null;
  description?: string;
  event_year?: string;
  image_url?: string;
  category?: string;
  display_order?: number;
  is_published?: boolean;
};

const tabs: { key: TabKey; label: string }[] = [
  { key: "sections", label: "Sections" },
  { key: "communities", label: "Communities" },
  { key: "history", label: "History" },
  { key: "gallery", label: "Gallery" },
];

const tableForTab: Record<TabKey, TableName> = {
  sections: "lga_about_sections",
  communities: "lga_communities",
  history: "lga_history_events",
  gallery: "lga_heritage_media",
};

const emptyForm = {
  title: "",
  slug: "",
  name: "",
  short_description: "",
  content: "",
  community_type: "town",
  parent_id: "",
  description: "",
  event_year: "",
  image_url: "",
  category: "heritage",
  display_order: "0",
};

export default function AboutLgaScreen() {
  const { theme } = useAppTheme();
  const styles = createStyles(theme);

  const [activeTab, setActiveTab] = useState<TabKey>("sections");
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const currentTable = tableForTab[activeTab];

  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from(currentTable)
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;

      setRecords((data ?? []) as RecordItem[]);
    } catch (error: any) {
      Alert.alert(
        "Unable to load information",
        error.message ?? "Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [currentTable]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const updateForm = (key: keyof typeof emptyForm, value: string) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const openNewForm = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setModalVisible(true);
  };

  const openEditForm = (item: RecordItem) => {
    setEditingId(item.id);

    setForm({
      ...emptyForm,
      title: item.title ?? "",
      slug: item.slug ?? "",
      name: item.name ?? "",
      short_description: item.short_description ?? "",
      content: item.content ?? "",
      community_type: item.community_type ?? "town",
      parent_id: item.parent_id ?? "",
      description: item.description ?? "",
      event_year: item.event_year ?? "",
      image_url: item.image_url ?? "",
      category: item.category ?? "heritage",
      display_order: String(item.display_order ?? 0),
    });

    setModalVisible(true);
  };

  const pickImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission required",
          "Please allow access to your photo library."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];

      setSaving(true);

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const extension = asset.uri.split(".").pop()?.split("?")[0] || "jpg";
      const filePath = `about-lga/${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("government-images")
        .upload(filePath, blob, {
          contentType: asset.mimeType || "image/jpeg",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("government-images")
        .getPublicUrl(filePath);

      updateForm("image_url", data.publicUrl);

      Alert.alert("Image uploaded", "Your image is ready to use.");
    } catch (error: any) {
      Alert.alert(
        "Image upload failed",
        error.message ?? "Unable to upload this image."
      );
    } finally {
      setSaving(false);
    }
  };

  const saveRecord = async () => {
    const isCommunity = activeTab === "communities";
    const isHistory = activeTab === "history";
    const isGallery = activeTab === "gallery";

    if (isCommunity && !form.name.trim()) {
      Alert.alert("Required", "Please enter the community name.");
      return;
    }

    if (!isCommunity && !form.title.trim()) {
      Alert.alert("Required", "Please enter a title.");
      return;
    }

    if (activeTab === "sections" && !form.slug.trim()) {
      Alert.alert("Required", "Please enter a unique section slug.");
      return;
    }

    if (isGallery && !form.image_url.trim()) {
      Alert.alert("Required", "Please upload or provide an image URL.");
      return;
    }

    if (isHistory && !form.description.trim()) {
      Alert.alert("Required", "Please enter the historical event description.");
      return;
    }

    try {
      setSaving(true);

      let payload: Record<string, any> = {
        display_order: Number(form.display_order) || 0,
      };

      if (activeTab === "sections") {
        payload = {
          ...payload,
          title: form.title.trim(),
          slug: form.slug.trim().toLowerCase().replace(/\s+/g, "-"),
          short_description: form.short_description.trim() || null,
          content: form.content.trim() || null,
          image_url: form.image_url.trim() || null,
        };
      }

      if (isCommunity) {
        payload = {
          ...payload,
          name: form.name.trim(),
          community_type: form.community_type,
          parent_id: form.parent_id.trim() || null,
          description: form.description.trim() || null,
          image_url: form.image_url.trim() || null,
        };
      }

      if (isHistory) {
        payload = {
          ...payload,
          title: form.title.trim(),
          event_year: form.event_year.trim() || null,
          description: form.description.trim(),
          image_url: form.image_url.trim() || null,
        };
      }

      if (isGallery) {
        payload = {
          ...payload,
          title: form.title.trim(),
          description: form.description.trim() || null,
          image_url: form.image_url.trim(),
          category: form.category.trim() || "heritage",
        };
      }

      let result;

      if (editingId) {
        result = await supabase
          .from(currentTable)
          .update(payload)
          .eq("id", editingId);
      } else {
        result = await supabase
          .from(currentTable)
          .insert(payload);
      }

      if (result.error) throw result.error;

      setModalVisible(false);
      setForm({ ...emptyForm });

      Alert.alert(
        "Saved",
        editingId
          ? "Your information has been updated."
          : "Your information has been added. Publish it when ready."
      );

      await loadRecords();
    } catch (error: any) {
      Alert.alert(
        "Save failed",
        error.message ?? "Unable to save this information."
      );
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (item: RecordItem) => {
    try {
      const { error } = await supabase
        .from(currentTable)
        .update({ is_published: !item.is_published })
        .eq("id", item.id);

      if (error) throw error;

      await loadRecords();

      Alert.alert(
        "Updated",
        item.is_published
          ? "This information is now unpublished."
          : "This information is now published."
      );
    } catch (error: any) {
      Alert.alert("Update failed", error.message);
    }
  };

  const deleteRecord = (item: RecordItem) => {
    const label = item.name ?? item.title ?? "this record";

    Alert.alert(
      "Delete information?",
      `Are you sure you want to delete ${label}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from(currentTable)
                .delete()
                .eq("id", item.id);

              if (error) throw error;

              await loadRecords();
            } catch (error: any) {
              Alert.alert("Delete failed", error.message);
            }
          },
        },
      ]
    );
  };

  const getRecordTitle = (item: RecordItem) =>
    item.name ?? item.title ?? "Untitled";

  const renderRecord = ({ item }: { item: RecordItem }) => (
    <View style={styles.recordCard}>
      {item.image_url ? (
        <Image
          source={{ uri: item.image_url }}
          style={styles.recordImage}
        />
      ) : null}

      <View style={styles.recordContent}>
        <Text style={styles.recordTitle}>{getRecordTitle(item)}</Text>

        {activeTab === "communities" ? (
          <Text style={styles.recordDescription}>
            {item.community_type}
            {item.parent_id ? " • Has a parent community" : ""}
          </Text>
        ) : null}

        {activeTab === "history" && item.event_year ? (
          <Text style={styles.recordDescription}>
            Year: {item.event_year}
          </Text>
        ) : null}

        <Text style={styles.recordDescription}>
          {item.short_description ||
            item.description ||
            item.slug ||
            item.content?.slice(0, 100) ||
            "No short description"}
        </Text>

        <View style={styles.recordFooter}>
          <View
            style={[
              styles.statusBadge,
              item.is_published
                ? styles.publishedBadge
                : styles.draftBadge,
            ]}
          >
            <Text style={styles.statusText}>
              {item.is_published ? "Published" : "Draft"}
            </Text>
          </View>

          <Text style={styles.orderText}>
            Order: {item.display_order ?? 0}
          </Text>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={styles.editButton}
            onPress={() => openEditForm(item)}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>

          <Pressable
            style={styles.publishButton}
            onPress={() => togglePublished(item)}
          >
            <Text style={styles.publishButtonText}>
              {item.is_published ? "Unpublish" : "Publish"}
            </Text>
          </Pressable>

          <Pressable
            style={styles.deleteButton}
            onPress={() => deleteRecord(item)}
          >
            <Text style={styles.deleteButtonText}>Delete</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  const renderField = (
    label: string,
    key: keyof typeof emptyForm,
    placeholder: string,
    multiline = false
  ) => (
    <View style={styles.fieldContainer} key={key}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          multiline && styles.multilineInput,
        ]}
        value={form[key]}
        onChangeText={(value) => updateForm(key, value)}
        placeholder={placeholder}
        placeholderTextColor={theme.secondaryText}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        autoCapitalize={key === "slug" ? "none" : "sentences"}
      />
    </View>
  );

  const renderCommunityType = () => (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>Community Type</Text>

      <View style={styles.choiceRow}>
        {["town", "district", "village"].map((type) => (
          <Pressable
            key={type}
            onPress={() => updateForm("community_type", type)}
            style={[
              styles.choiceButton,
              form.community_type === type && styles.choiceSelected,
            ]}
          >
            <Text
              style={[
                styles.choiceText,
                form.community_type === type && styles.choiceSelectedText,
              ]}
            >
              {type}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderForm = () => (
    <Modal
      visible={modalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {editingId ? "Edit Information" : "Add Information"}
          </Text>

          <Pressable onPress={() => setModalVisible(false)}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.modalContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {activeTab === "sections" ? (
            <>
              {renderField("Section Title", "title", "e.g. Our History")}
              {renderField("Section Slug", "slug", "e.g. our-history")}
              {renderField(
                "Short Description",
                "short_description",
                "A brief introduction",
                true
              )}
              {renderField(
                "Full Content",
                "content",
                "Write the complete information here...",
                true
              )}
            </>
          ) : null}

          {activeTab === "communities" ? (
            <>
              {renderField("Community Name", "name", "Enter the name")}
              {renderCommunityType()}
              {renderField(
                "Parent Community ID",
                "parent_id",
                "Optional: enter the parent record UUID"
              )}
              {renderField(
                "Description",
                "description",
                "Describe this community...",
                true
              )}
            </>
          ) : null}

          {activeTab === "history" ? (
            <>
              {renderField("Event Title", "title", "Historical event title")}
              {renderField("Year or Period", "event_year", "e.g. 1991")}
              {renderField(
                "Event Description",
                "description",
                "Describe this historical event...",
                true
              )}
            </>
          ) : null}

          {activeTab === "gallery" ? (
            <>
              {renderField("Photo Title", "title", "Enter a photo title")}
              {renderField(
                "Description",
                "description",
                "Describe this photograph...",
                true
              )}
              {renderField("Category", "category", "e.g. culture, heritage")}
            </>
          ) : null}

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Photograph</Text>

            <Pressable
              style={styles.uploadButton}
              onPress={pickImage}
              disabled={saving}
            >
              <Text style={styles.uploadButtonText}>
                {saving ? "Uploading..." : "Choose and Upload Image"}
              </Text>
            </Pressable>

            {form.image_url ? (
              <Image
                source={{ uri: form.image_url }}
                style={styles.previewImage}
              />
            ) : null}

            {activeTab !== "gallery" ? (
              <Text style={styles.helperText}>
                An image is optional for this section.
              </Text>
            ) : null}
          </View>

          {renderField(
            "Display Order",
            "display_order",
            "0"
          )}

          <Pressable
            style={[
              styles.saveButton,
              saving && styles.disabledButton,
            ]}
            onPress={saveRecord}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>
                {editingId ? "Save Changes" : "Add Information"}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.heading}>About Igbo-Eze North</Text>
          <Text style={styles.subheading}>
            Manage the history, communities and heritage of our LGA.
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabContainer}
        >
          {tabs.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[
                styles.tab,
                activeTab === tab.key && styles.activeTab,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.activeTabText,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.listHeader}>
          <View>
            <Text style={styles.listTitle}>
              {tabs.find((tab) => tab.key === activeTab)?.label}
            </Text>
            <Text style={styles.countText}>
              {records.length} record{records.length === 1 ? "" : "s"}
            </Text>
          </View>

          <Pressable style={styles.addButton} onPress={openNewForm}>
            <Text style={styles.addButtonText}>+ Add New</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>Loading information...</Text>
          </View>
        ) : (
          <FlatList
            data={records}
            keyExtractor={(item) => item.id}
            renderItem={renderRecord}
            contentContainerStyle={styles.listContent}
            refreshing={loading}
            onRefresh={loadRecords}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>No information yet</Text>
                <Text style={styles.emptyText}>
                  Add your first record using the Add New button.
                </Text>
              </View>
            }
          />
        )}

        {renderForm()}
      </View>
    </>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      paddingTop: 55,
    },
    header: {
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    heading: {
      fontSize: 23,
      fontWeight: "800",
      color: theme.text,
    },
    subheading: {
      color: theme.secondaryText,
      fontSize: 13,
      marginTop: 6,
      lineHeight: 19,
    },
    tabContainer: {
      paddingHorizontal: 20,
      gap: 9,
      paddingBottom: 18,
    },
    tab: {
      paddingHorizontal: 17,
      paddingVertical: 11,
      borderRadius: 22,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    activeTab: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    tabText: {
      color: theme.text,
      fontSize: 12,
      fontWeight: "600",
    },
    activeTabText: {
      color: "#FFFFFF",
    },
    listHeader: {
      paddingHorizontal: 20,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    listTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "700",
    },
    countText: {
      color: theme.secondaryText,
      fontSize: 12,
      marginTop: 3,
    },
    addButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderRadius: 10,
    },
    addButtonText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "700",
    },
    listContent: {
      paddingHorizontal: 20,
      paddingBottom: 40,
      flexGrow: 1,
    },
    recordCard: {
      backgroundColor: theme.surface,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 13,
      overflow: "hidden",
    },
    recordImage: {
      width: "100%",
      height: 155,
      backgroundColor: theme.inputBackground,
    },
    recordContent: {
      padding: 15,
    },
    recordTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "700",
    },
    recordDescription: {
      color: theme.secondaryText,
      fontSize: 12,
      marginTop: 7,
      lineHeight: 18,
    },
    recordFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 13,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 15,
    },
    publishedBadge: {
      backgroundColor: "#DDF3E5",
    },
    draftBadge: {
      backgroundColor: "#FFF0D6",
    },
    statusText: {
      color: "#315B40",
      fontSize: 10,
      fontWeight: "700",
    },
    orderText: {
      color: theme.secondaryText,
      fontSize: 11,
    },
    actionRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 14,
    },
    editButton: {
      backgroundColor: theme.inputBackground,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 8,
    },
    editButtonText: {
      color: theme.text,
      fontSize: 11,
      fontWeight: "700",
    },
    publishButton: {
      backgroundColor: "#E2F2E8",
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 8,
    },
    publishButtonText: {
      color: "#176B45",
      fontSize: 11,
      fontWeight: "700",
    },
    deleteButton: {
      backgroundColor: "#FCE8E8",
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 8,
    },
    deleteButtonText: {
      color: "#B83232",
      fontSize: 11,
      fontWeight: "700",
    },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      color: theme.secondaryText,
      marginTop: 10,
      fontSize: 13,
    },
    emptyContainer: {
      alignItems: "center",
      paddingVertical: 65,
    },
    emptyTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: "700",
    },
    emptyText: {
      color: theme.secondaryText,
      fontSize: 12,
      marginTop: 7,
      textAlign: "center",
    },
    modalContainer: {
      flex: 1,
      backgroundColor: theme.background,
      paddingTop: 20,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingBottom: 17,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalTitle: {
      color: theme.text,
      fontSize: 19,
      fontWeight: "800",
    },
    closeText: {
      color: theme.primary,
      fontWeight: "700",
      fontSize: 14,
    },
    modalContent: {
      padding: 20,
      paddingBottom: 50,
    },
    fieldContainer: {
      marginBottom: 17,
    },
    fieldLabel: {
      color: theme.text,
      fontSize: 13,
      fontWeight: "700",
      marginBottom: 8,
    },
    input: {
      minHeight: 49,
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 13,
      color: theme.text,
      fontSize: 13,
    },
    multilineInput: {
      minHeight: 115,
      paddingTop: 12,
    },
    choiceRow: {
      flexDirection: "row",
      gap: 8,
    },
    choiceButton: {
      paddingHorizontal: 15,
      paddingVertical: 11,
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: 9,
    },
    choiceSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    choiceText: {
      color: theme.text,
      fontSize: 12,
      textTransform: "capitalize",
    },
    choiceSelectedText: {
      color: "#FFFFFF",
      fontWeight: "700",
    },
    uploadButton: {
      backgroundColor: theme.inputBackground,
      borderColor: theme.primary,
      borderWidth: 1,
      borderStyle: "dashed",
      borderRadius: 10,
      padding: 15,
      alignItems: "center",
    },
    uploadButtonText: {
      color: theme.primary,
      fontSize: 13,
      fontWeight: "700",
    },
    previewImage: {
      width: "100%",
      height: 170,
      borderRadius: 10,
      marginTop: 12,
    },
    helperText: {
      color: theme.secondaryText,
      fontSize: 11,
      marginTop: 7,
    },
    saveButton: {
      backgroundColor: theme.primary,
      minHeight: 52,
      borderRadius: 11,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 12,
    },
    disabledButton: {
      opacity: 0.6,
    },
    saveButtonText: {
      color: "#FFFFFF",
      fontWeight: "800",
      fontSize: 14,
    },
  });
