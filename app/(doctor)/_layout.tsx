import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/src/theme/colors';

export default function DoctorLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: 'white',
          borderTopWidth: 1,
          borderTopColor: '#f1f5f9',
          height: Platform.OS === 'ios' ? 85 : 80, 
          paddingTop: 10,
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : 20, 
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginBottom: Platform.OS === 'android' ? 5 : 0,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="home-variant" size={26} color={color} />
          ),
        }}
      />
      
      {/* 1. NAYA TAB: Record (Isse error khatam ho jayega) */}
      <Tabs.Screen
        name="record/index"
        options={{
          title: 'Record',
          tabBarLabel: 'Voice Record',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="microphone" size={26} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="queue/patient_queue"
        options={{
          title: 'Queue',
          tabBarLabel: 'Queue',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="human-queue" size={26} color={color} />
          ),
        }}
      />
      
      {/* Hidden Screens */}
      <Tabs.Screen
        name="report/[id]"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="soap-review/[id]"
        options={{
          href: null,
          title: 'SOAP Review',
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="account-circle-outline" size={26} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}