
import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";

type AdminProfile = {
  surname: string;
  other_names: string;
  phone: string;
};

type UserRole = "admin" | "super_admin" | "citizen";

export default function ProfileScreen() {
  const { theme, isDark } = useAppTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Administrator");
  const [isActive, setIsActive] = useState(true);

  const [profile, setProfile] = useState<AdminProfile>({
    surname: "",
    other_names: "",
    phone: "",
  });

  const styles = createStyles(theme, isDark);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        Alert.alert("Session expired", "Please sign in again.");
        router.replace("/login");
        return;
      }

      setEmail(user.email ?? "");

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("surname, other_names, phone")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (profileData) {
        setProfile({
          surname: profileData.surname ?? "",
          other_names: profileData.other_names ?? "",
          phone: profileData.phone ?? "",
        });
      }

      // Load administrator access from the existing user_roles table.
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (roleError) throw roleError;

      const currentRole = roleData?.role as UserRole | undefined;

      if (currentRole === "super_admin") {
        setRole("Super Admin");
        setIsActive(true);
      } else if (currentRole === "admin") {
        setRole("Administrator");
        setIsActive(true);
      } else {
        setRole("No Administrator Role");
        setIsActive(false);
      }
    } catch (error: any) {
      console.error("Profile loading error:", error);

      Alert.alert(
        "Unable to load profile",
        error?.message ?? "Something went wrong while loading your profile."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile.surname.trim()) {
      Alert.alert("Required field", "Please enter your surname.");
      return;
    }

    if (!profile.other_names.trim()) {
      Alert.alert("Required field", "Please enter your other names.");
      return;
    }

    if (!profile.phone.trim()) {
      Alert.alert("Required field", "Please enter your phone number.");
      return;
    }

    try {
      setSaving(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        Alert.alert("Session expired", "Please sign in again.");
        router.replace("/login");
        return;
      }

      if (!user.email) {
        Alert.alert(
          "Email unavailable",
          "Your account does not have an email address."
        );
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            surname: profile.surname.trim(),
            other_names: profile.other_names.trim(),
            phone: profile.phone.trim(),
            email: user.email,
          },
          { onConflict: "id" }
        );

      if (error) throw error;

      Alert.alert(
        "Success",
        "Your profile has been updated successfully."
      );
    } catch (error: any) {
      console.error("Profile save error:", error);

      Alert.alert(
        "Save failed",
        error?.message ?? "Unable to save your profile. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: theme.background },
        ]}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Text style={styles.backText}>‹</Text>
            </Pressable>

            <Text style={styles.headerTitle}>My Profile</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(profile.surname?.charAt(0) || "A").toUpperCase()}
              </Text>
            </View>

            <Text style={styles.name}>
              {profile.surname || profile.other_names
                ? `${profile.surname} ${profile.other_names}`.trim()
                : "Administrator"}
            </Text>

            <Text style={styles.emailText}>{email}</Text>

            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{role}</Text>
            </View>
          </View>

          <View style={styles.statusCard}>
            <View>
              <Text style={styles.statusLabel}>Account status</Text>
              <Text style={styles.statusDescription}>
                {isActive
                  ? "Your administrator account is active."
                  : "Your account does not currently have administrator access."}
              </Text>
            </View>

            <View
              style={[
                styles.statusIndicator,
                {
                  backgroundColor: isActive ? "#1E9D61" : "#D64545",
                },
              ]}
            >
              <Text style={styles.statusIndicatorText}>
                {isActive ? "Active" : "Inactive"}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>

            <Text style={styles.sectionDescription}>
              Update your administrator profile details below.
            </Text>

            <Text style={styles.inputLabel}>Surname</Text>
            <TextInput
              style={styles.input}
              value={profile.surname}
              onChangeText={(value) =>
                setProfile((previous) => ({
                  ...previous,
                  surname: value,
                }))
              }
              placeholder="Enter your surname"
              placeholderTextColor={theme.secondaryText}
              autoCapitalize="words"
            />

            <Text style={styles.inputLabel}>Other Names</Text>
            <TextInput
              style={styles.input}
              value={profile.other_names}
              onChangeText={(value) =>
                setProfile((previous) => ({
                  ...previous,
                  other_names: value,
                }))
              }
              placeholder="Enter your other names"
              placeholderTextColor={theme.secondaryText}
              autoCapitalize="words"
            />

            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={profile.phone}
              onChangeText={(value) =>
                setProfile((previous) => ({
                  ...previous,
                  phone: value,
                }))
              }
              placeholder="Enter your phone number"
              placeholderTextColor={theme.secondaryText}
              keyboardType="phone-pad"
            />

            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput]}
              value={email}
              editable={false}
              placeholder="Email address"
              placeholderTextColor={theme.secondaryText}
            />

            <Text style={styles.readOnlyNote}>
              Your email address is managed by your sign-in account.
            </Text>

            <Pressable
              style={[
                styles.saveButton,
                saving && styles.disabledButton,
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.footerText}>
            AnambraFix Administration
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 45,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      marginTop: 12,
      color: theme.secondaryText,
      fontSize: 14,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 30,
      marginTop: 15,
    },
    backButton: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor: theme.surface,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },
    backText: {
      fontSize: 32,
      color: theme.text,
      lineHeight: 35,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.text,
    },
    headerSpacer: {
      width: 42,
    },
    avatarContainer: {
      alignItems: "center",
      marginBottom: 25,
    },
    avatar: {
      width: 86,
      height: 86,
      borderRadius: 43,
      backgroundColor: theme.primary,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 13,
    },
    avatarText: {
      fontSize: 35,
      fontWeight: "800",
      color: "#FFFFFF",
    },
    name: {
      fontSize: 21,
      fontWeight: "700",
      color: theme.text,
      textAlign: "center",
    },
    emailText: {
      color: theme.secondaryText,
      fontSize: 13,
      marginTop: 5,
    },
    roleBadge: {
      backgroundColor: isDark ? "#294A37" : "#E5F3E9",
      paddingHorizontal: 15,
      paddingVertical: 7,
      borderRadius: 20,
      marginTop: 12,
    },
    roleText: {
      color: theme.primary,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "capitalize",
    },
    statusCard: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 17,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 25,
    },
    statusLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.text,
    },
    statusDescription: {
      fontSize: 12,
      color: theme.secondaryText,
      marginTop: 5,
      maxWidth: 210,
    },
    statusIndicator: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
    },
    statusIndicatorText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "700",
    },
    section: {
      backgroundColor: theme.surface,
      borderRadius: 18,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
    },
    sectionDescription: {
      fontSize: 12,
      color: theme.secondaryText,
      marginTop: 6,
      marginBottom: 22,
    },
    inputLabel: {
      color: theme.text,
      fontSize: 13,
      fontWeight: "600",
      marginBottom: 8,
      marginTop: 14,
    },
    input: {
      height: 51,
      borderRadius: 11,
      paddingHorizontal: 14,
      backgroundColor: theme.inputBackground,
      borderWidth: 1,
      borderColor: theme.border,
      color: theme.text,
      fontSize: 14,
    },
    readOnlyInput: {
      opacity: 0.75,
    },
    readOnlyNote: {
      fontSize: 11,
      color: theme.secondaryText,
      marginTop: 7,
    },
    saveButton: {
      height: 53,
      borderRadius: 12,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 25,
    },
    disabledButton: {
      opacity: 0.65,
    },
    saveButtonText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "700",
    },
    footerText: {
      textAlign: "center",
      marginTop: 25,
      color: theme.secondaryText,
      fontSize: 11,
    },
  });
