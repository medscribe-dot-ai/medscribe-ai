import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../src/config/api';
import { printQueueToken } from '../../src/utils/printQueueToken';
import { ReceptionistMenuButton } from '../../src/components/receptionist/ReceptionistNavMenu';

interface Appointment {
  appointment_id: number;
  patient_id: number;
  doctor_id: number;
  scheduled_time: string | null;
  status: string | null;
  queue_token: string | null;
  patient_name: string | null;
  patient_code: string | null;
  doctor_name: string | null;
}

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  waiting: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Waiting' },
  scheduled: { bg: 'bg-sky-50', text: 'text-sky-700', label: 'Scheduled' },
  in_progress: { bg: 'bg-teal-50', text: 'text-teal-700', label: 'In Progress' },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Completed' },
  cancelled: { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Cancelled' },
};

const AppointmentsPage = () => {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const todayParam = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const fetchAppointments = async () => {
    try {
      const res = await axios.get(`${API_URL}/appointments`, {
        params: { date: todayParam() },
      });
      setAppointments(res.data || []);
    } catch (error: any) {
      console.error('Failed to fetch appointments:', error.response?.data || error.message);
      setAppointments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchAppointments();
    }, [])
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View className="px-6 py-4 flex-row items-center justify-between border-b border-slate-100 bg-white">
        <ReceptionistMenuButton title="Appointments" />
        <TouchableOpacity
          onPress={() => router.push('/(receptionist)/patients')}
          className="bg-teal-600 px-3 py-2 rounded-xl flex-row items-center gap-x-1"
        >
          <MaterialCommunityIcons name="calendar-plus" size={16} color="#FFFFFF" />
          <Text className="text-white text-xs font-bold">Book</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchAppointments();
            }}
            tintColor="#0D9488"
          />
        }
      >
        <Text className="text-sm font-bold text-slate-500 mb-4 uppercase">Today, {todayLabel}</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#0D9488" style={{ marginTop: 40 }} />
        ) : appointments.length === 0 ? (
          <View className="items-center py-16">
            <MaterialCommunityIcons name="calendar-blank-outline" size={48} color="#94A3B8" />
            <Text className="text-sm font-bold text-slate-400 mt-3">No appointments today</Text>
            <Text className="text-xs text-slate-400 mt-1 text-center px-8">
              Select a patient from the Patients list to book a visit.
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(receptionist)/patients')}
              className="mt-5 bg-teal-600 px-5 py-3 rounded-2xl"
            >
              <Text className="text-white font-bold text-sm">Go to Patients</Text>
            </TouchableOpacity>
          </View>
        ) : (
          appointments.map((app) => {
            const style = statusStyles[app.status || ''] || statusStyles.scheduled;
            return (
              <View
                key={app.appointment_id}
                className="bg-white p-4 rounded-2xl border border-slate-100 mb-4 shadow-sm"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1 pr-2">
                    <View className="w-12 h-12 bg-sky-50 rounded-full items-center justify-center">
                      <MaterialCommunityIcons name="calendar-clock" size={22} color="#0284C7" />
                    </View>
                    <View className="ml-4 flex-1">
                      <Text className="font-bold text-slate-900">{app.patient_name || 'Patient'}</Text>
                      <Text className="text-xs text-slate-500 mt-0.5">
                        {app.doctor_name || 'Doctor'} • {formatTime(app.scheduled_time)}
                      </Text>
                      <Text className="text-[11px] text-slate-400 mt-0.5">
                        Code: {app.patient_code || '—'}
                      </Text>
                    </View>
                  </View>
                  <View className={`px-3 py-1 rounded-full ${style.bg}`}>
                    <Text className={`text-[10px] font-bold ${style.text}`}>{style.label}</Text>
                  </View>
                </View>

                {app.queue_token ? (
                  <View className="mt-3 pt-3 border-t border-slate-50 flex-row items-center justify-between gap-x-3">
                    <View className="flex-1 bg-teal-50 border border-dashed border-teal-200 px-3 py-2 rounded-xl">
                      <Text className="text-[9px] font-bold text-teal-500 uppercase">Queue Token</Text>
                      <Text className="text-base font-black text-teal-700 tracking-wide mt-0.5" selectable>
                        {app.queue_token}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() =>
                        printQueueToken({
                          patient_name: app.patient_name,
                          patient_code: app.patient_code,
                          queue_token: app.queue_token,
                          scheduled_time: app.scheduled_time,
                          doctor_name: app.doctor_name,
                        })
                      }
                      className="bg-teal-600 px-3 py-2.5 rounded-xl flex-row items-center gap-x-1.5"
                    >
                      <MaterialCommunityIcons name="printer-outline" size={16} color="#FFFFFF" />
                      <Text className="text-white text-xs font-bold">Print Token</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default AppointmentsPage;
