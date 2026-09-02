import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../src/theme/colors';

export default function AdminProfile() {
    const router = useRouter();

    // Mock Admin Data
    const adminData = {
        name: "Super Admin",
        email: "admin@mediflow.ai",
        role: "System Administrator",
        permissions: ["User Management", "AI Configuration", "Analytics Access"],
        lastLogin: "Jan 08, 2026 - 09:45 AM"
    };

    return (
        <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1">
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View className="flex-row items-center px-6 py-4">
                <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
                    <MaterialCommunityIcons name="chevron-left" size={28} color={colors.darkText} />
                </TouchableOpacity>
                <Text className="text-xl font-bold ml-2">Admin Profile</Text>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                className="px-6"
                contentContainerStyle={{ paddingBottom: 32 }}
            >

                {/* Profile Card */}
                <View className="items-center mt-4 mb-8">
                    <View
                        className="w-24 h-24 rounded-full items-center justify-center border-4 border-white shadow-lg"
                        style={{ backgroundColor: colors.primary }}
                    >
                        <MaterialCommunityIcons
                            name={"account-shield" as any} // 'as any' likhne se error chala jayega
                            size={50}
                            color="white"
                        />
                    </View>
                    <Text className="text-2xl font-extrabold mt-4" style={{ color: colors.darkText }}>
                        {adminData.name}
                    </Text>
                    <Text className="text-sm font-medium" style={{ color: colors.mutedText }}>
                        {adminData.role}
                    </Text>
                </View>

                {/* System Info Section */}
                <Text className="text-lg font-bold mb-4" style={{ color: colors.darkText }}>System Information</Text>
                <View className="bg-white rounded-[32px] p-6 mb-6 shadow-sm border" style={{ borderColor: colors.accent }}>
                    <InfoRow label="Email" value={adminData.email} icon="email-outline" />
                    <View className="h-[1px] my-3" style={{ backgroundColor: colors.accent }} />
                    <InfoRow label="Last Login" value={adminData.lastLogin} icon="clock-outline" />
                </View>

                {/* AI Agents Access Section */}
                <Text className="text-lg font-bold mb-4" style={{ color: colors.darkText }}>AI Agent Permissions</Text>
                <View className="flex-row flex-wrap gap-2 mb-8">
                    {adminData.permissions.map((perm, index) => (
                        <View
                            key={index}
                            className="px-4 py-2 rounded-full border"
                            style={{ backgroundColor: colors.primary + '10', borderColor: colors.primary }}
                        >
                            <Text style={{ color: colors.primary }} className="text-xs font-bold">{perm}</Text>
                        </View>
                    ))}
                </View>

                {/* Settings Actions */}
                <View className="bg-white rounded-[32px] p-2 shadow-sm border mb-10" style={{ borderColor: colors.accent }}>
                    <ProfileMenuItem icon="security" title="Security Settings" />
                    <View className="h-[1px] mx-5" style={{ backgroundColor: colors.accent }} />
                    <ProfileMenuItem icon="bell-ring-outline" title="Notification Preferences" />
                    <View className="h-[1px] mx-5" style={{ backgroundColor: colors.accent }} />
                    <ProfileMenuItem icon="database-settings" title="AI Model Configuration" />
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

// --- Local Helper Components ---

const InfoRow = ({ label, value, icon }: { label: string, value: string, icon: string }) => (
    <View className="flex-row items-center">
        <View className="w-10 h-10 rounded-xl items-center justify-center mr-4" style={{ backgroundColor: colors.background }}>
            <MaterialCommunityIcons name={icon as any} size={20} color={colors.primary} />
        </View>
        <View>
            <Text className="text-xs font-bold uppercase tracking-widest" style={{ color: colors.mutedText }}>{label}</Text>
            <Text className="text-[15px] font-bold" style={{ color: colors.darkText }}>{value}</Text>
        </View>
    </View>
);

const ProfileMenuItem = ({ icon, title }: { icon: string, title: string }) => (
    <TouchableOpacity className="flex-row items-center p-4">
        <View className="w-10 h-10 rounded-xl items-center justify-center mr-4" style={{ backgroundColor: colors.background }}>
            <MaterialCommunityIcons name={icon as any} size={20} color={colors.primary} />
        </View>
        <Text className="flex-1 font-bold text-[15px]" style={{ color: colors.darkText }}>{title}</Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.mutedText} />
    </TouchableOpacity>
);