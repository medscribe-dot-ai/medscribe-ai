import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../src/theme/colors';

export default function DoctorProfile() {
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

  if (loading) {
    return (
      <View
        className="flex-1 justify-center items-center"
        style={{ backgroundColor: colors.background }}
      >
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={{ color: colors.mutedText }} className="mt-4 font-medium">
          Loading profile...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1" edges={[]}>
      <StatusBar style="dark" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        className="px-6"
        contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}
      >
        <Text style={{ color: colors.darkText }} className="text-3xl font-bold mb-6">
          Profile
        </Text>

        <View className="items-center mb-8">
          <View
            className="w-24 h-24 rounded-full items-center justify-center border-4 border-white shadow-sm"
            style={{ backgroundColor: colors.primary }}
          >
            <MaterialCommunityIcons name="doctor" size={50} color="white" />
          </View>
          <Text
            className="text-2xl font-extrabold mt-4"
            style={{ color: colors.darkText }}
          >
            {doctorData?.name || 'Doctor'}
          </Text>
          <Text className="text-sm font-medium mt-1" style={{ color: colors.mutedText }}>
            {doctorData?.specialization || 'Medical Specialist'}
          </Text>
        </View>

        <Text className="text-lg font-bold mb-3" style={{ color: colors.darkText }}>
          Professional Information
        </Text>
        <View
          className="bg-white rounded-[28px] p-5 mb-6 shadow-sm border"
          style={{ borderColor: colors.accent }}
        >
          <InfoRow label="Email" value={doctorData?.email || '—'} icon="email-outline" />
          <View className="h-[1px] my-3" style={{ backgroundColor: colors.accent }} />
          <InfoRow
            label="Experience"
            value={`${doctorData?.experience || 0} Years`}
            icon="briefcase-outline"
          />
        </View>

        <Text className="text-lg font-bold mb-3" style={{ color: colors.darkText }}>
          Preferences
        </Text>
        <View
          className="bg-white rounded-[28px] p-2 shadow-sm border mb-4"
          style={{ borderColor: colors.accent }}
        >
          <ComingSoonRow icon="security" title="Security Settings" />
          <View className="h-[1px] mx-5" style={{ backgroundColor: colors.accent }} />
          <ComingSoonRow icon="bell-ring-outline" title="Notification Preferences" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const InfoRow = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}) => (
  <View className="flex-row items-center">
    <View
      className="w-10 h-10 rounded-xl items-center justify-center mr-4"
      style={{ backgroundColor: colors.background }}
    >
      <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
    </View>
    <View className="flex-1">
      <Text
        className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: colors.mutedText }}
      >
        {label}
      </Text>
      <Text className="text-[15px] font-bold mt-0.5" style={{ color: colors.darkText }}>
        {value}
      </Text>
    </View>
  </View>
);

const ComingSoonRow = ({
  icon,
  title,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
}) => (
  <View className="flex-row items-center p-4 opacity-70">
    <View
      className="w-10 h-10 rounded-xl items-center justify-center mr-4"
      style={{ backgroundColor: colors.background }}
    >
      <MaterialCommunityIcons name={icon} size={20} color={colors.mutedText} />
    </View>
    <Text className="flex-1 font-bold text-[15px]" style={{ color: colors.mutedText }}>
      {title}
    </Text>
    <View
      className="px-2.5 py-1 rounded-full"
      style={{ backgroundColor: colors.background }}
    >
      <Text
        className="text-[10px] font-bold uppercase"
        style={{ color: colors.mutedText }}
      >
        Coming soon
      </Text>
    </View>
  </View>
);
