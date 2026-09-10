// src/services/doctorService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../config/api';
import { DashboardStats } from '../types/dashboard';

export interface DoctorQueueItem {
  appointment_id: number;
  patient_id: number;
  doctor_id: number;
  scheduled_time: string | null;
  status: string | null;
  queue_token: string | null;
  patient_name: string | null;
  patient_code: string | null;
  doctor_name: string | null;
  created_at?: string | null;
}

const ACTIVE_QUEUE_STATUSES = new Set(['waiting', 'in_progress']);

const todayParam = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const getLoggedInDoctorId = async (): Promise<number | null> => {
  const raw = await AsyncStorage.getItem('user_data');
  if (!raw) return null;
  const user = JSON.parse(raw);
  return user?.doctor_id ?? null;
};

/** Today's appointments for this doctor that are waiting or in_progress. */
export const getDoctorQueue = async (doctorId?: number | null): Promise<DoctorQueueItem[]> => {
  const id = doctorId ?? (await getLoggedInDoctorId());
  if (!id) return [];

  const res = await axios.get(`${API_URL}/appointments`, {
    params: { date: todayParam(), doctor_id: id },
  });

  return ((res.data || []) as DoctorQueueItem[]).filter((a) =>
    ACTIVE_QUEUE_STATUSES.has((a.status || '').toLowerCase())
  );
};

export const startConsultationVisit = async (appointmentId: number): Promise<DoctorQueueItem> => {
  const raw = await AsyncStorage.getItem('user_data');
  const user = raw ? JSON.parse(raw) : null;
  if (!user?.user_id) {
    throw new Error('Not logged in as doctor');
  }

  const res = await axios.patch(
    `${API_URL}/appointments/${appointmentId}/status`,
    { status: 'in_progress' },
    { headers: { 'X-User-Id': String(user.user_id) } }
  );
  return res.data;
};

export const getDoctorDashboard = async () => {
  const doctorId = await getLoggedInDoctorId();
  const queue = await getDoctorQueue(doctorId);

  // Completed today (same doctor) for KPI — optional extra fetch
  let completedToday = 0;
  if (doctorId) {
    try {
      const res = await axios.get(`${API_URL}/appointments`, {
        params: { date: todayParam(), doctor_id: doctorId, status: 'completed' },
      });
      completedToday = (res.data || []).length;
    } catch {
      completedToday = 0;
    }
  }

  const stats: DashboardStats = {
    totalInQueue: queue.filter((q) => q.status === 'waiting').length,
    completedToday,
    weekConsultations: 0,
    avgWaitTime: '—',
  };

  return {
    stats,
    queue: queue.slice(0, 3),
    doctorId,
  };
};

/** @deprecated Prefer getDoctorQueue — kept name for existing imports */
export const getFullQueue = async () => getDoctorQueue();
