
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";

type AdminRole = "admin" | "super_admin";

export default function AdminLoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert(
        "Missing Information",
        "Please enter your administrator email and password."
      );
      return;
    }

    if (loading) return;

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        Alert.alert(
          "Sign In Failed",
          "Your email or password may be incorrect. Please try again."
        );
        return;
      }

      const user = data.user;

      if (!user) {
        await supabase.auth.signOut();
        Alert.alert(
          "Sign In Failed",
          "We could not verify your account."
        );
        return;
      }

      // Verify administrator role directly from AnambraFix.
      const { data: roleRecord, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (roleError) {
        await supabase.auth.signOut();

        Alert.alert(
          "Verification Error",
          "We could not verify your administrator permissions. Please try again."
        );
        return;
      }

      const role = roleRecord?.role as AdminRole | undefined;

      if (role !== "admin" && role !== "super_admin") {
        await supabase.auth.signOut();

        Alert.alert(
          "Access Denied",
          "This account is not authorised to access AnambraFix Admin."
        );
        return;
      }

      router.replace("/dashboard");
    } catch {
      await supabase.auth.signOut();

      Alert.alert(
        "Connection Error",
        "We could not connect to the server. Check your internet connection and Supabase configuration."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topAccent} />

          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image
                source={require("../assets/anambralogo.png")}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.appName}>AnambraFix</Text>
            <Text style={styles.portalLabel}>ADMINISTRATION PORTAL</Text>

            <View style={styles.officialBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.officialBadgeText}>
                Restricted Administrator Access
              </Text>
            </View>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.welcomeTitle}>Welcome Back</Text>

            <Text style={styles.welcomeDescription}>
              Sign in with your authorised administrator account to manage
              community reports, public projects, announcements and civic
              information across Anambra State.
            </Text>

            <View style={styles.divider} />

            <Text style={styles.inputLabel}>ADMIN EMAIL ADDRESS</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputIcon}>✉</Text>

              <TextInput
                style={styles.input}
                placeholder="Enter your admin email"
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                editable={!loading}
              />
            </View>

            <Text style={styles.inputLabel}>PASSWORD</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputIcon}>●</Text>

              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoComplete="current-password"
                editable={!loading}
              />

              <TouchableOpacity
                onPress={() => setPasswordVisible(!passwordVisible)}
                style={styles.showPasswordButton}
                disabled={loading}
              >
                <Text style={styles.showPasswordText}>
                  {passwordVisible ? "Hide" : "Show"}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.loginButton,
                loading && styles.loginButtonDisabled,
              ]}
              onPress={handleLogin}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>
                    Sign In to Dashboard
                  </Text>
                  <Text style={styles.buttonArrow}>→</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.securityNotice}>
              <Text style={styles.lockIcon}>▣</Text>

              <Text style={styles.securityText}>
                Secure administrative access. Only authorised AnambraFix
                administrators can manage platform information.
              </Text>
            </View>
          </View>

          <View style={styles.footer}>
            <View style={styles.footerLine} />

            <Text style={styles.footerTitle}>ANAMBRAFIX</Text>

            <Text style={styles.footerSubtitle}>
              Civic Management Portal
            </Text>

            <Text style={styles.footerCopyright}>
              © {new Date().getFullYear()} AnambraFix. All rights reserved.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F7F5",
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingBottom: 28,
  },
  topAccent: {
    height: 5,
    backgroundColor: "#176B45",
    marginHorizontal: -22,
    marginBottom: 34,
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  logoContainer: {
    width: 112,
    height: 112,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1EAE4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    shadowColor: "#174D35",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  logoImage: {
    width: 94,
    height: 94,
  },
  appName: {
    fontSize: 27,
    fontWeight: "800",
    color: "#164B35",
    letterSpacing: -0.7,
    textAlign: "center",
  },
  portalLabel: {
    marginTop: 7,
    color: "#64766B",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
  },
  officialBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E5F2E9",
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 17,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#198754",
    marginRight: 8,
  },
  officialBadgeText: {
    color: "#176B45",
    fontSize: 11,
    fontWeight: "700",
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E8EEE9",
    shadowColor: "#173D2C",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 3,
  },
  welcomeTitle: {
    color: "#173F2D",
    fontSize: 23,
    fontWeight: "800",
    marginBottom: 9,
  },
  welcomeDescription: {
    color: "#718078",
    fontSize: 13,
    lineHeight: 21,
  },
  divider: {
    height: 1,
    backgroundColor: "#EAF0EC",
    marginTop: 20,
    marginBottom: 22,
  },
  inputLabel: {
    color: "#40574A",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
    marginBottom: 9,
    marginTop: 5,
  },
  inputContainer: {
    minHeight: 55,
    borderWidth: 1,
    borderColor: "#DCE6DF",
    borderRadius: 12,
    backgroundColor: "#FBFDFC",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    marginBottom: 19,
  },
  inputIcon: {
    color: "#648473",
    fontSize: 16,
    width: 27,
    textAlign: "center",
    marginRight: 5,
  },
  input: {
    flex: 1,
    color: "#20382B",
    fontSize: 14,
    paddingVertical: 14,
  },
  showPasswordButton: {
    paddingVertical: 10,
    paddingLeft: 8,
  },
  showPasswordText: {
    color: "#176B45",
    fontSize: 12,
    fontWeight: "700",
  },
  loginButton: {
    minHeight: 56,
    backgroundColor: "#176B45",
    borderRadius: 13,
    paddingHorizontal: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 5,
    shadowColor: "#176B45",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 9,
    elevation: 3,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  buttonArrow: {
    color: "#FFFFFF",
    fontSize: 22,
    marginLeft: 12,
    marginTop: -2,
  },
  securityNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F3F7F4",
    borderRadius: 10,
    padding: 12,
    marginTop: 20,
  },
  lockIcon: {
    color: "#176B45",
    fontSize: 15,
    marginRight: 9,
  },
  securityText: {
    flex: 1,
    color: "#66766D",
    fontSize: 11,
    lineHeight: 17,
  },
  footer: {
    alignItems: "center",
    marginTop: 30,
  },
  footerLine: {
    width: 42,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#D4E4D9",
    marginBottom: 15,
  },
  footerTitle: {
    color: "#466052",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textAlign: "center",
  },
  footerSubtitle: {
    color: "#87958D",
    fontSize: 11,
    marginTop: 7,
  },
  footerCopyright: {
    color: "#A0AAA4",
    fontSize: 10,
    marginTop: 12,
  },
});
