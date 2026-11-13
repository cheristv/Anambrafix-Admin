
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { ThemePreference, useAppTheme } from "../context/ThemeContext";

const appearanceOptions: {
  label: string;
  description: string;
  value: ThemePreference;
  icon: string;
}[] = [
  {
    label: "Light Mode",
    description: "Always use the light appearance.",
    value: "light",
    icon: "☀️",
  },
  {
    label: "Dark Mode",
    description: "Always use the dark appearance.",
    value: "dark",
    icon: "🌙",
  },
  {
    label: "System Default",
    description: "Follow your device appearance settings.",
    value: "system",
    icon: "📱",
  },
];

export default function AppearanceScreen() {
  const { theme, isDark, preference, setPreference } = useAppTheme();
  const [saving, setSaving] = useState(false);

  const handleAppearanceChange = async (value: ThemePreference) => {
    try {
      setSaving(true);
      await setPreference(value);
    } catch (error) {
      console.error("Unable to update appearance:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={[
              styles.backButton,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.backText, { color: theme.text }]}>‹</Text>
          </Pressable>

          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.text }]}>
              Appearance
            </Text>
            <Text style={[styles.subtitle, { color: theme.secondaryText }]}>
              Personalise how your admin app looks.
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.preview,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Display preference
          </Text>

          <Text style={[styles.sectionDescription, { color: theme.secondaryText }]}>
            Choose how Igbo-Eze-North Admin should appear on your device.
          </Text>

          {appearanceOptions.map((option) => {
            const selected = preference === option.value;

            return (
              <Pressable
                key={option.value}
                disabled={saving}
                onPress={() => handleAppearanceChange(option.value)}
                style={[
                  styles.option,
                  {
                    backgroundColor: selected
                      ? isDark
                        ? "#263D30"
                        : "#EAF5EE"
                      : theme.inputBackground,
                    borderColor: selected ? theme.primary : theme.border,
                  },
                ]}
              >
                <View style={styles.optionIcon}>
                  <Text style={styles.icon}>{option.icon}</Text>
                </View>

                <View style={styles.optionContent}>
                  <Text style={[styles.optionTitle, { color: theme.text }]}>
                    {option.label}
                  </Text>
                  <Text
                    style={[
                      styles.optionDescription,
                      { color: theme.secondaryText },
                    ]}
                  >
                    {option.description}
                  </Text>
                </View>

                <View
                  style={[
                    styles.radioOuter,
                    { borderColor: selected ? theme.primary : theme.secondaryText },
                  ]}
                >
                  {selected && (
                    <View
                      style={[
                        styles.radioInner,
                        { backgroundColor: theme.primary },
                      ]}
                    />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View
          style={[
            styles.note,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.noteTitle, { color: theme.text }]}>
            Your preference
          </Text>
          <Text style={[styles.noteText, { color: theme.secondaryText }]}>
            Your selection is saved automatically and will be remembered when
            you reopen the app.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    padding: 20,
    paddingTop: 55,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 30,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  backText: {
    fontSize: 32,
    lineHeight: 36,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 13,
    marginTop: 5,
  },
  preview: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  sectionDescription: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 7,
    marginBottom: 18,
  },
  option: {
    minHeight: 78,
    borderWidth: 1,
    borderRadius: 15,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  icon: {
    fontSize: 22,
  },
  optionContent: {
    flex: 1,
    paddingRight: 8,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  optionDescription: {
    fontSize: 11,
    marginTop: 5,
  },
  radioOuter: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },
  note: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 18,
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  noteText: {
    fontSize: 12,
    lineHeight: 19,
    marginTop: 6,
  },
});
