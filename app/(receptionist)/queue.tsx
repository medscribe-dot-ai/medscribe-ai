import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../src/config/api';
import { printQueueToken } from '../../src/utils/printQueueToken';
import { ReceptionistMenuButton } from '../../src/components/receptionist/ReceptionistNavMenu';

interface QueueAppointment {
  appointment_id: number;
  patient_id: number;
  doctor_id: number;
  scheduled_time: string | null;
  status: string | null;
  queue_token: string | null;
  patient_name: string | null;
  patient_code: string | null;
  doctor_name: string | null;
  created_at: string | null;
}

const QUEUE_STATUSES = new Set(['waiting', 'in_progress', 'completed']);

const PatientQueue = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('Waiting');
  const [queueData, setQueueData] = useState<QueueAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const tabs = ['All', 'Waiting', 'In Progress', 'Done'];

  const statusLabel = (status: string | null) => {
    if (status === 'in_progress') return 'In Progress';
    if (status === 'completed') return 'Done';
    if (status === 'waiting') return 'Waiting';
    return status || '—';
  };

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

  const getWaitMinutes = (fromIso: string | null) => {
    if (!fromIso) return null;
    const diffMs = Date.now() - new Date(fromIso).getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
  };

  const fetchQueue = async () => {
    try {
      setLoading(true);
      // Today's visit queue from appointments (not patient registration)
      const response = await axios.get(`${API_URL}/appointments`, {
        params: { date: todayParam() },
      });
      const rows: QueueAppointment[] = (response.data || []).filter(
        (a: QueueAppointment) => QUEUE_STATUSES.has((a.status || '').toLowerCase())
      );
      setQueueData(rows);
    } catch (error: any) {
      console.error('Failed to fetch queue:', error.response?.data || error.message);
      setQueueData([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchQueue();
    }, [])
  );

  const updateStatus = async (appointmentId: number, status: string) => {
    try {
      setUpdatingId(appointmentId);
      const raw = await AsyncStorage.getItem('user_data');
      const user = raw ? JSON.parse(raw) : null;
      if (!user?.user_id) {
        Alert.alert('Session Expired', 'Please log in again.');
        return;
      }
      await axios.patch(
        `${API_URL}/appointments/${appointmentId}/status`,
        { status },
        { headers: { 'X-User-Id': String(user.user_id) } }
      );
      await fetchQueue();
    } catch (error: any) {
      const detail = error.response?.data?.detail || 'Could not update status.';
      Alert.alert('Update Failed', String(detail));
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredQueue = queueData.filter((item) => {
    const label = statusLabel(item.status);
    const matchesTab = activeTab === 'All' || label === activeTab;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (item.patient_name || '').toLowerCase().includes(q) ||
      (item.patient_code || '').toLowerCase().includes(q) ||
      (item.queue_token || '').toLowerCase().includes(q) ||
      (item.doctor_name || '').toLowerCase().includes(q);
    return matchesTab && matchesSearch;
  });

  const waitingCount = queueData.filter((p) => (p.status || '').toLowerCase() === 'waiting').length;

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-white">
      <ScrollView
        nestedScrollEnabled={true}
        showsVerticalScrollIndicator={true}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 28 }}
        style={{ flex: 1 }}
      >
        {/* HEADER */}
        <View className="px-6 pt-4 pb-2 bg-white flex-row justify-between items-center">
          <ReceptionistMenuButton title="Queue" />
          <View className="bg-teal-50 border border-teal-100 px-3 py-1 rounded-full">
            <Text className="text-xs font-bold text-teal-700">{waitingCount} waiting</Text>
          </View>
        </View>

        {/* TITLE BAR */}
        <View className="px-6 mt-3">
          <Text className="text-2xl font-black text-slate-900">Patient Queue</Text>
          <View className="h-1 bg-teal-600 w-24 mt-1 rounded-full" />
        </View>

        {/* SEARCH & FILTER BAR */}
        <View className="px-6 mt-5 flex-row justify-between items-center gap-x-3">
          <View className="flex-1 bg-slate-50/80 border border-slate-200 rounded-2xl flex-row items-center px-4 py-1">
            <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
            <TextInput
              placeholder="Search token, name, or doctor..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="flex-1 p-2 text-slate-800 text-sm"
            />
          </View>

          <TouchableOpacity onPress={fetchQueue} className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-2xl">
            <MaterialCommunityIcons name="refresh" size={20} color="#475569" />
          </TouchableOpacity>
        </View>

        {/* SEGMENTED TABS */}
        <View className="mx-6 mt-5 bg-slate-50 border border-slate-100 p-1 rounded-2xl flex-row justify-between">
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-xl items-center justify-center ${
                activeTab === tab
                  ? 'bg-white shadow-sm border border-slate-100'
                  : 'shadow-none'
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  activeTab === tab ? 'text-slate-800' : 'text-slate-400'
                }`}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* QUEUE CARDS LIST */}
        <View className="px-6 mt-6 gap-y-4">
          {loading && queueData.length === 0 ? (
            <ActivityIndicator size="large" color="#0D9488" style={{ marginTop: 20 }} />
          ) : filteredQueue.length > 0 ? (
            filteredQueue.map((item) => {
              const label = statusLabel(item.status);
              const waitMins = getWaitMinutes(item.scheduled_time || item.created_at);
              const busy = updatingId === item.appointment_id;

              return (
                <View
                  key={item.appointment_id}
                  className="w-full bg-white border border-slate-100 p-4 rounded-2xl shadow-sm"
                >
                  <View className="flex-row justify-between items-start">
                    {/* Left: Queue token + details */}
                    <View className="flex-row items-start gap-x-4 flex-1">
                      <View className="bg-teal-50 border border-teal-200 px-3 py-2 rounded-xl items-center justify-center min-w-[80px]">
                        <Text className="text-[9px] font-bold text-teal-500 uppercase">Queue Token</Text>
                        <Text className="text-sm font-black text-teal-700 tracking-wide mt-0.5" selectable>
                          {item.queue_token || '—'}
                        </Text>
                      </View>

                      <View className="flex-1 pr-2">
                        <Text className="text-base font-bold text-slate-800">
                          {item.patient_name || 'Patient'}
                        </Text>
                        <Text className="text-xs text-slate-400 font-medium mt-0.5">
                          {item.patient_code || '—'} · {formatTime(item.scheduled_time)}
                        </Text>

                        <View className="flex-row items-center flex-wrap gap-x-2 gap-y-1.5 mt-3">
                          {item.doctor_name ? (
                            <View className="bg-teal-50 border border-teal-100 px-2.5 py-0.5 rounded-lg">
                              <Text className="text-[10px] font-bold text-teal-700">
                                {item.doctor_name}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </View>

                    {/* Right: Status */}
                    <View className="items-end">
                      <View
                        className={`flex-row items-center gap-x-1 px-2.5 py-1 rounded-full border ${
                          label === 'In Progress'
                            ? 'bg-teal-50 border-teal-200'
                            : label === 'Done'
                              ? 'bg-emerald-50 border-emerald-200'
                              : 'bg-amber-50 border-amber-200'
                        }`}
                      >
                        <MaterialCommunityIcons
                          name={
                            label === 'In Progress'
                              ? 'play-circle-outline'
                              : label === 'Done'
                                ? 'check-circle-outline'
                                : 'clock-outline'
                          }
                          size={13}
                          color={
                            label === 'In Progress'
                              ? '#0D9488'
                              : label === 'Done'
                                ? '#059669'
                                : '#F59E0B'
                          }
                        />
                        <Text
                          className={`text-[10px] font-bold ${
                            label === 'In Progress'
                              ? 'text-teal-600'
                              : label === 'Done'
                                ? 'text-emerald-600'
                                : 'text-amber-600'
                          }`}
                        >
                          {label}
                        </Text>
                      </View>

                      {label === 'Waiting' && waitMins !== null ? (
                        <Text className="text-[10px] font-medium text-slate-400 mt-1">
                          {waitMins} min wait
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {/* Receptionist: Print Token + Cancel only (no Start/Complete) */}
                  {item.queue_token ||
                  item.status === 'waiting' ||
                  item.status === 'in_progress' ? (
                    <View className="flex-row gap-x-2 mt-3 pt-3 border-t border-slate-50 flex-wrap">
                      {item.queue_token ? (
                        <TouchableOpacity
                          onPress={() =>
                            printQueueToken({
                              patient_name: item.patient_name,
                              patient_code: item.patient_code,
                              queue_token: item.queue_token,
                              scheduled_time: item.scheduled_time,
                              doctor_name: item.doctor_name,
                            })
                          }
                          className="px-3 py-2 rounded-xl border border-teal-200 bg-teal-50 flex-row items-center gap-x-1"
                        >
                          <MaterialCommunityIcons name="printer-outline" size={14} color="#0D9488" />
                          <Text className="text-teal-700 text-xs font-bold">Print Token</Text>
                        </TouchableOpacity>
                      ) : null}
                      {item.status === 'waiting' || item.status === 'in_progress' ? (
                        <TouchableOpacity
                          disabled={busy}
                          onPress={() =>
                            Alert.alert('Cancel visit?', 'This appointment will be cancelled.', [
                              { text: 'No', style: 'cancel' },
                              {
                                text: 'Cancel',
                                style: 'destructive',
                                onPress: () => updateStatus(item.appointment_id, 'cancelled'),
                              },
                            ])
                          }
                          className="px-4 py-2 rounded-xl border border-slate-200 items-center justify-center"
                        >
                          {busy ? (
                            <ActivityIndicator color="#64748B" size="small" />
                          ) : (
                            <Text className="text-slate-500 text-xs font-bold">Cancel</Text>
                          )}
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })
          ) : (
            <View className="items-center justify-center py-12">
              <MaterialCommunityIcons name="account-clock-outline" size={48} color="#94A3B8" />
              <Text className="text-sm font-bold text-slate-400 mt-2">No patients in this section</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default PatientQueue;
