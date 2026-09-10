import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL } from '../../src/config/api';
import {
  APPOINTMENT_SLOT_MINUTES,
  AppointmentSlot,
  DoctorSchedule,
  buildSlotsForDate,
  formatMinutesToDisplay,
  getScheduleRangeLabel,
  isDoctorScheduledOnDate,
  isDoctorWorkingAt,
  markBookedSlots,
  scheduledTimeToSlotHHMM,
  weekdayKeyFromDateStr,
} from '../../src/utils/doctorSlots';
import { printQueueToken } from '../../src/utils/printQueueToken';

interface Doctor {
  doctor_id: number;
  name: string;
  specialization: string | null;
  availability_status: string | null;
}

interface DayAppointment {
  appointment_id: number;
  doctor_id: number;
  scheduled_time: string | null;
  status: string | null;
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

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const addDaysStr = (dateStr: string, days: number) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};

const tomorrowStr = () => addDaysStr(todayStr(), 1);

const formatDateLabel = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return dateStr;
  return dt.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const ACTIVE_BOOKING_STATUSES = new Set([
  'scheduled',
  'waiting',
  'in_progress',
  'completed',
]);

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

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [schedulesByDoctor, setSchedulesByDoctor] = useState<Record<number, DoctorSchedule>>(
    {}
  );
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [dayAppointments, setDayAppointments] = useState<DayAppointment[]>([]);
  const [loadingDayAppts, setLoadingDayAppts] = useState(false);

  // waiting = Current OPD (today locked). scheduled = Future Appointment.
  const [visitType, setVisitType] = useState<'waiting' | 'scheduled'>('waiting');
  const [dateStr, setDateStr] = useState(todayStr());
  const [dateDraft, setDateDraft] = useState(tomorrowStr());
  const [showDateModal, setShowDateModal] = useState(false);

  const [expandedDoctorId, setExpandedDoctorId] = useState<number | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [booked, setBooked] = useState<BookedAppointment | null>(null);
  const [nowTick, setNowTick] = useState(() => new Date());

  const effectiveDate = visitType === 'waiting' ? todayStr() : dateStr;

  const fetchDoctorsAndSchedules = useCallback(async () => {
    try {
      setLoadingDoctors(true);
      setLoadingSchedules(true);
      const res = await axios.get(`${API_URL}/doctors`);
      const list: Doctor[] = res.data || [];
      setDoctors(list);

      const scheduleEntries = await Promise.all(
        list.map(async (d) => {
          try {
            const detail = await axios.get(`${API_URL}/doctors/${d.doctor_id}`);
            return [d.doctor_id, (detail.data?.schedule as DoctorSchedule) || {}] as const;
          } catch {
            return [d.doctor_id, {} as DoctorSchedule] as const;
          }
        })
      );
      const map: Record<number, DoctorSchedule> = {};
      for (const [id, schedule] of scheduleEntries) {
        map[id] = schedule;
      }
      setSchedulesByDoctor(map);
    } catch (error: any) {
      console.error('Failed to load doctors:', error.response?.data || error.message);
      Alert.alert('Error', 'Could not load doctors. Please try again.');
      setDoctors([]);
      setSchedulesByDoctor({});
    } finally {
      setLoadingDoctors(false);
      setLoadingSchedules(false);
    }
  }, []);

  const fetchDayAppointments = useCallback(async (date: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      setDayAppointments([]);
      return;
    }
    try {
      setLoadingDayAppts(true);
      const res = await axios.get(`${API_URL}/appointments`, {
        params: { date: date.trim() },
      });
      setDayAppointments(res.data || []);
    } catch (error: any) {
      console.error('Failed to load day appointments:', error.response?.data || error.message);
      setDayAppointments([]);
    } finally {
      setLoadingDayAppts(false);
    }
  }, []);

  useEffect(() => {
    if (!patientId || Number.isNaN(patientId)) {
      Alert.alert('Missing Patient', 'Select a patient before booking.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
      return;
    }
    fetchDoctorsAndSchedules();
  }, [patientId, fetchDoctorsAndSchedules, router]);

  useEffect(() => {
    fetchDayAppointments(effectiveDate);
  }, [effectiveDate, fetchDayAppointments]);

  // Refresh "currently available" for Current OPD every minute
  useEffect(() => {
    if (visitType !== 'waiting') return;
    const id = setInterval(() => setNowTick(new Date()), 60_000);
    return () => clearInterval(id);
  }, [visitType]);

  useEffect(() => {
    setSelectedDoctorId(null);
    setSelectedSlot(null);
    setExpandedDoctorId(null);
    setErrors({});
  }, [visitType, effectiveDate]);

  const bookedTimesForDoctor = (doctorId: number): string[] =>
    dayAppointments
      .filter(
        (a) =>
          a.doctor_id === doctorId &&
          ACTIVE_BOOKING_STATUSES.has((a.status || '').toLowerCase())
      )
      .map((a) => scheduledTimeToSlotHHMM(a.scheduled_time))
      .filter((t): t is string => Boolean(t));

  const slotsForDoctor = (doctorId: number): AppointmentSlot[] => {
    const schedule = schedulesByDoctor[doctorId] || {};
    const base = buildSlotsForDate(schedule, effectiveDate, nowTick);
    return markBookedSlots(base, bookedTimesForDoctor(doctorId));
  };

  const doctorMeta = (doctorId: number) => {
    const schedule = schedulesByDoctor[doctorId] || {};
    const scheduledOnDay = isDoctorScheduledOnDate(schedule, effectiveDate);
    const onDutyNow =
      visitType === 'waiting'
        ? isDoctorWorkingAt(schedule, effectiveDate, nowTick)
        : scheduledOnDay;
    const slots = slotsForDoctor(doctorId);
    const openCount = slots.filter((s) => s.available).length;
    const rangeLabel = getScheduleRangeLabel(schedule, effectiveDate);
    const selectable = scheduledOnDay && openCount > 0 && (visitType === 'scheduled' || onDutyNow);
    return { schedule, scheduledOnDay, onDutyNow, slots, openCount, rangeLabel, selectable };
  };

  const validate = () => {
    const next: { [key: string]: string } = {};
    if (!selectedDoctorId) next.doctor = 'Select an available doctor and time slot.';
    if (!selectedSlot) next.time = 'Select an available time slot.';
    if (selectedDoctorId && selectedSlot) {
      const slots = slotsForDoctor(selectedDoctorId);
      if (!slots.some((s) => s.time === selectedSlot && s.available)) {
        next.time = 'Selected slot is not available.';
      }
      if (!doctorMeta(selectedDoctorId).selectable) {
        next.doctor = 'This doctor is not available for booking right now.';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleBook = async () => {
    if (!validate()) {
      Alert.alert('Missing Information', 'Please select an available doctor and time slot.');
      return;
    }

    const scheduled_time = new Date(`${effectiveDate}T${selectedSlot}:00`);
    if (Number.isNaN(scheduled_time.getTime())) {
      Alert.alert('Invalid Date/Time', 'Please choose a valid slot.');
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
      setSelectedSlot(null);
      setSelectedDoctorId(null);
      await fetchDayAppointments(effectiveDate);
      setShowSuccess(true);
    } catch (error: any) {
      const detail =
        error.response?.data?.detail ||
        'Could not book appointment. Ensure the appointments API is deployed.';
      Alert.alert('Booking Failed', String(detail));
      console.error('Book appointment error:', error.response?.data || error.message);
      await fetchDayAppointments(effectiveDate);
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

  const applyFutureDate = (next: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) {
      Alert.alert('Invalid Date', 'Use YYYY-MM-DD.');
      return;
    }
    if (next <= todayStr()) {
      Alert.alert('Future Only', 'Pick a date after today for future appointments.');
      return;
    }
    setDateStr(next);
    setShowDateModal(false);
  };

  const dayKey = weekdayKeyFromDateStr(effectiveDate);
  const loadingList = loadingDoctors || loadingSchedules || loadingDayAppts;

  return (
    <SafeAreaView style={{ flex: 1, overflow: 'hidden', backgroundColor: '#F8FAFC' }} edges={[]}>
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
            onPress={() => {
              setVisitType('waiting');
              setDateStr(todayStr());
            }}
            className={`flex-1 p-3 rounded-2xl border ${
              visitType === 'waiting' ? 'bg-teal-50 border-teal-300' : 'bg-white border-slate-200'
            }`}
          >
            <Text
              className={`text-sm font-bold text-center ${
                visitType === 'waiting' ? 'text-teal-700' : 'text-slate-600'
              }`}
            >
              Current OPD
            </Text>
            <Text className="text-[10px] text-slate-400 text-center mt-1">Today · queue token now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setVisitType('scheduled');
              setDateStr((prev) => (prev > todayStr() ? prev : tomorrowStr()));
              setDateDraft((prev) => (prev > todayStr() ? prev : tomorrowStr()));
            }}
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
            <Text className="text-[10px] text-slate-400 text-center mt-1">Pick a date · no token yet</Text>
          </TouchableOpacity>
        </View>

        {/* Date */}
        <Text className="text-xs font-bold text-slate-700 mb-2">Date *</Text>
        {visitType === 'waiting' ? (
          <View className="mb-5 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 flex-row items-center justify-between">
            <View>
              <Text className="text-sm font-bold text-slate-800">{formatDateLabel(todayStr())}</Text>
              <Text className="text-[10px] text-slate-400 mt-0.5">
                Today is locked for Current OPD
              </Text>
            </View>
            <MaterialCommunityIcons name="lock-outline" size={18} color="#94A3B8" />
          </View>
        ) : (
          <View className="mb-5">
            <View className="flex-row items-center gap-x-2">
              <TouchableOpacity
                onPress={() => {
                  const prev = addDaysStr(effectiveDate, -1);
                  if (prev > todayStr()) setDateStr(prev);
                }}
                className="w-11 h-11 rounded-xl bg-white border border-slate-200 items-center justify-center"
              >
                <MaterialCommunityIcons name="chevron-left" size={22} color="#475569" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setDateDraft(effectiveDate);
                  setShowDateModal(true);
                }}
                className="flex-1 bg-white border border-sky-200 rounded-2xl px-4 py-3"
              >
                <Text className="text-sm font-bold text-slate-800 text-center">
                  {formatDateLabel(effectiveDate)}
                </Text>
                <Text className="text-[10px] text-sky-600 text-center mt-0.5">Tap to pick date</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setDateStr(addDaysStr(effectiveDate, 1))}
                className="w-11 h-11 rounded-xl bg-white border border-slate-200 items-center justify-center"
              >
                <MaterialCommunityIcons name="chevron-right" size={22} color="#475569" />
              </TouchableOpacity>
            </View>
            <Text className="text-[11px] text-slate-400 mt-2">
              {dayKey ? `${dayKey} · schedules recalculate for all doctors` : ''}
            </Text>
          </View>
        )}

        {/* Doctors + expandable slots */}
        <Text className="text-xs font-bold text-slate-700 mb-2">
          Doctors & slots * ({APPOINTMENT_SLOT_MINUTES} min)
        </Text>

        {loadingList ? (
          <ActivityIndicator color="#0D9488" className="mb-5" />
        ) : doctors.length === 0 ? (
          <Text className="text-sm text-slate-400 mb-5">No doctors available.</Text>
        ) : (
          <View className="mb-5 gap-y-3">
            {doctors.map((d) => {
              const meta = doctorMeta(d.doctor_id);
              const expanded = expandedDoctorId === d.doctor_id;
              const selected =
                selectedDoctorId === d.doctor_id && Boolean(selectedSlot);
              const unavailable =
                !meta.scheduledOnDay ||
                (visitType === 'waiting' && !meta.onDutyNow) ||
                meta.openCount === 0;

              let statusLabel = 'Available';
              let statusColor = 'text-emerald-700';
              let statusBg = 'bg-emerald-50 border-emerald-200';
              if (!meta.scheduledOnDay) {
                statusLabel = 'Off day';
                statusColor = 'text-slate-500';
                statusBg = 'bg-slate-100 border-slate-200';
              } else if (visitType === 'waiting' && !meta.onDutyNow) {
                statusLabel = 'Outside hours';
                statusColor = 'text-amber-700';
                statusBg = 'bg-amber-50 border-amber-200';
              } else if (meta.openCount === 0) {
                statusLabel = 'No open slots';
                statusColor = 'text-slate-500';
                statusBg = 'bg-slate-100 border-slate-200';
              } else if (visitType === 'waiting' && meta.onDutyNow) {
                statusLabel = 'Available now';
              }

              return (
                <View
                  key={d.doctor_id}
                  className={`rounded-2xl border overflow-hidden ${
                    unavailable
                      ? 'bg-slate-50 border-slate-200'
                      : selected
                        ? 'bg-teal-50/40 border-teal-300'
                        : 'bg-white border-slate-200'
                  }`}
                  style={unavailable ? { opacity: 0.72 } : undefined}
                >
                  <TouchableOpacity
                    onPress={() =>
                      setExpandedDoctorId((prev) =>
                        prev === d.doctor_id ? null : d.doctor_id
                      )
                    }
                    className="p-4 flex-row items-center justify-between"
                    activeOpacity={0.85}
                  >
                    <View className="flex-1 pr-3">
                      <Text
                        className={`font-bold ${
                          unavailable ? 'text-slate-500' : 'text-slate-900'
                        }`}
                      >
                        {d.name}
                      </Text>
                      <Text className="text-xs text-slate-500 mt-0.5">
                        {d.specialization || 'General'}
                        {meta.rangeLabel ? ` · ${meta.rangeLabel}` : ''}
                      </Text>
                      <View className={`self-start mt-2 px-2 py-0.5 rounded-full border ${statusBg}`}>
                        <Text className={`text-[10px] font-bold ${statusColor}`}>
                          {statusLabel}
                          {meta.scheduledOnDay ? ` · ${meta.openCount} open` : ''}
                        </Text>
                      </View>
                    </View>
                    <MaterialCommunityIcons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={22}
                      color="#64748B"
                    />
                  </TouchableOpacity>

                  {expanded ? (
                    <View className="px-4 pb-4 border-t border-slate-100 pt-3">
                      {!meta.scheduledOnDay ? (
                        <Text className="text-xs text-slate-400 text-center py-2">
                          Doctor is not scheduled on {dayKey || 'this day'}.
                        </Text>
                      ) : meta.slots.length === 0 ? (
                        <Text className="text-xs text-slate-400 text-center py-2">
                          No slots fit this schedule window.
                        </Text>
                      ) : (
                        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                          {meta.slots.map((slot) => {
                            const isSelected =
                              selectedDoctorId === d.doctor_id && selectedSlot === slot.time;
                            const disabled = !slot.available || !meta.selectable;
                            return (
                              <TouchableOpacity
                                key={slot.time}
                                disabled={disabled}
                                onPress={() => {
                                  if (disabled) return;
                                  setSelectedDoctorId(d.doctor_id);
                                  setSelectedSlot(slot.time);
                                  setErrors((p) => ({ ...p, doctor: '', time: '' }));
                                }}
                                className={`px-3 py-2.5 rounded-xl border min-w-[72px] items-center ${
                                  disabled
                                    ? 'bg-slate-100 border-slate-200'
                                    : isSelected
                                      ? 'bg-teal-600 border-teal-600'
                                      : 'bg-emerald-50 border-emerald-300'
                                }`}
                              >
                                <Text
                                  className={`text-xs font-bold ${
                                    disabled
                                      ? 'text-slate-400'
                                      : isSelected
                                        ? 'text-white'
                                        : 'text-emerald-700'
                                  }`}
                                >
                                  {formatMinutesToDisplay(slot.minutes)}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  ) : null}
                </View>
              );
            })}
            {errors.doctor || errors.time ? (
              <Text className="text-red-500 text-xs mt-1">
                {errors.doctor || errors.time}
              </Text>
            ) : null}
          </View>
        )}

        <TouchableOpacity
          onPress={handleBook}
          disabled={submitting || loadingList || !selectedDoctorId || !selectedSlot}
          className="w-full bg-teal-600 p-4 rounded-2xl flex-row justify-center items-center gap-x-2 active:opacity-90"
          style={{
            opacity: submitting || !selectedDoctorId || !selectedSlot ? 0.6 : 1,
          }}
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

      {/* Future date picker modal */}
      <Modal visible={showDateModal} transparent animationType="fade">
        <View
          style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)' }}
          className="items-center justify-center px-8"
        >
          <View className="w-full bg-white rounded-3xl p-6">
            <Text className="text-base font-black text-slate-900 mb-1">Pick a date</Text>
            <Text className="text-xs text-slate-400 mb-4">Format YYYY-MM-DD (after today)</Text>
            <TextInput
              value={dateDraft}
              onChangeText={setDateDraft}
              placeholder="2026-09-10"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
              className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-slate-800 text-sm mb-4"
            />
            <View className="flex-row gap-x-3">
              <TouchableOpacity
                onPress={() => setShowDateModal(false)}
                className="flex-1 py-3 rounded-2xl border border-slate-200 items-center"
              >
                <Text className="text-slate-600 font-bold text-sm">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => applyFutureDate(dateDraft.trim())}
                className="flex-1 py-3 rounded-2xl bg-teal-600 items-center"
              >
                <Text className="text-white font-bold text-sm">Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
                <View className="bg-teal-50 border-2 border-dashed border-teal-300 px-6 py-4 rounded-2xl mt-2 w-full items-center">
                  <Text className="text-3xl font-black text-teal-700 tracking-wider" selectable>
                    {booked.queue_token}
                  </Text>
                </View>
                <Text className="text-[10px] text-slate-400 mt-2 text-center">
                  Token is saved on this appointment. You can print it again from Appointments or Queue.
                </Text>
              </View>
            ) : (
              <Text className="text-xs text-slate-400 mt-4 text-center">
                Future appointment — queue token will be issued when the visit starts.
              </Text>
            )}

            <View className="w-full mt-5 bg-slate-50 border border-slate-200 rounded-2xl p-4 gap-y-2">
              <Text className="text-xs text-slate-500">
                Patient code:{' '}
                <Text className="font-bold text-slate-800">
                  {booked?.patient_code || patientCode}
                </Text>
              </Text>
              <Text className="text-xs text-slate-500">
                Doctor:{' '}
                <Text className="font-bold text-slate-800">{booked?.doctor_name || '—'}</Text>
              </Text>
              <Text className="text-xs text-slate-500">
                When:{' '}
                <Text className="font-bold text-slate-800">
                  {formatWhen(booked?.scheduled_time || null)}
                </Text>
              </Text>
              <Text className="text-xs text-slate-500">
                Status:{' '}
                <Text className="font-bold text-teal-700 capitalize">{booked?.status || '—'}</Text>
              </Text>
            </View>

            <View className="w-full gap-y-3 mt-6">
              {booked?.queue_token ? (
                <TouchableOpacity
                  onPress={() =>
                    printQueueToken({
                      patient_name: booked.patient_name || patientName,
                      patient_code: booked.patient_code || patientCode,
                      queue_token: booked.queue_token,
                      scheduled_time: booked.scheduled_time,
                      doctor_name: booked.doctor_name,
                    })
                  }
                  className="w-full bg-teal-600 p-4 rounded-2xl items-center flex-row justify-center gap-x-2"
                >
                  <MaterialCommunityIcons name="printer-outline" size={18} color="#FFFFFF" />
                  <Text className="text-white font-bold text-sm">Print Token</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={() => {
                  setShowSuccess(false);
                  router.replace('/(receptionist)/appointments');
                }}
                className={`w-full p-4 rounded-2xl items-center ${
                  booked?.queue_token ? 'bg-slate-50 border border-slate-200' : 'bg-teal-600'
                }`}
              >
                <Text
                  className={`font-bold text-sm ${
                    booked?.queue_token ? 'text-slate-700' : 'text-white'
                  }`}
                >
                  View Appointments
                </Text>
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
