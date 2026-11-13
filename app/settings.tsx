
import { router } from "expo-router";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";

export default function SettingsScreen() {
  const { theme } = useAppTheme();
  const styles = createStyles(theme);

  const settingsOptions = [
    {
      title: "My Profile",
      description: "Manage your personal information",
      icon: "👤",
      route: "/profile",
    },
    {
      title: "Change Password",
      description: "Update your administrator account password",
      icon: "🔐",
      route: "/change-password",
    },
    {
      title: "Appearance",
      description: "Choose light, dark or system mode",
      icon: "🎨",
      route: "/appearance",
    },
    {
      title: "Notifications",
      description: "Manage your notification preferences",
      icon: "🔔",
      route: "/notifications",
    },
  ] as const;

  const handleSignOut = () => {
    Alert.alert(
      "Sign out",
      "Are you sure you want to sign out of your administrator account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.auth.signOut();

            if (error) {
              Alert.alert("Sign out failed", error.message);
              return;
            }

            router.replace("/login");
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.heading}>Settings</Text>
      <Text style={styles.subtitle}>
        Manage your account and app preferences.
      </Text>

      <View style={styles.optionsContainer}>
        {settingsOptions.map((option) => (
          <Pressable
            key={option.title}
            style={styles.option}
            onPress={() => router.push(option.route)}
          >
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>{option.icon}</Text>
            </View>

            <View style={styles.optionTextContainer}>
              <Text style={styles.optionTitle}>{option.title}</Text>
              <Text style={styles.optionDescription}>
                {option.description}
              </Text>
            </View>

            <Text style={styles.arrow}>›</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={styles.signOutButton}
        onPress={handleSignOut}
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>

      <Text style={styles.footer}>
        Igbo-Eze North Administration
      </Text>
    </ScrollView>
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
      paddingTop: 65,
      paddingBottom: 45,
    },
    heading: {
      fontSize: 27,
      fontWeight: "800",
      color: theme.text,
    },
    subtitle: {
      fontSize: 13,
      color: theme.secondaryText,
      marginTop: 7,
      marginBottom: 28,
    },
    optionsContainer: {
      gap: 13,
    },
    option: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      borderRadius: 15,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    iconContainer: {
      width: 46,
      height: 46,
      borderRadius: 13,
      backgroundColor: theme.inputBackground,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 13,
    },
    icon: {
      fontSize: 21,
    },
    optionTextContainer: {
      flex: 1,
    },
    optionTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: "700",
    },
    optionDescription: {
      color: theme.secondaryText,
      fontSize: 11,
      marginTop: 5,
    },
    arrow: {
      color: theme.secondaryText,
      fontSize: 27,
      marginLeft: 8,
    },
    signOutButton: {
      height: 52,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "#D94A4A",
      justifyContent: "center",
      alignItems: "center",
      marginTop: 35,
    },
    signOutText: {
      color: "#D94A4A",
      fontSize: 14,
      fontWeight: "700",
    },
    footer: {
      color: theme.secondaryText,
      fontSize: 11,
      textAlign: "center",
      marginTop: 35,
    },
  });
