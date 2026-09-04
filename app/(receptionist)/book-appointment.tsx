import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { API_URL } from '../../src/config/api';

interface Doctor {
  doctor_id: number;
  name: string;
  specialization: string | null;
  availability_status: string | null;
}

interface BookedAppointment {
  appointment_id: number;
  patient_name: string | null;
  patient_code: string | null;
  doctor_name: string | null;
  scheduled_time: string | null;
  status: string | null;
  queue_token: string | null;
}

const pad = (n: number) => String(n).padStart(2, '0');

const nowDefaults = () => {
  const d = new Date();
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
};

const BookAppointment = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{
    patient_id?: string;
    name?: string;
    patient_code?: string;
  }>();

  const patientId = Number(params.patient_id);
  const patientName = params.name || 'Patient';
  const patientCode = params.patient_code || '—';

  const defaults = nowDefaults();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
  const [dateStr, setDateStr] = useState(defaults.date);
  const [timeStr, setTimeStr] = useState(defaults.time);
  // Current OPD visit → waiting (token now). Future → scheduled.
  const [visitType, setVisitType] = useState<'waiting' | 'scheduled'>('waiting');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const [showSuccess, setShowSuccess] = useState(false);
  const [booked, setBooked] = useState<BookedAppointment | null>(null);

  const fetchDoctors = useCallback(async () => {
    try {
      setLoadingDoctors(true);
      const res = await axios.get(`${API_URL}/doctors`);
      setDoctors(res.data || []);
    } catch (error: any) {
      console.error('Failed to load doctors:', error.response?.data || error.message);
      Alert.alert('Error', 'Could not load doctors. Please try again.');
    } finally {
      setLoadingDoctors(false);
    }
  }, []);

  useEffect(() => {
    if (!patientId || Number.isNaN(patientId)) {
      Alert.alert('Missing Patient', 'Select a patient before booking.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
      return;
    }
    fetchDoctors();
  }, [patientId, fetchDoctors, router]);

  const validate = () => {
    const next: { [key: string]: string } = {};
    if (!selectedDoctorId) next.doctor = 'Select a doctor.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
      next.date = 'Use date format YYYY-MM-DD.';
    }
    if (!/^\d{2}:\d{2}$/.test(timeStr.trim())) {
      next.time = 'Use time format HH:MM (24-hour).';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleBook = async () => {
    if (!validate()) {
      Alert.alert('Missing Information', 'Please fix the highlighted fields.');
      return;
    }

    const scheduled_time = new Date(`${dateStr.trim()}T${timeStr.trim()}:00`);
    if (Number.isNaN(scheduled_time.getTime())) {
      Alert.alert('Invalid Date/Time', 'Please enter a valid date and time.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post(`${API_URL}/appointments`, {
        patient_id: patientId,
        doctor_id: selectedDoctorId,
        scheduled_time: scheduled_time.toISOString(),
        status: visitType,
      });

      setBooked({
        appointment_id: res.data.appointment_id,
        patient_name: res.data.patient_name,
        patient_code: res.data.patient_code,
        doctor_name: res.data.doctor_name,
        scheduled_time: res.data.scheduled_time,
        status: res.data.status,
        queue_token: res.data.queue_token,
      });
      setShowSuccess(true);
    } catch (error: any) {
      const detail =
        error.response?.data?.detail ||
        'Could not book appointment. Ensure the appointments API is deployed.';
      Alert.alert('Booking Failed', String(detail));
      console.error('Book appointment error:', error.response?.data || error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatWhen = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View className="px-6 py-4 flex-row items-center border-b border-slate-100 bg-white">
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text className="text-lg font-bold ml-4 text-slate-800">Book Appointment</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
        {/* Patient summary */}
        <View className="bg-white border border-slate-100 rounded-2xl p-4 mb-5 shadow-sm">
          <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
            Patient
          </Text>
          <Text className="text-base font-bold text-slate-900">{patientName}</Text>
          <Text className="text-xs text-slate-500 mt-0.5">Code: {patientCode}</Text>
        </View>

        {/* Visit type */}
        <Text className="text-xs font-bold text-slate-700 mb-2">Visit Type *</Text>
        <View className="flex-row gap-x-3 mb-5">
          <TouchableOpacity
            onPress={() => setVisitType('waiting')}
            className={`flex-1 p-3 rounded-2xl border ${
              visitType === 'waiting' ? 'bg-teal-50 border-teal-300' : 'bg-white border-slate-200'
            }`}
          >
            <Text
              className={`text-sm font-bold text-center ${
                visitType === 'waiting' ? 'text-teal-700' : 'text-slate-600'
              }`}
            >
              Current OPD Visit
            </Text>
            <Text className="text-[10px] text-slate-400 text-center mt-1">Gets queue token now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setVisitType('scheduled')}
            className={`flex-1 p-3 rounded-2xl border ${
              visitType === 'scheduled' ? 'bg-sky-50 border-sky-300' : 'bg-white border-slate-200'
            }`}
          >
            <Text
              className={`text-sm font-bold text-center ${
                visitType === 'scheduled' ? 'text-sky-700' : 'text-slate-600'
              }`}
            >
              Future Appointment
            </Text>
            <Text className="text-[10px] text-slate-400 text-center mt-1">No token yet</Text>
          </TouchableOpacity>
        </View>

        {/* Doctor */}
        <Text className="text-xs font-bold text-slate-700 mb-2">Doctor *</Text>
        {loadingDoctors ? (
          <ActivityIndicator color="#0D9488" className="mb-5" />
        ) : doctors.length === 0 ? (
          <Text className="text-sm text-slate-400 mb-5">No doctors available.</Text>
        ) : (
          <View className="mb-5 gap-y-2">
            {doctors.map((d) => {
              const selected = selectedDoctorId === d.doctor_id;
              return (
                <TouchableOpacity
                  key={d.doctor_id}
                  onPress={() => {
                    setSelectedDoctorId(d.doctor_id);
                    if (errors.doctor) setErrors((p) => ({ ...p, doctor: '' }));
                  }}
                  className={`p-4 rounded-2xl border flex-row items-center justify-between ${
                    selected ? 'bg-teal-50 border-teal-300' : 'bg-white border-slate-200'
                  }`}
                >
                  <View className="flex-1 pr-2">
                    <Text className="font-bold text-slate-900">{d.name}</Text>
                    <Text className="text-xs text-slate-500 mt-0.5">
                      {d.specialization || 'General'} · {d.availability_status || '—'}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name={selected ? 'radiobox-marked' : 'radiobox-blank'}
                    size={22}
                    color={selected ? '#0D9488' : '#94A3B8'}
                  />
                </TouchableOpacity>
              );
            })}
            {errors.doctor ? (
              <Text className="text-red-500 text-xs mt-1">{errors.doctor}</Text>
            ) : null}
          </View>
        )}

        {/* Date / Time */}
        <View className="flex-row justify-between mb-5">
          <View className="w-[48%]">
            <Text className="text-xs font-bold text-slate-700 mb-2">Date * (YYYY-MM-DD)</Text>
            <TextInput
              value={dateStr}
              onChangeText={(v) => {
                setDateStr(v);
                if (errors.date) setErrors((p) => ({ ...p, date: '' }));
              }}
              placeholder="2026-03-04"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              className="bg-white border border-slate-200 p-3.5 rounded-2xl text-slate-800 text-sm"
              style={{ borderColor: errors.date ? '#EF4444' : undefined }}
            />
            {errors.date ? <Text className="text-red-500 text-xs mt-1">{errors.date}</Text> : null}
          </View>
          <View className="w-[48%]">
            <Text className="text-xs font-bold text-slate-700 mb-2">Time * (HH:MM)</Text>
            <TextInput
              value={timeStr}
              onChangeText={(v) => {
                setTimeStr(v);
                if (errors.time) setErrors((p) => ({ ...p, time: '' }));
              }}
              placeholder="10:30"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              className="bg-white border border-slate-200 p-3.5 rounded-2xl text-slate-800 text-sm"
              style={{ borderColor: errors.time ? '#EF4444' : undefined }}
            />
            {errors.time ? <Text className="text-red-500 text-xs mt-1">{errors.time}</Text> : null}
          </View>
        </View>

        <TouchableOpacity
          onPress={() => {
            const n = nowDefaults();
            setDateStr(n.date);
            setTimeStr(n.time);
            setVisitType('waiting');
          }}
          className="mb-5 flex-row items-center gap-x-2"
        >
          <MaterialCommunityIcons name="clock-fast" size={16} color="#0D9488" />
          <Text className="text-sm font-semibold text-teal-700">Use now (current visit)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleBook}
          disabled={submitting || loadingDoctors}
          className="w-full bg-teal-600 p-4 rounded-2xl flex-row justify-center items-center gap-x-2 active:opacity-90"
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <MaterialCommunityIcons name="calendar-check" size={18} color="#FFFFFF" />
              <Text className="text-white font-bold text-base">Confirm Booking</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Success modal */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View
          style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)' }}
          className="items-center justify-center px-8"
        >
          <View className="w-full bg-white rounded-3xl p-7 items-center shadow-lg">
            <View className="w-16 h-16 bg-emerald-50 rounded-full items-center justify-center mb-4">
              <MaterialCommunityIcons name="check-circle" size={36} color="#10B981" />
            </View>
            <Text className="text-lg font-black text-slate-900 text-center">Appointment Booked</Text>
            <Text className="text-sm text-slate-500 text-center mt-1">
              {booked?.patient_name || patientName}
            </Text>

            {booked?.queue_token ? (
              <View className="mt-5 items-center w-full">
                <Text className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  Queue Token
                </Text>
                <View className="bg-teal-50 border-2 border-dashed border-teal-200 px-6 py-3 rounded-2xl mt-2">
                  <Text className="text-2xl font-black text-teal-700 tracking-wider" selectable>
                    {booked.queue_token}
                  </Text>
                </View>
              </View>
            ) : (
              <Text className="text-xs text-slate-400 mt-4 text-center">
                Future appointment — queue token will be issued when the visit starts.
              </Text>
            )}

            <View className="w-full mt-5 bg-slate-50 border border-slate-200 rounded-2xl p-4 gap-y-2">
              <Text className="text-xs text-slate-500">
                Patient code:{' '}
                <Text className="font-bold text-slate-800">{booked?.patient_code || patientCode}</Text>
              </Text>
              <Text className="text-xs text-slate-500">
                Doctor: <Text className="font-bold text-slate-800">{booked?.doctor_name || '—'}</Text>
              </Text>
              <Text className="text-xs text-slate-500">
                When:{' '}
                <Text className="font-bold text-slate-800">{formatWhen(booked?.scheduled_time || null)}</Text>
              </Text>
              <Text className="text-xs text-slate-500">
                Status:{' '}
                <Text className="font-bold text-teal-700 capitalize">{booked?.status || '—'}</Text>
              </Text>
            </View>

            <View className="w-full gap-y-3 mt-6">
              <TouchableOpacity
                onPress={() => {
                  setShowSuccess(false);
                  router.replace('/(receptionist)/appointments');
                }}
                className="w-full bg-teal-600 p-4 rounded-2xl items-center"
              >
                <Text className="text-white font-bold text-sm">View Appointments</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowSuccess(false);
                  router.replace('/(receptionist)/patients');
                }}
                className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl items-center"
              >
                <Text className="text-slate-700 font-bold text-sm">Back to Patients</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default BookAppointment;
