import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, Switch } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  ReceptionistMenuButton,
  confirmReceptionistLogout,
} from '../../src/components/receptionist/ReceptionistNavMenu';

const SettingsScreen = () => {
  const router = useRouter();

  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-white">
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        style={{ flex: 1 }}
      >
        <View className="px-6 pt-4 pb-2 bg-white flex-row justify-between items-center">
          <ReceptionistMenuButton title="Settings" />
        </View>

        <View className="px-6 mt-2">
          <Text className="text-2xl font-black text-slate-900">Settings</Text>
        </View>

        <View className="mx-6 mt-6 bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex-row justify-between items-center">
          <View className="flex-row items-center gap-x-4">
            <View className="w-14 h-14 bg-teal-50 rounded-full items-center justify-center border border-teal-100">
              <Text className="text-lg font-bold text-teal-600">AH</Text>
            </View>
            <View>
              <Text className="text-base font-bold text-slate-800">Ali Hassan</Text>
              <Text className="text-xs text-slate-400 mt-0.5">receptionist@mediflow.com</Text>
              <View className="bg-purple-100 px-2 py-0.5 rounded-md mt-1.5 self-start">
                <Text className="text-[9px] font-bold text-purple-600">Receptionist</Text>
              </View>
            </View>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
        </View>

        <View className="mx-6 mt-6">
          <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Preferences
          </Text>
          <View className="bg-white border border-slate-100 rounded-3xl px-5 py-2 shadow-sm">
            <View className="flex-row justify-between items-center py-4 border-b border-slate-50">
              <View className="flex-row items-center gap-x-3">
                <MaterialCommunityIcons name="bell-outline" size={20} color="#475569" />
                <Text className="text-sm font-semibold text-slate-700">Notifications</Text>
              </View>
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ false: '#E2E8F0', true: '#0D9488' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View className="flex-row justify-between items-center py-4 border-b border-slate-50">
              <View className="flex-row items-center gap-x-3">
                <MaterialCommunityIcons name="weather-night" size={20} color="#475569" />
                <Text className="text-sm font-semibold text-slate-700">Dark Mode</Text>
              </View>
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                trackColor={{ false: '#E2E8F0', true: '#0D9488' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View className="flex-row justify-between items-center py-4">
              <View className="flex-row items-center gap-x-3">
                <MaterialCommunityIcons name="earth" size={20} color="#475569" />
                <Text className="text-sm font-semibold text-slate-700">Language</Text>
              </View>
              <View className="flex-row items-center gap-x-1">
                <Text className="text-xs font-medium text-slate-400">English</Text>
                <MaterialCommunityIcons name="chevron-right" size={18} color="#94A3B8" />
              </View>
            </View>
          </View>
        </View>

        <View className="mx-6 mt-6">
          <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Security</Text>
          <View className="bg-white border border-slate-100 rounded-3xl px-5 py-2 shadow-sm">
            <TouchableOpacity className="flex-row justify-between items-center py-4 border-b border-slate-50">
              <View className="flex-row items-center gap-x-3">
                <MaterialCommunityIcons name="shield-outline" size={20} color="#475569" />
                <Text className="text-sm font-semibold text-slate-700">Change Password</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <View className="flex-row justify-between items-center py-4">
              <View className="flex-row items-center gap-x-3">
                <MaterialCommunityIcons name="cellphone-lock" size={20} color="#475569" />
                <Text className="text-sm font-semibold text-slate-700">Two-Factor Auth</Text>
              </View>
              <Switch
                value={twoFactor}
                onValueChange={setTwoFactor}
                trackColor={{ false: '#E2E8F0', true: '#0D9488' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        <View className="mx-6 mt-6">
          <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Support</Text>
          <View className="bg-white border border-slate-100 rounded-3xl px-5 py-2 shadow-sm">
            <TouchableOpacity className="flex-row justify-between items-center py-4">
              <View className="flex-row items-center gap-x-3">
                <MaterialCommunityIcons name="help-circle-outline" size={20} color="#475569" />
                <Text className="text-sm font-semibold text-slate-700">Help & FAQ</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => confirmReceptionistLogout(router)}
          className="mx-6 mt-6 mb-4 bg-white border border-red-100 p-4 rounded-2xl flex-row items-center gap-x-3 active:opacity-95"
        >
          <MaterialCommunityIcons name="logout" size={20} color="#EF4444" />
          <Text className="text-sm font-bold text-red-500">Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SettingsScreen;
