
import { Ionicons } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

type Town = {
  id: string;
  name: string;
};

type Announcement = {
  id: string;
  title: string;
  body: string;
  category: string;
  priority: string;
  state: string;
  lga: string | null;
  image_url: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
};

const CATEGORIES = [
  { label: "General", value: "general" },
  { label: "Security", value: "security" },
  { label: "Health", value: "health" },
  { label: "Education", value: "education" },
  { label: "Infrastructure", value: "infrastructure" },
  { label: "Environment", value: "environment" },
  { label: "Community", value: "community" },
  { label: "Events", value: "events" },
];

const PRIORITIES = [
  { label: "Normal", value: "normal" },
  { label: "Important", value: "important" },
  { label: "Urgent", value: "urgent" },
];

export default function AnnouncementsScreen() {
  const { theme } = useAppTheme();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [towns, setTowns] = useState<Town[]>([]);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("normal");
  const [lga, setLga] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [townPickerVisible, setTownPickerVisible] = useState(false);
  const [townSearch, setTownSearch] = useState("");

  const filteredTowns = useMemo(() => {
    const search = townSearch.trim().toLowerCase();

    if (!search) return towns;

    return towns.filter((town) =>
      town.name.toLowerCase().includes(search)
    );
  }, [towns, townSearch]);

  const loadAnnouncements = useCallback(async () => {
    try {
      const [announcementResult, townResult] = await Promise.all([
        supabase
          .from("announcements")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("towns")
          .select("id, name")
          .order("name", { ascending: true }),
      ]);

      if (announcementResult.error) {
        throw announcementResult.error;
      }

      if (townResult.error) {
        throw townResult.error;
      }

      setAnnouncements(
        (announcementResult.data ?? []) as Announcement[]
      );

      setTowns(townResult.data ?? []);
    } catch (error: any) {
      Alert.alert(
        "Loading error",
        error.message ?? "Could not load announcements."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();

    const channel = supabase
      .channel("admin-announcements")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "announcements",
        },
        () => {
          loadAnnouncements();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAnnouncements]);

  function clearForm() {
    setTitle("");
    setBody("");
    setCategory("general");
    setPriority("normal");
    setLga("");
    setImageUrl("");
    setEditingId(null);
  }

  function editAnnouncement(item: Announcement) {
    setEditingId(item.id);
    setTitle(item.title ?? "");
    setBody(item.body ?? "");
    setCategory(item.category || "general");
    setPriority(item.priority || "normal");
    setLga(item.lga || "");
    setImageUrl(item.image_url || "");

    setTownPickerVisible(false);
  }

  function selectTown(name: string) {
    setLga(name);
    setTownPickerVisible(false);
    setTownSearch("");
  }

  async function saveAnnouncement(publish: boolean) {
    if (saving) return;

    if (!title.trim() || !body.trim()) {
      Alert.alert(
        "Missing information",
        "Enter both the announcement title and message."
      );
      return;
    }

    if (imageUrl.trim() && !/^https?:\/\/\S+/i.test(imageUrl.trim())) {
      Alert.alert(
        "Invalid image URL",
        "Enter a valid image link beginning with https:// or http://."
      );
      return;
    }

    setSaving(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        Alert.alert(
          "Authentication error",
          "Please sign in again."
        );
        return;
      }

      const now = new Date().toISOString();

      const announcementData = {
        title: title.trim(),
        body: body.trim(),
        category,
        priority,
        state: "Anambra State",
        lga: lga.trim() || null,
        image_url: imageUrl.trim() || null,
        is_published: publish,
        published_at: publish ? now : null,
        updated_at: now,
      };

      let error;

      if (editingId) {
        const result = await supabase
          .from("announcements")
          .update(announcementData)
          .eq("id", editingId);

        error = result.error;
      } else {
        const result = await supabase
          .from("announcements")
          .insert({
            ...announcementData,
            created_by: authData.user.id,
          });

        error = result.error;
      }

      if (error) {
        Alert.alert("Save failed", error.message);
        return;
      }

      Alert.alert(
        "Success",
        publish
          ? "Announcement published successfully."
          : "Announcement saved as draft."
      );

      clearForm();
      await loadAnnouncements();
    } catch (error: any) {
      Alert.alert(
        "Unexpected error",
        error.message ?? "Could not save announcement."
      );
    } finally {
      setSaving(false);
    }
  }

  async function changePublication(item: Announcement) {
    const publish = !item.is_published;

    const { error } = await supabase
      .from("announcements")
      .update({
        is_published: publish,
        published_at: publish
          ? new Date().toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (error) {
      Alert.alert("Update failed", error.message);
      return;
    }

    Alert.alert(
      "Success",
      publish
        ? "Announcement is now published."
        : "Announcement has been unpublished."
    );

    await loadAnnouncements();
  }

  function deleteAnnouncement(id: string) {
    Alert.alert(
      "Delete announcement",
      "This announcement will be permanently deleted. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("announcements")
              .delete()
              .eq("id", id);

            if (error) {
              Alert.alert("Delete failed", error.message);
              return;
            }

            if (editingId === id) {
              clearForm();
            }

            await loadAnnouncements();

            Alert.alert(
              "Deleted",
              "Announcement deleted successfully."
            );
          },
        },
      ]
    );
  }

  function refreshAnnouncements() {
    setRefreshing(true);
    loadAnnouncements();
  }

  const publishedCount = announcements.filter(
    (item) => item.is_published
  ).length;

  const draftCount = announcements.length - publishedCount;

  function renderOption(
    label: string,
    selected: boolean,
    onPress: () => void
  ) {
    return (
      <Pressable
        key={label}
        onPress={onPress}
        style={[
          styles.optionButton,
          {
            backgroundColor: selected
              ? theme.primary
              : theme.inputBackground,
            borderColor: selected
              ? theme.primary
              : theme.border,
          },
        ]}
      >
        <Text
          style={{
            color: selected ? "#FFFFFF" : theme.text,
            fontSize: 12,
            fontWeight: "700",
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background },
      ]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={[
            styles.backButton,
            { backgroundColor: theme.surface },
          ]}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={theme.text}
          />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.headerTitle,
              { color: theme.text },
            ]}
          >
            Announcements
          </Text>

          <Text
            style={{
              color: theme.secondaryText,
              fontSize: 12,
              marginTop: 4,
            }}
          >
            Share important updates with citizens
          </Text>
        </View>

        <Pressable
          onPress={refreshAnnouncements}
          disabled={refreshing}
          style={[
            styles.refreshButton,
            { backgroundColor: theme.surface },
          ]}
        >
          {refreshing ? (
            <ActivityIndicator
              size="small"
              color={theme.primary}
            />
          ) : (
            <Ionicons
              name="refresh"
              size={20}
              color={theme.primary}
            />
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.statsRow}>
          <View
            style={[
              styles.statCard,
              { backgroundColor: theme.surface },
            ]}
          >
            <Text
              style={[
                styles.statNumber,
                { color: theme.text },
              ]}
            >
              {announcements.length}
            </Text>

            <Text
              style={{
                color: theme.secondaryText,
                fontSize: 12,
              }}
            >
              Total
            </Text>
          </View>

          <View
            style={[
              styles.statCard,
              { backgroundColor: theme.surface },
            ]}
          >
            <Text
              style={[
                styles.statNumber,
                { color: "#168653" },
              ]}
            >
              {publishedCount}
            </Text>

            <Text
              style={{
                color: theme.secondaryText,
                fontSize: 12,
              }}
            >
              Published
            </Text>
          </View>

          <View
            style={[
              styles.statCard,
              { backgroundColor: theme.surface },
            ]}
          >
            <Text
              style={[
                styles.statNumber,
                { color: "#B07816" },
              ]}
            >
              {draftCount}
            </Text>

            <Text
              style={{
                color: theme.secondaryText,
                fontSize: 12,
              }}
            >
              Drafts
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.formCard,
            { backgroundColor: theme.surface },
          ]}
        >
          <View style={styles.formHeading}>
            <Ionicons
              name={
                editingId
                  ? "create-outline"
                  : "megaphone-outline"
              }
              size={21}
              color={theme.primary}
            />

            <Text
              style={[
                styles.sectionTitle,
                { color: theme.text },
              ]}
            >
              {editingId
                ? "Edit announcement"
                : "Create announcement"}
            </Text>
          </View>

          <Text
            style={[
              styles.label,
              { color: theme.text },
            ]}
          >
            Title *
          </Text>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Enter announcement title"
            placeholderTextColor={theme.secondaryText}
            maxLength={150}
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBackground,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
          />

          <Text
            style={[
              styles.label,
              { color: theme.text },
            ]}
          >
            Announcement message *
          </Text>

          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Write the full announcement for citizens..."
            placeholderTextColor={theme.secondaryText}
            multiline
            textAlignVertical="top"
            style={[
              styles.messageInput,
              {
                backgroundColor: theme.inputBackground,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
          />

          <Text
            style={[
              styles.label,
              { color: theme.text },
            ]}
          >
            Category
          </Text>

          <View style={styles.optionsContainer}>
            {CATEGORIES.map((item) =>
              renderOption(
                item.label,
                category === item.value,
                () => setCategory(item.value)
              )
            )}
          </View>

          <Text
            style={[
              styles.label,
              { color: theme.text },
            ]}
          >
            Priority
          </Text>

          <View style={styles.optionsContainer}>
            {PRIORITIES.map((item) =>
              renderOption(
                item.label,
                priority === item.value,
                () => setPriority(item.value)
              )
            )}
          </View>

          <Text
            style={[
              styles.label,
              { color: theme.text },
            ]}
          >
            Target LGA
          </Text>

          <Pressable
            onPress={() => setTownPickerVisible(true)}
            style={[
              styles.selectButton,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.selectButtonContent}>
              <Ionicons
                name="location-outline"
                size={19}
                color={theme.primary}
              />

              <Text
                style={{
                  color: lga ? theme.text : theme.secondaryText,
                  fontSize: 14,
                  flex: 1,
                }}
              >
                {lga || "All LGAs"}
              </Text>
            </View>

            <Ionicons
              name="chevron-down"
              size={18}
              color={theme.secondaryText}
            />
          </Pressable>

          <Text
            style={{
              color: theme.secondaryText,
              fontSize: 11,
              marginTop: 6,
            }}
          >
            Choose an LGA or leave as All LGAs.
          </Text>

          <Text
            style={[
              styles.label,
              { color: theme.text },
            ]}
          >
            Announcement image URL (optional)
          </Text>

          <TextInput
            value={imageUrl}
            onChangeText={setImageUrl}
            placeholder="https://example.com/image.jpg"
            placeholderTextColor={theme.secondaryText}
            autoCapitalize="none"
            keyboardType="url"
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBackground,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
          />

          <Text
            style={{
              color: theme.secondaryText,
              fontSize: 11,
              marginTop: 7,
            }}
          >
            State: Anambra State
          </Text>

          <Pressable
            disabled={saving}
            onPress={() => saveAnnouncement(false)}
            style={[
              styles.draftButton,
              { borderColor: theme.primary },
              saving && styles.disabledButton,
            ]}
          >
            {saving ? (
              <ActivityIndicator color={theme.primary} />
            ) : (
              <>
                <Ionicons
                  name="save-outline"
                  size={18}
                  color={theme.primary}
                />

                <Text
                  style={{
                    color: theme.primary,
                    fontWeight: "700",
                  }}
                >
                  Save as draft
                </Text>
              </>
            )}
          </Pressable>

          <Pressable
            disabled={saving}
            onPress={() => saveAnnouncement(true)}
            style={[
              styles.publishButton,
              { backgroundColor: theme.primary },
              saving && styles.disabledButton,
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name="send"
                  size={17}
                  color="#FFFFFF"
                />

                <Text style={styles.publishText}>
                  {editingId
                    ? "Update and publish"
                    : "Publish announcement"}
                </Text>
              </>
            )}
          </Pressable>

          {editingId && (
            <Pressable
              onPress={clearForm}
              style={styles.cancelButton}
            >
              <Text
                style={{ color: theme.secondaryText }}
              >
                Cancel editing
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.listHeader}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.text },
            ]}
          >
            All announcements
          </Text>

          <Text
            style={{
              color: theme.secondaryText,
              fontSize: 12,
            }}
          >
            {announcements.length} total
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator
            color={theme.primary}
            size="large"
            style={{ marginTop: 25 }}
          />
        ) : announcements.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: theme.surface },
            ]}
          >
            <Ionicons
              name="megaphone-outline"
              size={38}
              color={theme.secondaryText}
            />

            <Text
              style={[
                styles.emptyTitle,
                { color: theme.text },
              ]}
            >
              No announcements yet
            </Text>

            <Text
              style={{
                color: theme.secondaryText,
                textAlign: "center",
              }}
            >
              Create your first announcement above.
            </Text>
          </View>
        ) : (
          announcements.map((item) => (
            <View
              key={item.id}
              style={[
                styles.announcementCard,
                { backgroundColor: theme.surface },
              ]}
            >
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.announcementTitle,
                      { color: theme.text },
                    ]}
                  >
                    {item.title}
                  </Text>

                  <Text
                    style={{
                      color: theme.secondaryText,
                      fontSize: 11,
                      marginTop: 5,
                    }}
                  >
                    Created{" "}
                    {new Date(
                      item.created_at
                    ).toLocaleDateString()}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: item.is_published
                        ? "#E2F5E9"
                        : "#FFF1D5",
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: item.is_published
                        ? "#176B45"
                        : "#986400",
                      fontWeight: "800",
                      fontSize: 10,
                    }}
                  >
                    {item.is_published
                      ? "PUBLISHED"
                      : "DRAFT"}
                  </Text>
                </View>
              </View>

              <View style={styles.metadataRow}>
                <View
                  style={[
                    styles.metadataBadge,
                    { backgroundColor: theme.inputBackground },
                  ]}
                >
                  <Text
                    style={{
                      color: theme.text,
                      fontSize: 10,
                      fontWeight: "700",
                    }}
                  >
                    {(item.category || "general").toUpperCase()}
                  </Text>
                </View>

                <View
                  style={[
                    styles.metadataBadge,
                    {
                      backgroundColor:
                        item.priority === "urgent"
                          ? "#FCE4E4"
                          : item.priority === "important"
                            ? "#FFF1D5"
                            : theme.inputBackground,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color:
                        item.priority === "urgent"
                          ? "#B42318"
                          : item.priority === "important"
                            ? "#986400"
                            : theme.secondaryText,
                      fontSize: 10,
                      fontWeight: "800",
                    }}
                  >
                    {(item.priority || "normal").toUpperCase()}
                  </Text>
                </View>
              </View>

              {item.lga && (
                <Text
                  style={{
                    color: theme.secondaryText,
                    fontSize: 11,
                    marginTop: 9,
                  }}
                >
                  <Ionicons
                    name="location-outline"
                    size={12}
                  />{" "}
                  {item.lga}
                </Text>
              )}

              <Text
                style={[
                  styles.announcementContent,
                  { color: theme.secondaryText },
                ]}
                numberOfLines={5}
              >
                {item.body}
              </Text>

              {item.image_url && (
                <Text
                  style={{
                    color: theme.primary,
                    fontSize: 11,
                    marginTop: 8,
                  }}
                  numberOfLines={1}
                >
                  <Ionicons
                    name="image-outline"
                    size={13}
                  />{" "}
                  Image attached
                </Text>
              )}

              <View
                style={[
                  styles.actions,
                  { borderTopColor: theme.border },
                ]}
              >
                <Pressable
                  onPress={() => editAnnouncement(item)}
                  style={styles.action}
                >
                  <Ionicons
                    name="create-outline"
                    size={17}
                    color={theme.primary}
                  />

                  <Text style={{ color: theme.primary }}>
                    Edit
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => changePublication(item)}
                  style={styles.action}
                >
                  <Ionicons
                    name={
                      item.is_published
                        ? "eye-off-outline"
                        : "globe-outline"
                    }
                    size={17}
                    color={theme.primary}
                  />

                  <Text style={{ color: theme.primary }}>
                    {item.is_published
                      ? "Unpublish"
                      : "Publish"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => deleteAnnouncement(item.id)}
                  style={styles.action}
                >
                  <Ionicons
                    name="trash-outline"
                    size={17}
                    color={theme.danger}
                  />

                  <Text style={{ color: theme.danger }}>
                    Delete
                  </Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={townPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTownPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.surface },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: theme.text },
                ]}
              >
                Select target LGA
              </Text>

              <Pressable
                onPress={() => setTownPickerVisible(false)}
              >
                <Ionicons
                  name="close"
                  size={25}
                  color={theme.text}
                />
              </Pressable>
            </View>

            <TextInput
              value={townSearch}
              onChangeText={setTownSearch}
              placeholder="Search LGAs..."
              placeholderTextColor={theme.secondaryText}
              style={[
                styles.input,
                {
                  backgroundColor: theme.inputBackground,
                  color: theme.text,
                  borderColor: theme.border,
                  marginBottom: 12,
                },
              ]}
            />

            <Pressable
              onPress={() => selectTown("")}
              style={[
                styles.townOption,
                { borderBottomColor: theme.border },
              ]}
            >
              <Text
                style={{
                  color: theme.text,
                  fontWeight: "700",
                }}
              >
                All LGAs
              </Text>

              {!lga && (
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={theme.primary}
                />
              )}
            </Pressable>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 360 }}
            >
              {filteredTowns.map((town) => (
                <Pressable
                  key={town.id}
                  onPress={() => selectTown(town.name)}
                  style={[
                    styles.townOption,
                    { borderBottomColor: theme.border },
                  ]}
                >
                  <Text style={{ color: theme.text }}>
                    {town.name}
                  </Text>

                  {lga === town.name && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={theme.primary}
                    />
                  )}
                </Pressable>
              ))}

              {filteredTowns.length === 0 && (
                <Text
                  style={{
                    color: theme.secondaryText,
                    textAlign: "center",
                    padding: 20,
                  }}
                >
                  No matching LGA found.
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 55,
    paddingBottom: 18,
    gap: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
  },
  content: {
    padding: 20,
    paddingBottom: 50,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 22,
  },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    gap: 5,
  },
  statNumber: {
    fontSize: 23,
    fontWeight: "900",
  },
  formCard: {
    padding: 18,
    borderRadius: 18,
    marginBottom: 28,
  },
  formHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 18,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
    fontSize: 14,
  },
  messageInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    minHeight: 145,
    fontSize: 14,
  },
  optionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionButton: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  selectButton: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 50,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  metadataRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 12,
  },
  metadataBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
  },
  draftButton: {
    borderWidth: 1,
    borderRadius: 12,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 20,
  },
  publishButton: {
    borderRadius: 12,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    marginTop: 10,
  },
  publishText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.6,
  },
  cancelButton: {
    alignItems: "center",
    paddingTop: 14,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  emptyCard: {
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  announcementCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 13,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  announcementTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
  },
  announcementContent: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 13,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 16,
    paddingTop: 13,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: 35,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  townOption: {
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
});
