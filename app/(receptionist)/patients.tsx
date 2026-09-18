import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../../src/config/api';
import { ReceptionistMenuButton } from '../../src/components/receptionist/ReceptionistNavMenu';

interface Patient {
  patient_id: number;
  name: string;
  patient_code: string | null;
  age: number | null;
  phone: string | null;
  department: string | null;
  status: string | null;
  created_at: string | null;
  visit_count: number;
}

const PatientsPage = () => {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const fetchPatients = async (search: string = '') => {
    try {
      setLoading(true);
      const headers: Record<string, string> = {};
      try {
        const raw = await AsyncStorage.getItem('user_data');
        const user = raw ? JSON.parse(raw) : null;
        if (user?.user_id != null) {
          headers['X-User-Id'] = String(user.user_id);
        }
      } catch {
        // Backend still omits clinical summary unless role is doctor/admin
      }
      const response = await axios.get(`${API_URL}/patients`, {
        params: { search },
        headers,
      });
      setPatients(response.data);
    } catch (error: any) {
      console.error('Failed to fetch patients:', error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchPatients(searchTerm);
    }, [])
  );

  const handleSearchChange = (text: string) => {
    setSearchTerm(text);
  };

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      fetchPatients(searchTerm);
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  return (
    <SafeAreaView style={{ flex: 1, overflow: 'hidden', backgroundColor: '#F8FAFC' }} edges={[]}>
      <View className="px-6 py-4 bg-white border-b border-slate-100 flex-row items-center justify-between">
        <ReceptionistMenuButton title="Patients" />
        <TouchableOpacity
          onPress={() => router.push('/(receptionist)/register')}
          className="bg-teal-600 px-3 py-2 rounded-xl flex-row items-center gap-x-1"
        >
          <MaterialCommunityIcons name="account-plus" size={16} color="#FFFFFF" />
          <Text className="text-white text-xs font-bold">Register</Text>
        </TouchableOpacity>
      </View>

      <View className="px-6 py-4">
        <View className="flex-row items-center bg-white border border-slate-200 rounded-xl px-4 py-3">
          <Feather name="search" size={20} color="#94A3B8" />
          <TextInput
            placeholder="Search name, ID, or phone..."
            value={searchTerm}
            onChangeText={handleSearchChange}
            className="ml-3 flex-1"
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }} style={{ flex: 1 }}>
        {loading && patients.length === 0 ? (
          <ActivityIndicator size="large" color="#0D9488" style={{ marginTop: 40 }} />
        ) : patients.length === 0 ? (
          <Text className="text-sm text-slate-400 text-center mt-10">
            {searchTerm ? 'No patients match your search.' : 'No patients registered yet.'}
          </Text>
        ) : (
          patients.map((p) => (
            <TouchableOpacity
              key={p.patient_id}
              onPress={() =>
                router.push({
                  pathname: '/(receptionist)/book-appointment',
                  params: {
                    patient_id: String(p.patient_id),
                    name: p.name,
                    patient_code: p.patient_code || '',
                  },
                })
              }
              activeOpacity={0.85}
              className="bg-white p-5 rounded-2xl border border-slate-100 mb-4 shadow-sm flex-row justify-between items-center"
            >
              <View className="flex-row items-start flex-1">
                <View className="w-12 h-12 bg-teal-50 rounded-full items-center justify-center">
                  <Text className="text-teal-700 font-bold">{getInitials(p.name)}</Text>
                </View>
                <View className="ml-4 flex-1">
                  <Text className="font-bold text-slate-900">{p.name}</Text>
                  <Text className="text-xs text-slate-500 mt-0.5">
                    {p.age ? `${p.age}y` : '—'} • {p.patient_code || '—'}
                  </Text>
                  <Text className="text-xs text-slate-400 mt-0.5">
                    📞 {p.phone || 'N/A'} • 📄 {p.visit_count} visit{p.visit_count !== 1 ? 's' : ''}
                  </Text>
                  <Text className="text-[11px] font-semibold text-teal-600 mt-2">
                    Book New Appointment →
                  </Text>
                </View>
              </View>

              <View className="items-end">
                <View className="bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
                  <Text className="text-[11px] font-bold text-slate-600">
                    {p.department?.trim() || 'Not specified'}
                  </Text>
                </View>
                <Text className="text-[10px] text-slate-400 mt-2">📅 {formatDate(p.created_at)}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default PatientsPage;
