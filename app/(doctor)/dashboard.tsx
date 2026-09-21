import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { KpiCard } from '../../src/components/ui/kpiCard';
import {
  DoctorQueueItem,
  getDoctorDashboard,
  startConsultationVisit,
} from '../../src/services/doctorService';
import { formatAppointmentTime } from '../../src/utils/doctorSlots';

const themeColors = {
  primary: '#0D9488',
  background: '#F8FAFC',
  accent: '#E0F2F1',
  darkText: '#1E293B',
  mutedText: '#64748B',
};

function formatQueueStatus(status: string | null | undefined): string {
  const key = (status || '').toLowerCase().trim();
  if (key === 'in_progress') return 'In Progress';
  if (key === 'waiting') return 'Waiting';
  if (!key) return '—';
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Prefer current in_progress visit; else earliest waiting by scheduled_time. */
function selectNextAppointmentId(queue: DoctorQueueItem[]): number | null {
  if (!queue.length) return null;

  const inProgress = queue.filter((q) => (q.status || '').toLowerCase() === 'in_progress');
  if (inProgress.length > 0) {
    inProgress.sort((a, b) => {
      const ta = a.scheduled_time ? new Date(a.scheduled_time).getTime() : Number.POSITIVE_INFINITY;
      const tb = b.scheduled_time ? new Date(b.scheduled_time).getTime() : Number.POSITIVE_INFINITY;
      return ta - tb;
    });
    return inProgress[0].appointment_id;
  }

  const waiting = queue.filter((q) => (q.status || '').toLowerCase() === 'waiting');
  if (waiting.length === 0) return null;
  waiting.sort((a, b) => {
    const ta = a.scheduled_time ? new Date(a.scheduled_time).getTime() : Number.POSITIVE_INFINITY;
    const tb = b.scheduled_time ? new Date(b.scheduled_time).getTime() : Number.POSITIVE_INFINITY;
    return ta - tb;
  });
  return waiting[0].appointment_id;
}

export default function DoctorDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [doctorName, setDoctorName] = useState('Doctor');
  const [startingId, setStartingId] = useState<number | null>(null);
  const startLockRef = useRef(false);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const userData = await AsyncStorage.getItem('user_data');
      if (userData) {
        const user = JSON.parse(userData);
        setDoctorName(user.name || 'Doctor');
      }
      const res = await getDoctorDashboard();
      setData(res);
    } catch (error) {
      console.error('Dashboard error:', error);
      setData(null);
      setLoadError('Unable to load your dashboard. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      startLockRef.current = false;
      setStartingId(null);
      loadDashboard();
    }, [])
  );

  const formatTime = (iso: string | null) => formatAppointmentTime(iso);

  const handleStartConsultation = async (item: DoctorQueueItem) => {
    if (startLockRef.current) return;
    startLockRef.current = true;
    setStartingId(item.appointment_id);
    try {
      if (item.status === 'waiting') {
        await startConsultationVisit(item.appointment_id);
      }
      router.push({
        pathname: '/(doctor)/record',
        params: {
          appointment_id: String(item.appointment_id),
          patient_id: String(item.patient_id),
          queue_token: item.queue_token || '',
          patient_name: item.patient_name || '',
          patient_code: item.patient_code || '',
        },
      });
    } catch (error: any) {
      startLockRef.current = false;
      const detail = error.response?.data?.detail || 'Could not start consultation.';
      Alert.alert('Start Failed', String(detail));
    } finally {
      setStartingId(null);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('user_data');
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const queue: DoctorQueueItem[] = data?.queue || [];
  const nextAppointmentId = useMemo(() => selectNextAppointmentId(queue), [queue]);

  if (loading) {
    return (
      <View
        style={{ backgroundColor: themeColors.background }}
        className="flex-1 justify-center items-center"
      >
        <ActivityIndicator size="large" color={themeColors.primary} />
        <Text style={{ color: themeColors.mutedText }} className="mt-4 font-medium">
          Loading dashboard...
        </Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={{ backgroundColor: themeColors.background }} className="flex-1" edges={[]}>
        <StatusBar style="dark" />
        <View className="flex-1 px-6 justify-center items-center">
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#F97316" />
          <Text
            style={{ color: themeColors.darkText }}
            className="text-lg font-bold mt-4 text-center"
          >
            Dashboard unavailable
          </Text>
          <Text
            style={{ color: themeColors.mutedText }}
            className="text-sm mt-2 text-center px-4"
          >
            {loadError}
          </Text>
          <TouchableOpacity
            onPress={loadDashboard}
            style={{ backgroundColor: themeColors.primary }}
            className="mt-6 px-6 py-3 rounded-2xl"
          >
            <Text className="text-white font-bold">Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ backgroundColor: themeColors.background }} className="flex-1" edges={[]}>
      <StatusBar style="dark" />
      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingTop: 20, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row justify-between items-center mb-8">
          <View className="flex-row items-center">
            <View
              style={{ backgroundColor: themeColors.accent }}
              className="w-12 h-12 rounded-full items-center justify-center border-2 border-white shadow-sm"
            >
              <MaterialCommunityIcons name="doctor" size={26} color={themeColors.primary} />
            </View>
            <View className="ml-3">
              <Text
                style={{ color: themeColors.primary }}
                className="text-[10px] font-bold uppercase tracking-widest"
              >
                MedScribeAI
              </Text>
              <Text style={{ color: themeColors.darkText }} className="text-xl font-bold">
                Salam, {doctorName}!
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleLogout}
            style={{ backgroundColor: '#FEE2E2' }}
            className="w-10 h-10 rounded-xl items-center justify-center border border-red-100"
          >
            <MaterialCommunityIcons name="logout" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>

        <View className="flex-row flex-wrap justify-between mb-6">
          <KpiCard
            title="In Queue"
            value={data?.stats?.totalInQueue || 0}
            icon="account-clock-outline"
            iconColor="#f97316"
          />
          <KpiCard
            title="Completed"
            value={data?.stats?.completedToday || 0}
            icon="check-decagram-outline"
            iconColor="#16a34a"
          />
        </View>

        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-xl font-bold text-slate-900">Patient Queue</Text>
          <TouchableOpacity onPress={() => router.navigate('/(doctor)/queue/patient_queue')}>
            <Text style={{ color: themeColors.primary }} className="font-bold text-sm">
              View all
            </Text>
          </TouchableOpacity>
        </View>

        {queue.length === 0 ? (
          <View className="items-center py-10 mb-4 bg-white rounded-[28px] border border-slate-100">
            <MaterialCommunityIcons name="account-clock-outline" size={40} color="#94A3B8" />
            <Text className="text-sm font-bold text-slate-500 mt-3">No patients in queue</Text>
            <Text className="text-xs text-slate-400 mt-1 px-6 text-center">
              New waiting patients will appear here.
            </Text>
          </View>
        ) : (
          queue.map((item: DoctorQueueItem) => {
            const isNext = item.appointment_id === nextAppointmentId;
            return (
              <View
                key={item.appointment_id}
                className={`bg-white p-5 rounded-[28px] mb-3 shadow-sm border ${
                  isNext ? 'border-teal-300' : 'border-slate-100'
                }`}
                style={
                  isNext
                    ? { backgroundColor: '#F0FDFA', borderWidth: 1.5 }
                    : undefined
                }
              >
                {isNext ? (
                  <View className="self-start mb-2 px-2.5 py-1 rounded-full bg-teal-100">
                    <Text className="text-[10px] font-bold text-teal-700 uppercase">Next</Text>
                  </View>
                ) : null}
                <View className="flex-row items-center">
                  <View className="bg-teal-50 px-3 py-2 rounded-2xl mr-3 items-center min-w-[70px]">
                    <Text className="text-[9px] font-bold text-teal-600 uppercase">Token</Text>
                    <Text className="text-[11px] font-black text-teal-700 mt-0.5">
                      {item.queue_token || '—'}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-lg text-slate-800">
                      {item.patient_name || 'Patient'}
                    </Text>
                    <Text className="text-sm text-slate-500">
                      {item.patient_code || '—'} · {formatTime(item.scheduled_time)} ·{' '}
                      {formatQueueStatus(item.status)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => handleStartConsultation(item)}
                  disabled={startingId !== null}
                  style={{ backgroundColor: themeColors.primary }}
                  className="mt-3 py-3 rounded-2xl flex-row items-center justify-center gap-x-2"
                >
                  {startingId === item.appointment_id ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <MaterialCommunityIcons
                        name={item.status === 'waiting' ? 'play-circle-outline' : 'arrow-right-circle-outline'}
                        size={18}
                        color="#fff"
                      />
                      <Text className="text-white font-bold text-sm">
                        {item.status === 'waiting' ? 'Start Consultation' : 'Continue Consultation'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
