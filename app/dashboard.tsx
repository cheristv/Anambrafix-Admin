
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";

type AdminRole = "admin" | "super_admin";

type DashboardStat = {
  residents: number;
  projects: number;
  reports: number;
  announcements: number;
};

type ManagementItem = {
  title: string;
  description: string;
  icon: string;
  color: string;
  background: string;
  route: string;
  superAdminOnly?: boolean;
};

const managementItems: ManagementItem[] = [
  {
    title: "Homepage Pictures",
    description:
      "Upload pictures, add titles and manage the AnambraFix homepage slideshow",
    icon: "🖼️",
    color: "#247A50",
    background: "#EAF6EF",
    route: "/homepage-pictures",
  },
  {
    title: "Emergency & Security",
    description: "Manage emergency information and security contacts",
    icon: "🚨",
    color: "#D93636",
    background: "#FFF0F0",
    route: "/emergency",
  },
  {
    title: "Hospitals & Health Centres",
    description: "Manage hospitals, clinics and health facilities",
    icon: "🏥",
    color: "#1877C9",
    background: "#EAF4FF",
    route: "/hospitals",
  },
  {
    title: "Government Management",
    description:
      "Manage government officials, leadership history and state history",
    icon: "🏛️",
    color: "#247A50",
    background: "#EAF6EF",
    route: "/government",
  },
  {
    title: "Projects & Development",
    description: "Add public projects and update their progress",
    icon: "🏗️",
    color: "#B78316",
    background: "#FFF7E5",
    route: "/projects",
  },
  {
    title: "Announcements",
    description: "Create, publish and manage public announcements",
    icon: "📢",
    color: "#A45A16",
    background: "#FFF2E5",
    route: "/announcements",
  },
  {
    title: "Citizens' Reports",
    description: "Review citizens' reports, update statuses and respond",
    icon: "📋",
    color: "#167D87",
    background: "#E8F7F8",
    route: "/reports",
  },
  {
    title: "Citizens Management",
    description: "View and manage registered AnambraFix citizens",
    icon: "👥",
    color: "#465B9B",
    background: "#EEF1FF",
    route: "/citizens",
  },
  {
    title: "Administrators Management",
    description:
      "Add administrators, promote Super Admins and manage administrator access",
    icon: "🛡️",
    color: "#1877C9",
    background: "#EAF4FF",
    route: "/administrators",
    superAdminOnly: true,
  },
];

const initialStats: DashboardStat = {
  residents: 0,
  projects: 0,
  reports: 0,
  announcements: 0,
};

export default function DashboardScreen() {
  const [stats, setStats] = useState<DashboardStat>(initialStats);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // VERIFY ADMINISTRATOR AND LOAD DASHBOARD
  const loadDashboard = useCallback(async () => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      const { data: roleRecord, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (roleError) {
        console.log("Administrator verification error:", roleError.message);

        Alert.alert(
          "Verification Error",
          "We could not verify your administrator permissions. Please sign in again.",
          [
            {
              text: "OK",
              onPress: async () => {
                await supabase.auth.signOut();
                router.replace("/login");
              },
            },
          ]
        );
        return;
      }

      const userRole = roleRecord?.role;

      if (userRole !== "admin" && userRole !== "super_admin") {
        await supabase.auth.signOut();

        Alert.alert(
          "Access Denied",
          "Your account is not authorised to access AnambraFix Admin."
        );

        router.replace("/login");
        return;
      }

      setRole(userRole as AdminRole);

      const [
        residentsResult,
        projectsResult,
        reportsResult,
        announcementsResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true }),

        supabase
          .from("projects")
          .select("*", { count: "exact", head: true }),

        supabase
          .from("reports")
          .select("*", { count: "exact", head: true }),

        supabase
          .from("announcements")
          .select("*", { count: "exact", head: true }),
      ]);

      const results = [
        residentsResult,
        projectsResult,
        reportsResult,
        announcementsResult,
      ];

      const queryError = results.find((result) => result.error);

      if (queryError?.error) {
        console.log(
          "Dashboard statistics error:",
          queryError.error.message
        );
        return;
      }

      setStats({
        residents: residentsResult.count ?? 0,
        projects: projectsResult.count ?? 0,
        reports: reportsResult.count ?? 0,
        announcements: announcementsResult.count ?? 0,
      });
    } catch (error) {
      console.log("Dashboard loading error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // RELOAD WHEN DASHBOARD GETS FOCUS
  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  // PULL DOWN TO REFRESH
  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  // OPEN MANAGEMENT SECTION
  const openManagementItem = (item: ManagementItem) => {
    if (item.superAdminOnly && role !== "super_admin") {
      Alert.alert(
        "Access Restricted",
        "Only Super Admins can manage administrator accounts."
      );
      return;
    }

    router.push(item.route as any);
  };

  // OPEN SETTINGS
  const handleSettings = () => {
    router.push("/settings");
  };

  // SIGN OUT
  const handleSignOut = () => {
    Alert.alert(
      "Sign out",
      "Are you sure you want to sign out of the AnambraFix admin account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.auth.signOut();

            if (error) {
              Alert.alert("Sign out failed", error.message);
              return;
            }

            setRole(null);
            router.replace("/login");
          },
        },
      ]
    );
  };

  const statItems = [
    {
      label: "Residents",
      value: stats.residents,
      icon: "👤",
      color: "#247A50",
      background: "#EAF6EF",
    },
    {
      label: "Projects",
      value: stats.projects,
      icon: "🏗️",
      color: "#B78316",
      background: "#FFF7E5",
    },
    {
      label: "Reports",
      value: stats.reports,
      icon: "📋",
      color: "#167D87",
      background: "#E8F7F8",
    },
    {
      label: "Announcements",
      value: stats.announcements,
      icon: "📢",
      color: "#A45A16",
      background: "#FFF2E5",
    },
  ];

  const visibleManagementItems = managementItems.filter(
    (item) => !item.superAdminOnly || role === "super_admin"
  );

  if (loading || !role) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color="#176B45" />
        <Text style={styles.loadingText}>
          Verifying administrator access...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#176B45"]}
            tintColor="#176B45"
          />
        }
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.brandArea}>
            <Image
              source={require("../assets/anambralogo.png")}
              style={styles.logo}
              resizeMode="contain"
            />

            <View style={styles.brandText}>
              <Text style={styles.brandName}>ANAMBRAFIX</Text>
              <Text style={styles.brandSubtitle}>
                ADMINISTRATION PORTAL
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              onPress={handleSettings}
              accessibilityRole="button"
              accessibilityLabel="Open settings"
              style={({ pressed }) => [
                styles.headerButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.headerIcon}>⚙️</Text>
            </Pressable>
          </View>
        </View>

        {/* WELCOME */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeSmall}>ANAMBRA STATE</Text>
          <Text style={styles.welcomeTitle}>Dashboard</Text>

          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>
              {role === "super_admin" ? "SUPER ADMIN" : "ADMIN"}
            </Text>
          </View>

          <Text style={styles.welcomeDescription}>
            Manage citizens' reports, public projects, announcements
            and civic information across Anambra State.
          </Text>
        </View>

        {/* OVERVIEW */}
        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Overview</Text>
            <Text style={styles.sectionSubtitle}>
              AnambraFix platform at a glance
            </Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          {statItems.map((item) => (
            <View key={item.label} style={styles.statCard}>
              <View
                style={[
                  styles.statIconContainer,
                  { backgroundColor: item.background },
                ]}
              >
                <Text style={styles.statIcon}>{item.icon}</Text>
              </View>

              {loading ? (
                <ActivityIndicator
                  size="small"
                  color={item.color}
                  style={styles.statLoader}
                />
              ) : (
                <Text style={styles.statValue}>{item.value}</Text>
              )}

              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* MANAGEMENT SECTIONS */}
        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Management Centre</Text>
            <Text style={styles.sectionSubtitle}>
              Select a section to manage AnambraFix
            </Text>
          </View>
        </View>

        <View style={styles.managementList}>
          {visibleManagementItems.map((item) => (
            <Pressable
              key={item.title}
              onPress={() => openManagementItem(item)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.managementCard,
                pressed && styles.managementCardPressed,
              ]}
            >
              <View
                style={[
                  styles.managementIconContainer,
                  { backgroundColor: item.background },
                ]}
              >
                <Text style={styles.managementIcon}>{item.icon}</Text>
              </View>

              <View style={styles.managementTextArea}>
                <Text style={styles.managementTitle}>
                  {item.title}
                </Text>

                <Text style={styles.managementDescription}>
                  {item.description}
                </Text>
              </View>

              <Text
                style={[
                  styles.managementArrow,
                  { color: item.color },
                ]}
              >
                ›
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ADMINISTRATION NOTE */}
        <View style={styles.noticeCard}>
          <Text style={styles.noticeIcon}>ℹ️</Text>

          <View style={styles.noticeTextArea}>
            <Text style={styles.noticeTitle}>
              Administration notice
            </Text>

            <Text style={styles.noticeDescription}>
              Content published through AnambraFix Admin can be
              displayed to citizens using the AnambraFix mobile app.
              Review information carefully before publishing.
            </Text>
          </View>
        </View>

        {/* SIGN OUT */}
        <Pressable
          onPress={handleSignOut}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.signOutIcon}>↪</Text>
          <Text style={styles.signOutText}>
            Sign out of admin account
          </Text>
        </Pressable>

        <Text style={styles.footer}>
          ANAMBRAFIX ADMINISTRATION PORTAL
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: "#F6F8F6",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#64766B",
    fontSize: 13,
    marginTop: 14,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#F6F8F6",
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 35,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  brandArea: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  logo: {
    width: 48,
    height: 48,
    marginRight: 10,
  },
  brandText: {
    flex: 1,
  },
  brandName: {
    color: "#155D3D",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  brandSubtitle: {
    color: "#78857D",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.1,
    marginTop: 4,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E8EDE9",
  },
  headerIcon: {
    fontSize: 17,
  },
  welcomeSection: {
    backgroundColor: "#176B45",
    borderRadius: 22,
    padding: 22,
    marginBottom: 27,
  },
  welcomeSmall: {
    color: "#CBE9D8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  welcomeTitle: {
    color: "#FFFFFF",
    fontSize: 29,
    fontWeight: "900",
    marginTop: 7,
  },
  roleBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 10,
  },
  roleBadgeText: {
    color: "#176B45",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  welcomeDescription: {
    color: "#E1F1E7",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 300,
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: {
    color: "#1B2C22",
    fontSize: 18,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: "#89948D",
    fontSize: 12,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  statCard: {
    width: "48.3%",
    minHeight: 125,
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EAF0EB",
  },
  statIconContainer: {
    width: 35,
    height: 35,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  statIcon: {
    fontSize: 17,
  },
  statValue: {
    color: "#1B2C22",
    fontSize: 25,
    fontWeight: "900",
    marginTop: 10,
  },
  statLoader: {
    alignSelf: "flex-start",
    marginTop: 13,
    marginBottom: 4,
  },
  statLabel: {
    color: "#77847B",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },
  managementList: {
    gap: 11,
  },
  managementCard: {
    minHeight: 91,
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EAF0EB",
  },
  managementCardPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.985 }],
  },
  managementIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 13,
  },
  managementIcon: {
    fontSize: 25,
  },
  managementTextArea: {
    flex: 1,
    paddingVertical: 3,
  },
  managementTitle: {
    color: "#203329",
    fontSize: 13,
    fontWeight: "800",
  },
  managementDescription: {
    color: "#87928B",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 5,
  },
  managementArrow: {
    fontSize: 29,
    fontWeight: "400",
    marginLeft: 5,
  },
  noticeCard: {
    backgroundColor: "#EAF4EE",
    borderRadius: 16,
    padding: 15,
    flexDirection: "row",
    marginTop: 23,
    marginBottom: 20,
  },
  noticeIcon: {
    fontSize: 19,
    marginRight: 11,
  },
  noticeTextArea: {
    flex: 1,
  },
  noticeTitle: {
    color: "#205D3E",
    fontSize: 12,
    fontWeight: "900",
  },
  noticeDescription: {
    color: "#547260",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },
  signOutButton: {
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: "#FFF0F0",
    borderWidth: 1,
    borderColor: "#F5DADA",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signOutIcon: {
    color: "#C53A3A",
    fontSize: 20,
    marginRight: 9,
  },
  signOutText: {
    color: "#B83232",
    fontSize: 13,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.7,
  },
  footer: {
    textAlign: "center",
    color: "#A0AAA3",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 23,
  },
});
