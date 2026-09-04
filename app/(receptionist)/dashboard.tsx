import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, Dimensions, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const { height: screenHeight } = Dimensions.get('window');
const API_URL = "https://medscribeai-pzqu.onrender.com";

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
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

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
      console.error("Failed to load receptionist dashboard:", error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  // Refetch every time the screen comes back into focus (e.g. after registering a patient)
  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [])
  );

  return (
    <SafeAreaView style={{ flex: 1, height: screenHeight }} className="bg-white">
      <ScrollView 
        nestedScrollEnabled={true}
        showsVerticalScrollIndicator={true} 
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 160 }}
        style={{ flex: 1 }}
      >
        {/* HEADER SECTION */}
        <View className="px-6 pt-6 pb-4 bg-white flex-row justify-between items-start">
          <View>
            <View className="flex-row items-center gap-x-2">
              <Text className="text-lg font-bold text-slate-900">MedScribe AI</Text>
              <View className="bg-purple-100 px-2.5 py-0.5 rounded-full">
                <Text className="text-[10px] font-bold text-purple-600">Receptionist</Text>
              </View>
            </View>
            <Text className="text-3xl font-black text-slate-900 mt-4">Hello, {receptionistName}</Text>
            <Text className="text-sm font-semibold text-slate-400 mt-0.5">{today}</Text>
          </View>

          <View className="flex-row items-center gap-x-3 mt-1">
            <TouchableOpacity className="p-2 bg-slate-50 rounded-full relative border border-slate-100">
              <MaterialCommunityIcons name="bell-outline" size={20} color="#64748B" />
              <View className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white" />
            </TouchableOpacity>
            <View className="w-10 h-10 bg-teal-50 rounded-full items-center justify-center border border-teal-100">
              <Text className="text-sm font-bold text-teal-600">{getInitials(receptionistName)}</Text>
            </View>
          </View>
        </View>

        {/* ANALYTICS CARDS */}
        {loading && !stats ? (
          <ActivityIndicator size="large" color="#0D9488" className="my-8" />
        ) : (
          <View className="px-6 pt-2 flex-row flex-wrap justify-between gap-y-4">
            <View className="w-[48%] bg-white p-4 rounded-2xl border border-slate-100 shadow-sm justify-between min-h-[115px]">
              <View className="flex-row justify-between items-start">
                <View className="flex-1 pr-1">
                  <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Registered Today</Text>
                  <Text className="text-2xl font-black text-slate-800 mt-2">{stats?.registered_today ?? 0}</Text>
                </View>
                <View className="p-2 bg-teal-50 rounded-xl">
                  <MaterialCommunityIcons name="account-plus-outline" size={18} color="#0D9488" />
                </View>
              </View>
            </View>

            <View className="w-[48%] bg-white p-4 rounded-2xl border border-slate-100 shadow-sm justify-between min-h-[115px]">
              <View className="flex-row justify-between items-start">
                <View className="flex-1 pr-1">
                  <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">In Queue</Text>
                  <Text className="text-2xl font-black text-slate-800 mt-2">{stats?.in_queue ?? 0}</Text>
                </View>
                <View className="p-2 bg-slate-50 rounded-xl">
                  <MaterialCommunityIcons name="account-multiple-outline" size={18} color="#64748B" />
                </View>
              </View>
              <Text className="text-[11px] font-medium text-slate-400 mt-2">Across all departments</Text>
            </View>

            <View className="w-[48%] bg-orange-50/50 p-4 rounded-2xl border border-orange-100/70 justify-between min-h-[115px]">
              <View className="flex-row justify-between items-start">
                <View className="flex-1 pr-1">
                  <Text className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">Avg Wait Time</Text>
                  <Text className="text-2xl font-black text-orange-950 mt-2">
                    {stats?.avg_wait_minutes != null ? `${stats.avg_wait_minutes} min` : '—'}
                  </Text>
                </View>
                <View className="p-2 bg-orange-100/60 rounded-xl">
                  <MaterialCommunityIcons name="clock-outline" size={18} color="#F97316" />
                </View>
              </View>
            </View>

            <View className="w-[48%] bg-green-50/40 p-4 rounded-2xl border border-green-100/60 justify-between min-h-[115px]">
              <View className="flex-row justify-between items-start">
                <View className="flex-1 pr-1">
                  <Text className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Appointments</Text>
                  <Text className="text-2xl font-black text-green-950 mt-2">{stats?.appointments_today ?? 0}</Text>
                </View>
                <View className="p-2 bg-green-100/60 rounded-xl">
                  <MaterialCommunityIcons name="calendar-blank-outline" size={18} color="#22C55E" />
                </View>
              </View>
              <Text className="text-[11px] font-medium text-green-600 mt-2">Upcoming today</Text>
            </View>
          </View>
        )}

        {/* QUICK ACTIONS */}
        <View className="px-6 mt-8">
          <Text className="text-sm font-bold text-slate-800 mb-4">Quick Actions</Text>
          <View className="gap-y-3">
            <TouchableOpacity 
              onPress={() => router.push('/(receptionist)/register')}
              className="w-full flex-row items-center justify-between p-4 bg-teal-600 rounded-2xl shadow-sm active:opacity-95"
            >
              <View className="flex-row items-center gap-x-3">
                <MaterialCommunityIcons name="account-plus-outline" size={20} color="#FFFFFF" />
                <Text className="text-sm font-bold text-white">Register New Patient</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => router.push('/(receptionist)/queue')} 
              className="w-full flex-row items-center justify-between p-4 bg-slate-50/80 border border-slate-100 rounded-2xl"
            >
              <View className="flex-row items-center gap-x-3">
                <MaterialCommunityIcons name="clipboard-text-clock-outline" size={20} color="#0D9488" />
                <Text className="text-sm font-semibold text-slate-700">View Patient Queue</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => router.push('/(receptionist)/patients')}
              className="w-full flex-row items-center justify-between p-4 bg-slate-50/80 border border-slate-100 rounded-2xl"
            >
              <View className="flex-row items-center gap-x-3">
                <MaterialCommunityIcons name="magnify" size={20} color="#0D9488" />
                <Text className="text-sm font-semibold text-slate-700">Search Patients</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => router.push('/(receptionist)/appointments')} 
              className="w-full flex-row items-center justify-between p-4 bg-slate-50/80 border border-slate-100 rounded-2xl"
            >
              <View className="flex-row items-center gap-x-3">
                <MaterialCommunityIcons name="calendar-month-outline" size={20} color="#0D9488" />
                <Text className="text-sm font-semibold text-slate-700">Appointments</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        {/* RECENT REGISTRATIONS */}
        <View className="px-6 mt-8">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-sm font-bold text-slate-800">Recent Registrations</Text>
            <TouchableOpacity onPress={() => router.push('/(receptionist)/patients')} className="flex-row items-center gap-x-1">
              <Text className="text-xs font-bold text-slate-700">View all</Text>
              <MaterialCommunityIcons name="chevron-right" size={16} color="#475569" />
            </TouchableOpacity>
          </View>

          {loading && recentPatients.length === 0 ? (
            <ActivityIndicator size="small" color="#0D9488" />
          ) : recentPatients.length === 0 ? (
            <Text className="text-sm text-slate-400 text-center py-6">No patients registered yet.</Text>
          ) : (
            <View className="gap-y-3">
              {recentPatients.map((patient) => (
                <View key={patient.patient_id} className="w-full bg-slate-50/60 border border-slate-100 p-3 rounded-2xl flex-row justify-between items-center">
                  <View className="flex-row items-center gap-x-3">
                    <View className="w-10 h-10 bg-purple-50 rounded-full items-center justify-center border border-purple-100">
                      <Text className="text-xs font-bold text-purple-600">{getInitials(patient.name)}</Text>
                    </View>
                    <View>
                      <Text className="text-sm font-bold text-slate-800">{patient.name}</Text>
                      <Text className="text-[11px] text-slate-400 mt-0.5">
                        {patient.patient_code} • <Text className="font-medium text-slate-500">{patient.department || 'Unassigned'}</Text>
                      </Text>
                    </View>
                  </View>

                  <View className="items-end">
                    <View className={`px-2.5 py-0.5 rounded-full border ${patient.status === 'assigned' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                      <Text className={`text-[10px] font-bold ${patient.status === 'assigned' ? 'text-emerald-600' : 'text-amber-600'}`}>
                        ✓ {patient.status === 'assigned' ? 'Assigned' : 'Waiting'}
                      </Text>
                    </View>
                    <Text className="text-[10px] text-slate-400 mt-1">{getTimeAgo(patient.created_at)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* FIXED BOTTOM NAVIGATION BAR */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} className="bg-white border-t border-slate-100 py-3 flex-row justify-around items-center shadow-lg">
        <TouchableOpacity className="items-center justify-center">
          <View className="bg-teal-600 px-4 py-2 rounded-xl flex-row items-center gap-x-1.5">
            <MaterialCommunityIcons name="view-dashboard" size={18} color="#FFFFFF" />
            <Text className="text-white text-xs font-bold">Home</Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => router.push('/(receptionist)/register')} className="items-center justify-center p-2">
          <MaterialCommunityIcons name="account-plus-outline" size={22} color="#94A3B8" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(receptionist)/patients')} className="items-center justify-center p-2">
          <MaterialCommunityIcons name="account-group-outline" size={22} color="#94A3B8" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(receptionist)/settings')} className="items-center justify-center p-2">
          <MaterialCommunityIcons name="cog-outline" size={22} color="#94A3B8" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default ReceptionistDashboard;