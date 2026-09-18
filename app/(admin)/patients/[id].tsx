import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { colors } from "../../../src/theme/colors";
import {
  getPatientById,
  getPatientHistory,
  PatientHistoryResponse,
  PatientHistoryVisit,
  PatientListItem,
} from "../../../src/services/patientService";
import { formatAppointmentDateTime } from "../../../src/utils/doctorSlots";

function formatVisitWhen(iso: string | null | undefined): string {
  const formatted = formatAppointmentDateTime(iso);
  return formatted === "—" ? "Date not set" : formatted;
}

function titleCaseStatus(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return "—";
  return raw
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isCompletedConsultation(visit: PatientHistoryVisit): boolean {
  return (visit.consultation_status || "").toLowerCase().trim() === "completed";
}

function soapSectionText(
  visit: PatientHistoryVisit,
  key: keyof NonNullable<PatientHistoryVisit["soap_sections"]>
): string | null {
  const fromSections = visit.soap_sections?.[key];
  if (fromSections && String(fromSections).trim()) return String(fromSections).trim();
  return null;
}

export default function PatientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [basics, setBasics] = useState<PatientListItem | null>(null);
  const [history, setHistory] = useState<PatientHistoryResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) {
        setError("Missing patient id.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [listItem, hist] = await Promise.all([
          getPatientById(id).catch(() => null),
          getPatientHistory(id),
        ]);
        if (cancelled) return;
        setBasics(listItem);
        setHistory(hist);
      } catch (e: unknown) {
        if (cancelled) return;
        const msg =
          e && typeof e === "object" && "response" in e
            ? (e as { response?: { data?: { detail?: string }; status?: number } }).response
                ?.data?.detail
            : null;
        setHistory(null);
        setBasics(null);
        setError(
          typeof msg === "string" && msg.trim()
            ? msg
            : e instanceof Error
              ? e.message
              : "Unable to load patient history."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const displayName =
    history?.patient_name || basics?.name || "Patient";
  const displayCode =
    history?.patient_code || basics?.patient_code || (id ? String(id) : "—");
  const ageLabel = basics?.age != null ? `${basics.age}y` : null;
  const department = basics?.department?.trim() || null;
  const regStatus = basics?.status ? titleCaseStatus(basics.status) : null;
  const visits = history?.visits ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={[]}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 }}
        >
          <MaterialCommunityIcons name="chevron-left" size={22} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: "900" }}>Back</Text>
        </Pressable>

        {error ? (
          <View
            style={{
              backgroundColor: "#FEF2F2",
              borderColor: "#FECACA",
              borderWidth: 1,
              borderRadius: 18,
              padding: 16,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "900", color: "#991B1B" }}>
              Could not load history
            </Text>
            <Text style={{ marginTop: 8, color: "#7F1D1D", fontWeight: "600" }}>{error}</Text>
          </View>
        ) : (
          <>
            {/* Patient basics */}
            <View
              style={{
                backgroundColor: "white",
                padding: 16,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: "#E5E7EB",
                marginBottom: 20,
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: "900", color: colors.darkText }}>
                {displayName}
              </Text>
              <Text style={{ marginTop: 6, color: "#6B7280", fontWeight: "700" }}>
                {displayCode}
                {ageLabel ? ` • ${ageLabel}` : ""}
              </Text>

              {!!department && (
                <Text style={{ marginTop: 10, fontWeight: "800", color: colors.darkText }}>
                  Department: {department}
                </Text>
              )}

              {!!regStatus && (
                <Text style={{ marginTop: 6, fontWeight: "800", color: colors.darkText }}>
                  Status: {regStatus}
                </Text>
              )}

              {!!basics?.phone && (
                <Text style={{ marginTop: 6, fontWeight: "700", color: "#6B7280" }}>
                  Phone: {basics.phone}
                </Text>
              )}
            </View>

            <Text
              style={{
                fontSize: 14,
                fontWeight: "900",
                color: colors.darkText,
                marginBottom: 12,
                textTransform: "uppercase",
                letterSpacing: 0.6,
              }}
            >
              Visit history
            </Text>

            {visits.length === 0 ? (
              <View
                style={{
                  backgroundColor: "white",
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                  padding: 20,
                  alignItems: "center",
                }}
              >
                <MaterialCommunityIcons name="calendar-blank-outline" size={28} color="#9CA3AF" />
                <Text
                  style={{
                    marginTop: 10,
                    color: "#6B7280",
                    fontWeight: "700",
                    textAlign: "center",
                  }}
                >
                  No visits recorded yet.
                </Text>
              </View>
            ) : (
              visits.map((visit) => (
                <VisitCard key={visit.appointment_id} visit={visit} />
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function VisitCard({ visit }: { visit: PatientHistoryVisit }) {
  const completed = isCompletedConsultation(visit);
  const sections = completed
    ? [
        { label: "Subjective", value: soapSectionText(visit, "subjective") },
        { label: "Objective", value: soapSectionText(visit, "objective") },
        { label: "Assessment", value: soapSectionText(visit, "assessment") },
        { label: "Plan", value: soapSectionText(visit, "plan") },
      ].filter((s) => !!s.value)
    : [];

  // Fallback: completed with raw note but no parsed sections
  const showRawSoap =
    completed && sections.length === 0 && !!(visit.soap_note && visit.soap_note.trim());

  return (
    <View
      style={{
        backgroundColor: "white",
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        padding: 16,
        marginBottom: 12,
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: "900", color: colors.darkText }}>
        {formatVisitWhen(visit.scheduled_time)}
      </Text>

      <MetaRow
        icon="stethoscope"
        label="Doctor"
        value={visit.doctor_name?.trim() || "—"}
      />
      <MetaRow
        icon="clipboard-text-outline"
        label="Appointment"
        value={titleCaseStatus(visit.status)}
      />
      {!!visit.queue_token?.trim() && (
        <MetaRow icon="ticket-confirmation-outline" label="Token" value={visit.queue_token.trim()} />
      )}
      {!!visit.consultation_status?.trim() && (
        <MetaRow
          icon="file-document-outline"
          label="Consultation"
          value={titleCaseStatus(visit.consultation_status)}
        />
      )}

      {completed && (sections.length > 0 || showRawSoap) && (
        <View
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTopWidth: 1,
            borderTopColor: "#F3F4F6",
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: "900",
              color: colors.primary,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: 10,
            }}
          >
            SOAP note
          </Text>

          {sections.map((s) => (
            <View key={s.label} style={{ marginBottom: 10 }}>
              <Text style={{ fontWeight: "900", color: "#111827", marginBottom: 2 }}>
                {s.label}
              </Text>
              <Text style={{ color: "#374151", fontWeight: "600", lineHeight: 20 }}>
                {s.value}
              </Text>
            </View>
          ))}

          {showRawSoap && (
            <Text style={{ color: "#374151", fontWeight: "600", lineHeight: 20 }}>
              {visit.soap_note!.trim()}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  value: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 8 }}>
      <MaterialCommunityIcons name={icon} size={16} color="#6B7280" style={{ marginTop: 2 }} />
      <Text style={{ flex: 1, color: "#6B7280", fontWeight: "700" }}>
        <Text style={{ fontWeight: "800", color: "#374151" }}>{label}: </Text>
        {value}
      </Text>
    </View>
  );
}
