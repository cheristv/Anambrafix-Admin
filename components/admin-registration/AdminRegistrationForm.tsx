
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import {
    registerAdmin,
    type AdminRegistrationInput,
} from "../../lib/admin-registration";

type Props = {
  onSuccess?: () => void;
};

export default function AdminRegistrationForm({ onSuccess }: Props) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password || !confirmPassword) {
      Alert.alert("Required fields", "Please complete every field.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      Alert.alert("Invalid email", "Enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      Alert.alert(
        "Password too short",
        "Use a password with at least 8 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Passwords do not match", "Please check both passwords.");
      return;
    }

    if (loading) return;

    setLoading(true);

    try {
      const input: AdminRegistrationInput = {
        fullName: cleanName,
        email: cleanEmail,
        password,
      };

      await registerAdmin(input);

      setFullName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");

      Alert.alert(
        "Administrator created",
        "The new administrator account has been created successfully.",
        [{ text: "OK", onPress: onSuccess }]
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.";

      Alert.alert("Registration failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.form}>
      <Text style={styles.title}>Register Administrator</Text>
      <Text style={styles.description}>
        Create an account for an authorised member of the administration team.
      </Text>

      <Text style={styles.label}>FULL NAME</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter full name"
        placeholderTextColor="#8A9990"
        value={fullName}
        onChangeText={setFullName}
        autoCapitalize="words"
        editable={!loading}
      />

      <Text style={styles.label}>EMAIL ADDRESS</Text>
      <TextInput
        style={styles.input}
        placeholder="admin@example.com"
        placeholderTextColor="#8A9990"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
      />

      <Text style={styles.label}>PASSWORD</Text>
      <View style={styles.passwordRow}>
        <TextInput
          style={styles.passwordInput}
          placeholder="At least 8 characters"
          placeholderTextColor="#8A9990"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          editable={!loading}
        />
        <TouchableOpacity
          onPress={() => setShowPassword(!showPassword)}
          disabled={loading}
          style={styles.showButton}
        >
          <Text style={styles.showText}>{showPassword ? "Hide" : "Show"}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>CONFIRM PASSWORD</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter the password again"
        placeholderTextColor="#8A9990"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        editable={!loading}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleRegister}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Create Administrator</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.note}>
        Only the designated owner account can create administrator accounts.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    width: "100%",
  },
  title: {
    color: "#164B35",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 8,
  },
  description: {
    color: "#718078",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 24,
  },
  label: {
    color: "#40574A",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: "#DCE6DF",
    backgroundColor: "#FBFDFC",
    borderRadius: 11,
    paddingHorizontal: 14,
    color: "#20382B",
    fontSize: 14,
    marginBottom: 17,
  },
  passwordRow: {
    height: 52,
    borderWidth: 1,
    borderColor: "#DCE6DF",
    backgroundColor: "#FBFDFC",
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 14,
    marginBottom: 17,
  },
  passwordInput: {
    flex: 1,
    color: "#20382B",
    fontSize: 14,
    height: "100%",
  },
  showButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  showText: {
    color: "#176B45",
    fontSize: 12,
    fontWeight: "700",
  },
  button: {
    height: 54,
    backgroundColor: "#176B45",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  note: {
    color: "#718078",
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 17,
  },
});
