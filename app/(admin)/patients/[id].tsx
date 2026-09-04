import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";

import { colors } from "../../../src/theme/colors";
import { getPatientReport } from "../../../src/services/doctorService";

type Patient = {
  id: string;
  name: string;
  age: number;
  condition: string;
  status: string;
  arrivalTime?: string;
  vitals?: { bp?: string; temp?: string; weight?: string };
  receptionNotes?: string;
};

export default function PatientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<Patient | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getPatientReport(String(id));
        setPatient(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: 16 }}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: colors.primary, fontWeight: "900" }}>← Back</Text>
        </Pressable>

        {!patient ? (
          <Text style={{ marginTop: 20, fontSize: 18, fontWeight: "900", color: colors.darkText }}>
            Patient record not found.
          </Text>
        ) : (
          <View style={{ marginTop: 20, backgroundColor: "white", padding: 16, borderRadius: 18 }}>
            <Text style={{ fontSize: 20, fontWeight: "900", color: colors.darkText }}>{patient.name}</Text>
            <Text style={{ marginTop: 6, color: "#6B7280", fontWeight: "700" }}>
              {patient.id} • {patient.age}y
            </Text>

            <Text style={{ marginTop: 10, fontWeight: "800", color: colors.darkText }}>
              Condition: {patient.condition}
            </Text>

            <Text style={{ marginTop: 6, fontWeight: "800", color: colors.darkText }}>
              Status: {patient.status}
            </Text>

            {!!patient.arrivalTime && (
              <Text style={{ marginTop: 6, fontWeight: "700", color: "#6B7280" }}>
                Arrival: {patient.arrivalTime}
              </Text>
            )}

            {!!patient.receptionNotes && (
              <Text style={{ marginTop: 10, color: "#374151", fontWeight: "600" }}>
                Notes: {patient.receptionNotes}
              </Text>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
