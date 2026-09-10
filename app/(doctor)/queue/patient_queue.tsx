import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/src/theme/colors';
import {
  DoctorQueueItem,
  getDoctorQueue,
  startConsultationVisit,
} from '@/src/services/doctorService';

export default function FullQueue() {
  const router = useRouter();
  const [fullQueue, setFullQueue] = useState<DoctorQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<number | null>(null);

  const loadQueue = async () => {
    try {
      setLoading(true);
      const data = await getDoctorQueue();
      setFullQueue(data);
    } catch (error: any) {
      console.error('Doctor queue error:', error.response?.data || error.message);
      setFullQueue([]);
      Alert.alert('Queue Error', 'Could not load today\'s appointments.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadQueue();
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

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1" edges={[]}>
      <StatusBar style="dark" />

      <View className="px-6 flex-1" style={{ marginTop: 10 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          className="flex-row items-center py-2 mb-6"
        >
          <View
            style={{ backgroundColor: colors.accent }}
            className="w-8 h-8 rounded-full items-center justify-center"
          >
            <Text style={{ color: colors.primary }} className="text-lg font-bold">
              ←
            </Text>
          </View>
          <Text style={{ color: colors.primary }} className="ml-3 font-bold text-base">
            Dashboard
          </Text>
        </TouchableOpacity>

        <View className="flex-row justify-between items-center mb-6">
          <Text style={{ color: colors.darkText }} className="text-3xl font-bold">
            Patient Queue
          </Text>
          <TouchableOpacity onPress={loadQueue} className="p-2">
            <MaterialCommunityIcons name="refresh" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} size="large" className="mt-10" />
        ) : fullQueue.length === 0 ? (
          <View className="items-center mt-16">
            <MaterialCommunityIcons name="account-clock-outline" size={48} color="#94A3B8" />
            <Text style={{ color: colors.mutedText }} className="mt-3 font-bold">
              No patients waiting for you today
            </Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {fullQueue.map((item) => {
              const busy = startingId === item.appointment_id;
              const isWaiting = item.status === 'waiting';
              const isInProgress = item.status === 'in_progress';

              return (
                <View
                  key={item.appointment_id}
                  style={{ backgroundColor: 'white', borderColor: colors.accent }}
                  className="p-5 rounded-3xl border shadow-sm mb-4"
                >
                  <View className="flex-row justify-between items-start">
                    <View className="flex-row flex-1 mr-2">
                      <View
                        style={{ backgroundColor: colors.accent }}
                        className="px-3 py-2 rounded-2xl items-center justify-center min-w-[78px] mr-3"
                      >
                        <Text className="text-[9px] font-bold text-teal-600 uppercase">Token</Text>
                        <Text
                          style={{ color: colors.primary }}
                          className="text-[11px] font-black mt-0.5"
                        >
                          {item.queue_token || '—'}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text style={{ color: colors.darkText }} className="font-bold text-lg">
                          {item.patient_name || 'Patient'}
                        </Text>
                        <Text style={{ color: colors.mutedText }} className="text-sm mt-1">
                          {item.patient_code || '—'} · {formatTime(item.scheduled_time)}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={{ backgroundColor: colors.accent }}
                      className="px-3 py-1 rounded-full"
                    >
                      <Text
                        style={{ color: colors.primary }}
                        className="text-[10px] font-bold uppercase"
                      >
                        {isInProgress ? 'In Progress' : 'Waiting'}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleStartConsultation(item)}
                    disabled={busy}
                    style={{ backgroundColor: colors.primary }}
                    className="mt-4 py-3 rounded-2xl flex-row items-center justify-center gap-x-2"
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="microphone" size={18} color="#fff" />
                        <Text className="text-white font-bold text-sm">
                          {isWaiting ? 'Start Consultation' : 'Continue Consultation'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
