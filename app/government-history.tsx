
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";
import { supabase } from "../lib/supabase";

type HistoryChapter = {
  id: string;
  title: string;
  introduction: string | null;
  content: string;
  photograph_urls: string[];
  display_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

type SelectedPhoto = ImagePicker.ImagePickerAsset;

const BUCKET = "government-images";
const STORAGE_PREFIX = "history/";

const COLORS = {
  primary: "#087A55",
  dark: "#10251C",
  muted: "#718078",
  background: "#F4F7F5",
  white: "#FFFFFF",
  border: "#E3EAE5",
  danger: "#C83E48",
  lightGreen: "#E8F5EE",
};

export default function GovernmentHistoryScreen() {
  const [chapters, setChapters] = useState<HistoryChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingChapter, setEditingChapter] =
    useState<HistoryChapter | null>(null);

  const [title, setTitle] = useState("");
  const [introduction, setIntroduction] = useState("");
  const [content, setContent] = useState("");
  const [displayOrder, setDisplayOrder] = useState("0");
  const [isPublished, setIsPublished] = useState(false);

  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<SelectedPhoto[]>([]);

  const loadChapters = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);

    try {
      const { data, error } = await supabase
        .from("government_history_chapters")
        .select(
          "id,title,introduction,content,photograph_urls,display_order,is_published,created_at,updated_at"
        )
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;

      setChapters((data ?? []) as HistoryChapter[]);
    } catch (error: any) {
      Alert.alert(
        "Unable to load history",
        error?.message || "Please try again."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadChapters();
  }, [loadChapters]);

  const onRefresh = () => {
    setRefreshing(true);
    loadChapters(false);
  };

  const resetForm = () => {
    setEditingChapter(null);
    setTitle("");
    setIntroduction("");
    setContent("");
    setDisplayOrder("0");
    setIsPublished(false);
    setExistingPhotos([]);
    setSelectedPhotos([]);
  };

  const openCreateForm = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditForm = (chapter: HistoryChapter) => {
    setEditingChapter(chapter);
    setTitle(chapter.title);
    setIntroduction(chapter.introduction ?? "");
    setContent(chapter.content);
    setDisplayOrder(String(chapter.display_order));
    setIsPublished(chapter.is_published);
    setExistingPhotos(chapter.photograph_urls ?? []);
    setSelectedPhotos([]);
    setModalVisible(true);
  };

  const pickPhotos = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission required",
          "Allow photo library access to select history photographs."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        quality: 0.85,
      });

      if (result.canceled || !result.assets?.length) return;

      const combined = [...selectedPhotos, ...result.assets];

      if (existingPhotos.length + combined.length > 10) {
        Alert.alert(
          "Photo limit",
          "A history chapter can contain a maximum of 10 photographs."
        );
        return;
      }

      setSelectedPhotos(combined);
    } catch (error: any) {
      Alert.alert(
        "Photo selection failed",
        error?.message || "Please try again."
      );
    }
  };

  const removeExistingPhoto = (url: string) => {
    setExistingPhotos((current) => current.filter((item) => item !== url));
  };

  const removeSelectedPhoto = (index: number) => {
    setSelectedPhotos((current) =>
      current.filter((_, photoIndex) => photoIndex !== index)
    );
  };

  const getStoragePath = (url: string): string | null => {
    try {
      const marker = `/storage/v1/object/public/${BUCKET}/`;
      const position = url.indexOf(marker);

      if (position === -1) return null;

      const encodedPath = url.slice(position + marker.length);
      const path = decodeURIComponent(encodedPath);

      return path.startsWith(STORAGE_PREFIX) ? path : null;
    } catch {
      return null;
    }
  };

  const removeStoragePhotos = async (urls: string[]) => {
    const paths = urls
      .map(getStoragePath)
      .filter((path): path is string => path !== null);

    if (!paths.length) return;

    const { error } = await supabase.storage.from(BUCKET).remove(paths);

    if (error) {
      console.warn("History photo cleanup failed:", error.message);
    }
  };

  const uploadSelectedPhotos = async (): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user) throw new Error("Your admin session has expired. Sign in again.");

    try {
      for (const photo of selectedPhotos) {
        const mimeType = photo.mimeType || "image/jpeg";

        const extension =
          mimeType === "image/png"
            ? "png"
            : mimeType === "image/webp"
              ? "webp"
              : "jpg";

        const fileName =
          `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;

        const storagePath = `${STORAGE_PREFIX}${user.id}/${fileName}`;

        const response = await fetch(photo.uri);

        if (!response.ok) {
          throw new Error("A selected photograph could not be read.");
        }

        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, blob, {
            contentType: mimeType,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(storagePath);

        uploadedUrls.push(data.publicUrl);
      }

      return uploadedUrls;
    } catch (error) {
      await removeStoragePhotos(uploadedUrls);
      throw error;
    }
  };

  const saveChapter = async () => {
    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    const cleanIntroduction = introduction.trim();

    if (!cleanTitle) {
      Alert.alert("Title required", "Enter a title for this chapter.");
      return;
    }

    if (!cleanContent) {
      Alert.alert("Content required", "Enter the history chapter content.");
      return;
    }

    const order = Number(displayOrder);

    if (
      !Number.isInteger(order) ||
      !Number.isFinite(order) ||
      order < 0
    ) {
      Alert.alert(
        "Invalid display order",
        "Enter a valid whole number of zero or greater."
      );
      return;
    }

    if (existingPhotos.length + selectedPhotos.length > 10) {
      Alert.alert("Photo limit", "A maximum of 10 photographs is allowed.");
      return;
    }

    setSaving(true);

    let uploadedUrls: string[] = [];

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in again.");

      uploadedUrls = await uploadSelectedPhotos();

      const payload = {
        title: cleanTitle,
        introduction: cleanIntroduction || null,
        content: cleanContent,
        photograph_urls: [...existingPhotos, ...uploadedUrls],
        display_order: order,
        is_published: isPublished,
        updated_at: new Date().toISOString(),
      };

      if (editingChapter) {
        const { error } = await supabase
          .from("government_history_chapters")
          .update(payload)
          .eq("id", editingChapter.id);

        if (error) throw error;

        const removedPhotos = editingChapter.photograph_urls.filter(
          (url) => !existingPhotos.includes(url)
        );

        if (removedPhotos.length) {
          await removeStoragePhotos(removedPhotos);
        }

        Alert.alert("Updated", "The history chapter has been updated.");
      } else {
        const { error } = await supabase
          .from("government_history_chapters")
          .insert({
            ...payload,
            created_by: user.id,
          });

        if (error) throw error;

        Alert.alert("Created", "The history chapter has been saved.");
      }

      setModalVisible(false);
      resetForm();
      await loadChapters(false);
    } catch (error: any) {
      if (uploadedUrls.length) {
        await removeStoragePhotos(uploadedUrls);
      }

      Alert.alert(
        "Unable to save chapter",
        error?.message || "Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (chapter: HistoryChapter) => {
    const nextStatus = !chapter.is_published;

    try {
      const { error } = await supabase
        .from("government_history_chapters")
        .update({
          is_published: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", chapter.id);

      if (error) throw error;

      setChapters((current) =>
        current.map((item) =>
          item.id === chapter.id
            ? { ...item, is_published: nextStatus }
            : item
        )
      );
    } catch (error: any) {
      Alert.alert(
        "Unable to update publishing status",
        error?.message || "Please try again."
      );
    }
  };

  const deleteChapter = (chapter: HistoryChapter) => {
    Alert.alert(
      "Delete history chapter?",
      `Are you sure you want to delete "${chapter.title}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("government_history_chapters")
                .delete()
                .eq("id", chapter.id);

              if (error) throw error;

              await removeStoragePhotos(chapter.photograph_urls ?? []);

              setChapters((current) =>
                current.filter((item) => item.id !== chapter.id)
              );

              Alert.alert("Deleted", "The history chapter has been deleted.");
            } catch (error: any) {
              Alert.alert(
                "Unable to delete chapter",
                error?.message || "Please try again."
              );
            }
          },
        },
      ]
    );
  };

  const formatDate = (value: string) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Unknown date";

    return date.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const renderChapter = (chapter: HistoryChapter) => (
    <View key={chapter.id} style={styles.chapterCard}>
      <View style={styles.cardTop}>
        <View style={styles.cardTitleArea}>
          <Text style={styles.chapterTitle}>{chapter.title}</Text>
          <Text style={styles.chapterDate}>
            Updated {formatDate(chapter.updated_at)}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            chapter.is_published
              ? styles.publishedBadge
              : styles.draftBadge,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              chapter.is_published
                ? styles.publishedText
                : styles.draftText,
            ]}
          >
            {chapter.is_published ? "Published" : "Draft"}
          </Text>
        </View>
      </View>

      {chapter.introduction ? (
        <Text style={styles.chapterIntroduction} numberOfLines={3}>
          {chapter.introduction}
        </Text>
      ) : null}

      <Text style={styles.chapterContent} numberOfLines={3}>
        {chapter.content}
      </Text>

      {chapter.photograph_urls?.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photoStrip}
        >
          {chapter.photograph_urls.map((url, index) => (
            <Image
              key={`${chapter.id}-${index}`}
              source={{ uri: url }}
              style={styles.cardPhoto}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.noPhotos}>
          <Ionicons name="images-outline" size={17} color={COLORS.muted} />
          <Text style={styles.noPhotosText}>No photographs</Text>
        </View>
      )}

      <View style={styles.cardMeta}>
        <Text style={styles.orderText}>
          Display order: {chapter.display_order}
        </Text>
        <Text style={styles.orderText}>
          {chapter.photograph_urls?.length ?? 0} photos
        </Text>
      </View>

      <View style={styles.cardActions}>
        <Pressable
          style={styles.editButton}
          onPress={() => openEditForm(chapter)}
        >
          <Ionicons name="create-outline" size={17} color={COLORS.primary} />
          <Text style={styles.editButtonText}>Edit</Text>
        </Pressable>

        <Pressable
          style={[
            styles.publishButton,
            chapter.is_published && styles.unpublishButton,
          ]}
          onPress={() => togglePublished(chapter)}
        >
          <Ionicons
            name={chapter.is_published ? "eye-off-outline" : "eye-outline"}
            size={17}
            color={chapter.is_published ? COLORS.dark : COLORS.white}
          />
          <Text
            style={[
              styles.publishButtonText,
              chapter.is_published && styles.unpublishButtonText,
            ]}
          >
            {chapter.is_published ? "Unpublish" : "Publish"}
          </Text>
        </Pressable>

        <Pressable
          style={styles.deleteButton}
          onPress={() => deleteChapter(chapter)}
        >
          <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="book-outline" size={25} color={COLORS.white} />
        </View>

        <View style={styles.headerTextArea}>
          <Text style={styles.headerTitle}>History of Anambra</Text>
          <Text style={styles.headerSubtitle}>
            Manage historical chapters and photographs
          </Text>
        </View>

        <Pressable style={styles.addButton} onPress={openCreateForm}>
          <Ionicons name="add" size={25} color={COLORS.white} />
        </Pressable>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{chapters.length}</Text>
          <Text style={styles.summaryLabel}>Total chapters</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>
            {chapters.filter((item) => item.is_published).length}
          </Text>
          <Text style={styles.summaryLabel}>Published</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>
            {chapters.filter((item) => !item.is_published).length}
          </Text>
          <Text style={styles.summaryLabel}>Drafts</Text>
        </View>
      </View>

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>History chapters</Text>
        <Text style={styles.sectionHint}>
          Citizens can see published chapters only.
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.stateText}>Loading history chapters...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {chapters.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="book-outline"
                  size={34}
                  color={COLORS.primary}
                />
              </View>
              <Text style={styles.emptyTitle}>No history chapters yet</Text>
              <Text style={styles.emptyDescription}>
                Create the first chapter to begin building Anambra State's
                historical archive.
              </Text>
              <Pressable
                style={styles.emptyButton}
                onPress={openCreateForm}
              >
                <Ionicons name="add" size={19} color={COLORS.white} />
                <Text style={styles.emptyButtonText}>Create chapter</Text>
              </Pressable>
            </View>
          ) : (
            chapters.map(renderChapter)
          )}
        </ScrollView>
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (!saving) setModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalScreen}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>
                {editingChapter ? "Edit chapter" : "New history chapter"}
              </Text>
              <Text style={styles.modalSubtitle}>
                Add historical information and photographs.
              </Text>
            </View>

            <Pressable
              style={styles.closeButton}
              disabled={saving}
              onPress={() => setModalVisible(false)}
            >
              <Ionicons name="close" size={24} color={COLORS.dark} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.fieldLabel}>Chapter title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter chapter title"
              placeholderTextColor="#9AA69F"
              maxLength={180}
            />

            <Text style={styles.fieldLabel}>Introduction</Text>
            <TextInput
              style={[styles.input, styles.multilineSmall]}
              value={introduction}
              onChangeText={setIntroduction}
              placeholder="A short introduction to this chapter (optional)"
              placeholderTextColor="#9AA69F"
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.fieldLabel}>Chapter content *</Text>
            <TextInput
              style={[styles.input, styles.contentInput]}
              value={content}
              onChangeText={setContent}
              placeholder="Write the historical account here..."
              placeholderTextColor="#9AA69F"
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.fieldLabel}>Display order</Text>
            <TextInput
              style={styles.input}
              value={displayOrder}
              onChangeText={setDisplayOrder}
              placeholder="0"
              keyboardType="number-pad"
            />
            <Text style={styles.helperText}>
              Lower numbers appear earlier in the Citizen app.
            </Text>

            <View style={styles.photoHeading}>
              <View>
                <Text style={styles.fieldLabel}>Photographs</Text>
                <Text style={styles.helperText}>
                  Up to 10 JPEG, PNG or WebP images.
                </Text>
              </View>

              <Pressable
                style={styles.choosePhotosButton}
                onPress={pickPhotos}
              >
                <Ionicons
                  name="images-outline"
                  size={18}
                  color={COLORS.primary}
                />
                <Text style={styles.choosePhotosText}>Choose photos</Text>
              </Pressable>
            </View>

            {existingPhotos.length > 0 || selectedPhotos.length > 0 ? (
              <View style={styles.selectedPhotos}>
                {existingPhotos.map((url, index) => (
                  <View key={`${url}-${index}`} style={styles.photoItem}>
                    <Image source={{ uri: url }} style={styles.formPhoto} />
                    <Pressable
                      style={styles.removePhoto}
                      onPress={() => removeExistingPhoto(url)}
                    >
                      <Ionicons
                        name="close"
                        size={15}
                        color={COLORS.white}
                      />
                    </Pressable>
                  </View>
                ))}

                {selectedPhotos.map((photo, index) => (
                  <View key={`${photo.uri}-${index}`} style={styles.photoItem}>
                    <Image
                      source={{ uri: photo.uri }}
                      style={styles.formPhoto}
                    />
                    <Pressable
                      style={styles.removePhoto}
                      onPress={() => removeSelectedPhoto(index)}
                    >
                      <Ionicons
                        name="close"
                        size={15}
                        color={COLORS.white}
                      />
                    </Pressable>
                    <View style={styles.newPhotoLabel}>
                      <Text style={styles.newPhotoLabelText}>NEW</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons
                  name="image-outline"
                  size={28}
                  color={COLORS.muted}
                />
                <Text style={styles.photoPlaceholderText}>
                  No photographs selected
                </Text>
              </View>
            )}

            <View style={styles.publishSetting}>
              <View style={styles.publishSettingText}>
                <Text style={styles.publishSettingTitle}>
                  Publish this chapter
                </Text>
                <Text style={styles.helperText}>
                  Published chapters become visible to citizens.
                </Text>
              </View>

              <Switch
                value={isPublished}
                onValueChange={setIsPublished}
                trackColor={{
                  false: "#D5DDD8",
                  true: "#9BD6BA",
                }}
                thumbColor={isPublished ? COLORS.primary : "#F5F5F5"}
              />
            </View>

            <Pressable
              style={[
                styles.saveButton,
                saving && styles.disabledButton,
              ]}
              onPress={saveChapter}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons
                    name="save-outline"
                    size={19}
                    color={COLORS.white}
                  />
                  <Text style={styles.saveButtonText}>
                    {editingChapter ? "Save changes" : "Create chapter"}
                  </Text>
                </>
              )}
            </Pressable>

            <Text style={styles.formFooter}>
              All changes are saved to the AnambraFix database.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.dark,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 60 : 48,
    paddingBottom: 25,
    flexDirection: "row",
    alignItems: "center",
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextArea: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "800",
  },
  headerSubtitle: {
    color: "#C1D0C8",
    fontSize: 11,
    marginTop: 4,
  },
  addButton: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryRow: {
    flexDirection: "row",
    paddingHorizontal: 15,
    marginTop: -1,
    gap: 9,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 9,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryNumber: {
    color: COLORS.dark,
    fontSize: 23,
    fontWeight: "800",
  },
  summaryLabel: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 4,
  },
  sectionHeading: {
    paddingHorizontal: 18,
    paddingTop: 25,
    paddingBottom: 13,
  },
  sectionTitle: {
    color: COLORS.dark,
    fontSize: 17,
    fontWeight: "800",
  },
  sectionHint: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 15,
    paddingBottom: 35,
  },
  chapterCard: {
    backgroundColor: COLORS.white,
    borderRadius: 17,
    padding: 15,
    marginBottom: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  cardTitleArea: {
    flex: 1,
    paddingRight: 8,
  },
  chapterTitle: {
    color: COLORS.dark,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
  },
  chapterDate: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 5,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  publishedBadge: {
    backgroundColor: COLORS.lightGreen,
  },
  draftBadge: {
    backgroundColor: "#F0F1F2",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
  },
  publishedText: {
    color: COLORS.primary,
  },
  draftText: {
    color: COLORS.muted,
  },
  chapterIntroduction: {
    color: "#43554B",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 13,
    fontWeight: "600",
  },
  chapterContent: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 8,
  },
  photoStrip: {
    gap: 8,
    marginTop: 14,
  },
  cardPhoto: {
    width: 105,
    height: 75,
    borderRadius: 10,
    backgroundColor: COLORS.background,
  },
  noPhotos: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 14,
  },
  noPhotosText: {
    color: COLORS.muted,
    fontSize: 11,
  },
  cardMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 13,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  orderText: {
    color: COLORS.muted,
    fontSize: 10,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 13,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 13,
    height: 39,
    borderRadius: 10,
    backgroundColor: COLORS.lightGreen,
  },
  editButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  publishButton: {
    flex: 1,
    height: 39,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  publishButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
  },
  unpublishButton: {
    backgroundColor: "#E9EFEB",
  },
  unpublishButtonText: {
    color: COLORS.dark,
  },
  deleteButton: {
    width: 40,
    height: 39,
    borderRadius: 10,
    backgroundColor: "#FFF0F0",
    alignItems: "center",
    justifyContent: "center",
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stateText: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 12,
  },
  emptyState: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 25,
    alignItems: "center",
    marginTop: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyIcon: {
    width: 65,
    height: 65,
    borderRadius: 22,
    backgroundColor: COLORS.lightGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: COLORS.dark,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 15,
  },
  emptyDescription: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    height: 43,
    borderRadius: 12,
    marginTop: 18,
  },
  emptyButtonText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 12,
  },
  modalScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 19,
    paddingTop: Platform.OS === "ios" ? 22 : 18,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    color: COLORS.dark,
    fontSize: 19,
    fontWeight: "800",
  },
  modalSubtitle: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 5,
  },
  closeButton: {
    width: 39,
    height: 39,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },
  formContent: {
    padding: 18,
    paddingBottom: 45,
  },
  fieldLabel: {
    color: COLORS.dark,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 15,
  },
  input: {
    minHeight: 48,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: COLORS.dark,
    fontSize: 13,
  },
  multilineSmall: {
    minHeight: 85,
  },
  contentInput: {
    minHeight: 190,
    lineHeight: 21,
  },
  helperText: {
    color: COLORS.muted,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 5,
  },
  photoHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 15,
  },
  choosePhotosButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: COLORS.lightGreen,
  },
  choosePhotosText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "800",
  },
  selectedPhotos: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 13,
  },
  photoItem: {
    width: 92,
    height: 82,
    position: "relative",
  },
  formPhoto: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
    backgroundColor: COLORS.border,
  },
  removePhoto: {
    position: "absolute",
    right: -6,
    top: -6,
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: COLORS.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  newPhotoLabel: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 4,
  },
  newPhotoLabelText: {
    color: COLORS.white,
    fontSize: 8,
    fontWeight: "800",
  },
  photoPlaceholder: {
    minHeight: 85,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#C7D4CC",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 13,
    gap: 5,
  },
  photoPlaceholderText: {
    color: COLORS.muted,
    fontSize: 11,
  },
  publishSetting: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.white,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 23,
  },
  publishSettingText: {
    flex: 1,
    paddingRight: 10,
  },
  publishSettingTitle: {
    color: COLORS.dark,
    fontSize: 12,
    fontWeight: "800",
  },
  saveButton: {
    height: 51,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    marginTop: 22,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.65,
  },
  formFooter: {
    color: COLORS.muted,
    fontSize: 10,
    textAlign: "center",
    marginTop: 13,
  },
});
