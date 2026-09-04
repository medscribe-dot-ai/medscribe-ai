import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { colors } from '../../../src/theme/colors';

const FALLBACK_API_URL = 'https://medscribeai-pzqu.onrender.com';
const FETCH_TIMEOUT_MS = 15000;

function resolveApiUrl(): string {
    const hostUri = Constants.expoConfig?.hostUri;
    if (__DEV__ && hostUri) {
        const host = hostUri.split(':')[0];
        if (host) return `http://${host}:8000`;
    }

    const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
    if (envUrl) return envUrl.replace(/\/$/, '');

    return FALLBACK_API_URL;
}

export default function DoctorsList() {
    const [doctors, setDoctors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useFocusEffect(
        useCallback(() => {
            let isActive = true;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

            const fetchDoctors = async () => {
                setLoading(true);
                try {
                    const apiUrl = resolveApiUrl();
                    const response = await fetch(`${apiUrl}/doctors`, {
                        signal: controller.signal,
                    });
                    if (!response.ok) {
                        throw new Error(`Failed to fetch doctors (${response.status})`);
                    }
                    const data = await response.json();
                    if (isActive) {
                        setDoctors(Array.isArray(data) ? data : []);
                    }
                } catch (error) {
                    console.error('Error fetching doctors:', error);
                    if (isActive) {
                        setDoctors([]);
                    }
                } finally {
                    clearTimeout(timeoutId);
                    if (isActive) {
                        setLoading(false);
                    }
                }
            };

            fetchDoctors();

            return () => {
                isActive = false;
                controller.abort();
                clearTimeout(timeoutId);
            };
        }, [])
    );

    return (
        <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1">
            <View className="px-6 py-4 flex-row items-center border-b border-slate-100 bg-white">
                <TouchableOpacity onPress={() => router.back()} className="mr-4 w-10 h-10 items-center justify-center rounded-full bg-slate-50">
                    <MaterialCommunityIcons name="chevron-left" size={28} color={colors.darkText} />
                </TouchableOpacity>
                <Text className="text-xl font-extrabold text-slate-800 me-3">Doctors List</Text>
                <View className="bg-teal-100 px-2 py-1 rounded-full">
                    <Text className="text-teal-700 font-bold">{doctors.length}</Text>
                </View>
            </View>

            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text className="mt-2 text-slate-400">Loading Doctors...</Text>
                </View>
            ) : (
                <FlatList
                    data={doctors}
                    keyExtractor={(item) => item.doctor_id?.toString() || Math.random().toString()}
                    contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32 }}
                    ListEmptyComponent={() => (
                        <View className="items-center mt-20">
                            <MaterialCommunityIcons name="account-off-outline" size={60} color="#CBD5E1" />
                            <Text className="text-slate-400 mt-4">No doctors found.</Text>
                        </View>
                    )}
                    renderItem={({ item }) => {
                        const displayName = item.name?.trim() || "Unknown Doctor";
                        
                        return (
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => {
                                    router.push({
                                        pathname: "/(admin)/doctor/[id]" as any,
                                        params: { id: item.doctor_id }
                                    });
                                }}
                                className="bg-white p-5 rounded-[28px] mb-4 border border-slate-100 shadow-sm flex-row items-center"
                            >
                                <View className="w-14 h-14 rounded-2xl bg-teal-50 items-center justify-center mr-4">
                                    <MaterialCommunityIcons name="account-tie-voice-outline" size={30} color={colors.primary} />
                                </View>

                                <View className="flex-1">
                                    <Text className="font-bold text-lg text-slate-800">{displayName}</Text>
                                    <Text className="text-xs text-slate-400 font-medium mb-1">{item.specialization}</Text>

                                    <View className="flex-row items-center">
                                        <View className={`w-2 h-2 rounded-full mr-2 ${item.availability_status === 'available' ? 'bg-green-500' : 'bg-amber-500'}`} />
                                        <Text className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                            {item.availability_status || 'Active'}
                                        </Text>
                                    </View>
                                </View>

                                <MaterialCommunityIcons name="chevron-right" size={24} color="#CBD5E1" />
                            </TouchableOpacity>
                        );
                    }}
                />
            )}
        </SafeAreaView>
    );
}