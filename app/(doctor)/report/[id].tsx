import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getPatientById, PatientListItem } from '@/src/services/patientService';
import { colors } from '@/src/theme/colors';

function titleCaseStatus(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return '—';
  return raw
    .trim()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatRegisteredAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PatientReport() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [patient, setPatient] = useState<PatientListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedAudioUri, setSavedAudioUri] = useState<string | null>(null);

  const audioRecorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    directory: 'document',
  });
  const recorderState = useAudioRecorderState(audioRecorder);
  const isRecording = recorderState.isRecording;

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    getPatientById(id as string)
      .then((data) => setPatient(data))
      .catch((err: unknown) => {
        console.log('Patient load error:', err);
        Alert.alert('Error', err instanceof Error ? err.message : String(err));
        setPatient(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function startRecording() {
    try {
      let permission = await AudioModule.getRecordingPermissionsAsync();
      if (!permission.granted) {
        permission = await AudioModule.requestRecordingPermissionsAsync();
      }
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Microphone access is required to record consultation.');
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      console.log('Recording started');
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', err instanceof Error ? err.message : String(err));
    }
  }

  async function stopRecording() {
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      setSavedAudioUri(uri);
      console.log('Recording stopped at:', uri);
      Alert.alert('Success', 'Consultation recorded successfully!');
    } catch (err) {
      console.error('Failed to stop recording', err);
      Alert.alert('Error', err instanceof Error ? err.message : String(err));
    }
  }

  if (loading) {
    return (
      <View
        style={{ backgroundColor: colors.background }}
        className="flex-1 justify-center items-center"
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!patient) {
    return (
      <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1" edges={[]}>
        <StatusBar style="dark" />
        <View className="px-6" style={{ marginTop: 10 }}>
          <TouchableOpacity
            onPress={() => router.replace('/(doctor)/dashboard')}
            className="flex-row items-center py-2"
          >
            <View
              style={{ backgroundColor: colors.accent }}
              className="w-8 h-8 rounded-full items-center justify-center"
            >
              <Text style={{ color: colors.primary }} className="font-bold">
                ←
              </Text>
            </View>
            <Text style={{ color: colors.primary }} className="ml-3 font-bold text-base">
              Dashboard
            </Text>
          </TouchableOpacity>
        </View>
        <View className="flex-1 justify-center items-center px-6">
          <Text style={{ color: colors.darkText }} className="text-lg font-bold">
            Patient not found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const codeOrId = patient.patient_code || String(patient.patient_id);
  const ageLabel =
    patient.age != null ? `${patient.age} years old` : 'Age unavailable';
  const departmentLabel = patient.department?.trim() || 'Department unavailable';
  const registeredAt = formatRegisteredAt(patient.created_at);

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1" edges={[]}>
      <StatusBar style="dark" />

      {/* Navigation Bar */}
      <View className="px-6" style={{ marginTop: 10 }}>
        <TouchableOpacity
          onPress={() => router.replace('/(doctor)/dashboard')}
          className="flex-row items-center py-2"
        >
          <View
            style={{ backgroundColor: colors.accent }}
            className="w-8 h-8 rounded-full items-center justify-center"
          >
            <Text style={{ color: colors.primary }} className="font-bold">
              ←
            </Text>
          </View>
          <Text style={{ color: colors.primary }} className="ml-3 font-bold text-base">
            Dashboard
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="px-6 flex-1" contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>

        {/* Patient Profile Header */}
        <View className="mt-8 mb-6">
          <Text
            style={{ color: colors.mutedText }}
            className="text-xs font-bold uppercase tracking-wider mb-1"
          >
            Patient: {codeOrId}
          </Text>
          <Text style={{ color: colors.darkText }} className="text-4xl font-bold">
            {patient.name}
          </Text>
          <Text style={{ color: colors.mutedText }} className="text-lg mt-1">
            {ageLabel} • {departmentLabel}
          </Text>
          <Text style={{ color: colors.mutedText }} className="text-sm mt-2 font-semibold">
            Status: {titleCaseStatus(patient.status)}
            {patient.phone ? ` • ${patient.phone}` : ''}
          </Text>
          {registeredAt ? (
            <Text style={{ color: colors.mutedText }} className="text-sm mt-1 font-semibold">
              Registered: {registeredAt}
            </Text>
          ) : null}
          <Text style={{ color: colors.mutedText }} className="text-sm mt-1 font-semibold">
            Visits on record: {patient.visit_count ?? 0}
          </Text>
        </View>

        {/* No vitals API — explicit empty state (not fake values) */}
        <View
          style={{ backgroundColor: 'white', borderColor: colors.accent }}
          className="p-6 rounded-3xl border shadow-sm mb-6"
        >
          <Text style={{ color: colors.primary }} className="font-bold mb-2 text-lg">
            Reception Vitals
          </Text>
          <Text style={{ color: colors.mutedText }} className="leading-6 text-base font-medium">
            Vitals are not available. This clinic does not store BP, temperature, or weight on the
            patient record yet.
          </Text>
        </View>

        <View style={{ backgroundColor: colors.accent }} className="p-6 rounded-3xl mb-8">
          <Text style={{ color: colors.primary }} className="font-bold mb-2 text-lg">
            Reason for Visit
          </Text>
          <Text
            style={{ color: colors.primary, opacity: 0.8 }}
            className="leading-6 text-base font-medium"
          >
            Reception notes are not available for this patient.
          </Text>
        </View>

        <View className="items-center mb-12">
          <TouchableOpacity
            onPress={isRecording ? stopRecording : startRecording}
            style={{
              backgroundColor: isRecording ? '#EF4444' : colors.primary,
              width: 80,
              height: 80,
              borderRadius: 40,
            }}
            className="items-center justify-center shadow-xl"
          >
            <MaterialCommunityIcons
              name={isRecording ? 'stop' : 'microphone'}
              size={40}
              color="white"
            />
          </TouchableOpacity>

          <Text
            className="mt-4 font-bold text-lg"
            style={{ color: isRecording ? '#EF4444' : colors.darkText }}
          >
            {isRecording ? 'Recording Consultation...' : 'Tap to Start Examination'}
          </Text>

          {savedAudioUri && !isRecording && (
            <Text className="mt-2 text-xs text-slate-400">
              Recording saved: {savedAudioUri.split('/').pop()}
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
