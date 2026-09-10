import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NavItem = {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  href: string;
  match: string[];
};

const NAV_ITEMS: NavItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: 'view-dashboard-outline',
    href: '/(receptionist)/dashboard',
    match: ['/dashboard', '/(receptionist)/dashboard'],
  },
  {
    key: 'patients',
    label: 'Patients',
    icon: 'account-group-outline',
    href: '/(receptionist)/patients',
    match: ['/patients', '/(receptionist)/patients'],
  },
  {
    key: 'appointments',
    label: 'Appointments',
    icon: 'calendar-month-outline',
    href: '/(receptionist)/appointments',
    match: ['/appointments', '/(receptionist)/appointments'],
  },
  {
    key: 'queue',
    label: 'Queue',
    icon: 'clipboard-text-clock-outline',
    href: '/(receptionist)/queue',
    match: ['/queue', '/(receptionist)/queue'],
  },
];

export async function receptionistLogout(router: ReturnType<typeof useRouter>) {
  await AsyncStorage.removeItem('user_data');
  router.replace('/(auth)/login');
}

export function confirmReceptionistLogout(router: ReturnType<typeof useRouter>) {
  Alert.alert('Logout', 'Are you sure you want to logout?', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Logout',
      style: 'destructive',
      onPress: () => {
        void receptionistLogout(router);
      },
    },
  ]);
}

type Props = {
  /** Optional label shown next to the menu button */
  title?: string;
};

/**
 * Mobile-friendly receptionist menu (slide-over panel).
 * Opens from a header hamburger — practical on phone, no desktop-only sidebar.
 */
export function ReceptionistMenuButton({ title }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const isActive = (item: NavItem) =>
    item.match.some((m) => pathname === m || pathname.endsWith(m.replace('/(receptionist)', '')));

  const go = (href: string) => {
    setOpen(false);
    router.push(href as any);
  };

  return (
    <>
      <View className="flex-row items-center gap-x-3">
        <TouchableOpacity
          onPress={() => setOpen(true)}
          className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl items-center justify-center"
          accessibilityLabel="Open menu"
        >
          <MaterialCommunityIcons name="menu" size={22} color="#0F766E" />
        </TouchableOpacity>
        {title ? (
          <Text className="text-base font-bold text-slate-800" numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View
            style={{
              width: '78%',
              maxWidth: 320,
              backgroundColor: '#FFFFFF',
              paddingTop: insets.top + 12,
              paddingBottom: insets.bottom + 16,
              paddingHorizontal: 20,
            }}
          >
            <View className="flex-row items-center justify-between mb-6">
              <View>
                <Text className="text-lg font-black text-slate-900">MedScribe AI</Text>
                <View className="bg-purple-100 self-start px-2.5 py-0.5 rounded-full mt-1">
                  <Text className="text-[10px] font-bold text-purple-600">Receptionist</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setOpen(false)}
                className="w-9 h-9 rounded-full bg-slate-50 border border-slate-100 items-center justify-center"
              >
                <MaterialCommunityIcons name="close" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
              Navigation
            </Text>

            <View className="gap-y-2">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item);
                return (
                  <TouchableOpacity
                    key={item.key}
                    onPress={() => go(item.href)}
                    className={`flex-row items-center gap-x-3 px-3 py-3.5 rounded-2xl border ${
                      active
                        ? 'bg-teal-50 border-teal-200'
                        : 'bg-white border-slate-100'
                    }`}
                  >
                    <MaterialCommunityIcons
                      name={item.icon}
                      size={22}
                      color={active ? '#0D9488' : '#64748B'}
                    />
                    <Text
                      className={`text-sm font-bold flex-1 ${
                        active ? 'text-teal-800' : 'text-slate-700'
                      }`}
                    >
                      {item.label}
                    </Text>
                    {active ? (
                      <View className="w-2 h-2 rounded-full bg-teal-600" />
                    ) : (
                      <MaterialCommunityIcons name="chevron-right" size={18} color="#CBD5E1" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View className="flex-1" />

            <TouchableOpacity
              onPress={() => {
                setOpen(false);
                confirmReceptionistLogout(router);
              }}
              className="flex-row items-center gap-x-3 px-3 py-3.5 rounded-2xl border border-red-100 bg-red-50 mt-4"
            >
              <MaterialCommunityIcons name="logout" size={22} color="#EF4444" />
              <Text className="text-sm font-bold text-red-500">Logout</Text>
            </TouchableOpacity>
          </View>

          <Pressable style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.45)' }} onPress={() => setOpen(false)} />
        </View>
      </Modal>
    </>
  );
}
