
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";

const COLORS = {
  green: "#176B45",
  darkGreen: "#104B32",
  background: "#F4F7F5",
  white: "#FFFFFF",
  text: "#17231C",
  muted: "#718078",
  border: "#E2E9E4",
  red: "#C0392B",
  lightGreen: "#E8F4EC",
};

type Tab = "chairmen" | "history";

const ANAMBRA_LGAS = [
  "Aguata",
  "Anambra East",
  "Anambra West",
  "Anaocha",
  "Awka North",
  "Awka South",
  "Ayamelum",
  "Dunukofia",
  "Ekwusigo",
  "Idemili North",
  "Idemili South",
  "Ihiala",
  "Njikoka",
  "Nnewi North",
  "Nnewi South",
  "Ogbaru",
  "Onitsha North",
  "Onitsha South",
  "Orumba North",
  "Orumba South",
  "Oyi",
];

type Chairman = {
  id: string;
  lga_name: string;
  full_name: string;
  political_party: string | null;
  start_date: string | null;
  end_date: string | null;
  biography: string | null;
  image_url: string | null;
  is_current: boolean;
  is_published: boolean;
  display_order: number;
};

type HistoryChapter = {
  id: string;
  title: string;
  introduction: string | null;
  content: string;
  photograph_urls: string[] | null;
  display_order: number;
  is_published: boolean;
};

type ImageAsset = {
  uri: string;
  fileName: string | null;
  mimeType: string | null;
};

const emptyChairman = {
  lga_name: ANAMBRA_LGAS[0],
  full_name: "",
  political_party: "",
  start_date: "",
  end_date: "",
  is_current: false,
  biography: "",
};

const emptyChapter = {
  title: "",
  introduction: "",
  content: "",
  display_order: "1",
};

function showMessage(title: string, message: string) {
  Alert.alert(title, message);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function formatDate(value: string | null) {
  if (!value) return "Not specified";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function uploadImage(asset: ImageAsset): Promise<string> {
  const response = await fetch(asset.uri);

  if (!response.ok) {
    throw new Error("Could not read the selected image.");
  }

  const fileBuffer = await response.arrayBuffer();
  const extension =
    asset.fileName?.split(".").pop()?.toLowerCase() || "jpg";

  const fileName = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${extension}`;

  const filePath = `government/${fileName}`;
  const contentType = asset.mimeType || "image/jpeg";

  const { error } = await supabase.storage
    .from("government-images")
    .upload(filePath, fileBuffer, {
      contentType,
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from("government-images")
    .getPublicUrl(filePath);

  return data.publicUrl;
}

async function chooseImage(): Promise<ImageAsset | null> {
  const permission =
    await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    showMessage(
      "Permission required",
      "Please allow photo library access to select an image."
    );
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    quality: 0.8,
  });

  if (result.canceled || !result.assets.length) return null;

  const selected = result.assets[0];

  return {
    uri: selected.uri,
    fileName: selected.fileName ?? null,
    mimeType: selected.mimeType ?? null,
  };
}

function SectionButton({
  title,
  active,
  onPress,
}: {
  title: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tabButton, active && styles.activeTabButton]}
    >
      <Text style={[styles.tabText, active && styles.activeTabText]}>
        {title}
      </Text>
    </Pressable>
  );
}

function ActionButton({
  title,
  onPress,
  color = COLORS.green,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.actionButton,
        { backgroundColor: color },
        disabled && styles.disabledButton,
      ]}
    >
      <Text style={styles.actionButtonText}>{title}</Text>
    </Pressable>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = "default",
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: "default" | "numeric";
}) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9AA59E"
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        style={[styles.input, multiline && styles.multilineInput]}
      />
    </View>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>Nothing here yet</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
    </View>
  );
}

function StatCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );
}

export default function GovernmentScreen() {
  const [activeTab, setActiveTab] = useState<Tab>("chairmen");

  const [chairmen, setChairmen] = useState<Chairman[]>([]);
  const [chapters, setChapters] = useState<HistoryChapter[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [chairmanForm, setChairmanForm] = useState({ ...emptyChairman });
  const [chapterForm, setChapterForm] = useState({ ...emptyChapter });

  const [selectedImage, setSelectedImage] =
    useState<ImageAsset | null>(null);
  const [existingImageUrl, setExistingImageUrl] =
    useState<string | null>(null);

  const [chapterImages, setChapterImages] = useState<ImageAsset[]>([]);
  const [existingChapterImages, setExistingChapterImages] =
    useState<string[]>([]);

  const [published, setPublished] = useState(true);

  const loadData = useCallback(async () => {
    const [chairmenResult, chaptersResult] = await Promise.all([
      supabase
        .from("local_government_chairmen")
        .select("*")
        .order("lga_name", { ascending: true })
        .order("display_order", { ascending: true })
        .order("start_date", { ascending: false }),

      supabase
        .from("government_history_chapters")
        .select("*")
        .order("display_order", { ascending: true }),
    ]);

    if (chairmenResult.error) throw chairmenResult.error;
    if (chaptersResult.error) throw chaptersResult.error;

    setChairmen(chairmenResult.data || []);
    setChapters(chaptersResult.data || []);
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        await loadData();
      } catch (error) {
        if (mounted) {
          showMessage("Loading failed", getErrorMessage(error));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);

    try {
      await loadData();
    } catch (error) {
      showMessage("Refresh failed", getErrorMessage(error));
    } finally {
      setRefreshing(false);
    }
  };

  const filteredChairmen = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return chairmen;

    return chairmen.filter(
      (item) =>
        item.full_name.toLowerCase().includes(query) ||
        item.lga_name.toLowerCase().includes(query) ||
        (item.political_party || "").toLowerCase().includes(query)
    );
  }, [chairmen, search]);

  const publishedCount = chairmen.filter(
    (item) => item.is_published
  ).length;

  const resetForms = () => {
    setEditingId(null);
    setChairmanForm({ ...emptyChairman });
    setChapterForm({ ...emptyChapter });
    setSelectedImage(null);
    setExistingImageUrl(null);
    setChapterImages([]);
    setExistingChapterImages([]);
    setPublished(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalVisible(false);
    resetForms();
  };

  const openNewForm = () => {
    resetForms();
    setModalVisible(true);
  };

  const editChairman = (item: Chairman) => {
    resetForms();
    setEditingId(item.id);

    setChairmanForm({
      lga_name: item.lga_name,
      full_name: item.full_name,
      political_party: item.political_party || "",
      start_date: item.start_date || "",
      end_date: item.end_date || "",
      is_current: item.is_current,
      biography: item.biography || "",
    });

    setExistingImageUrl(item.image_url);
    setPublished(item.is_published);
    setModalVisible(true);
  };

  const editChapter = (item: HistoryChapter) => {
    resetForms();
    setEditingId(item.id);

    setChapterForm({
      title: item.title,
      introduction: item.introduction || "",
      content: item.content,
      display_order: String(item.display_order),
    });

    setExistingChapterImages(item.photograph_urls || []);
    setPublished(item.is_published);
    setModalVisible(true);
  };

  const selectSingleImage = async () => {
    const image = await chooseImage();
    if (image) setSelectedImage(image);
  };

  const selectChapterImages = async () => {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      showMessage(
        "Permission required",
        "Please allow photo library access."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (result.canceled) return;

    const images = result.assets.map((asset) => ({
      uri: asset.uri,
      fileName: asset.fileName ?? null,
      mimeType: asset.mimeType ?? null,
    }));

    setChapterImages((previous) => [...previous, ...images]);
  };

  const saveChairman = async () => {
    const name = chairmanForm.full_name.trim();
    const startDate = chairmanForm.start_date.trim();
    const endDate = chairmanForm.end_date.trim();

    if (!chairmanForm.lga_name || !name || !startDate) {
      showMessage(
        "Missing information",
        "Select an LGA and enter the chairman's name and start date."
      );
      return;
    }

    if (!isValidDate(startDate)) {
      showMessage(
        "Invalid start date",
        "Enter the date in YYYY-MM-DD format, for example 2025-01-15."
      );
      return;
    }

    if (endDate && !isValidDate(endDate)) {
      showMessage(
        "Invalid end date",
        "Enter the end date in YYYY-MM-DD format."
      );
      return;
    }

    if (endDate && endDate < startDate) {
      showMessage(
        "Invalid dates",
        "The end date cannot be earlier than the start date."
      );
      return;
    }

    if (chairmanForm.is_current && endDate) {
      showMessage(
        "Check the dates",
        "A current chairman should not have an end date."
      );
      return;
    }

    setSaving(true);

    try {
      let imageUrl = existingImageUrl;

      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage);
      }

      const payload = {
        lga_name: chairmanForm.lga_name,
        full_name: name,
        political_party:
          chairmanForm.political_party.trim() || null,
        start_date: startDate,
        end_date: endDate || null,
        is_current: chairmanForm.is_current,
        biography: chairmanForm.biography.trim() || null,
        image_url: imageUrl,
        is_published: published,
      };

      if (editingId) {
        const { error } = await supabase
          .from("local_government_chairmen")
          .update(payload)
          .eq("id", editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("local_government_chairmen")
          .insert(payload);

        if (error) throw error;
      }

      setModalVisible(false);
      resetForms();
      await loadData();
      showMessage("Success", "Chairman record saved.");
    } catch (error) {
      showMessage("Save failed", getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const saveChapter = async () => {
    if (!chapterForm.title.trim() || !chapterForm.content.trim()) {
      showMessage(
        "Missing information",
        "Enter a chapter title and its content."
      );
      return;
    }

    const order = Number(chapterForm.display_order);

    if (!Number.isInteger(order) || order < 0) {
      showMessage("Invalid order", "Enter a valid display order.");
      return;
    }

    setSaving(true);

    try {
      const uploadedUrls: string[] = [];

      for (const image of chapterImages) {
        uploadedUrls.push(await uploadImage(image));
      }

      const payload = {
        title: chapterForm.title.trim(),
        introduction: chapterForm.introduction.trim() || null,
        content: chapterForm.content.trim(),
        photograph_urls: [
          ...existingChapterImages,
          ...uploadedUrls,
        ],
        display_order: order,
        is_published: published,
      };

      if (editingId) {
        const { error } = await supabase
          .from("government_history_chapters")
          .update(payload)
          .eq("id", editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("government_history_chapters")
          .insert(payload);

        if (error) throw error;
      }

      setModalVisible(false);
      resetForms();
      await loadData();
      showMessage("Success", "History chapter saved.");
    } catch (error) {
      showMessage("Save failed", getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = (
    table: "local_government_chairmen" | "government_history_chapters",
    id: string,
    description: string
  ) => {
    Alert.alert(
      "Delete record",
      `Are you sure you want to delete ${description}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from(table)
                .delete()
                .eq("id", id);

              if (error) throw error;

              await loadData();
              showMessage("Deleted", "The record has been deleted.");
            } catch (error) {
              showMessage("Delete failed", getErrorMessage(error));
            }
          },
        },
      ]
    );
  };

  const togglePublish = async (
    table: "local_government_chairmen" | "government_history_chapters",
    id: string,
    currentValue: boolean
  ) => {
    try {
      const { error } = await supabase
        .from(table)
        .update({ is_published: !currentValue })
        .eq("id", id);

      if (error) throw error;

      await loadData();
    } catch (error) {
      showMessage("Update failed", getErrorMessage(error));
    }
  };

  const renderImagePicker = () => (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>Photograph</Text>

      {selectedImage ? (
        <Image
          source={{ uri: selectedImage.uri }}
          style={styles.previewImage}
        />
      ) : existingImageUrl ? (
        <Image
          source={{ uri: existingImageUrl }}
          style={styles.previewImage}
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imagePlaceholderText}>
            No photograph selected
          </Text>
        </View>
      )}

      <ActionButton
        title="Choose Photograph"
        onPress={selectSingleImage}
        color={COLORS.darkGreen}
      />
    </View>
  );

  const renderLgaSelector = () => (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>
        Local Government Area
      </Text>
      <Text style={styles.helperText}>
        Select the LGA this chairman represents.
      </Text>

      <View style={styles.lgaOptions}>
        {ANAMBRA_LGAS.map((lga) => {
          const selected = chairmanForm.lga_name === lga;

          return (
            <Pressable
              key={lga}
              onPress={() =>
                setChairmanForm((previous) => ({
                  ...previous,
                  lga_name: lga,
                }))
              }
              style={[
                styles.lgaOption,
                selected && styles.selectedLgaOption,
              ]}
            >
              <Text
                style={[
                  styles.lgaOptionText,
                  selected && styles.selectedLgaOptionText,
                ]}
              >
                {lga}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderChairmen = () => (
    <>
      <View style={styles.sectionHeading}>
        <View style={styles.sectionHeadingText}>
          <Text style={styles.sectionTitle}>
            Local Government Chairmen
          </Text>
          <Text style={styles.sectionDescription}>
            Manage current and former chairmen across all 21 LGAs.
          </Text>
        </View>

        <ActionButton title="+ Add" onPress={openNewForm} />
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search name, LGA or political party..."
        placeholderTextColor="#9AA59E"
        style={styles.searchInput}
      />

      {filteredChairmen.length === 0 ? (
        <EmptyState
          message={
            search.trim()
              ? "No chairman records match your search."
              : "No chairman records have been added yet."
          }
        />
      ) : (
        filteredChairmen.map((item) => (
          <View key={item.id} style={styles.recordCard}>
            <View style={styles.recordTop}>
              {item.image_url ? (
                <Image
                  source={{ uri: item.image_url }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarLetter}>
                    {item.full_name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}

              <View style={styles.recordInfo}>
                <Text style={styles.recordName}>
                  {item.full_name}
                </Text>
                <Text style={styles.lgaBadge}>{item.lga_name}</Text>
                <Text style={styles.recordSubtext}>
                  {formatDate(item.start_date)} –{" "}
                  {item.is_current
                    ? "Present"
                    : formatDate(item.end_date)}
                </Text>
                {!!item.political_party && (
                  <Text style={styles.recordSubtext}>
                    {item.political_party}
                  </Text>
                )}
                <Text style={styles.statusText}>
                  {item.is_published ? "Published" : "Draft"}
                  {item.is_current ? " · Current" : ""}
                </Text>
              </View>
            </View>

            {!!item.biography && (
              <Text style={styles.recordDescription}>
                {item.biography}
              </Text>
            )}

            <View style={styles.recordActions}>
              <ActionButton
                title="Edit"
                onPress={() => editChairman(item)}
                color={COLORS.darkGreen}
              />
              <ActionButton
                title={item.is_published ? "Unpublish" : "Publish"}
                onPress={() =>
                  togglePublish(
                    "local_government_chairmen",
                    item.id,
                    item.is_published
                  )
                }
                color="#68766E"
              />
              <ActionButton
                title="Delete"
                onPress={() =>
                  deleteRecord(
                    "local_government_chairmen",
                    item.id,
                    item.full_name
                  )
                }
                color={COLORS.red}
              />
            </View>
          </View>
        ))
      )}
    </>
  );

  const renderHistory = () => (
    <>
      <View style={styles.sectionHeading}>
        <View style={styles.sectionHeadingText}>
          <Text style={styles.sectionTitle}>
            Anambra State History
          </Text>
          <Text style={styles.sectionDescription}>
            Manage historical chapters and photographs.
          </Text>
        </View>

        <ActionButton title="+ Add" onPress={openNewForm} />
      </View>

      {chapters.length === 0 ? (
        <EmptyState message="No history chapters have been created yet." />
      ) : (
        chapters.map((item) => (
          <View key={item.id} style={styles.recordCard}>
            <Text style={styles.recordName}>{item.title}</Text>

            {!!item.introduction && (
              <Text style={styles.recordSubtext}>
                {item.introduction}
              </Text>
            )}

            <Text style={styles.recordDescription} numberOfLines={4}>
              {item.content}
            </Text>

            {!!item.photograph_urls?.length && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {item.photograph_urls.map((url, index) => (
                  <Image
                    key={`${item.id}-${index}`}
                    source={{ uri: url }}
                    style={styles.chapterThumbnail}
                  />
                ))}
              </ScrollView>
            )}

            <Text style={styles.statusText}>
              {item.is_published ? "Published" : "Draft"} · Order{" "}
              {item.display_order}
            </Text>

            <View style={styles.recordActions}>
              <ActionButton
                title="Edit"
                onPress={() => editChapter(item)}
                color={COLORS.darkGreen}
              />
              <ActionButton
                title={item.is_published ? "Unpublish" : "Publish"}
                onPress={() =>
                  togglePublish(
                    "government_history_chapters",
                    item.id,
                    item.is_published
                  )
                }
                color="#68766E"
              />
              <ActionButton
                title="Delete"
                onPress={() =>
                  deleteRecord(
                    "government_history_chapters",
                    item.id,
                    item.title
                  )
                }
                color={COLORS.red}
              />
            </View>
          </View>
        ))
      )}
    </>
  );

  const renderForm = () => {
    if (activeTab === "chairmen") {
      return (
        <>
          {renderLgaSelector()}

          <FormField
            label="Chairman's Full Name"
            value={chairmanForm.full_name}
            onChangeText={(value) =>
              setChairmanForm((previous) => ({
                ...previous,
                full_name: value,
              }))
            }
            placeholder="Enter full name"
          />

          <FormField
            label="Political Party"
            value={chairmanForm.political_party}
            onChangeText={(value) =>
              setChairmanForm((previous) => ({
                ...previous,
                political_party: value,
              }))
            }
            placeholder="Enter political party (optional)"
          />

          <FormField
            label="Start Date"
            value={chairmanForm.start_date}
            onChangeText={(value) =>
              setChairmanForm((previous) => ({
                ...previous,
                start_date: value,
              }))
            }
            placeholder="YYYY-MM-DD e.g. 2025-01-15"
          />

          <FormField
            label="End Date"
            value={chairmanForm.end_date}
            onChangeText={(value) =>
              setChairmanForm((previous) => ({
                ...previous,
                end_date: value,
              }))
            }
            placeholder="YYYY-MM-DD (leave empty if current)"
          />

          <View style={styles.switchRow}>
            <View style={styles.switchTextContainer}>
              <Text style={styles.fieldLabel}>
                Currently serving
              </Text>
              <Text style={styles.helperText}>
                Turn this on for the serving chairman.
              </Text>
            </View>

            <Switch
              value={chairmanForm.is_current}
              onValueChange={(value) =>
                setChairmanForm((previous) => ({
                  ...previous,
                  is_current: value,
                  end_date: value ? "" : previous.end_date,
                }))
              }
              trackColor={{ true: COLORS.green, false: "#C8D1CB" }}
            />
          </View>

          <FormField
            label="Biography"
            value={chairmanForm.biography}
            onChangeText={(value) =>
              setChairmanForm((previous) => ({
                ...previous,
                biography: value,
              }))
            }
            placeholder="Enter a short biography"
            multiline
          />

          {renderImagePicker()}
        </>
      );
    }

    return (
      <>
        <FormField
          label="Chapter Title"
          value={chapterForm.title}
          onChangeText={(value) =>
            setChapterForm((previous) => ({
              ...previous,
              title: value,
            }))
          }
          placeholder="Enter chapter title"
        />

        <FormField
          label="Introduction"
          value={chapterForm.introduction}
          onChangeText={(value) =>
            setChapterForm((previous) => ({
              ...previous,
              introduction: value,
            }))
          }
          placeholder="A short introduction"
          multiline
        />

        <FormField
          label="Full Content"
          value={chapterForm.content}
          onChangeText={(value) =>
            setChapterForm((previous) => ({
              ...previous,
              content: value,
            }))
          }
          placeholder="Write the historical information here"
          multiline
        />

        <FormField
          label="Display Order"
          value={chapterForm.display_order}
          onChangeText={(value) =>
            setChapterForm((previous) => ({
              ...previous,
              display_order: value,
            }))
          }
          placeholder="1"
          keyboardType="numeric"
        />

        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>
            Chapter Photographs
          </Text>

          <ActionButton
            title="Choose Photographs"
            onPress={selectChapterImages}
            color={COLORS.darkGreen}
          />

          <View style={styles.thumbnailRow}>
            {existingChapterImages.map((url, index) => (
              <View
                key={`existing-${index}`}
                style={styles.thumbnailWrap}
              >
                <Image
                  source={{ uri: url }}
                  style={styles.chapterThumbnail}
                />
                <Pressable
                  onPress={() =>
                    setExistingChapterImages((previous) =>
                      previous.filter(
                        (_, itemIndex) => itemIndex !== index
                      )
                    )
                  }
                  style={styles.removeImageButton}
                >
                  <Text style={styles.removeImageText}>×</Text>
                </Pressable>
              </View>
            ))}

            {chapterImages.map((image, index) => (
              <View key={`new-${index}`} style={styles.thumbnailWrap}>
                <Image
                  source={{ uri: image.uri }}
                  style={styles.chapterThumbnail}
                />
                <Pressable
                  onPress={() =>
                    setChapterImages((previous) =>
                      previous.filter(
                        (_, itemIndex) => itemIndex !== index
                      )
                    )
                  }
                  style={styles.removeImageButton}
                >
                  <Text style={styles.removeImageText}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      </>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.green} />
          <Text style={styles.loadingText}>
            Loading government records...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerEyebrow}>ADMINISTRATION</Text>
        <Text style={styles.headerTitle}>
          Government Management
        </Text>
        <Text style={styles.headerSubtitle}>
          Manage Anambra State government information and history.
        </Text>
      </View>

      <View style={styles.statsRow}>
        <StatCard title="Chairmen" value={chairmen.length} />
        <StatCard title="Published" value={publishedCount} />
        <StatCard title="History" value={chapters.length} />
      </View>

      <View style={styles.tabs}>
        <SectionButton
          title="Chairmen"
          active={activeTab === "chairmen"}
          onPress={() => setActiveTab("chairmen")}
        />
        <SectionButton
          title="History"
          active={activeTab === "history"}
          onPress={() => setActiveTab("history")}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.green}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === "chairmen" && renderChairmen()}
        {activeTab === "history" && renderHistory()}
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingId ? "Edit Record" : "Add New Record"}
            </Text>

            <Pressable
              onPress={closeModal}
              disabled={saving}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </Pressable>
          </View>

          <KeyboardAvoidingView
            style={styles.modalBody}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
            >
              {renderForm()}

              <View style={styles.switchRow}>
                <View style={styles.switchTextContainer}>
                  <Text style={styles.fieldLabel}>
                    Publish record
                  </Text>
                  <Text style={styles.helperText}>
                    Published records can appear in the citizens' app.
                  </Text>
                </View>

                <Switch
                  value={published}
                  onValueChange={setPublished}
                  trackColor={{ true: COLORS.green, false: "#C8D1CB" }}
                />
              </View>

              <ActionButton
                title={
                  saving
                    ? "Saving..."
                    : editingId
                      ? "Save Changes"
                      : "Create Record"
                }
                onPress={
                  activeTab === "chairmen"
                    ? saveChairman
                    : saveChapter
                }
                disabled={saving}
              />

              {saving && (
                <ActivityIndicator
                  color={COLORS.green}
                  style={styles.savingIndicator}
                />
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
  },
  headerEyebrow: {
    color: COLORS.green,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 23,
    fontWeight: "800",
    marginTop: 5,
  },
  headerSubtitle: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 5,
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: {
    color: COLORS.green,
    fontSize: 22,
    fontWeight: "800",
  },
  statTitle: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 3,
  },
  tabs: {
    flexDirection: "row",
    marginHorizontal: 16,
    padding: 5,
    borderRadius: 12,
    backgroundColor: "#E8EEE9",
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
    borderRadius: 9,
  },
  activeTabButton: {
    backgroundColor: COLORS.white,
    elevation: 2,
  },
  tabText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  activeTabText: {
    color: COLORS.green,
    fontWeight: "800",
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
    gap: 10,
  },
  sectionHeadingText: {
    flex: 1,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
  },
  sectionDescription: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  actionButton: {
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.55,
  },
  recordCard: {
    backgroundColor: COLORS.white,
    borderRadius: 15,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  recordTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 13,
    backgroundColor: "#E8EEE9",
  },
  avatarPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 13,
    backgroundColor: COLORS.lightGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    fontSize: 21,
    color: COLORS.green,
    fontWeight: "800",
  },
  recordInfo: {
    flex: 1,
  },
  recordName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },
  lgaBadge: {
    color: COLORS.green,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
  },
  recordSubtext: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 4,
  },
  statusText: {
    color: COLORS.green,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 8,
  },
  recordDescription: {
    color: "#56635B",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 13,
  },
  recordActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 14,
  },
  searchInput: {
    backgroundColor: COLORS.white,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.text,
    marginBottom: 14,
  },
  emptyState: {
    backgroundColor: COLORS.white,
    padding: 25,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },
  emptyMessage: {
    color: COLORS.muted,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 19,
    marginTop: 7,
  },
  fieldContainer: {
    marginBottom: 17,
  },
  fieldLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 14,
    minHeight: 47,
  },
  multilineInput: {
    minHeight: 105,
    paddingTop: 12,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 18,
  },
  switchTextContainer: {
    flex: 1,
  },
  helperText: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 3,
    marginBottom: 8,
  },
  lgaOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 5,
  },
  lgaOption: {
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  selectedLgaOption: {
    backgroundColor: COLORS.lightGreen,
    borderColor: COLORS.green,
  },
  lgaOptionText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  selectedLgaOptionText: {
    color: COLORS.green,
    fontWeight: "800",
  },
  imagePlaceholder: {
    height: 130,
    backgroundColor: "#E8EEE9",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  imagePlaceholderText: {
    color: COLORS.muted,
    fontSize: 12,
  },
  previewImage: {
    width: "100%",
    height: 170,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: "#E8EEE9",
  },
  chapterThumbnail: {
    width: 90,
    height: 75,
    borderRadius: 9,
    marginRight: 8,
    marginTop: 10,
  },
  thumbnailRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 5,
  },
  thumbnailWrap: {
    position: "relative",
  },
  removeImageButton: {
    position: "absolute",
    right: 1,
    top: 7,
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  removeImageText: {
    color: COLORS.white,
    fontSize: 18,
    lineHeight: 21,
    fontWeight: "700",
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
  },
  closeButton: {
    width: 35,
    height: 35,
    borderRadius: 18,
    backgroundColor: "#EDF1EE",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    color: COLORS.text,
    fontSize: 24,
    lineHeight: 27,
  },
  modalBody: {
    flex: 1,
  },
  formContent: {
    padding: 18,
    paddingBottom: 45,
  },
  savingIndicator: {
    marginTop: 12,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: COLORS.muted,
    marginTop: 12,
    fontSize: 13,
  },
});
