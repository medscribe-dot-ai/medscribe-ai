import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import { formatAppointmentTime } from '@/src/utils/doctorSlots';

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

export default function FullQueue() {
  const router = useRouter();
  const [fullQueue, setFullQueue] = useState<DoctorQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<number | null>(null);
  const startLockRef = useRef(false);

  const loadQueue = async () => {
    try {
      setLoading(true);
      const data = await getDoctorQueue();
      setFullQueue(data);
    } catch (error: any) {
      console.error('Doctor queue error:', error.response?.data || error.message);
      setFullQueue([]);
      Alert.alert('Queue Error', "Could not load today's appointments.");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      startLockRef.current = false;
      setStartingId(null);
      loadQueue();
    }, [])
  );

  const formatTime = (iso: string | null) => formatAppointmentTime(iso);

  const nextAppointmentId = useMemo(
    () => selectNextAppointmentId(fullQueue),
    [fullQueue]
  );

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

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1" edges={[]}>
      <StatusBar style="dark" />

      <View className="px-6 flex-1" style={{ marginTop: 10 }}>
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
          <View className="items-center mt-16 px-6">
            <MaterialCommunityIcons name="account-clock-outline" size={52} color="#94A3B8" />
            <Text style={{ color: colors.darkText }} className="mt-4 font-bold text-base text-center">
              No patients in queue
            </Text>
            <Text style={{ color: colors.mutedText }} className="mt-2 text-sm text-center">
              Waiting and in-progress visits for today will show here.
            </Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
          >
            {fullQueue.map((item) => {
              const busy = startingId === item.appointment_id;
              const isWaiting = item.status === 'waiting';
              const isInProgress = item.status === 'in_progress';
              const isNext = item.appointment_id === nextAppointmentId;

              return (
                <View
                  key={item.appointment_id}
                  style={{
                    backgroundColor: isNext ? '#F0FDFA' : 'white',
                    borderColor: isNext ? '#5EEAD4' : colors.accent,
                    borderWidth: isNext ? 1.5 : 1,
                  }}
                  className="p-5 rounded-3xl shadow-sm mb-4"
                >
                  {isNext ? (
                    <View
                      style={{ backgroundColor: '#CCFBF1' }}
                      className="self-start px-2.5 py-1 rounded-full mb-2"
                    >
                      <Text style={{ color: colors.primary }} className="text-[10px] font-bold uppercase">
                        Next
                      </Text>
                    </View>
                  ) : null}

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
                      style={{ backgroundColor: isInProgress ? '#FEF3C7' : colors.accent }}
                      className="px-3 py-1 rounded-full"
                    >
                      <Text
                        style={{ color: isInProgress ? '#B45309' : colors.primary }}
                        className="text-[10px] font-bold uppercase"
                      >
                        {isInProgress ? 'In Progress' : 'Waiting'}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleStartConsultation(item)}
                    disabled={startingId !== null}
                    style={{ backgroundColor: colors.primary }}
                    className="mt-4 py-3 rounded-2xl flex-row items-center justify-center gap-x-2"
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <MaterialCommunityIcons
                          name={isWaiting ? 'play-circle-outline' : 'arrow-right-circle-outline'}
                          size={18}
                          color="#fff"
                        />
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
