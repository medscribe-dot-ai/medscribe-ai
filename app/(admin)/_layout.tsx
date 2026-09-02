import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { Platform, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../src/theme/colors';

export default function AdminLayout() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.mutedText,
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '700',
                    // Label ko thoda aur upar kiya
                    marginBottom: Platform.OS === 'android' ? 12 : 5,
                },
                tabBarStyle: {
                    backgroundColor: 'white',
                    borderTopColor: colors.accent,
                    borderTopWidth: 1,
                    height: Platform.OS === 'ios' ? 60 + insets.bottom : 64 + insets.bottom,
                    paddingTop: 8,
                    paddingBottom: Math.max(insets.bottom, 12),
                    elevation: 30,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -4 },
                    shadowOpacity: 0.1,
                    shadowRadius: 10,
                },
                tabBarItemStyle: {
                    // Content ko center se thoda upar rakha
                    height: 50,
                }
            }}
        >
            <Tabs.Screen
                name="dashboard"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color, focused }) => (
                        <MaterialCommunityIcons
                            name={focused ? "home" : "home-outline"}
                            size={26}
                            color={color}
                        />
                    ),
                }}
            />

            <Tabs.Screen
                name="doctor/index"
                options={{
                    title: 'Doctors',
                    tabBarIcon: ({ color, focused }) => (
                        <MaterialCommunityIcons
                            name={focused ? "account-group" : "account-group-outline"}
                            size={26}
                            color={color}
                        />
                    ),
                }}
            />

            <Tabs.Screen
                name="doctor/add"
                options={{
                    title: 'Add',
                    tabBarLabel: 'Add Doctor',
                    tabBarIcon: ({ color, focused }) => (
                        <MaterialCommunityIcons
                            name={focused ? "account-plus" : "account-plus-outline"}
                            size={26}
                            color={color}
                        />
                    ),
                    tabBarButton: (props) => {
                        // 1. Props ko destructure karein taake unnecessary null values filter ho jayein
                        const { children, onPress, accessibilityState, style, ...rest } = props;

                        return (
                            <TouchableOpacity
                                // accessibilityState aur style ko lazmi pass karein tab bar ki alignment ke liye
                                accessibilityState={accessibilityState}
                                style={style}
                                activeOpacity={0.7}
                                onPress={(e) => {
                                    // Pehle apna custom navigation chalayein
                                    router.push({
                                        pathname: "/(admin)/doctor/add",
                                        params: { editData: null }
                                    });
                                    // Phir tab bar ka default onPress (agar koi hai)
                                    onPress?.(e);
                                }}
                            >
                                {children}
                            </TouchableOpacity>
                        );
                    },
                }}
            />

            <Tabs.Screen
                name="reports"
                options={{
                    title: 'Reports',
                    tabBarIcon: ({ color, focused }) => (
                        <MaterialCommunityIcons
                            name={focused ? "file-chart" : "file-chart-outline"}
                            size={26}
                            color={color}
                        />
                    ),
                }}
            />

            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color, focused }) => (
                        <MaterialCommunityIcons
                            name={focused ? "account-circle" : "account-circle-outline"}
                            size={26}
                            color={color}
                        />
                    ),
                }}
            />

            <Tabs.Screen name="doctor/[id]" options={{ href: null }} />
            <Tabs.Screen name="patients/index" options={{ href: null }} />
            <Tabs.Screen name="patients/[id]" options={{ href: null }} />
            <Tabs.Screen name="receptionist/index" options={{ href: null }} />
            <Tabs.Screen name="receptionist/add" options={{ href: null }} />
            <Tabs.Screen name="receptionist/[id]" options={{ href: null }} />
            <Tabs.Screen name="(receptionist)" options={{ href: null }} />
        </Tabs>
    );
}