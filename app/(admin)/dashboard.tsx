import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StatCard } from '../../src/components/ui/StatCard';
import { API_URL } from '../../src/config/api';
import { getPatients } from '../../src/services/patientService';
import { colors } from '../../src/theme/colors';
import { formatAppointmentTime } from '../../src/utils/doctorSlots';

const FETCH_TIMEOUT_MS = 15000;

const ACTIVE_OPD_STATUSES = new Set(['waiting', 'in_progress']);

type TodayAppointment = {
    appointment_id: number;
    patient_name: string | null;
    patient_code: string | null;
    doctor_name: string | null;
    status: string | null;
    scheduled_time: string | null;
    queue_token: string | null;
};

type OpdActivityRow = {
    key: string;
    title: string;
    sub: string;
    time: string;
};

const todayParam = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const statusLabel = (status: string | null | undefined) => {
    const key = (status || '').toLowerCase().trim();
    if (key === 'waiting') return 'Waiting';
    if (key === 'in_progress') return 'In Progress';
    if (key === 'scheduled') return 'Scheduled';
    if (key === 'completed') return 'Completed';
    if (key === 'cancelled') return 'Cancelled';
    return status?.trim() || 'Unknown';
};

const uniqueDepartmentCount = (doctors: { specialization?: string | null }[]) => {
    const set = new Set<string>();
    for (const d of doctors) {
        const spec = (d.specialization || '').trim();
        if (spec) set.add(spec.toLowerCase());
    }
    return set.size;
};

const mapLiveOpdRows = (appointments: TodayAppointment[]): OpdActivityRow[] => {
    return appointments
        .filter((a) => ACTIVE_OPD_STATUSES.has((a.status || '').toLowerCase().trim()))
        .slice(0, 8)
        .map((a) => {
            const doctor = (a.doctor_name || '').trim() || 'Doctor';
            const patient =
                (a.patient_name || '').trim() ||
                (a.patient_code || '').trim() ||
                'Patient';
            const token = (a.queue_token || '').trim();
            const subParts = [statusLabel(a.status), patient];
            if (token) subParts.push(token);
            return {
                key: String(a.appointment_id),
                title: doctor,
                sub: subParts.join(' · '),
                time: formatAppointmentTime(a.scheduled_time),
            };
        });
};

export default function AdminDashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalDoctors: 0,
        totalReceptionists: 0,
        totalPatients: 0,
        totalDepartments: 0,
    });
    const [liveOpd, setLiveOpd] = useState<OpdActivityRow[]>([]);

    useFocusEffect(
        useCallback(() => {
            let isActive = true;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

            const loadDashboardData = async () => {
                setLoading(true);
                try {
                    const apiUrl = API_URL;
                    const [doctorsRes, receptionistsRes, patients, appointmentsRes] =
                        await Promise.all([
                            fetch(`${apiUrl}/doctors`, { signal: controller.signal }),
                            fetch(`${apiUrl}/receptionists`, { signal: controller.signal }),
                            getPatients(),
                            fetch(`${apiUrl}/appointments?date=${todayParam()}`, {
                                signal: controller.signal,
                            }),
                        ]);

                    const doctors = doctorsRes.ok ? await doctorsRes.json() : [];
                    const receptionists = receptionistsRes.ok
                        ? await receptionistsRes.json()
                        : [];
                    const appointments = appointmentsRes.ok
                        ? await appointmentsRes.json()
                        : [];

                    const doctorList = Array.isArray(doctors) ? doctors : [];
                    const receptionistList = Array.isArray(receptionists) ? receptionists : [];
                    const patientList = Array.isArray(patients) ? patients : [];
                    const appointmentList = Array.isArray(appointments)
                        ? (appointments as TodayAppointment[])
                        : [];

                    if (isActive) {
                        setStats({
                            totalDoctors: doctorList.length,
                            totalReceptionists: receptionistList.length,
                            totalPatients: patientList.length,
                            totalDepartments: uniqueDepartmentCount(doctorList),
                        });
                        setLiveOpd(mapLiveOpdRows(appointmentList));
                    }
                } catch (error) {
                    console.error('Dashboard load error:', error);
                    if (isActive) {
                        setStats({
                            totalDoctors: 0,
                            totalReceptionists: 0,
                            totalPatients: 0,
                            totalDepartments: 0,
                        });
                        setLiveOpd([]);
                    }
                } finally {
                    clearTimeout(timeoutId);
                    if (isActive) setLoading(false);
                }
            };

            loadDashboardData();

            return () => {
                isActive = false;
                controller.abort();
                clearTimeout(timeoutId);
            };
        }, [])
    );

    const handleLogout = () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Logout',
                style: 'destructive',
                onPress: () => router.replace('/(auth)/login'),
            },
        ]);
    };

    if (loading) {
        return (
            <View
                className="flex-1 justify-center items-center"
                style={{ backgroundColor: colors.background }}
            >
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1" edges={[]}>
            <StatusBar style="dark" />

            <ScrollView
                showsVerticalScrollIndicator={false}
                className="px-6"
                contentContainerStyle={{ paddingBottom: 32 }}
            >
                {/* 1. Header Section */}
                <View className="flex-row items-center justify-between mt-6 mb-8">
                    <TouchableOpacity
                        className="flex-row items-center"
                        onPress={() => router.push('/(admin)/profile')}
                    >
                        <View
                            className="w-12 h-12 rounded-full items-center justify-center border-2 border-white shadow-sm"
                            style={{
                                backgroundColor: colors.accent + '40',
                                borderColor: colors.accent,
                            }}
                        >
                            <MaterialCommunityIcons
                                name="account-tie"
                                size={28}
                                color={colors.primary}
                            />
                        </View>
                        <View className="ml-3">
                            <Text
                                style={{ color: colors.primary }}
                                className="text-xs font-bold uppercase tracking-tighter"
                            >
                                MedScribeAI Admin
                            </Text>
                            <Text
                                style={{ color: colors.darkText }}
                                className="text-xl font-extrabold"
                            >
                                Hello, Admin!
                            </Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleLogout}
                        className="w-11 h-11 rounded-2xl items-center justify-center bg-red-50 border border-red-100 shadow-sm"
                    >
                        <MaterialCommunityIcons name="logout-variant" size={22} color="#EF4444" />
                    </TouchableOpacity>
                </View>

                {/* 2. Dynamic Stats Grid */}
                <View
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                    }}
                >
                    <TouchableOpacity
                        style={{ width: '48%', marginBottom: 15 }}
                        activeOpacity={0.8}
                        onPress={() => router.push('/(admin)/doctor')}
                    >
                        <StatCard
                            title="Total Doctors"
                            value={stats.totalDoctors.toString()}
                            icon="doctor"
                            color={colors.primary}
                        />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={{ width: '48%', marginBottom: 15 }}
                        activeOpacity={0.8}
                        onPress={() => router.push('/(admin)/receptionist' as any)}
                    >
                        <StatCard
                            title="Total Receptionists"
                            value={stats.totalReceptionists.toString()}
                            icon="account-tie"
                            color="#FF9800"
                        />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={{ width: '48%', marginBottom: 15 }}
                        activeOpacity={0.8}
                        onPress={() => router.push({ pathname: '/(admin)/patients' } as any)}
                    >
                        <StatCard
                            title="Total Patients"
                            value={stats.totalPatients.toString()}
                            icon="account-group"
                            color="#4CAF50"
                        />
                    </TouchableOpacity>

                    <View style={{ width: '48%', marginBottom: 15 }}>
                        <StatCard
                            title="Total Departments"
                            value={stats.totalDepartments.toString()}
                            icon="hospital-building"
                            color="#E91E63"
                        />
                    </View>
                </View>

                {/* 3. AI Insights Card — static note only (no fabricated metrics) */}
                <View className="mt-2 p-5 rounded-[32px] bg-blue-50 border border-blue-100">
                    <View className="flex-row items-center mb-2">
                        <MaterialCommunityIcons name="auto-fix" size={20} color={colors.primary} />
                        <Text className="ml-2 font-bold text-blue-800">AI System Health</Text>
                    </View>
                    <Text className="text-blue-600 text-sm">
                        Transcription, RAG, and SOAP generation run as part of consultation
                        processing. Live accuracy metrics are not available in this build.
                    </Text>
                </View>

                {/* 4. Quick Actions */}
                <View className="mt-6">
                    <Text style={{ color: colors.darkText }} className="text-lg font-bold mb-4">
                        Quick Actions
                    </Text>
                    <View
                        className="bg-white rounded-[32px] p-2 shadow-sm border"
                        style={{ borderColor: colors.accent }}
                    >
                        <ActionItem
                            icon="account-plus-outline"
                            title="Add New Doctor"
                            onPress={() =>
                                router.push({
                                    pathname: '/(admin)/doctor/add',
                                    params: { editData: null },
                                })
                            }
                        />
                        <View className="h-[0.5px] mx-5" style={{ backgroundColor: colors.accent }} />

                        <ActionItem
                            icon="card-account-details-outline"
                            title="Add New Receptionist"
                            onPress={() =>
                                router.push({
                                    pathname: '/(admin)/receptionist/add',
                                    params: { editData: null },
                                } as any)
                            }
                        />
                        <View className="h-[0.5px] mx-5" style={{ backgroundColor: colors.accent }} />

                        <ActionItem
                            icon="shield-account-outline"
                            title="Manage Receptionists"
                            onPress={() => router.push('/(admin)/receptionist' as any)}
                        />
                        <View className="h-[0.5px] mx-5" style={{ backgroundColor: colors.accent }} />

                        <ActionItem
                            icon="file-chart-outline"
                            title="System Analytics"
                            onPress={() => router.push('/(admin)/reports')}
                        />
                    </View>
                </View>

                {/* 5. Live OPD Flow — today waiting / in_progress only */}
                <View className="mt-6 mb-10">
                    <Text style={{ color: colors.darkText }} className="text-lg font-bold mb-4">
                        Live OPD Flow
                    </Text>
                    <View className="bg-white rounded-3xl p-4 border border-slate-100 shadow-xs">
                        {liveOpd.length === 0 ? (
                            <Text className="text-sm text-slate-400 text-center py-3">
                                No active OPD activity
                            </Text>
                        ) : (
                            liveOpd.map((row) => (
                                <ActivityRow
                                    key={row.key}
                                    title={row.title}
                                    sub={row.sub}
                                    time={row.time}
                                />
                            ))
                        )}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const ActionItem = ({ icon, title, onPress }: ActionItemProps) => (
    <TouchableOpacity onPress={onPress} className="flex-row items-center p-4 active:opacity-60">
        <View
            style={{ backgroundColor: colors.background }}
            className="w-11 h-11 rounded-2xl items-center justify-center mr-4"
        >
            <MaterialCommunityIcons name={icon as any} size={22} color={colors.primary} />
        </View>
        <Text style={{ color: colors.darkText }} className="flex-1 font-bold text-[15px]">
            {title}
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.mutedText} />
    </TouchableOpacity>
);

const ActivityRow = ({ title, sub, time }: { title: string; sub: string; time: string }) => (
    <View className="flex-row justify-between items-center py-3 border-b border-slate-50 last:border-0">
        <View className="flex-1 pr-3">
            <Text className="font-bold text-slate-800">{title}</Text>
            <Text className="text-xs text-slate-500">{sub}</Text>
        </View>
        <Text className="text-[10px] text-slate-400 font-bold uppercase">{time}</Text>
    </View>
);

interface ActionItemProps {
    icon: string;
    title: string;
    onPress: () => void;
}
