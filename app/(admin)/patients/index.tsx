import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { colors } from "../../../src/theme/colors";
import { getDoctorDashboard } from "../../../src/services/doctorService";

// Filter types
type AdminFilter = "ALL" | "IN_QUEUE" | "ACTIVE" | "PAST_PATIENTS";

type Patient = {
  id: string;
  name: string;
  age: number;
  condition: string;
  status: string; 
};

// Logic to map status to filter tabs
function mapStatusToFilter(p: Patient): AdminFilter {
  if (p.status === "Urgent") return "IN_QUEUE";
  if (p.status === "Discharged" || p.status === "Past") return "PAST_PATIENTS";
  return "ACTIVE";
}

export default function AdminPatientsScreen() {
  const router = useRouter();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AdminFilter>("ALL");

  useEffect(() => {
    (async () => {
      try {
        const res = await getDoctorDashboard();
        // Dummy data loading for Past Patients tab
        const modifiedData = (res.queue || []).map((p: Patient, index: number) => {
          if (index === 0 || index === 1) return { ...p, status: "Discharged" };
          return p;
        });
        setPatients(modifiedData);
      } catch (e) {
        setPatients([]);
      }
    })();
  }, []);

  const counts = useMemo(() => ({
    all: patients.length,
    inQueue: patients.filter((p) => mapStatusToFilter(p) === "IN_QUEUE").length,
    active: patients.filter((p) => mapStatusToFilter(p) === "ACTIVE").length,
    past: patients.filter((p) => mapStatusToFilter(p) === "PAST_PATIENTS").length,
  }), [patients]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return patients.filter((p) => {
      const matchesQuery = !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
      const matchesFilter = filter === "ALL" ? true : mapStatusToFilter(p) === filter;
      return matchesQuery && matchesFilter;
    });
  }, [patients, query, filter]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      
      {/* --- DOCTORS LIST STYLE WHITE HEADER --- */}
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 16, 
        paddingVertical: 14,
        gap: 12,
        backgroundColor: 'white', // Header background white kiya
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6'
      }}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={{
            backgroundColor: 'white',
            padding: 8,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#F3F4F6',
            // Light shadow for depth
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 2,
          }}
        >
          <MaterialCommunityIcons name="chevron-left" size={24} color={colors.darkText} />
        </TouchableOpacity>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 20, fontWeight: "900", color: colors.darkText }}>
            Patients List
          </Text>
          {/* Green count badge like Doctor List */}
          <View style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
            <Text style={{ color: '#065F46', fontWeight: '900', fontSize: 13 }}>{counts.all}</Text>
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
        {/* Search Bar */}
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          backgroundColor: "white",
          borderRadius: 18,
          borderWidth: 1,
          borderColor: "#E5E7EB",
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}>
          <MaterialCommunityIcons name="magnify" size={20} color="#9CA3AF" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name, ID, or condition..."
            placeholderTextColor="#9CA3AF"
            style={{ flex: 1, fontWeight: "700", color: "#111827" }}
          />
        </View>

        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16 }} contentContainerStyle={{ gap: 10 }}>
          <Chip label="All" count={counts.all} active={filter === "ALL"} onPress={() => setFilter("ALL")} />
          <Chip label="In Queue" count={counts.inQueue} active={filter === "IN_QUEUE"} onPress={() => setFilter("IN_QUEUE")} />
          <Chip label="Active" count={counts.active} active={filter === "ACTIVE"} onPress={() => setFilter("ACTIVE")} />
          <Chip label="Past Patients" count={counts.past} active={filter === "PAST_PATIENTS"} onPress={() => setFilter("PAST_PATIENTS")} />
        </ScrollView>
      </View>

      {/* Patients List */}
      <ScrollView style={{ paddingHorizontal: 16, marginTop: 16 }} contentContainerStyle={{ paddingBottom: 32 }}>
        {filtered.map((p) => (
          <Pressable key={p.id} onPress={() => router.push({ pathname: "/(admin)/patients/[id]", params: { id: p.id } })}>
            <PatientRow patient={p} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Internal Components ---

function Chip({ label, count, active, onPress }: { label: string; count: number; active: boolean; onPress: () => void; }) {
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
      <View style={{ backgroundColor: active ? "white" : "#F3F4F6", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
        <Text style={{ fontWeight: "900", color: active ? colors.primary : "#111827", fontSize: 12 }}>{count}</Text>
      </View>
    </Pressable>
  );
}

function PatientRow({ patient }: { patient: Patient }) {
  const getBadgeStyle = () => {
    if (patient.status === "Urgent") return { text: "In Queue", bg: "#FEF3C7", fg: "#92400E" };
    if (patient.status === "Discharged" || patient.status === "Past") return { text: "Past Patient", bg: "#F3F4F6", fg: "#6B7280" };
    return { text: "Active", bg: "#D1FAE5", fg: "#065F46" };
  };
  const badge = getBadgeStyle();

  return (
    <View style={{
        backgroundColor: "white",
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        marginBottom: 12,
        flexDirection: "row",
        gap: 14,
        alignItems: "center",
      }}>
      <View style={{ width: 48, height: 48, borderRadius: 999, backgroundColor: colors.accent + "40", alignItems: "center", justifyContent: "center" }}>
        <MaterialCommunityIcons name="account-outline" size={22} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 16, fontWeight: "900", color: "#111827" }}>{patient.name}</Text>
          <View style={{ backgroundColor: badge.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
            <Text style={{ color: badge.fg, fontWeight: "900", fontSize: 12 }}>{badge.text}</Text>
          </View>
        </View>
        <Text style={{ color: "#6B7280", marginTop: 2, fontWeight: "700" }}>{patient.id} • {patient.age}y</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
          <MaterialCommunityIcons name="stethoscope" size={16} color="#6B7280" />
          <Text style={{ color: "#6B7280", fontWeight: "800" }}>{patient.condition}</Text>
        </View>
      </View>
    </View>
  );
}