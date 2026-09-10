import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../src/theme/colors';
import { API_URL } from '../../../src/config/api';

const FETCH_TIMEOUT_MS = 15000;


export default function ReceptionistDetails() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const [receptionist, setReceptionist] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadReceptionistData();
    }, [id]);

    const loadReceptionistData = async () => {
        const receptionistId = Array.isArray(id) ? id[0] : id;

        if (!receptionistId) {
            setError('Receptionist ID is missing.');
            setReceptionist(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        try {
            const apiUrl = API_URL;
            const response = await fetch(`${apiUrl}/receptionists/${receptionistId}`, {
                signal: controller.signal,
            });

            if (response.status === 404) {
                setError('Receptionist not found.');
                setReceptionist(null);
                return;
            }

            if (!response.ok) {
                throw new Error(`Failed to fetch receptionist (${response.status})`);
            }

            const data = await response.json();
            setReceptionist(data);
        } catch (fetchError) {
            console.error('Error fetching receptionist details:', fetchError);
            setError('Unable to load receptionist details. Please try again.');
            setReceptionist(null);
        } finally {
            clearTimeout(timeoutId);
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text className="mt-3 text-slate-400">Loading Receptionist Details...</Text>
            </View>
        );
    }

    if (error || !receptionist) {
        return (
            <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1" edges={[]}>
                <View className="px-6 py-4 flex-row items-center bg-white border-b border-slate-50">
                    <TouchableOpacity onPress={() => router.push('/(admin)/receptionist')} className="mr-4 p-2 rounded-full bg-slate-50">
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.darkText} />
                    </TouchableOpacity>
                    <Text className="text-xl font-bold">Receptionist Profile</Text>
                </View>
                <View className="flex-1 justify-center items-center px-6">
                    <MaterialCommunityIcons name="account-off-outline" size={56} color="#CBD5E1" />
                    <Text className="text-slate-500 text-center mt-4">{error ?? 'Receptionist not found.'}</Text>
                    <TouchableOpacity
                        onPress={loadReceptionistData}
                        className="mt-6 bg-teal-50 px-5 py-3 rounded-2xl border border-teal-100"
                    >
                        <Text style={{ color: colors.primary }} className="font-bold">Retry</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const handleDelete = () => {
        const routeId = Array.isArray(id) ? id[0] : id;

        if (!receptionist?.receptionist_id || String(receptionist.receptionist_id) !== String(routeId)) {
            Alert.alert('Delete Failed', 'The receptionist record could not be verified. Please refresh and try again.');
            return;
        }

        Alert.alert(
            'Delete Receptionist',
            `Are you sure you want to permanently delete ${receptionist.name}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        setDeleting(true);
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

                        try {
                            const apiUrl = API_URL;
                            const response = await fetch(`${apiUrl}/receptionists/${receptionist.receptionist_id}`, {
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
                                `${receptionist.name} has been permanently removed.`,
                                [{ text: 'OK', onPress: () => router.replace('/(admin)/receptionist') }]
                            );
                        } catch (deleteError: any) {
                            console.error('Error deleting receptionist:', deleteError);
                            Alert.alert(
                                'Delete Failed',
                                deleteError?.message || 'Could not delete receptionist. Please try again.'
                            );
                        } finally {
                            clearTimeout(timeoutId);
                            setDeleting(false);
                        }
                    },
                },
            ]
        );
    };

    const handleEdit = () => {
        router.push({
            pathname: '/(admin)/receptionist/add' as any,
            params: { editData: JSON.stringify(receptionist) },
        });
    };

    const createdAt = receptionist.created_at
        ? new Date(receptionist.created_at).toLocaleDateString()
        : '—';

    return (
        <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1" edges={[]}>
            <View className="px-6 py-4 flex-row items-center justify-between bg-white border-b border-slate-50">
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => router.push('/(admin)/receptionist')} className="mr-4 p-2 rounded-full bg-slate-50">
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.darkText} />
                    </TouchableOpacity>
                    <Text className="text-xl font-bold">Receptionist Profile</Text>
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
                    <Text className="text-2xl font-bold text-slate-800">{receptionist.name}</Text>
                    <Text className="text-teal-600 font-bold mb-1">Receptionist</Text>

                    <View className="flex-row items-center mb-4 bg-slate-50 px-3 py-1 rounded-full">
                        <MaterialCommunityIcons name="at" size={14} color={colors.mutedText} />
                        <Text className="text-xs text-slate-500 font-medium ml-1">{receptionist.username}</Text>
                    </View>

                    <View className="flex-row border-t border-slate-50 w-full pt-4 justify-around">
                        <View className="items-center">
                            <Text className="text-xs text-slate-400">Joined</Text>
                            <Text className="font-bold">{createdAt}</Text>
                        </View>
                        <View className="items-center">
                            <Text className="text-xs text-slate-400">Status</Text>
                            <Text className="font-bold text-green-600 uppercase text-[10px]">Active</Text>
                        </View>
                    </View>
                </View>

                <View className="bg-white p-6 rounded-[32px] border border-slate-100 mb-6">
                    <Text className="font-bold text-slate-800 mb-4 text-lg">Contact Information</Text>
                    <InfoRow icon="email-outline" label="Email" text={receptionist.email} />
                    <InfoRow icon="phone-outline" label="Phone" text={receptionist.phone ?? '—'} />
                </View>

                <TouchableOpacity
                    onPress={handleDelete}
                    disabled={deleting}
                    className="mb-10 p-5 flex-row justify-center items-center bg-red-50 rounded-[24px] border border-red-100"
                >
                    <MaterialCommunityIcons name="trash-can-outline" size={22} color="#EF4444" />
                    <Text className="ml-2 text-red-500 font-bold text-base">
                        {deleting ? 'Deleting...' : 'Delete Receptionist Permanently'}
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
