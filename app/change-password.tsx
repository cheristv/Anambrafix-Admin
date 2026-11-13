
import { router } from "expo-router";
import { useState } from "react";
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

export default function ChangePasswordScreen() {
  const { theme } = useAppTheme();
  const styles = createStyles(theme);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Missing information", "Please complete all password fields.");
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert(
        "Password too short",
        "Your new password must contain at least 8 characters."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(
        "Passwords do not match",
        "Please make sure your new password and confirmation are the same."
      );
      return;
    }

    if (newPassword === currentPassword) {
      Alert.alert(
        "Choose a different password",
        "Your new password must be different from your current password."
      );
      return;
    }

    setLoading(true);

    try {
      // Get the currently signed-in administrator.
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert(
          "Authentication error",
          "Your administrator session could not be verified. Please sign in again."
        );
        return;
      }

      if (!user.email) {
        Alert.alert(
          "Account error",
          "This administrator account does not have an email address. Please contact your system administrator."
        );
        return;
      }

      // Verify the current password by signing in with the same account.
      const { error: signInError } =
        await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });

      if (signInError) {
        Alert.alert(
          "Incorrect current password",
          "The current password you entered is incorrect. Please try again."
        );
        return;
      }

      // Update this administrator's password in Supabase Auth.
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        Alert.alert("Update failed", updateError.message);
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      Alert.alert(
        "Password updated",
        "Your administrator password has been changed successfully.",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );
    } catch {
      Alert.alert(
        "Something went wrong",
        "We could not update your password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const renderPasswordField = (
    label: string,
    value: string,
    onChangeText: (value: string) => void,
    visible: boolean,
    setVisible: (value: boolean) => void,
    placeholder: string
  ) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.secondaryText}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />

        <Pressable
          style={styles.showButton}
          onPress={() => setVisible(!visible)}
          disabled={loading}
        >
          <Text style={styles.showText}>
            {visible ? "Hide" : "Show"}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={styles.backText}>‹  Back to Settings</Text>
        </Pressable>

        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>🔐</Text>
          </View>

          <Text style={styles.heading}>Change Password</Text>

          <Text style={styles.subtitle}>
            Update your administrator account password securely.
          </Text>
        </View>

        <View style={styles.form}>
          {renderPasswordField(
            "Current Password",
            currentPassword,
            setCurrentPassword,
            showCurrentPassword,
            setShowCurrentPassword,
            "Enter your current password"
          )}

          {renderPasswordField(
            "New Password",
            newPassword,
            setNewPassword,
            showNewPassword,
            setShowNewPassword,
            "Enter your new password"
          )}

          {renderPasswordField(
            "Confirm New Password",
            confirmPassword,
            setConfirmPassword,
            showConfirmPassword,
            setShowConfirmPassword,
            "Enter your new password again"
          )}

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Password requirement</Text>
            <Text style={styles.infoText}>
              Your new password must contain at least 8 characters.
            </Text>
          </View>

          <Pressable
            style={[
              styles.updateButton,
              loading && styles.disabledButton,
            ]}
            onPress={handleChangePassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.updateButtonText}>
                Update Password
              </Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.footer}>
          Your password is securely managed by Supabase.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      padding: 20,
      paddingTop: 55,
      paddingBottom: 45,
    },
    backButton: {
      alignSelf: "flex-start",
      paddingVertical: 8,
      marginBottom: 25,
    },
    backText: {
      color: "#247A50",
      fontSize: 14,
      fontWeight: "700",
    },
    header: {
      alignItems: "center",
      marginBottom: 30,
    },
    headerIcon: {
      width: 65,
      height: 65,
      borderRadius: 20,
      backgroundColor: theme.inputBackground,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 17,
    },
    headerIconText: {
      fontSize: 30,
    },
    heading: {
      color: theme.text,
      fontSize: 24,
      fontWeight: "800",
    },
    subtitle: {
      color: theme.secondaryText,
      fontSize: 13,
      textAlign: "center",
      lineHeight: 20,
      marginTop: 9,
    },
    form: {
      backgroundColor: theme.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 18,
    },
    fieldContainer: {
      marginBottom: 19,
    },
    label: {
      color: theme.text,
      fontSize: 13,
      fontWeight: "700",
      marginBottom: 9,
    },
    inputWrapper: {
      minHeight: 53,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.inputBackground,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 13,
    },
    input: {
      flex: 1,
      color: theme.text,
      fontSize: 13,
      paddingVertical: 14,
    },
    showButton: {
      paddingLeft: 12,
      paddingVertical: 10,
    },
    showText: {
      color: "#247A50",
      fontSize: 12,
      fontWeight: "700",
    },
    infoBox: {
      backgroundColor: theme.inputBackground,
      borderRadius: 11,
      padding: 13,
      marginTop: 2,
      marginBottom: 22,
    },
    infoTitle: {
      color: theme.text,
      fontSize: 12,
      fontWeight: "700",
      marginBottom: 5,
    },
    infoText: {
      color: theme.secondaryText,
      fontSize: 12,
      lineHeight: 18,
    },
    updateButton: {
      height: 53,
      backgroundColor: "#247A50",
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    disabledButton: {
      opacity: 0.65,
    },
    updateButtonText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "800",
    },
    footer: {
      color: theme.secondaryText,
      fontSize: 11,
      textAlign: "center",
      marginTop: 28,
    },
  });
