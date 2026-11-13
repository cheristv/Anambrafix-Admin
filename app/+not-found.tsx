
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.code}>404</Text>

      <Text style={styles.title}>Page Not Found</Text>

      <Text style={styles.message}>
        The page you are looking for does not exist.
      </Text>

      <Pressable
        style={styles.button}
        onPress={() => router.replace("/login")}
      >
        <Text style={styles.buttonText}>Return to Login</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#F7F9F7",
  },
  code: {
    fontSize: 56,
    fontWeight: "800",
    color: "#176B3A",
  },
  title: {
    fontSize: 23,
    fontWeight: "700",
    color: "#173B28",
    marginTop: 8,
  },
  message: {
    fontSize: 15,
    color: "#667085",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 24,
  },
  button: {
    backgroundColor: "#176B3A",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
