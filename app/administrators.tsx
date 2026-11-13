
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";

type UserRole = "citizen" | "admin" | "super_admin";

type Citizen = {
  id: string;
  surname: string | null;
  other_names: string | null;
  phone: string | null;
  email: string | null;
  lga: string | null;
  community: string | null;
  created_at: string | null;
  role: UserRole | null;
};

type ProfilePreview = {
  id: string;
  surname: string | null;
  other_names: string | null;
  email: string | null;
  phone: string | null;
};

const GREEN = "#087F5B";
const DARK = "#12352B";
const MUTED = "#718078";
const BACKGROUND = "#F4F7F5";

export default function AdministratorsScreen() {
  const [users, setUsers] = useState<Citizen[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  // Add Administrator states
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [previewProfile, setPreviewProfile] =
    useState<ProfilePreview | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [confirmingAdmin, setConfirmingAdmin] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      setCurrentUserId(user.id);

      const { data: myRole, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (roleError) throw roleError;

      const role = myRole?.role as UserRole | undefined;

      if (role !== "super_admin") {
        setCurrentRole(role ?? null);
        setAccessDenied(true);
        return;
      }

      setCurrentRole(role);
      setAccessDenied(false);

      const [
        { data: profiles, error: profilesError },
        { data: roles, error: rolesError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, surname, other_names, phone, email, lga, community, created_at"
          )
          .order("surname", { ascending: true }),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      if (profilesError) throw profilesError;
      if (rolesError) throw rolesError;

      const roleMap = new Map<string, UserRole>();

      (roles ?? []).forEach((item) => {
        roleMap.set(item.user_id, item.role as UserRole);
      });

      const formattedUsers: Citizen[] = (profiles ?? []).map((profile) => ({
        ...profile,
        role: roleMap.get(profile.id) ?? null,
      }));

      setUsers(formattedUsers);
    } catch (error: any) {
      Alert.alert(
        "Unable to load administrators",
        error?.message ?? "Please try again."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadUsers();
    }, [loadUsers])
  );

  // Search for an existing AnambraFix account by email.
  const lookupAdministrator = async () => {
    const email = newAdminEmail.trim().toLowerCase();

    if (!email) {
      Alert.alert("Email required", "Enter the person's email address.");
      return;
    }

    setLookingUp(true);
    setPreviewProfile(null);

    try {
      const { data, error } = await supabase.functions.invoke(
        "create-admin",
        {
          body: {
            action: "lookup",
            email,
          },
        }
      );

      if (error) throw error;

      if (!data?.success || !data?.profile) {
        throw new Error(data?.error ?? "Could not find this account.");
      }

      setPreviewProfile(data.profile as ProfilePreview);
    } catch (error: any) {
      Alert.alert(
        "Account not found",
        error?.message ??
          "Could not find an existing AnambraFix account with this email."
      );
    } finally {
      setLookingUp(false);
    }
  };

  // Grant administrator access after the owner confirms.
  const confirmAddAdministrator = async () => {
    if (!previewProfile || confirmingAdmin) return;

    setConfirmingAdmin(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "create-admin",
        {
          body: {
            action: "confirm",
            userId: previewProfile.id,
            email: previewProfile.email,
          },
        }
      );

      if (error) throw error;

      if (!data?.success) {
        throw new Error(
          data?.error ?? "Could not grant administrator access."
        );
      }

      setPreviewProfile(null);
      setNewAdminEmail("");

      await loadUsers();

      Alert.alert(
        "Administrator Added",
        "Administrator access has been granted successfully. The person's profile is now included in the administrator records."
      );
    } catch (error: any) {
      Alert.alert(
        "Unable to Add Administrator",
        error?.message ?? "Please try again."
      );
    } finally {
      setConfirmingAdmin(false);
    }
  };

  const askToConfirmAdministrator = () => {
    if (!previewProfile) return;

    const personName =
      `${previewProfile.surname ?? ""} ${previewProfile.other_names ?? ""}`
        .trim() || "this person";

    Alert.alert(
      "Confirm Administrator",
      `Are you sure you want to grant administrator access to ${personName} (${previewProfile.email})?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Yes, Add Administrator",
          onPress: confirmAddAdministrator,
        },
      ]
    );
  };

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return users;

    return users.filter((user) => {
      const searchable = [
        user.surname,
        user.other_names,
        user.email,
        user.phone,
        user.lga,
        user.community,
        user.role,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(term);
    });
  }, [users, search]);

  const administrators = users.filter(
    (user) => user.role === "admin" || user.role === "super_admin"
  );

  const citizens = users.filter((user) => user.role === "citizen");

  const changeRole = (person: Citizen, nextRole: UserRole) => {
    if (currentRole !== "super_admin") {
      Alert.alert(
        "Permission denied",
        "Only a Super Admin can manage administrator accounts."
      );
      return;
    }

    if (person.id === currentUserId) {
      Alert.alert(
        "Action not allowed",
        "You cannot change your own administrator role."
      );
      return;
    }

    if (!person.role) {
      Alert.alert(
        "Role unavailable",
        "This account has no role record. No changes have been made."
      );
      return;
    }

    const personName =
      `${person.surname ?? ""} ${person.other_names ?? ""}`.trim() ||
      person.email ||
      "this user";

    let action = "";

    if (person.role === "citizen" && nextRole === "admin") {
      action = `Promote ${personName} to Admin?`;
    } else if (person.role === "admin" && nextRole === "super_admin") {
      action = `Promote ${personName} to Super Admin?`;
    } else if (
      person.role === "super_admin" &&
      nextRole === "admin"
    ) {
      action = `Change ${personName} from Super Admin to Admin?`;
    } else if (
      (person.role === "admin" || person.role === "super_admin") &&
      nextRole === "citizen"
    ) {
      action = `Remove administrator access from ${personName}? Their citizen account and profile will remain.`;
    } else {
      return;
    }

    Alert.alert("Confirm role change", action, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Continue",
        style: "destructive",
        onPress: () => performRoleUpdate(person, nextRole),
      },
    ]);
  };

  const performRoleUpdate = async (
    person: Citizen,
    nextRole: UserRole
  ) => {
    if (!person.role) return;

    setUpdatingId(person.id);

    try {
      const { data, error } = await supabase
        .from("user_roles")
        .update({ role: nextRole })
        .eq("user_id", person.id)
        .eq("role", person.role)
        .neq("user_id", currentUserId)
        .select("user_id")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(
          "No role was updated. Your permissions or the user's current role may have changed. Refresh and try again."
        );
      }

      setUsers((previous) =>
        previous.map((user) =>
          user.id === person.id ? { ...user, role: nextRole } : user
        )
      );

      Alert.alert("Successful", "The user's role has been updated.");
    } catch (error: any) {
      Alert.alert(
        "Role update failed",
        error?.message ?? "Please try again."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const getRoleLabel = (role: UserRole | null) => {
    if (role === "super_admin") return "SUPER ADMIN";
    if (role === "admin") return "ADMIN";
    if (role === "citizen") return "CITIZEN";
    return "NO ROLE";
  };

  const renderUser = ({ item }: { item: Citizen }) => {
    const isSelf = item.id === currentUserId;
    const isUpdating = updatingId === item.id;
    const fullName =
      `${item.surname ?? ""} ${item.other_names ?? ""}`.trim() ||
      "Unnamed user";

    return (
      <View style={styles.userCard}>
        <View style={styles.userTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(item.surname?.[0] ?? item.email?.[0] ?? "U").toUpperCase()}
            </Text>
          </View>

          <View style={styles.userInfo}>
            <Text style={styles.userName}>{fullName}</Text>
            <Text style={styles.userEmail}>
              {item.email || "No email available"}
            </Text>
            <Text style={styles.userPhone}>
              {item.phone || "No phone number"}
            </Text>
          </View>
        </View>

        <View style={styles.detailsRow}>
          <Text style={styles.detailText}>
            LGA: {item.lga || "Not provided"}
          </Text>
          <Text style={styles.detailText}>
            Community: {item.community || "Not provided"}
          </Text>
        </View>

        <View style={styles.roleRow}>
          <View
            style={[
              styles.roleBadge,
              item.role === "super_admin" && styles.superBadge,
              item.role === "admin" && styles.adminBadge,
              item.role === "citizen" && styles.citizenBadge,
            ]}
          >
            <Text
              style={[
                styles.roleText,
                item.role === "super_admin" && styles.superText,
                item.role === "admin" && styles.adminText,
                item.role === "citizen" && styles.citizenText,
              ]}
            >
              {getRoleLabel(item.role)}
            </Text>
          </View>

          {isSelf && <Text style={styles.youLabel}>YOUR ACCOUNT</Text>}
        </View>

        {isUpdating ? (
          <View style={styles.updating}>
            <ActivityIndicator color={GREEN} />
            <Text style={styles.updatingText}>Updating role...</Text>
          </View>
        ) : (
          !isSelf &&
          item.role && (
            <View style={styles.actions}>
              {item.role === "citizen" && (
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => changeRole(item, "admin")}
                >
                  <Text style={styles.primaryButtonText}>
                    Promote to Admin
                  </Text>
                </Pressable>
              )}

              {item.role === "admin" && (
                <>
                  <Pressable
                    style={styles.primaryButton}
                    onPress={() => changeRole(item, "super_admin")}
                  >
                    <Text style={styles.primaryButtonText}>
                      Make Super Admin
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => changeRole(item, "citizen")}
                  >
                    <Text style={styles.secondaryButtonText}>
                      Remove Admin Access
                    </Text>
                  </Pressable>
                </>
              )}

              {item.role === "super_admin" && (
                <>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => changeRole(item, "admin")}
                  >
                    <Text style={styles.secondaryButtonText}>
                      Demote to Admin
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.dangerButton}
                    onPress={() => changeRole(item, "citizen")}
                  >
                    <Text style={styles.dangerButtonText}>
                      Remove Admin Access
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          )
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color={GREEN} />
        <Text style={styles.loadingText}>
          Loading administrator records...
        </Text>
      </SafeAreaView>
    );
  }

  if (accessDenied || currentRole !== "super_admin") {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar barStyle="dark-content" />
        <Text style={styles.deniedTitle}>Access Restricted</Text>
        <Text style={styles.deniedText}>
          Only Super Admin accounts can manage administrators.
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.replace("/dashboard")}
        >
          <Text style={styles.primaryButtonText}>Return to Dashboard</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Administrators</Text>
          <Text style={styles.headerSubtitle}>
            Manage AnambraFix access and roles
          </Text>
        </View>
      </View>

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={renderUser}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadUsers();
            }}
            tintColor={GREEN}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryNumber}>{users.length}</Text>
                <Text style={styles.summaryLabel}>Total Citizens</Text>
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryNumber}>
                  {administrators.length}
                </Text>
                <Text style={styles.summaryLabel}>Administrators</Text>
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryNumber}>{citizens.length}</Text>
                <Text style={styles.summaryLabel}>Citizens</Text>
              </View>
            </View>

            {/* Add Administrator */}
            <View style={styles.addAdminCard}>
              <Text style={styles.addAdminTitle}>Add Administrator</Text>
              <Text style={styles.addAdminDescription}>
                Enter the email address of an existing AnambraFix user.
                Their profile will appear for your confirmation before
                administrator access is granted.
              </Text>

              <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
              <TextInput
                style={styles.emailInput}
                placeholder="Enter registered email address"
                placeholderTextColor="#89958F"
                value={newAdminEmail}
                onChangeText={(value) => {
                  setNewAdminEmail(value);
                  setPreviewProfile(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!lookingUp && !confirmingAdmin}
              />

              <Pressable
                style={[
                  styles.lookupButton,
                  (lookingUp || confirmingAdmin) && styles.disabledButton,
                ]}
                onPress={lookupAdministrator}
                disabled={lookingUp || confirmingAdmin}
              >
                {lookingUp ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    Find User Profile
                  </Text>
                )}
              </Pressable>

              {previewProfile && (
                <View style={styles.previewCard}>
                  <Text style={styles.previewHeading}>
                    Matching User Profile
                  </Text>

                  <View style={styles.previewUser}>
                    <View style={styles.previewAvatar}>
                      <Text style={styles.previewAvatarText}>
                        {(
                          previewProfile.surname?.[0] ??
                          previewProfile.email?.[0] ??
                          "U"
                        ).toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.previewInfo}>
                      <Text style={styles.previewName}>
                        {`${previewProfile.surname ?? ""} ${
                          previewProfile.other_names ?? ""
                        }`.trim() || "Unnamed user"}
                      </Text>
                      <Text style={styles.previewEmail}>
                        {previewProfile.email}
                      </Text>
                      <Text style={styles.previewPhone}>
                        {previewProfile.phone || "No phone number"}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.confirmQuestion}>
                    Is this the person you want to add as an administrator?
                  </Text>

                  <Pressable
                    style={[
                      styles.confirmButton,
                      confirmingAdmin && styles.disabledButton,
                    ]}
                    onPress={askToConfirmAdministrator}
                    disabled={confirmingAdmin}
                  >
                    {confirmingAdmin ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>
                        Confirm and Add Administrator
                      </Text>
                    )}
                  </Pressable>

                  <Pressable
                    style={styles.cancelPreviewButton}
                    onPress={() => setPreviewProfile(null)}
                    disabled={confirmingAdmin}
                  >
                    <Text style={styles.cancelPreviewText}>Cancel</Text>
                  </Pressable>
                </View>
              )}
            </View>

            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>Super Admin privileges</Text>
              <Text style={styles.noticeText}>
                You can promote citizens, appoint Super Admins, demote
                administrators, and remove administrator access. Removing
                access does not delete a person's citizen account.
              </Text>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, email, phone or LGA..."
              placeholderTextColor="#89958F"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
            />

            <Text style={styles.sectionTitle}>
              All Registered Users ({filteredUsers.length})
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No users found</Text>
            <Text style={styles.emptyText}>
              Try another search term.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: BACKGROUND,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 14,
  },
  loadingText: {
    color: MUTED,
    fontSize: 14,
  },
  deniedTitle: {
    color: DARK,
    fontSize: 22,
    fontWeight: "800",
  },
  deniedText: {
    color: MUTED,
    textAlign: "center",
    marginBottom: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 15,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E8EEEA",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EAF4EF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  backText: {
    color: GREEN,
    fontSize: 30,
    lineHeight: 34,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    color: DARK,
    fontSize: 21,
    fontWeight: "800",
  },
  headerSubtitle: {
    color: MUTED,
    fontSize: 12,
    marginTop: 3,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 9,
    marginBottom: 15,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 17,
    paddingHorizontal: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E8EEEA",
  },
  summaryNumber: {
    color: GREEN,
    fontSize: 24,
    fontWeight: "800",
  },
  summaryLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "600",
    marginTop: 5,
    textAlign: "center",
  },
  addAdminCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#DCEAE1",
  },
  addAdminTitle: {
    color: DARK,
    fontSize: 17,
    fontWeight: "800",
  },
  addAdminDescription: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 15,
  },
  inputLabel: {
    color: DARK,
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 7,
  },
  emailInput: {
    height: 48,
    backgroundColor: "#F8FAF9",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DCE5DF",
    paddingHorizontal: 13,
    color: DARK,
    fontSize: 13,
  },
  lookupButton: {
    backgroundColor: GREEN,
    borderRadius: 10,
    minHeight: 45,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 11,
    paddingHorizontal: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
  previewCard: {
    backgroundColor: "#F1F7F3",
    borderRadius: 12,
    padding: 13,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#D8E9DE",
  },
  previewHeading: {
    color: DARK,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 12,
  },
  previewUser: {
    flexDirection: "row",
    alignItems: "center",
  },
  previewAvatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#DDEFE4",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  previewAvatarText: {
    color: GREEN,
    fontSize: 18,
    fontWeight: "800",
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    color: DARK,
    fontSize: 14,
    fontWeight: "800",
  },
  previewEmail: {
    color: MUTED,
    fontSize: 11,
    marginTop: 3,
  },
  previewPhone: {
    color: MUTED,
    fontSize: 11,
    marginTop: 2,
  },
  confirmQuestion: {
    color: DARK,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 15,
    marginBottom: 10,
  },
  confirmButton: {
    backgroundColor: GREEN,
    borderRadius: 9,
    minHeight: 44,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelPreviewButton: {
    alignItems: "center",
    paddingVertical: 11,
    marginTop: 3,
  },
  cancelPreviewText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "700",
  },
  notice: {
    backgroundColor: "#E8F4ED",
    borderRadius: 14,
    padding: 15,
    marginBottom: 16,
  },
  noticeTitle: {
    color: DARK,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 5,
  },
  noticeText: {
    color: "#496458",
    fontSize: 12,
    lineHeight: 19,
  },
  searchInput: {
    height: 48,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E8E3",
    paddingHorizontal: 14,
    color: DARK,
    fontSize: 13,
    marginBottom: 20,
  },
  sectionTitle: {
    color: DARK,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12,
  },
  userCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E8EEEA",
  },
  userTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#E5F2EA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  avatarText: {
    color: GREEN,
    fontSize: 18,
    fontWeight: "800",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: DARK,
    fontSize: 15,
    fontWeight: "800",
  },
  userEmail: {
    color: MUTED,
    fontSize: 12,
    marginTop: 3,
  },
  userPhone: {
    color: MUTED,
    fontSize: 11,
    marginTop: 2,
  },
  detailsRow: {
    borderTopWidth: 1,
    borderTopColor: "#EFF2F0",
    marginTop: 12,
    paddingTop: 10,
    gap: 5,
  },
  detailText: {
    color: "#64736B",
    fontSize: 11,
  },
  roleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 9,
  },
  roleBadge: {
    alignSelf: "flex-start",
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  superBadge: {
    backgroundColor: "#F0E9FF",
  },
  adminBadge: {
    backgroundColor: "#E5F1FF",
  },
  citizenBadge: {
    backgroundColor: "#E8F4ED",
  },
  roleText: {
    fontSize: 10,
    fontWeight: "800",
  },
  superText: {
    color: "#7041B5",
  },
  adminText: {
    color: "#2863A5",
  },
  citizenText: {
    color: GREEN,
  },
  youLabel: {
    color: MUTED,
    fontSize: 9,
    fontWeight: "800",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  primaryButton: {
    backgroundColor: GREEN,
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  secondaryButton: {
    backgroundColor: "#EDF3EF",
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: DARK,
    fontSize: 11,
    fontWeight: "800",
  },
  dangerButton: {
    backgroundColor: "#FFF0EF",
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerButtonText: {
    color: "#B42318",
    fontSize: 11,
    fontWeight: "800",
  },
  updating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 14,
  },
  updatingText: {
    color: MUTED,
    fontSize: 12,
  },
  emptyState: {
    alignItems: "center",
    padding: 30,
  },
  emptyTitle: {
    color: DARK,
    fontSize: 15,
    fontWeight: "800",
  },
  emptyText: {
    color: MUTED,
    fontSize: 12,
    marginTop: 5,
  },
});
