import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getPatientById,
  getPatientHistory,
  PatientHistoryVisit,
  PatientListItem,
} from '@/src/services/patientService';
import { formatAppointmentDateTime } from '@/src/utils/doctorSlots';

function formatVisitWhen(iso: string | null | undefined): string {
  const formatted = formatAppointmentDateTime(iso);
  return formatted === '—' ? 'Date not set' : formatted;
}

function isCompletedConsultation(visit: PatientHistoryVisit): boolean {
  return (visit.consultation_status || '').toLowerCase().trim() === 'completed';
}

function HistoryVisitCard({ visit }: { visit: PatientHistoryVisit }) {
  const [showFullSoap, setShowFullSoap] = useState(false);

  const sections = (
    [
      { key: 'assessment', label: 'Assessment', value: visit.soap_sections?.assessment },
      { key: 'plan', label: 'Plan', value: visit.soap_sections?.plan },
      { key: 'subjective', label: 'Subjective', value: visit.soap_sections?.subjective },
      { key: 'objective', label: 'Objective', value: visit.soap_sections?.objective },
    ] as const
  ).filter((s) => !!(s.value && String(s.value).trim()));

  const rawNote =
    sections.length === 0 && visit.soap_note?.trim() ? visit.soap_note.trim() : null;

  const hasSummary = !!(visit.clinical_summary && visit.clinical_summary.trim());
  const hasDetail = sections.length > 0 || !!rawNote;
  const showDetail = hasSummary ? showFullSoap : hasDetail;

  const detailBlock =
    sections.length > 0 ? (
      <View style={{ marginTop: 12 }}>
        {sections.map((s) => (
          <View key={s.key} style={{ marginBottom: 10 }}>
            <Text style={{ fontWeight: '800', color: '#0f172a', fontSize: 12, marginBottom: 2 }}>
              {s.label}
            </Text>
            <Text style={{ color: '#334155', fontSize: 13, lineHeight: 18, fontWeight: '500' }}>
              {String(s.value).trim()}
            </Text>
          </View>
        ))}
      </View>
    ) : rawNote ? (
      <Text
        style={{
          marginTop: 12,
          color: '#334155',
          fontSize: 13,
          lineHeight: 18,
          fontWeight: '500',
        }}
      >
        {rawNote}
      </Text>
    ) : null;

  const doctorLabel = visit.doctor_name?.trim() || null;
  const tokenLabel = visit.queue_token?.trim() || null;

  return (
    <View
      style={{
        backgroundColor: '#ffffff',
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 12,
      }}
    >
      <Text style={{ color: '#0d9488', fontSize: 14, fontWeight: '800' }}>
        {formatVisitWhen(visit.scheduled_time)}
      </Text>

      {doctorLabel ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 }}>
          <MaterialCommunityIcons name="stethoscope" size={15} color="#64748b" />
          <Text style={{ color: '#334155', fontSize: 13, fontWeight: '700', flex: 1 }}>
            {doctorLabel}
          </Text>
        </View>
      ) : null}

      {tokenLabel ? (
        <Text style={{ color: '#64748b', fontSize: 12, marginTop: 4, fontWeight: '600' }}>
          Token: {tokenLabel}
        </Text>
      ) : null}

      {hasSummary ? (
        <View
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 14,
            backgroundColor: '#f0fdfa',
            borderWidth: 1,
            borderColor: '#99f6e4',
          }}
        >
          <Text style={{ fontWeight: '800', color: '#0f766e', fontSize: 12, marginBottom: 4 }}>
            Clinical Summary
          </Text>
          <Text style={{ color: '#334155', fontSize: 13, lineHeight: 18, fontWeight: '500' }}>
            {visit.clinical_summary!.trim()}
          </Text>
        </View>
      ) : null}

      {hasSummary && hasDetail ? (
        <TouchableOpacity
          onPress={() => setShowFullSoap((prev) => !prev)}
          style={{
            marginTop: 12,
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 6,
          }}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons
            name={showFullSoap ? 'chevron-up' : 'chevron-down'}
            size={18}
            color="#0d9488"
          />
          <Text style={{ color: '#0d9488', fontWeight: '800', fontSize: 13, marginLeft: 4 }}>
            {showFullSoap ? 'Hide Full SOAP' : 'View Full SOAP'}
          </Text>
        </TouchableOpacity>
      ) : null}

      {showDetail && detailBlock ? (
        detailBlock
      ) : !hasSummary && !hasDetail ? (
        <Text style={{ marginTop: 10, color: '#64748b', fontSize: 13, fontWeight: '600' }}>
          No SOAP content available for this visit.
        </Text>
      ) : null}
    </View>
  );
}

function HeaderMetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
      <MaterialCommunityIcons name={icon} size={16} color="#64748b" />
      <Text style={{ color: '#64748b', fontSize: 13, fontWeight: '600', flex: 1 }}>
        <Text style={{ fontWeight: '700', color: '#334155' }}>{label}: </Text>
        {value}
      </Text>
    </View>
  );
}

export default function DoctorVisitHistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    patient_id?: string;
    exclude_appointment_id?: string;
    patient_name?: string;
    patient_code?: string;
  }>();

  const patientId = params.patient_id ? String(params.patient_id).trim() : '';
  const excludeAppointmentId = params.exclude_appointment_id
    ? Number(params.exclude_appointment_id)
    : null;
  const paramName = params.patient_name?.trim() || '';
  const paramCode = params.patient_code?.trim() || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visits, setVisits] = useState<PatientHistoryVisit[]>([]);
  const [patientName, setPatientName] = useState(paramName);
  const [patientCode, setPatientCode] = useState(paramCode);
  const [patientBasics, setPatientBasics] = useState<PatientListItem | null>(null);

  const loadHistory = useCallback(async () => {
    if (!patientId) {
      setError('Missing patient.');
      setVisits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const hist = await getPatientHistory(patientId);
      setPatientName(hist.patient_name?.trim() || paramName || 'Patient');
      setPatientCode(hist.patient_code?.trim() || paramCode || '—');
      setVisits(Array.isArray(hist.visits) ? hist.visits : []);
    } catch (e: unknown) {
      setVisits([]);
      setError(
        e instanceof Error ? e.message : 'Unable to load visit history. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [patientId, paramName, paramCode]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  // Optional demographics — must not block or wipe history on failure.
  useEffect(() => {
    let cancelled = false;
    if (!patientId) {
      setPatientBasics(null);
      return;
    }
    (async () => {
      try {
        const basics = await getPatientById(patientId);
        if (!cancelled) setPatientBasics(basics);
      } catch {
        if (!cancelled) setPatientBasics(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const completedHistory = useMemo(() => {
    return visits.filter((v) => {
      if (!isCompletedConsultation(v)) return false;
      if (
        excludeAppointmentId != null &&
        !Number.isNaN(excludeAppointmentId) &&
        v.appointment_id === excludeAppointmentId
      ) {
        return false;
      }
      return true;
    });
  }, [visits, excludeAppointmentId]);

  const displayName =
    patientName || patientBasics?.name?.trim() || paramName || 'Patient';
  const displayCode =
    patientCode || patientBasics?.patient_code?.trim() || paramCode || '—';
  const ageLabel =
    patientBasics?.age != null && !Number.isNaN(patientBasics.age)
      ? `${patientBasics.age} years`
      : null;
  const phoneLabel = patientBasics?.phone?.trim() || null;
  const departmentLabel = patientBasics?.department?.trim() || null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }} edges={[]}>
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            backgroundColor: '#fff',
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
            borderWidth: 1,
            borderColor: '#e2e8f0',
          }}
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color="#1e293b" />
        </TouchableOpacity>

        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            padding: 16,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '800',
              color: '#0d9488',
              textTransform: 'uppercase',
              letterSpacing: 0.6,
            }}
          >
            Patient Record
          </Text>
          <Text
            style={{
              color: '#0f172a',
              fontSize: 22,
              fontWeight: '800',
              marginTop: 6,
              letterSpacing: -0.3,
            }}
          >
            {displayName}
          </Text>
          <Text style={{ color: '#64748b', fontSize: 13, fontWeight: '700', marginTop: 4 }}>
            {displayCode}
          </Text>

          {ageLabel ? (
            <HeaderMetaRow icon="calendar-account-outline" label="Age" value={ageLabel} />
          ) : null}
          {phoneLabel ? (
            <HeaderMetaRow icon="phone-outline" label="Phone" value={phoneLabel} />
          ) : null}
          {departmentLabel ? (
            <HeaderMetaRow icon="hospital-building" label="Department" value={departmentLabel} />
          ) : null}

          <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600', marginTop: 12 }}>
            Read-only previous consultations
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 }}>
          <ActivityIndicator size="large" color="#0d9488" />
          <Text style={{ color: '#64748b', marginTop: 12, fontWeight: '600' }}>
            Loading visit history…
          </Text>
        </View>
      ) : error ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
          <View
            style={{
              backgroundColor: '#fef2f2',
              borderColor: '#fca5a5',
              borderWidth: 1,
              borderRadius: 16,
              padding: 20,
            }}
          >
            <Text style={{ color: '#991b1b', fontWeight: '800', fontSize: 16, marginBottom: 8 }}>
              Unable to load history
            </Text>
            <Text style={{ color: '#7f1d1d', fontSize: 14, lineHeight: 20, marginBottom: 16 }}>
              {error}
            </Text>
            <TouchableOpacity
              onPress={() => void loadHistory()}
              style={{
                backgroundColor: '#0d9488',
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: '700', color: '#fff' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '800',
              color: '#0f172a',
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              marginBottom: 12,
            }}
          >
            Visit History
          </Text>

          {completedHistory.length === 0 ? (
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                padding: 28,
                alignItems: 'center',
              }}
            >
              <MaterialCommunityIcons name="clipboard-text-outline" size={40} color="#94a3b8" />
              <Text
                style={{
                  color: '#64748b',
                  fontSize: 14,
                  fontWeight: '700',
                  textAlign: 'center',
                  marginTop: 12,
                  lineHeight: 20,
                }}
              >
                No previous consultations found for this patient.
              </Text>
            </View>
          ) : (
            completedHistory.map((visit) => (
              <HistoryVisitCard key={visit.appointment_id} visit={visit} />
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
