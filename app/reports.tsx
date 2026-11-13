
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";

type ReportUpdate = {
  id: string;
  report_id: string;
  old_status: string | null;
  new_status: string;
  note: string | null;
  created_at: string;
};

type Report = {
  id: string;
  user_id: string;
  tracking_code: string;
  title: string;
  description: string;
  category: string;
  state: string;
  lga: string;
  community: string;
  location_details: string | null;
  photo_urls: string[] | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  updates: ReportUpdate[];
  photoUrl: string | null;
};

const PHOTO_BUCKET = "report-photos";

const STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "under_review", label: "Under Review" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "rejected", label: "Rejected" },
];

const COLORS = {
  primary: "#087B50",
  primaryLight: "#E7F5EE",
  background: "#F5F8F6",
  surface: "#FFFFFF",
  text: "#17251D",
  muted: "#718078",
  border: "#E1EAE4",
  white: "#FFFFFF",
  red: "#D93636",
};

function statusLabel(status: string) {
  return (
    STATUSES.find((item) => item.value === status)?.label ?? status
  );
}

function statusColor(status: string) {
  switch (status) {
    case "resolved":
      return "#23834D";
    case "in_progress":
      return "#2563EB";
    case "under_review":
      return "#B7791F";
    case "rejected":
      return "#D93636";
    default:
      return "#68766D";
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function ReportsScreen() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedReport, setSelectedReport] =
    useState<Report | null>(null);

  const [statusDraft, setStatusDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadReports(showRefresh = false) {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Please sign in to access Admin Reports.");
      }

      const { data: adminAccess, error: adminError } =
        await supabase.rpc("is_current_user_admin");

      if (adminError || adminAccess !== true) {
        throw new Error("You do not have permission to manage reports.");
      }

      const { data: reportRows, error: reportError } = await supabase
        .from("reports")
        .select(
          "id, user_id, tracking_code, title, description, category, state, lga, community, location_details, photo_urls, status, admin_note, created_at"
        )
        .order("created_at", { ascending: false });

      if (reportError) throw reportError;

      const rows = (reportRows ?? []) as Omit<
        Report,
        "updates" | "photoUrl"
      >[];

      const reportIds = rows.map((report) => report.id);

      let updates: ReportUpdate[] = [];

      if (reportIds.length > 0) {
        const { data: updateRows, error: updateError } =
          await supabase
            .from("report_updates")
            .select(
              "id, report_id, old_status, new_status, note, created_at"
            )
            .in("report_id", reportIds)
            .order("created_at", { ascending: false });

        if (updateError) throw updateError;

        updates = (updateRows ?? []) as ReportUpdate[];
      }

      const completeReports: Report[] = await Promise.all(
        rows.map(async (report) => {
          const reportUpdates = updates.filter(
            (update) => update.report_id === report.id
          );

          let photoUrl: string | null = null;

          if (report.photo_urls && report.photo_urls.length > 0) {
            const { data: signedPhoto } = await supabase.storage
              .from(PHOTO_BUCKET)
              .createSignedUrl(report.photo_urls[0], 3600);

            photoUrl = signedPhoto?.signedUrl ?? null;
          }

          return {
            ...report,
            updates: reportUpdates,
            photoUrl,
          };
        })
      );

      setReports(completeReports);
    } catch (error) {
      console.error("Admin reports loading error:", error);

      Alert.alert(
        "Unable to Load Reports",
        error instanceof Error
          ? error.message
          : "Please check your connection and try again."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function openReport(report: Report) {
    setSelectedReport(report);
    setStatusDraft(report.status);
    setNoteDraft(report.admin_note ?? "");
  }

  async function saveReportChanges() {
    if (!selectedReport) return;

    if (!STATUSES.some((item) => item.value === statusDraft)) {
      Alert.alert("Invalid Status", "Please select a valid report status.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("reports")
        .update({
          status: statusDraft,
          admin_note: noteDraft.trim() || null,
        })
        .eq("id", selectedReport.id);

      if (error) throw error;

      Alert.alert(
        "Report Updated",
        "The report status and administrator note have been saved."
      );

      setSelectedReport(null);
      await loadReports();
    } catch (error) {
      console.error("Report update error:", error);

      Alert.alert(
        "Update Failed",
        error instanceof Error
          ? error.message
          : "Unable to update this report."
      );
    } finally {
      setSaving(false);
    }
  }

  const filteredReports = reports.filter((report) => {
    const matchesStatus =
      statusFilter === "all" || report.status === statusFilter;

    const searchText = search.trim().toLowerCase();

    const matchesSearch =
      !searchText ||
      [
        report.title,
        report.category,
        report.tracking_code,
        report.community,
        report.lga,
        report.state,
        report.description,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(searchText));

    return matchesStatus && matchesSearch;
  });

  const pendingCount = reports.filter(
    (report) => report.status === "pending"
  ).length;

  const activeCount = reports.filter(
    (report) =>
      report.status === "under_review" ||
      report.status === "in_progress"
  ).length;

  const resolvedCount = reports.filter(
    (report) => report.status === "resolved"
  ).length;

  React.useEffect(() => {
    loadReports();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadReports(true)}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.heading}>Community Reports</Text>
            <Text style={styles.subtitle}>
              Review reports and manage their progress.
            </Text>
          </View>

          <Pressable
            style={styles.refreshButton}
            onPress={() => loadReports(true)}
          >
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </Pressable>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{reports.length}</Text>
            <Text style={styles.statLabel}>Total Reports</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: "#B7791F" }]}>
              {pendingCount}
            </Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: "#2563EB" }]}>
              {activeCount}
            </Text>
            <Text style={styles.statLabel}>In Progress</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: "#23834D" }]}>
              {resolvedCount}
            </Text>
            <Text style={styles.statLabel}>Resolved</Text>
          </View>
        </View>

        <TextInput
          style={styles.searchInput}
          placeholder="Search title, tracking number, LGA..."
          placeholderTextColor={COLORS.muted}
          value={search}
          onChangeText={setSearch}
        />

        <Text style={styles.filterHeading}>Filter by status</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <Pressable
            onPress={() => setStatusFilter("all")}
            style={[
              styles.filterButton,
              statusFilter === "all" && styles.activeFilter,
            ]}
          >
            <Text
              style={[
                styles.filterText,
                statusFilter === "all" && styles.activeFilterText,
              ]}
            >
              All
            </Text>
          </Pressable>

          {STATUSES.map((status) => (
            <Pressable
              key={status.value}
              onPress={() => setStatusFilter(status.value)}
              style={[
                styles.filterButton,
                statusFilter === status.value && styles.activeFilter,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  statusFilter === status.value &&
                    styles.activeFilterText,
                ]}
              >
                {status.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.mutedText}>Loading reports...</Text>
          </View>
        ) : filteredReports.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No Reports Found</Text>
            <Text style={styles.mutedText}>
              There are no reports matching your current search or filter.
            </Text>
          </View>
        ) : (
          <View style={styles.reportList}>
            <Text style={styles.resultsText}>
              Showing {filteredReports.length} report
              {filteredReports.length === 1 ? "" : "s"}
            </Text>

            {filteredReports.map((report) => (
              <Pressable
                key={report.id}
                style={styles.reportCard}
                onPress={() => openReport(report)}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.category}>
                    {report.category}
                  </Text>

                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: statusColor(report.status),
                      },
                    ]}
                  >
                    <Text style={styles.statusBadgeText}>
                      {statusLabel(report.status)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.reportTitle}>{report.title}</Text>

                <Text style={styles.reportDescription} numberOfLines={3}>
                  {report.description}
                </Text>

                <View style={styles.locationBox}>
                  <Text style={styles.locationText}>
                    📍 {report.community}, {report.lga}
                  </Text>
                  <Text style={styles.locationText}>{report.state}</Text>
                </View>

                <View style={styles.cardBottom}>
                  <View>
                    <Text style={styles.trackingLabel}>TRACKING NUMBER</Text>
                    <Text style={styles.trackingCode}>
                      {report.tracking_code}
                    </Text>
                  </View>

                  <Text style={styles.viewDetails}>View Details ›</Text>
                </View>

                <Text style={styles.dateText}>
                  Submitted: {formatDate(report.created_at)}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={selectedReport !== null}
        animationType="slide"
        onRequestClose={() => setSelectedReport(null)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeading}>Report Details</Text>

            <Pressable
              style={styles.closeButton}
              onPress={() => setSelectedReport(null)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>

          {selectedReport ? (
            <ScrollView
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.detailCard}>
                <Text style={styles.category}>
                  {selectedReport.category}
                </Text>

                <Text style={styles.detailTitle}>
                  {selectedReport.title}
                </Text>

                <Text style={styles.detailDescription}>
                  {selectedReport.description}
                </Text>

                <View style={styles.detailDivider} />

                <Text style={styles.detailLabel}>Tracking Number</Text>
                <Text style={styles.trackingCode}>
                  {selectedReport.tracking_code}
                </Text>

                <Text style={styles.detailLabel}>Location</Text>
                <Text style={styles.detailValue}>
                  {selectedReport.community}, {selectedReport.lga},{" "}
                  {selectedReport.state}
                </Text>

                {selectedReport.location_details ? (
                  <>
                    <Text style={styles.detailLabel}>
                      Additional Location Details
                    </Text>
                    <Text style={styles.detailValue}>
                      {selectedReport.location_details}
                    </Text>
                  </>
                ) : null}

                <Text style={styles.detailLabel}>Date Submitted</Text>
                <Text style={styles.detailValue}>
                  {formatDate(selectedReport.created_at)}
                </Text>

                {selectedReport.photoUrl ? (
                  <>
                    <Text style={styles.detailLabel}>Submitted Photo</Text>
                    <Image
                      source={{ uri: selectedReport.photoUrl }}
                      style={styles.detailPhoto}
                      resizeMode="cover"
                    />
                  </>
                ) : null}
              </View>

              <View style={styles.detailCard}>
                <Text style={styles.sectionHeading}>
                  Update Report
                </Text>

                <Text style={styles.fieldLabel}>Report Status</Text>

                <View style={styles.statusOptions}>
                  {STATUSES.map((status) => (
                    <Pressable
                      key={status.value}
                      onPress={() => setStatusDraft(status.value)}
                      style={[
                        styles.statusOption,
                        statusDraft === status.value &&
                          styles.selectedStatusOption,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusOptionText,
                          statusDraft === status.value &&
                            styles.selectedStatusOptionText,
                        ]}
                      >
                        {status.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>
                  Administrator's Note
                </Text>

                <TextInput
                  style={styles.noteInput}
                  value={noteDraft}
                  onChangeText={setNoteDraft}
                  placeholder="Write an update for the citizen..."
                  placeholderTextColor={COLORS.muted}
                  multiline
                  textAlignVertical="top"
                />

                <Pressable
                  style={[
                    styles.saveButton,
                    saving && styles.disabledButton,
                  ]}
                  onPress={saveReportChanges}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.saveButtonText}>
                      Save Report Update
                    </Text>
                  )}
                </Pressable>
              </View>

              <View style={styles.detailCard}>
                <Text style={styles.sectionHeading}>
                  Report History
                </Text>

                {selectedReport.updates.length === 0 ? (
                  <Text style={styles.mutedText}>
                    No additional status updates have been recorded yet.
                  </Text>
                ) : (
                  selectedReport.updates.map((update) => (
                    <View key={update.id} style={styles.historyItem}>
                      <View
                        style={[
                          styles.historyDot,
                          {
                            backgroundColor: statusColor(
                              update.new_status
                            ),
                          },
                        ]}
                      />

                      <View style={styles.historyContent}>
                        <Text style={styles.historyStatus}>
                          {statusLabel(update.new_status)}
                        </Text>

                        {update.note ? (
                          <Text style={styles.historyNote}>
                            {update.note}
                          </Text>
                        ) : null}

                        <Text style={styles.historyDate}>
                          {formatDate(update.created_at)}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    padding: 20,
    paddingBottom: 45,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
    gap: 12,
  },
  heading: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.text,
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 6,
  },
  refreshButton: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  refreshButtonText: {
    color: COLORS.primary,
    fontWeight: "700",
    fontSize: 12,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  statNumber: {
    fontSize: 25,
    fontWeight: "800",
    color: COLORS.primary,
  },
  statLabel: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 5,
  },
  searchInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 13,
    color: COLORS.text,
    fontSize: 14,
  },
  filterHeading: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 20,
    marginBottom: 10,
  },
  filterRow: {
    gap: 8,
    paddingBottom: 6,
  },
  filterButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  activeFilter: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: "600",
  },
  activeFilterText: {
    color: COLORS.white,
  },
  loadingBox: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  mutedText: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  emptyCard: {
    alignItems: "center",
    padding: 28,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginTop: 20,
    gap: 10,
  },
  emptyIcon: {
    fontSize: 38,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
  },
  reportList: {
    marginTop: 18,
    gap: 13,
  },
  resultsText: {
    fontSize: 13,
    color: COLORS.muted,
    fontWeight: "600",
  },
  reportCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  category: {
    color: COLORS.primary,
    fontWeight: "800",
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusBadgeText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 10,
  },
  reportTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 7,
  },
  reportDescription: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  locationBox: {
    backgroundColor: COLORS.background,
    padding: 11,
    borderRadius: 10,
    marginTop: 13,
    gap: 5,
  },
  locationText: {
    color: COLORS.muted,
    fontSize: 12,
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 15,
    gap: 8,
  },
  trackingLabel: {
    color: COLORS.muted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  trackingCode: {
    color: COLORS.primary,
    fontWeight: "800",
    fontSize: 13,
    marginTop: 4,
  },
  viewDetails: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  dateText: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 12,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalHeading: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
  },
  closeButton: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 9,
  },
  closeButtonText: {
    color: COLORS.primary,
    fontWeight: "700",
    fontSize: 12,
  },
  modalContent: {
    padding: 18,
    paddingBottom: 40,
    gap: 15,
  },
  detailCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 17,
  },
  detailTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 9,
    marginBottom: 9,
  },
  detailDescription: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  detailDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 15,
  },
  detailLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 12,
    marginBottom: 5,
  },
  detailValue: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 20,
  },
  detailPhoto: {
    width: "100%",
    height: 210,
    borderRadius: 12,
    marginTop: 5,
    backgroundColor: COLORS.background,
  },
  sectionHeading: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 16,
  },
  fieldLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 9,
    marginTop: 5,
  },
  statusOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 18,
  },
  statusOption: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: COLORS.surface,
  },
  selectedStatusOption: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  statusOptionText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "700",
  },
  selectedStatusOptionText: {
    color: COLORS.white,
  },
  noteInput: {
    minHeight: 115,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 13,
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 20,
    backgroundColor: COLORS.background,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 17,
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "800",
  },
  historyItem: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 17,
  },
  historyDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    marginTop: 4,
  },
  historyContent: {
    flex: 1,
  },
  historyStatus: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
  },
  historyNote: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 5,
  },
  historyDate: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 5,
  },
});
