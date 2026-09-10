import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StatusBar, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../src/theme/colors';

export default function DoctorProfile() {
    const router = useRouter();
    const [doctorData, setDoctorData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDoctorData = async () => {
            const userData = await AsyncStorage.getItem('user_data');
            if (userData) setDoctorData(JSON.parse(userData));
            setLoading(false);
        };
        fetchDoctorData();
    }, []);

    if (loading) return <View className="flex-1 justify-center items-center" style={{ backgroundColor: colors.background }}><ActivityIndicator color={colors.primary} /></View>;

    return (
        <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1" edges={[]}>
            <StatusBar barStyle="dark-content" />
            <View className="flex-row items-center px-6 py-4">
                <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
                    <MaterialCommunityIcons name="chevron-left" size={28} color={colors.darkText} />
                </TouchableOpacity>
                <Text className="text-xl font-bold ml-2">Doctor Profile</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="px-6" contentContainerStyle={{ paddingBottom: 32 }}>
                <View className="items-center mt-4 mb-8">
                    <View className="w-24 h-24 rounded-full items-center justify-center border-4 border-white shadow-lg" style={{ backgroundColor: colors.primary }}>
                        <MaterialCommunityIcons name="doctor" size={50} color="white" />
                    </View>
                    <Text className="text-2xl font-extrabold mt-4" style={{ color: colors.darkText }}>{doctorData?.name}</Text>
                    <Text className="text-sm font-medium" style={{ color: colors.mutedText }}>{doctorData?.specialization || "Medical Specialist"}</Text>
                </View>

                <Text className="text-lg font-bold mb-4" style={{ color: colors.darkText }}>Professional Information</Text>
                <View className="bg-white rounded-[32px] p-6 mb-6 shadow-sm border" style={{ borderColor: colors.accent }}>
                    <InfoRow label="Email" value={doctorData?.email} icon="email-outline" />
                    <View className="h-[1px] my-3" style={{ backgroundColor: colors.accent }} />
                    <InfoRow label="Experience" value={`${doctorData?.experience || 0} Years`} icon="briefcase-outline" />
                </View>

                {/* Settings Actions */}
                <View className="bg-white rounded-[32px] p-2 shadow-sm border mb-10" style={{ borderColor: colors.accent }}>
                    <ProfileMenuItem icon="security" title="Security Settings" />
                    <View className="h-[1px] mx-5" style={{ backgroundColor: colors.accent }} />
                    <ProfileMenuItem icon="bell-ring-outline" title="Notification Preferences" />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const InfoRow = ({ label, value, icon }: any) => (
    <View className="flex-row items-center">
        <View className="w-10 h-10 rounded-xl items-center justify-center mr-4" style={{ backgroundColor: colors.background }}>
            <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
        </View>
        <View>
            <Text className="text-xs font-bold uppercase tracking-widest" style={{ color: colors.mutedText }}>{label}</Text>
            <Text className="text-[15px] font-bold" style={{ color: colors.darkText }}>{value}</Text>
        </View>
    </View>
);

const ProfileMenuItem = ({ icon, title }: any) => (
    <TouchableOpacity className="flex-row items-center p-4">
        <View className="w-10 h-10 rounded-xl items-center justify-center mr-4" style={{ backgroundColor: colors.background }}>
            <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
        </View>
        <Text className="flex-1 font-bold text-[15px]" style={{ color: colors.darkText }}>{title}</Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.mutedText} />
    </TouchableOpacity>
);