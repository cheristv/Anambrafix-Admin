
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";

type HomepageSlide = {
  id: string;
  title: string | null;
  image_path: string;
  is_published: boolean | null;
  sort_order: number | null;
  created_at?: string;
};

const BUCKET_NAME = "homepage-images";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export default function HomepagePicturesScreen() {
  const [slides, setSlides] = useState<HomepageSlide[]>([]);
  const [title, setTitle] = useState("");
  const [selectedImage, setSelectedImage] =
    useState<ImagePicker.ImagePickerAsset | null>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [busySlideId, setBusySlideId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const loadSlides = useCallback(async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("homepage_slides")
        .select(
          "id, title, image_path, is_published, sort_order, created_at"
        )
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) {
        Alert.alert("Unable to load pictures", error.message);
        return;
      }

      setSlides((data ?? []) as HomepageSlide[]);
    } catch (error) {
      Alert.alert(
        "Unable to load pictures",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSlides();
    }, [loadSlides])
  );

  const getImageUrl = (imagePath: string) => {
    if (
      imagePath.startsWith("https://") ||
      imagePath.startsWith("http://")
    ) {
      return imagePath;
    }

    const { data } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(imagePath);

    return data.publicUrl;
  };

  const chooseImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Photo access needed",
          "Allow photo-library access in your device settings to select a picture."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.85,
      });

      if (!result.canceled && result.assets.length > 0) {
        const image = result.assets[0];

        if (
          image.fileSize !== undefined &&
          image.fileSize > MAX_IMAGE_SIZE
        ) {
          Alert.alert(
            "Image too large",
            "Please select an image that is 5 MB or smaller."
          );
          return;
        }

        setSelectedImage(image);
      }
    } catch (error) {
      Alert.alert(
        "Unable to select picture",
        error instanceof Error ? error.message : "Please try again."
      );
    }
  };

  const resetForm = () => {
    setTitle("");
    setSelectedImage(null);
    setEditingId(null);
  };

  const getImageMimeType = (
    image: ImagePicker.ImagePickerAsset
  ): string | null => {
    const suppliedMime = image.mimeType?.toLowerCase();

    if (
      suppliedMime &&
      ALLOWED_MIME_TYPES.includes(suppliedMime)
    ) {
      return suppliedMime;
    }

    const filename = image.fileName || image.uri;
    const extension = filename
      .split("?")[0]
      .split(".")
      .pop()
      ?.toLowerCase();

    if (extension === "jpg" || extension === "jpeg") {
      return "image/jpeg";
    }

    if (extension === "png") {
      return "image/png";
    }

    if (extension === "webp") {
      return "image/webp";
    }

    return null;
  };

  const uploadPicture = async () => {
    const cleanTitle = title.trim();

    if (!cleanTitle) {
      Alert.alert("Title required", "Enter a title for this picture.");
      return;
    }

    if (!selectedImage) {
      Alert.alert("Picture required", "Select a picture first.");
      return;
    }

    const mimeType = getImageMimeType(selectedImage);

    if (!mimeType) {
      Alert.alert(
        "Unsupported image",
        "Only JPEG, PNG and WebP images are accepted. Please select a supported image."
      );
      return;
    }

    setUploading(true);

    let storagePath: string | null = null;

    try {
      // Read the selected local image as binary data.
      // Do not upload the URI string or a text/plain Blob.
      const response = await fetch(selectedImage.uri);

      if (!response.ok) {
        throw new Error("Could not read the selected picture.");
      }

      const imageArrayBuffer = await response.arrayBuffer();

      if (imageArrayBuffer.byteLength > MAX_IMAGE_SIZE) {
        throw new Error("The image must not exceed 5 MB.");
      }

      if (imageArrayBuffer.byteLength === 0) {
        throw new Error("The selected image is empty.");
      }

      const extension =
        mimeType === "image/jpeg"
          ? "jpg"
          : mimeType === "image/png"
            ? "png"
            : "webp";

      storagePath =
        `slides/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 10)}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, imageArrayBuffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { error: insertError } = await supabase
        .from("homepage_slides")
        .insert({
          title: cleanTitle,
          image_path: storagePath,
          is_published: false,
          sort_order: slides.length,
        });

      if (insertError) {
        await supabase.storage
          .from(BUCKET_NAME)
          .remove([storagePath]);

        storagePath = null;
        throw insertError;
      }

      Alert.alert(
        "Picture uploaded",
        "Your picture and title have been saved as a draft. Publish it when it is ready."
      );

      storagePath = null;
      resetForm();
      await loadSlides();
    } catch (error) {
      if (storagePath) {
        await supabase.storage
          .from(BUCKET_NAME)
          .remove([storagePath]);
      }

      Alert.alert(
        "Upload failed",
        error instanceof Error
          ? error.message
          : "An unexpected error occurred."
      );
    } finally {
      setUploading(false);
    }
  };

  const saveTitle = async (slide: HomepageSlide) => {
    const cleanTitle = title.trim();

    if (!cleanTitle) {
      Alert.alert("Title required", "Enter a title for this picture.");
      return;
    }

    setSavingEdit(true);

    try {
      const { error } = await supabase
        .from("homepage_slides")
        .update({ title: cleanTitle })
        .eq("id", slide.id);

      if (error) {
        throw error;
      }

      resetForm();
      await loadSlides();

      Alert.alert(
        "Title updated",
        "The picture title has been updated."
      );
    } catch (error) {
      Alert.alert(
        "Could not update title",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const togglePublished = async (slide: HomepageSlide) => {
    const nextPublished = !slide.is_published;

    setBusySlideId(slide.id);

    try {
      const { error } = await supabase
        .from("homepage_slides")
        .update({ is_published: nextPublished })
        .eq("id", slide.id);

      if (error) {
        throw error;
      }

      await loadSlides();

      Alert.alert(
        nextPublished ? "Picture published" : "Picture unpublished",
        nextPublished
          ? "This picture is now available to the citizens' app."
          : "This picture is now hidden from the citizens' app."
      );
    } catch (error) {
      Alert.alert(
        "Could not change publication status",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setBusySlideId(null);
    }
  };

  const moveSlide = async (
    slide: HomepageSlide,
    direction: "up" | "down"
  ) => {
    if (reordering || slides.length < 2) {
      return;
    }

    const currentIndex = slides.findIndex(
      (item) => item.id === slide.id
    );

    if (currentIndex < 0) {
      return;
    }

    const targetIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= slides.length) {
      return;
    }

    const otherSlide = slides[targetIndex];

    const currentOrder = slide.sort_order ?? currentIndex;
    const otherOrder = otherSlide.sort_order ?? targetIndex;

    const temporaryOrder =
      Math.min(
        ...slides.map((item, index) => item.sort_order ?? index)
      ) - 1;

    setReordering(true);

    try {
      const { error: firstError } = await supabase
        .from("homepage_slides")
        .update({ sort_order: temporaryOrder })
        .eq("id", slide.id);

      if (firstError) {
        throw firstError;
      }

      const { error: secondError } = await supabase
        .from("homepage_slides")
        .update({ sort_order: currentOrder })
        .eq("id", otherSlide.id);

      if (secondError) {
        await supabase
          .from("homepage_slides")
          .update({ sort_order: currentOrder })
          .eq("id", slide.id);

        throw secondError;
      }

      const { error: thirdError } = await supabase
        .from("homepage_slides")
        .update({ sort_order: otherOrder })
        .eq("id", slide.id);

      if (thirdError) {
        await supabase
          .from("homepage_slides")
          .update({ sort_order: otherOrder })
          .eq("id", otherSlide.id);

        await supabase
          .from("homepage_slides")
          .update({ sort_order: currentOrder })
          .eq("id", slide.id);

        throw thirdError;
      }

      await loadSlides();
    } catch (error) {
      Alert.alert(
        "Could not reorder pictures",
        error instanceof Error
          ? error.message
          : "Please try again."
      );

      await loadSlides();
    } finally {
      setReordering(false);
    }
  };

  const deleteSlide = (slide: HomepageSlide) => {
    Alert.alert(
      "Delete picture?",
      "This will remove the picture and its title from the slideshow. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setBusySlideId(slide.id);

            try {
              const { error: deleteError } = await supabase
                .from("homepage_slides")
                .delete()
                .eq("id", slide.id);

              if (deleteError) {
                throw deleteError;
              }

              if (
                slide.image_path &&
                !slide.image_path.startsWith("http://") &&
                !slide.image_path.startsWith("https://")
              ) {
                const { error: storageError } = await supabase.storage
                  .from(BUCKET_NAME)
                  .remove([slide.image_path]);

                if (storageError) {
                  Alert.alert(
                    "Record deleted",
                    "The database record was deleted, but the stored image could not be removed. Check Storage permissions."
                  );
                }
              }

              if (editingId === slide.id) {
                resetForm();
              }

              await loadSlides();
            } catch (error) {
              Alert.alert(
                "Delete failed",
                error instanceof Error
                  ? error.message
                  : "Could not delete this picture."
              );
            } finally {
              setBusySlideId(null);
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
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>CONTENT MANAGEMENT</Text>
            <Text style={styles.pageTitle}>Homepage Pictures</Text>
            <Text style={styles.subtitle}>
              Manage the pictures and titles displayed on the citizens' homepage.
            </Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>🖼️</Text>
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>
              Homepage picture slideshow
            </Text>
            <Text style={styles.infoDescription}>
              Every picture must have a title. Published pictures and their
              titles appear together in the citizens' homepage slideshow.
              You can also control their display order.
            </Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>
            {editingId ? "Edit picture title" : "Add a new picture"}
          </Text>

          {!editingId && (
            <>
              <Text style={styles.fieldLabel}>Picture</Text>

              <Pressable
                onPress={chooseImage}
                style={styles.imagePicker}
                accessibilityRole="button"
              >
                {selectedImage ? (
                  <Image
                    source={{ uri: selectedImage.uri }}
                    style={styles.selectedImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Text style={styles.imagePlaceholderIcon}>＋</Text>
                    <Text style={styles.imagePickerTitle}>
                      Choose a picture
                    </Text>
                    <Text style={styles.imagePickerSubtitle}>
                      JPEG, PNG or WebP · Maximum 5 MB
                    </Text>
                  </View>
                )}
              </Pressable>

              {selectedImage && (
                <Pressable
                  onPress={chooseImage}
                  style={styles.changeImage}
                >
                  <Text style={styles.changeImageText}>
                    Choose another picture
                  </Text>
                </Pressable>
              )}
            </>
          )}

          <Text style={styles.fieldLabel}>
            Picture title (required)
          </Text>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Community Development Projects"
            placeholderTextColor="#96A29A"
            style={styles.input}
            maxLength={100}
            returnKeyType="done"
          />

          <Text style={styles.helperText}>
            The title will be displayed together with this picture in the
            citizens' homepage slideshow.
          </Text>

          <View style={styles.formButtons}>
            <Pressable
              onPress={() => {
                if (editingId) {
                  const slide = slides.find(
                    (item) => item.id === editingId
                  );

                  if (slide) {
                    saveTitle(slide);
                  }
                } else {
                  uploadPicture();
                }
              }}
              disabled={uploading || savingEdit}
              style={[
                styles.primaryButton,
                (uploading || savingEdit) && styles.disabledButton,
              ]}
            >
              {uploading || savingEdit ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {editingId ? "Save title" : "Upload picture"}
                </Text>
              )}
            </Pressable>

            {editingId && (
              <Pressable
                onPress={resetForm}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.listHeader}>
          <View>
            <Text style={styles.sectionTitle}>Uploaded pictures</Text>
            <Text style={styles.listSubtitle}>
              {slides.length}{" "}
              {slides.length === 1 ? "picture" : "pictures"} total
            </Text>
          </View>

          <Pressable
            onPress={loadSlides}
            style={styles.refreshButton}
            disabled={loading || reordering}
          >
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#176B45"
            style={styles.loader}
          />
        ) : slides.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📷</Text>
            <Text style={styles.emptyTitle}>No pictures yet</Text>
            <Text style={styles.emptyDescription}>
              Choose a picture above, add its title and upload it to get started.
            </Text>
          </View>
        ) : (
          <View style={styles.slideList}>
            {slides.map((slide, index) => (
              <View key={slide.id} style={styles.slideCard}>
                <Image
                  source={{ uri: getImageUrl(slide.image_path) }}
                  style={styles.slideImage}
                  resizeMode="contain"
                />

                <View style={styles.slideDetails}>
                  <View style={styles.slideTitleRow}>
                    <Text style={styles.slideTitle} numberOfLines={2}>
                      {slide.title?.trim() || "Untitled picture"}
                    </Text>

                    <View
                      style={[
                        styles.statusBadge,
                        slide.is_published
                          ? styles.publishedBadge
                          : styles.draftBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          slide.is_published
                            ? styles.publishedText
                            : styles.draftText,
                        ]}
                      >
                        {slide.is_published ? "PUBLISHED" : "DRAFT"}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.orderLabel}>
                    Slideshow position: {index + 1}
                  </Text>

                  <View style={styles.orderActions}>
                    <Pressable
                      onPress={() => moveSlide(slide, "up")}
                      disabled={index === 0 || reordering || loading}
                      style={[
                        styles.orderButton,
                        (index === 0 || reordering) &&
                          styles.disabledOrderButton,
                      ]}
                    >
                      <Text style={styles.orderButtonText}>
                        ↑ Move up
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => moveSlide(slide, "down")}
                      disabled={
                        index === slides.length - 1 ||
                        reordering ||
                        loading
                      }
                      style={[
                        styles.orderButton,
                        (index === slides.length - 1 || reordering) &&
                          styles.disabledOrderButton,
                      ]}
                    >
                      <Text style={styles.orderButtonText}>
                        ↓ Move down
                      </Text>
                    </Pressable>

                    {reordering && (
                      <ActivityIndicator
                        color="#176B45"
                        size="small"
                      />
                    )}
                  </View>

                  <View style={styles.slideActions}>
                    <Pressable
                      onPress={() => {
                        setEditingId(slide.id);
                        setTitle(slide.title ?? "");
                        setSelectedImage(null);
                      }}
                      style={styles.secondaryButton}
                    >
                      <Text style={styles.secondaryButtonText}>
                        Edit title
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => togglePublished(slide)}
                      disabled={busySlideId === slide.id}
                      style={[
                        styles.publishButton,
                        slide.is_published && styles.unpublishButton,
                      ]}
                    >
                      {busySlideId === slide.id ? (
                        <ActivityIndicator
                          size="small"
                          color={
                            slide.is_published ? "#176B45" : "#FFFFFF"
                          }
                        />
                      ) : (
                        <Text
                          style={[
                            styles.publishButtonText,
                            slide.is_published &&
                              styles.unpublishButtonText,
                          ]}
                        >
                          {slide.is_published
                            ? "Unpublish"
                            : "Publish"}
                        </Text>
                      )}
                    </Pressable>

                    <Pressable
                      onPress={() => deleteSlide(slide)}
                      disabled={busySlideId === slide.id}
                      style={styles.deleteButton}
                    >
                      <Text style={styles.deleteButtonText}>
                        Delete
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.footerNote}>
          <Text style={styles.footerNoteText}>
            Only publish approved pictures. Every picture must have a clear,
            relevant and readable title.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F8F5",
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 22,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EBE5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  backText: {
    fontSize: 32,
    color: "#176B45",
    lineHeight: 35,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.3,
    color: "#176B45",
  },
  pageTitle: {
    color: "#1D3024",
    fontSize: 23,
    fontWeight: "900",
    marginTop: 5,
  },
  subtitle: {
    color: "#78877D",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: "#E8F5EC",
    borderRadius: 17,
    padding: 15,
    marginBottom: 20,
  },
  infoIcon: {
    fontSize: 25,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
  },
  infoTitle: {
    color: "#205D3E",
    fontWeight: "900",
    fontSize: 13,
  },
  infoDescription: {
    color: "#567461",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5ECE6",
    padding: 16,
    marginBottom: 27,
  },
  sectionTitle: {
    color: "#203329",
    fontSize: 17,
    fontWeight: "900",
  },
  fieldLabel: {
    color: "#35483B",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 18,
    marginBottom: 8,
  },
  imagePicker: {
    height: 175,
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: "#F0F5F1",
    borderWidth: 1,
    borderColor: "#DDE7DF",
    borderStyle: "dashed",
  },
  selectedImage: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  imagePlaceholderIcon: {
    fontSize: 32,
    color: "#176B45",
    fontWeight: "400",
  },
  imagePickerTitle: {
    color: "#245D3E",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 5,
  },
  imagePickerSubtitle: {
    color: "#829087",
    fontSize: 11,
    marginTop: 5,
  },
  changeImage: {
    alignSelf: "flex-start",
    marginTop: 8,
  },
  changeImageText: {
    color: "#176B45",
    fontWeight: "800",
    fontSize: 11,
  },
  input: {
    minHeight: 49,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDE6DF",
    paddingHorizontal: 13,
    color: "#203329",
    fontSize: 13,
    backgroundColor: "#FFFFFF",
  },
  helperText: {
    color: "#89958D",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 7,
  },
  formButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 17,
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: "#176B45",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },
  cancelButton: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 13,
    backgroundColor: "#F0F3F1",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    color: "#48564C",
    fontWeight: "800",
    fontSize: 12,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 13,
  },
  listSubtitle: {
    color: "#87938B",
    fontSize: 11,
    marginTop: 4,
  },
  refreshButton: {
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 10,
    backgroundColor: "#E6F3EA",
  },
  refreshText: {
    color: "#176B45",
    fontWeight: "900",
    fontSize: 11,
  },
  loader: {
    marginTop: 30,
    marginBottom: 30,
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    padding: 25,
    borderWidth: 1,
    borderColor: "#E5ECE6",
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    color: "#203329",
    fontWeight: "900",
    fontSize: 14,
    marginTop: 10,
  },
  emptyDescription: {
    color: "#87938B",
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 6,
  },
  slideList: {
    gap: 14,
  },
  slideCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E5ECE6",
    overflow: "hidden",
  },
  slideImage: {
    width: "100%",
    height: 200,
    backgroundColor: "#EEF2EF",
  },
  slideDetails: {
    padding: 13,
  },
  slideTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  slideTitle: {
    flex: 1,
    color: "#203329",
    fontWeight: "900",
    fontSize: 13,
    lineHeight: 19,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  publishedBadge: {
    backgroundColor: "#E6F5EA",
  },
  draftBadge: {
    backgroundColor: "#FFF3DE",
  },
  statusText: {
    fontSize: 8,
    fontWeight: "900",
  },
  publishedText: {
    color: "#176B45",
  },
  draftText: {
    color: "#99651A",
  },
  orderLabel: {
    color: "#78877D",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 10,
  },
  orderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  orderButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: "#E8F5EC",
  },
  disabledOrderButton: {
    opacity: 0.35,
  },
  orderButtonText: {
    color: "#176B45",
    fontSize: 10,
    fontWeight: "900",
  },
  slideActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 13,
  },
  secondaryButton: {
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#EDF3EF",
  },
  secondaryButtonText: {
    color: "#335A42",
    fontSize: 10,
    fontWeight: "800",
  },
  publishButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#176B45",
    minWidth: 75,
    alignItems: "center",
    justifyContent: "center",
  },
  publishButtonText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },
  unpublishButton: {
    backgroundColor: "#E7F4EA",
  },
  unpublishButtonText: {
    color: "#176B45",
  },
  deleteButton: {
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#FFF0F0",
  },
  deleteButtonText: {
    color: "#B83232",
    fontSize: 10,
    fontWeight: "900",
  },
  footerNote: {
    marginTop: 20,
    padding: 13,
    borderRadius: 12,
    backgroundColor: "#EEF2EF",
  },
  footerNoteText: {
    color: "#65736A",
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
  },
});
