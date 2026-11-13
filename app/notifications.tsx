
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { useAppTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";

type AdminNotification = {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  related_user_id: string | null;
  is_read: boolean;
  created_at: string;
};

export default function NotificationsScreen() {
  const { theme } = useAppTheme();

  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const unreadCount = notifications.filter(
    (item) => !item.is_read
  ).length;

  const loadNotifications = useCallback(async () => {
    const { data, error } = await supabase
      .from("admin_notifications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Notification loading error:", error.message);
      return;
    }

    setNotifications(data ?? []);
  }, []);

  useEffect(() => {
    const initialize = async () => {
      await loadNotifications();
      setLoading(false);
    };

    initialize();

    const channel = supabase
      .channel("admin-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "admin_notifications",
        },
        (payload) => {
          const newNotification =
            payload.new as AdminNotification;

          setNotifications((current) => {
            if (current.some((item) => item.id === newNotification.id)) {
              return current;
            }

            return [newNotification, ...current];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadNotifications]);

  const refreshNotifications = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const markAsRead = async (id: string) => {
    setUpdatingId(id);

    const { error } = await supabase
      .from("admin_notifications")
      .update({ is_read: true })
      .eq("id", id);

    if (error) {
      console.error("Mark as read error:", error.message);
    } else {
      setNotifications((current) =>
        current.map((item) =>
          item.id === id ? { ...item, is_read: true } : item
        )
      );
    }

    setUpdatingId(null);
  };

  const markAllAsRead = async () => {
    if (unreadCount === 0) return;

    setUpdatingId("all");

    const { error } = await supabase
      .from("admin_notifications")
      .update({ is_read: true })
      .eq("is_read", false);

    if (error) {
      console.error("Mark all as read error:", error.message);
    } else {
      setNotifications((current) =>
        current.map((item) => ({ ...item, is_read: true }))
      );
    }

    setUpdatingId(null);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString([], {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 40,
      paddingBottom: 18,
      gap: 14,
    },
    backButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: theme.text,
    },
    headerSubtitle: {
      fontSize: 13,
      color: theme.secondaryText,
      marginTop: 3,
    },
    count: {
      marginLeft: "auto",
      backgroundColor: theme.primary,
      minWidth: 30,
      height: 30,
      paddingHorizontal: 9,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    countText: {
      color: "#FFFFFF",
      fontWeight: "800",
      fontSize: 13,
    },
    actionRow: {
      paddingHorizontal: 20,
      paddingBottom: 14,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    sectionTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: "700",
    },
    markAll: {
      color: theme.primary,
      fontSize: 13,
      fontWeight: "700",
    },
    content: {
      paddingHorizontal: 20,
      paddingBottom: 35,
    },
    notification: {
      flexDirection: "row",
      backgroundColor: theme.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 15,
      marginBottom: 12,
      gap: 12,
    },
    unread: {
      borderColor: theme.primary,
      borderLeftWidth: 4,
    },
    iconBox: {
      width: 43,
      height: 43,
      borderRadius: 14,
      backgroundColor: theme.inputBackground,
      alignItems: "center",
      justifyContent: "center",
    },
    notificationBody: {
      flex: 1,
    },
    notificationTitle: {
      color: theme.text,
      fontSize: 14,
      fontWeight: "800",
      marginBottom: 5,
    },
    message: {
      color: theme.secondaryText,
      fontSize: 13,
      lineHeight: 19,
    },
    date: {
      color: theme.secondaryText,
      fontSize: 11,
      marginTop: 9,
    },
    unreadLabel: {
      color: theme.primary,
      fontSize: 11,
      fontWeight: "800",
      marginTop: 7,
    },
    readButton: {
      padding: 5,
      alignSelf: "flex-start",
    },
    empty: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 75,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: theme.text,
      marginTop: 15,
    },
    emptyText: {
      fontSize: 13,
      color: theme.secondaryText,
      marginTop: 7,
      textAlign: "center",
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name="arrow-back"
            size={21}
            color={theme.text}
          />
        </Pressable>

        <View>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSubtitle}>
            Updates from your LGA app
          </Text>
        </View>

        <View style={styles.count}>
          <Text style={styles.countText}>{unreadCount}</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <Text style={styles.sectionTitle}>
          Recent notifications
        </Text>

        {unreadCount > 0 && (
          <Pressable
            onPress={markAllAsRead}
            disabled={updatingId === "all"}
          >
            <Text style={styles.markAll}>
              {updatingId === "all" ? "Updating..." : "Mark all as read"}
            </Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={theme.primary}
          style={{ marginTop: 50 }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshNotifications}
              tintColor={theme.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {notifications.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons
                name="notifications-off-outline"
                size={48}
                color={theme.secondaryText}
              />
              <Text style={styles.emptyTitle}>
                No notifications yet
              </Text>
              <Text style={styles.emptyText}>
                New citizen registrations and other updates
                will appear here.
              </Text>
            </View>
          ) : (
            notifications.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.notification,
                  !item.is_read && styles.unread,
                ]}
              >
                <View style={styles.iconBox}>
                  <Ionicons
                    name={
                      item.notification_type === "registration"
                        ? "person-add-outline"
                        : "notifications-outline"
                    }
                    size={21}
                    color={theme.primary}
                  />
                </View>

                <View style={styles.notificationBody}>
                  <Text style={styles.notificationTitle}>
                    {item.title}
                  </Text>

                  <Text style={styles.message}>
                    {item.message}
                  </Text>

                  <Text style={styles.date}>
                    {formatDate(item.created_at)}
                  </Text>

                  {!item.is_read && (
                    <Text style={styles.unreadLabel}>
                      UNREAD
                    </Text>
                  )}
                </View>

                {!item.is_read && (
                  <Pressable
                    style={styles.readButton}
                    disabled={updatingId === item.id}
                    onPress={() => markAsRead(item.id)}
                  >
                    {updatingId === item.id ? (
                      <ActivityIndicator
                        size="small"
                        color={theme.primary}
                      />
                    ) : (
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={23}
                        color={theme.primary}
                      />
                    )}
                  </Pressable>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
