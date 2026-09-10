import React, { useCallback, useState } from 'react';
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

const themeColors = {
  primary: '#0D9488',
  background: '#F8FAFC',
  accent: '#E0F2F1',
  darkText: '#1E293B',
  mutedText: '#64748B',
};

export default function DoctorDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [doctorName, setDoctorName] = useState('Doctor');
  const [startingId, setStartingId] = useState<number | null>(null);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const userData = await AsyncStorage.getItem('user_data');
      if (userData) {
        const user = JSON.parse(userData);
        setDoctorName(user.name || 'Doctor');
      }
      const res = await getDoctorDashboard();
      setData(res);
    } catch (error) {
      console.error('Dashboard error:', error);
      setData({
        stats: { totalInQueue: 0, completedToday: 0, weekConsultations: 0, avgWaitTime: '0 min' },
        queue: [],
      });
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [])
  );

  const formatTime = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleStartConsultation = async (item: DoctorQueueItem) => {
    try {
      setStartingId(item.appointment_id);
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

  if (loading) {
    return (
      <View style={{ backgroundColor: themeColors.background }} className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color={themeColors.primary} />
        <Text style={{ color: themeColors.mutedText }} className="mt-4 font-medium">
          Loading dashboard...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ backgroundColor: themeColors.background }} className="flex-1" edges={[]}>
      <StatusBar style="dark" />
      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingTop: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row justify-between items-center mb-8">
          <TouchableOpacity activeOpacity={0.7} className="flex-row items-center">
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
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLogout}
            style={{ backgroundColor: '#FEE2E2' }}
            className="w-10 h-10 rounded-xl items-center justify-center border border-red-100"
          >
            <MaterialCommunityIcons name="logout" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>

        <View className="flex-row flex-wrap justify-between mb-4">
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

        <View className="mb-6">
          <Text className="text-xl font-bold text-slate-900 mb-4">Quick Actions</Text>
          <TouchableOpacity
            onPress={() => router.push('/(doctor)/record')}
            style={{ backgroundColor: themeColors.primary }}
            className="p-5 rounded-[28px] flex-row items-center justify-between shadow-md"
          >
            <View className="flex-row items-center">
              <View className="bg-white/20 p-2 rounded-xl mr-4">
                <MaterialCommunityIcons name="microphone" size={28} color="white" />
              </View>
              <View>
                <Text className="text-white font-bold text-lg">Voice Recording</Text>
                <Text className="text-white/80 text-xs font-medium">Record notes in Urdu/English</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="white" />
          </TouchableOpacity>
        </View>

        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-xl font-bold text-slate-900">Patient Queue</Text>
          <TouchableOpacity onPress={() => router.push('/(doctor)/queue/patient_queue')}>
            <Text style={{ color: themeColors.primary }} className="font-bold text-sm">
              View all
            </Text>
          </TouchableOpacity>
        </View>

        {(data?.queue || []).length === 0 ? (
          <Text className="text-sm text-slate-400 mb-4">No patients waiting for you today.</Text>
        ) : (
          data.queue.map((item: DoctorQueueItem) => (
            <View
              key={item.appointment_id}
              className="bg-white p-5 rounded-[28px] mb-3 shadow-sm border border-slate-100"
            >
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
                    {item.patient_code || '—'} · {formatTime(item.scheduled_time)} · {item.status}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => handleStartConsultation(item)}
                disabled={startingId === item.appointment_id}
                style={{ backgroundColor: themeColors.primary }}
                className="mt-3 py-3 rounded-2xl items-center"
              >
                {startingId === item.appointment_id ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold text-sm">
                    {item.status === 'waiting' ? 'Start Consultation' : 'Continue Consultation'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
