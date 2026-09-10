import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../../src/config/api';
import {
  ReceptionistMenuButton,
  confirmReceptionistLogout,
} from '../../src/components/receptionist/ReceptionistNavMenu';

interface Stats {
  registered_today: number;
  in_queue: number;
  appointments_today: number;
  avg_wait_minutes: number | null;
}

interface RecentPatient {
  patient_id: number;
  name: string;
  patient_code: string;
  department: string | null;
  status: string;
  created_at: string;
}

const ReceptionistDashboard = () => {
  const router = useRouter();
  const [receptionistName, setReceptionistName] = useState('there');
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentPatients, setRecentPatients] = useState<RecentPatient[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const getTimeAgo = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    return `${Math.floor(hrs / 24)} day(s) ago`;
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const userDataRaw = await AsyncStorage.getItem('user_data');
      if (userDataRaw) {
        const userData = JSON.parse(userDataRaw);
        setReceptionistName(userData?.name?.split(' ')[0] || 'there');
      }

      const [statsRes, recentRes] = await Promise.all([
        axios.get(`${API_URL}/dashboard/receptionist-stats`),
        axios.get(`${API_URL}/patients/recent?limit=5`),
      ]);

      setStats(statsRes.data);
      setRecentPatients(recentRes.data);
    } catch (error: any) {
      console.error('Failed to load receptionist dashboard:', error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [])
  );

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-white">
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 28 }}
        style={{ flex: 1 }}
      >
        {/* HEADER */}
        <View className="px-6 pt-4 pb-2 flex-row justify-between items-start">
          <View className="flex-1 pr-3">
            <ReceptionistMenuButton />
            <Text className="text-3xl font-black text-slate-900 mt-4">Hello, {receptionistName}</Text>
            <Text className="text-sm font-semibold text-slate-400 mt-0.5">{today}</Text>
          </View>

          <View className="flex-row items-center gap-x-2 mt-1">
            <TouchableOpacity
              onPress={() => confirmReceptionistLogout(router)}
              className="w-10 h-10 bg-red-50 border border-red-100 rounded-xl items-center justify-center"
              accessibilityLabel="Logout"
            >
              <MaterialCommunityIcons name="logout" size={20} color="#EF4444" />
            </TouchableOpacity>
            <View className="w-10 h-10 bg-teal-50 rounded-full items-center justify-center border border-teal-100">
              <Text className="text-sm font-bold text-teal-600">{getInitials(receptionistName)}</Text>
            </View>
          </View>
        </View>

        {/* TODAY AT A GLANCE */}
        <View className="px-6 mt-5">
          <Text className="text-sm font-bold text-slate-800 mb-3">Today at a glance</Text>
          {loading && !stats ? (
            <ActivityIndicator size="large" color="#0D9488" className="my-6" />
          ) : (
            <View className="flex-row flex-wrap justify-between gap-y-3">
              <TouchableOpacity
                onPress={() => router.push('/(receptionist)/patients')}
                className="w-[48%] bg-white p-4 rounded-2xl border border-slate-100 shadow-sm min-h-[100px]"
              >
                <View className="flex-row justify-between items-start">
                  <View className="flex-1 pr-1">
                    <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Registered
                    </Text>
                    <Text className="text-2xl font-black text-slate-800 mt-2">
                      {stats?.registered_today ?? 0}
                    </Text>
                  </View>
                  <View className="p-2 bg-teal-50 rounded-xl">
                    <MaterialCommunityIcons name="account-plus-outline" size={18} color="#0D9488" />
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/(receptionist)/queue')}
                className="w-[48%] bg-white p-4 rounded-2xl border border-slate-100 shadow-sm min-h-[100px]"
              >
                <View className="flex-row justify-between items-start">
                  <View className="flex-1 pr-1">
                    <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      In Queue
                    </Text>
                    <Text className="text-2xl font-black text-slate-800 mt-2">
                      {stats?.in_queue ?? 0}
                    </Text>
                  </View>
                  <View className="p-2 bg-amber-50 rounded-xl">
                    <MaterialCommunityIcons name="account-clock-outline" size={18} color="#D97706" />
                  </View>
                </View>
                <Text className="text-[11px] font-medium text-slate-400 mt-2">
                  Across all departments
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/(receptionist)/appointments')}
                className="w-[48%] bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 min-h-[100px]"
              >
                <View className="flex-row justify-between items-start">
                  <View className="flex-1 pr-1">
                    <Text className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                      Appointments
                    </Text>
                    <Text className="text-2xl font-black text-emerald-950 mt-2">
                      {stats?.appointments_today ?? 0}
                    </Text>
                  </View>
                  <View className="p-2 bg-emerald-100/70 rounded-xl">
                    <MaterialCommunityIcons name="calendar-blank-outline" size={18} color="#059669" />
                  </View>
                </View>
                <Text className="text-[11px] font-medium text-emerald-700 mt-2">Today</Text>
              </TouchableOpacity>

              <View className="w-[48%] bg-orange-50/50 p-4 rounded-2xl border border-orange-100/70 min-h-[100px]">
                <View className="flex-row justify-between items-start">
                  <View className="flex-1 pr-1">
                    <Text className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">
                      Avg Wait
                    </Text>
                    <Text className="text-2xl font-black text-orange-950 mt-2">
                      {stats?.avg_wait_minutes != null ? `${stats.avg_wait_minutes} min` : '—'}
                    </Text>
                  </View>
                  <View className="p-2 bg-orange-100/60 rounded-xl">
                    <MaterialCommunityIcons name="clock-outline" size={18} color="#F97316" />
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Quick actions */}
        <View className="px-6 mt-8">
          <Text className="text-sm font-bold text-slate-800 mb-3">Quick actions</Text>

          <TouchableOpacity
            onPress={() => router.push('/(receptionist)/register')}
            className="w-full flex-row items-center justify-between p-4 bg-teal-600 rounded-2xl mb-3 active:opacity-95"
          >
            <View className="flex-row items-center gap-x-3">
              <View className="bg-white/20 p-2 rounded-xl">
                <MaterialCommunityIcons name="account-plus" size={22} color="#FFFFFF" />
              </View>
              <View>
                <Text className="text-base font-bold text-white">Register Patient</Text>
                <Text className="text-[11px] text-teal-100 mt-0.5">New walk-in registration</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <View className="flex-row flex-wrap justify-between gap-y-3">
            <TouchableOpacity
              onPress={() => router.push('/(receptionist)/patients')}
              className="w-[48%] p-4 bg-slate-50 border border-slate-100 rounded-2xl"
            >
              <View className="w-9 h-9 bg-teal-50 rounded-xl items-center justify-center mb-3">
                <MaterialCommunityIcons name="calendar-plus" size={18} color="#0D9488" />
              </View>
              <Text className="text-sm font-bold text-slate-800">Book Appointment</Text>
              <Text className="text-[10px] text-slate-400 mt-1">Select a patient to book</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(receptionist)/patients')}
              className="w-[48%] p-4 bg-slate-50 border border-slate-100 rounded-2xl"
            >
              <View className="w-9 h-9 bg-teal-50 rounded-xl items-center justify-center mb-3">
                <MaterialCommunityIcons name="account-group-outline" size={18} color="#0D9488" />
              </View>
              <Text className="text-sm font-bold text-slate-800">View Patients</Text>
              <Text className="text-[10px] text-slate-400 mt-1">Search registered patients</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(receptionist)/queue')}
              className="w-[48%] p-4 bg-amber-50/60 border border-amber-100 rounded-2xl"
            >
              <View className="w-9 h-9 bg-amber-100/80 rounded-xl items-center justify-center mb-3">
                <MaterialCommunityIcons name="clipboard-text-clock-outline" size={18} color="#D97706" />
              </View>
              <Text className="text-sm font-bold text-slate-800">Today's Queue</Text>
              <Text className="text-[10px] text-slate-400 mt-1">
                {stats?.in_queue ?? 0} waiting / in progress
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(receptionist)/appointments')}
              className="w-[48%] p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl"
            >
              <View className="w-9 h-9 bg-emerald-100/80 rounded-xl items-center justify-center mb-3">
                <MaterialCommunityIcons name="calendar-month-outline" size={18} color="#059669" />
              </View>
              <Text className="text-sm font-bold text-slate-800">Today's Appointments</Text>
              <Text className="text-[10px] text-slate-400 mt-1">
                {stats?.appointments_today ?? 0} scheduled today
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* RECENT REGISTRATIONS */}
        <View className="px-6 mt-8 mb-4">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-sm font-bold text-slate-800">Recent registrations</Text>
            <TouchableOpacity
              onPress={() => router.push('/(receptionist)/patients')}
              className="flex-row items-center gap-x-1"
            >
              <Text className="text-xs font-bold text-teal-700">View all</Text>
              <MaterialCommunityIcons name="chevron-right" size={16} color="#0D9488" />
            </TouchableOpacity>
          </View>

          {loading && recentPatients.length === 0 ? (
            <ActivityIndicator size="small" color="#0D9488" />
          ) : recentPatients.length === 0 ? (
            <Text className="text-sm text-slate-400 text-center py-6">No patients registered yet.</Text>
          ) : (
            <View className="gap-y-3">
              {recentPatients.map((patient) => (
                <View
                  key={patient.patient_id}
                  className="w-full bg-slate-50/60 border border-slate-100 p-3 rounded-2xl flex-row justify-between items-center"
                >
                  <View className="flex-row items-center gap-x-3 flex-1 pr-2">
                    <View className="w-10 h-10 bg-purple-50 rounded-full items-center justify-center border border-purple-100">
                      <Text className="text-xs font-bold text-purple-600">
                        {getInitials(patient.name)}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-slate-800" numberOfLines={1}>
                        {patient.name}
                      </Text>
                      <Text className="text-[11px] text-slate-400 mt-0.5">
                        {patient.patient_code} · {patient.department || 'Unassigned'}
                      </Text>
                    </View>
                  </View>

                  <View className="items-end">
                    <View
                      className={`px-2.5 py-0.5 rounded-full border ${
                        patient.status === 'assigned'
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-amber-50 border-amber-200'
                      }`}
                    >
                      <Text
                        className={`text-[10px] font-bold ${
                          patient.status === 'assigned' ? 'text-emerald-600' : 'text-amber-600'
                        }`}
                      >
                        {patient.status === 'assigned' ? 'Assigned' : 'Waiting'}
                      </Text>
                    </View>
                    <Text className="text-[10px] text-slate-400 mt-1">
                      {getTimeAgo(patient.created_at)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ReceptionistDashboard;
