import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { colors } from "../../../src/theme/colors";
import { getPatients, PatientListItem } from "../../../src/services/patientService";

type AdminFilter = "ALL" | "IN_QUEUE" | "ACTIVE" | "PAST_PATIENTS";

/** UI row mapped from real GET /patients fields */
type Patient = {
  id: string;
  patientId: number;
  name: string;
  age: number | null;
  condition: string;
  status: string;
  visitCount: number;
};

function mapApiPatient(p: PatientListItem): Patient {
  const status = (p.status || "").toLowerCase().trim() || "waiting";
  return {
    id: p.patient_code || String(p.patient_id),
    patientId: p.patient_id,
    name: p.name || "Unknown",
    age: p.age ?? null,
    condition: p.department?.trim() || "—",
    status,
    visitCount: p.visit_count ?? 0,
  };
}

/**
 * Patient.model status is waiting | assigned (see backend).
 * Past = has prior visits and is no longer waiting/assigned.
 */
function mapStatusToFilter(p: Patient): AdminFilter {
  if (p.status === "waiting") return "IN_QUEUE";
  if (p.status === "assigned") return "ACTIVE";
  if (p.visitCount > 0) return "PAST_PATIENTS";
  return "ACTIVE";
}

export default function AdminPatientsScreen() {
  const router = useRouter();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AdminFilter>("ALL");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const rows = await getPatients();
        if (!cancelled) setPatients(rows.map(mapApiPatient));
      } catch {
        if (!cancelled) setPatients([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(
    () => ({
      all: patients.length,
      inQueue: patients.filter((p) => mapStatusToFilter(p) === "IN_QUEUE").length,
      active: patients.filter((p) => mapStatusToFilter(p) === "ACTIVE").length,
      past: patients.filter((p) => mapStatusToFilter(p) === "PAST_PATIENTS").length,
    }),
    [patients]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return patients.filter((p) => {
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.condition.toLowerCase().includes(q) ||
        String(p.patientId).includes(q);
      const matchesFilter = filter === "ALL" ? true : mapStatusToFilter(p) === filter;
      return matchesQuery && matchesFilter;
    });
  }, [patients, query, filter]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={[]}>
      {/* --- DOCTORS LIST STYLE WHITE HEADER --- */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 14,
          gap: 12,
          backgroundColor: "white",
          borderBottomWidth: 1,
          borderBottomColor: "#F3F4F6",
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            backgroundColor: "white",
            padding: 8,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#F3F4F6",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 2,
          }}
        >
          <MaterialCommunityIcons name="chevron-left" size={24} color={colors.darkText} />
        </TouchableOpacity>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 20, fontWeight: "900", color: colors.darkText }}>
            Patients List
          </Text>
          <View
            style={{
              backgroundColor: "#D1FAE5",
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: "#065F46", fontWeight: "900", fontSize: 13 }}>
              {counts.all}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            backgroundColor: "white",
            borderRadius: 18,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            paddingHorizontal: 14,
            paddingVertical: 12,
          }}
        >
          <MaterialCommunityIcons name="magnify" size={20} color="#9CA3AF" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name, ID, or department..."
            placeholderTextColor="#9CA3AF"
            style={{ flex: 1, fontWeight: "700", color: "#111827" }}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 16 }}
          contentContainerStyle={{ gap: 10 }}
        >
          <Chip label="All" count={counts.all} active={filter === "ALL"} onPress={() => setFilter("ALL")} />
          <Chip
            label="In Queue"
            count={counts.inQueue}
            active={filter === "IN_QUEUE"}
            onPress={() => setFilter("IN_QUEUE")}
          />
          <Chip
            label="Active"
            count={counts.active}
            active={filter === "ACTIVE"}
            onPress={() => setFilter("ACTIVE")}
          />
          <Chip
            label="Past Patients"
            count={counts.past}
            active={filter === "PAST_PATIENTS"}
            onPress={() => setFilter("PAST_PATIENTS")}
          />
        </ScrollView>
      </View>

      <ScrollView
        style={{ paddingHorizontal: 16, marginTop: 16 }}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 24 }} />
        ) : filtered.length === 0 ? (
          <Text
            style={{
              textAlign: "center",
              color: "#9CA3AF",
              fontWeight: "700",
              marginTop: 24,
            }}
          >
            No patients found.
          </Text>
        ) : (
          filtered.map((p) => (
            <Pressable
              key={p.patientId}
              onPress={() =>
                router.push({
                  pathname: "/(admin)/patients/[id]",
                  params: { id: String(p.patientId) },
                })
              }
            >
              <PatientRow patient={p} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: active ? colors.primary : "#E5E7EB",
        backgroundColor: active ? colors.primary : "white",
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <Text style={{ fontWeight: "900", color: active ? "white" : "#111827" }}>{label}</Text>
      <View
        style={{
          backgroundColor: active ? "white" : "#F3F4F6",
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 10,
        }}
      >
        <Text
          style={{
            fontWeight: "900",
            color: active ? colors.primary : "#111827",
            fontSize: 12,
          }}
        >
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

function PatientRow({ patient }: { patient: Patient }) {
  const getBadgeStyle = () => {
    const tab = mapStatusToFilter(patient);
    if (tab === "IN_QUEUE") return { text: "In Queue", bg: "#FEF3C7", fg: "#92400E" };
    if (tab === "PAST_PATIENTS") return { text: "Past Patient", bg: "#F3F4F6", fg: "#6B7280" };
    return { text: "Active", bg: "#D1FAE5", fg: "#065F46" };
  };
  const badge = getBadgeStyle();
  const ageLabel = patient.age != null ? `${patient.age}y` : "—";

  return (
    <View
      style={{
        backgroundColor: "white",
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        marginBottom: 12,
        flexDirection: "row",
        gap: 14,
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 999,
          backgroundColor: colors.accent + "40",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialCommunityIcons name="account-outline" size={22} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "900", color: "#111827" }}>{patient.name}</Text>
          <View
            style={{
              backgroundColor: badge.bg,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
            }}
          >
            <Text style={{ color: badge.fg, fontWeight: "900", fontSize: 12 }}>{badge.text}</Text>
          </View>
        </View>
        <Text style={{ color: "#6B7280", marginTop: 2, fontWeight: "700" }}>
          {patient.id} • {ageLabel}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
          <MaterialCommunityIcons name="stethoscope" size={16} color="#6B7280" />
          <Text style={{ color: "#6B7280", fontWeight: "800" }}>{patient.condition}</Text>
        </View>
      </View>
    </View>
  );
}
