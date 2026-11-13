
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AdminRegistrationForm from "../components/admin-registration/AdminRegistrationForm";

export default function RegisterAdminScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image
            source={require("../assets/anambralogo.png")}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.appName}>Igbo-Eze-North</Text>
          <Text style={styles.portal}>ADMINISTRATION PORTAL</Text>
        </View>

        <View style={styles.card}>
          <AdminRegistrationForm
            onSuccess={() => router.replace("/login")}
          />
        </View>

        <Text style={styles.footer}>
          Restricted administrative access
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F7F5",
  },
  content: {
    flexGrow: 1,
    padding: 22,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  logo: {
    width: 82,
    height: 82,
    marginBottom: 10,
  },
  appName: {
    fontSize: 23,
    fontWeight: "800",
    color: "#164B35",
  },
  portal: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#64766B",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E8EEE9",
  },
  footer: {
    textAlign: "center",
    color: "#87958D",
    fontSize: 11,
    marginTop: 22,
  },
});
