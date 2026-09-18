import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../src/theme/colors';
import { API_URL } from '../../../src/config/api';

const FETCH_TIMEOUT_MS = 15000;


export default function DoctorDetails() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const [doctor, setDoctor] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadDoctorData = useCallback(async () => {
        const doctorId = Array.isArray(id) ? id[0] : id;

        if (!doctorId) {
            setError('Doctor ID is missing.');
            setDoctor(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        try {
            const apiUrl = API_URL;
            const response = await fetch(`${apiUrl}/doctors/${doctorId}`, {
                signal: controller.signal,
            });

            if (response.status === 404) {
                setError('Doctor not found.');
                setDoctor(null);
                return;
            }

            if (!response.ok) {
                throw new Error(`Failed to fetch doctor (${response.status})`);
            }

            const data = await response.json();
            setDoctor(data);
        } catch (fetchError) {
            console.error('Error fetching doctor details:', fetchError);
            setError('Unable to load doctor details. Please try again.');
            setDoctor(null);
        } finally {
            clearTimeout(timeoutId);
            setLoading(false);
        }
    }, [id]);

    useFocusEffect(
        useCallback(() => {
            loadDoctorData();
        }, [loadDoctorData])
    );

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text className="mt-3 text-slate-400">Loading Doctor Details...</Text>
            </View>
        );
    }

    if (error || !doctor) {
        return (
            <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1" edges={[]}>
                <View className="px-6 py-4 flex-row items-center bg-white border-b border-slate-50">
                    <TouchableOpacity onPress={() => router.push('/(admin)/doctor')} className="mr-4 p-2 rounded-full bg-slate-50">
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.darkText} />
                    </TouchableOpacity>
                    <Text className="text-xl font-bold">Doctor Profile</Text>
                </View>
                <View className="flex-1 justify-center items-center px-6">
                    <MaterialCommunityIcons name="account-off-outline" size={56} color="#CBD5E1" />
                    <Text className="text-slate-500 text-center mt-4">{error ?? 'Doctor not found.'}</Text>
                    <TouchableOpacity
                        onPress={loadDoctorData}
                        className="mt-6 bg-teal-50 px-5 py-3 rounded-2xl border border-teal-100"
                    >
                        <Text style={{ color: colors.primary }} className="font-bold">Retry</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const handleDelete = () => {
        const routeDoctorId = Array.isArray(id) ? id[0] : id;

        if (!doctor?.doctor_id || String(doctor.doctor_id) !== String(routeDoctorId)) {
            Alert.alert('Delete Failed', 'The doctor record could not be verified. Please refresh and try again.');
            return;
        }

        Alert.alert(
            "Delete Doctor",
            `Are you sure you want to permanently delete Dr. ${doctor.name}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        setDeleting(true);
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

                        try {
                            const apiUrl = API_URL;
                            const response = await fetch(`${apiUrl}/doctors/${doctor.doctor_id}`, {
                                method: 'DELETE',
                                signal: controller.signal,
                            });

                            let data: any = {};
                            try {
                                data = await response.json();
                            } catch {
                                data = {};
                            }

                            if (!response.ok) {
                                throw new Error(
                                    typeof data.detail === 'string'
                                        ? data.detail
                                        : `Delete failed (${response.status})`
                                );
                            }

                            Alert.alert(
                                'Deleted',
                                `${doctor.name} has been permanently removed.`,
                                [{ text: 'OK', onPress: () => router.replace('/(admin)/doctor') }]
                            );
                        } catch (deleteError: any) {
                            console.error('Error deleting doctor:', deleteError);
                            Alert.alert(
                                'Delete Failed',
                                deleteError?.message || 'Could not delete doctor. Please try again.'
                            );
                        } finally {
                            clearTimeout(timeoutId);
                            setDeleting(false);
                        }
                    }
                }
            ]
        );
    };

    const handleEdit = () => {
        router.push({
            pathname: '/(admin)/doctor/add' as any,
            params: { editData: JSON.stringify(doctor) }
        });
    };

    return (
        <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1" edges={[]}>
            <View className="px-6 py-4 flex-row items-center justify-between bg-white border-b border-slate-50">
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => router.push("/(admin)/doctor")} className="mr-4 p-2 rounded-full bg-slate-50">
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.darkText} />
                    </TouchableOpacity>
                    <Text className="text-xl font-bold">Doctor Profile</Text>
                </View>
                <TouchableOpacity onPress={handleEdit} className="bg-teal-50 p-2 rounded-xl">
                    <MaterialCommunityIcons name="pencil" size={20} color={colors.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView
                className="px-6 py-6"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 32 }}
            >
                <View className="bg-white p-6 rounded-[32px] items-center border border-slate-100 mb-6 shadow-sm">
                    <MaterialCommunityIcons name="account-circle" size={80} color={colors.primary} />
                    <Text className="text-2xl font-bold text-slate-800">{doctor.name}</Text>
                    <Text className="text-teal-600 font-bold mb-1">{doctor.specialization}</Text>

                    <View className="flex-row items-center mb-4 bg-slate-50 px-3 py-1 rounded-full">
                        <MaterialCommunityIcons name="at" size={14} color={colors.mutedText} />
                        <Text className="text-xs text-slate-500 font-medium ml-1">{doctor.username}</Text>
                    </View>

                    <View className="flex-row border-t border-slate-50 w-full pt-4 justify-around">
                        <View className="items-center">
                            <Text className="text-xs text-slate-400">Experience</Text>
                            <Text className="font-bold">{doctor.experience_years ?? 0} Years</Text>
                        </View>
                        <View className="items-center">
                            <Text className="text-xs text-slate-400">Status</Text>
                            <Text className="font-bold text-green-600 uppercase text-[10px]">
                                {doctor.availability_status || 'Active'}
                            </Text>
                        </View>
                    </View>
                </View>

                <View className="bg-white p-6 rounded-[32px] border border-slate-100 mb-6">
                    <View className="flex-row items-center mb-4">
                        <MaterialCommunityIcons name="calendar-clock" size={22} color={colors.primary} />
                        <Text className="font-bold text-slate-800 ml-2 text-lg">Weekly Schedule</Text>
                    </View>

                    {doctor.schedule && Object.keys(doctor.schedule).length > 0 ? (
                        Object.entries(doctor.schedule).map(([day, time]: [string, string]) => (
                            <View key={day} className="flex-row justify-between py-3 border-b border-slate-50">
                                <Text className="font-bold text-slate-600">{day}</Text>
                                <Text className="text-slate-500 text-sm">{time}</Text>
                            </View>
                        ))
                    ) : (
                        <Text className="text-slate-400 text-sm">No schedule set</Text>
                    )}
                </View>

                <View className="bg-white p-6 rounded-[32px] border border-slate-100 mb-6">
                    <Text className="font-bold text-slate-800 mb-4 text-lg">Contact Information</Text>
                    <InfoRow icon="email-outline" label="Email" text={doctor.email} />
                    <InfoRow icon="phone-outline" label="Phone" text={doctor.phone ?? '—'} />
                </View>

                <TouchableOpacity
                    onPress={handleDelete}
                    disabled={deleting}
                    className="mb-10 p-5 flex-row justify-center items-center bg-red-50 rounded-[24px] border border-red-100"
                >
                    <MaterialCommunityIcons name="trash-can-outline" size={22} color="#EF4444" />
                    <Text className="ml-2 text-red-500 font-bold text-base">
                        {deleting ? 'Deleting...' : 'Delete Doctor Permanently'}
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const InfoRow = ({ icon, label, text }: any) => (
    <View className="flex-row items-center mb-4">
        <View className="w-10 h-10 rounded-xl bg-slate-50 items-center justify-center">
            <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
        </View>
        <View className="ml-3">
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{label}</Text>
            <Text className="text-slate-700 font-semibold">{text}</Text>
        </View>
    </View>
);
