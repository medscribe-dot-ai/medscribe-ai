import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { colors } from '@/src/theme/colors';
import { getPatients, PatientListItem } from '@/src/services/patientService';

export default function DoctorPatientsScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef(query);
  searchRef.current = query;
  const requestIdRef = useRef(0);
  const navLockRef = useRef(false);

  const loadPatients = useCallback(async (search: string = '') => {
    const requestId = ++requestIdRef.current;
    try {
      setLoading(true);
      setError(null);
      const rows = await getPatients(search);
      if (requestId !== requestIdRef.current) return;
      setPatients(Array.isArray(rows) ? rows : []);
    } catch (e: unknown) {
      if (requestId !== requestIdRef.current) return;
      console.error('Doctor patients error:', e);
      setPatients([]);
      setError('Unable to load patients. Please try again.');
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      navLockRef.current = false;
      void loadPatients(searchRef.current.trim());
    }, [loadPatients])
  );

  const skipSearchEffect = useRef(true);
  useEffect(() => {
    if (skipSearchEffect.current) {
      skipSearchEffect.current = false;
      return;
    }
    const handle = setTimeout(() => {
      void loadPatients(query.trim());
    }, 350);
    return () => clearTimeout(handle);
  }, [query, loadPatients]);

  const openHistory = (patient: PatientListItem) => {
    if (navLockRef.current) return;
    navLockRef.current = true;
    router.push({
      pathname: '/(doctor)/history/[patient_id]',
      params: {
        patient_id: String(patient.patient_id),
        patient_name: patient.name || '',
        patient_code: patient.patient_code || '',
      },
    });
  };

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1" edges={[]}>
      <StatusBar style="dark" />

      <View className="px-6 flex-1" style={{ marginTop: 10 }}>
        <Text style={{ color: colors.darkText }} className="text-3xl font-bold mb-4">
          Patients
        </Text>

        <View
          className="flex-row items-center bg-white rounded-2xl border px-4 py-3 mb-4"
          style={{ borderColor: colors.accent }}
        >
          <MaterialCommunityIcons name="magnify" size={20} color={colors.mutedText} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search name, code, or phone"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            style={{
              flex: 1,
              marginLeft: 10,
              fontWeight: '600',
              color: colors.darkText,
              fontSize: 15,
            }}
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <MaterialCommunityIcons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center pb-16">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.mutedText }} className="mt-4 font-medium">
              Loading patients...
            </Text>
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center px-4 pb-16">
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#F97316" />
            <Text
              style={{ color: colors.darkText }}
              className="text-lg font-bold mt-4 text-center"
            >
              Patients unavailable
            </Text>
            <Text
              style={{ color: colors.mutedText }}
              className="text-sm mt-2 text-center px-4"
            >
              {error}
            </Text>
            <TouchableOpacity
              onPress={() => void loadPatients(query.trim())}
              style={{ backgroundColor: colors.primary }}
              className="mt-6 px-6 py-3 rounded-2xl"
            >
              <Text className="text-white font-bold">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : patients.length === 0 ? (
          <View className="flex-1 items-center justify-center px-6 pb-16">
            <MaterialCommunityIcons name="account-search-outline" size={52} color="#94A3B8" />
            <Text
              style={{ color: colors.darkText }}
              className="mt-4 font-bold text-base text-center"
            >
              {query.trim() ? 'No matching patients' : 'No patients found'}
            </Text>
            <Text
              style={{ color: colors.mutedText }}
              className="mt-2 text-sm text-center"
            >
              {query.trim()
                ? 'Try a different name, code, or phone number.'
                : 'Registered patients will appear here.'}
            </Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
          >
            {patients.map((patient) => (
              <PatientRow
                key={patient.patient_id}
                patient={patient}
                onPress={() => openHistory(patient)}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

function PatientRow({
  patient,
  onPress,
}: {
  patient: PatientListItem;
  onPress: () => void;
}) {
  const code = patient.patient_code?.trim() || '—';
  const ageLabel = patient.age != null ? `${patient.age}y` : null;
  const phone = patient.phone?.trim() || null;
  const department = patient.department?.trim() || null;

  const metaParts = [code, ageLabel].filter(Boolean);
  const secondaryParts = [phone, department].filter(Boolean);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        backgroundColor: 'white',
        borderColor: colors.accent,
        borderWidth: 1,
      }}
      className="p-5 rounded-3xl mb-3 flex-row items-center"
    >
      <View
        style={{ backgroundColor: colors.accent }}
        className="w-12 h-12 rounded-full items-center justify-center mr-3"
      >
        <MaterialCommunityIcons name="account-outline" size={22} color={colors.primary} />
      </View>

      <View className="flex-1 mr-2">
        <Text style={{ color: colors.darkText }} className="font-bold text-lg" numberOfLines={1}>
          {patient.name || 'Patient'}
        </Text>
        <Text style={{ color: colors.mutedText }} className="text-sm mt-1 font-semibold">
          {metaParts.join(' · ')}
        </Text>
        {secondaryParts.length > 0 ? (
          <Text
            style={{ color: colors.mutedText }}
            className="text-xs mt-1 font-medium"
            numberOfLines={1}
          >
            {secondaryParts.join(' · ')}
          </Text>
        ) : null}
      </View>

      <MaterialCommunityIcons name="chevron-right" size={22} color="#94A3B8" />
    </TouchableOpacity>
  );
}
