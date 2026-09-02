import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { colors } from '../../../src/theme/colors';

const FALLBACK_API_URL = 'https://medscribeai-pzqu.onrender.com';

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

const NAME_REGEX = /^[A-Za-z.\s]{3,50}$/;
const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(\+92|0)[0-9]{10}$/;

type Errors = {
    name?: string;
    username?: string;
    email?: string;
    phone?: string;
    password?: string;
};

export default function AddReceptionist() {
    const router = useRouter();
    const { editData } = useLocalSearchParams();
    const isEditMode = !!editData && editData !== 'null';

    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [serverReady, setServerReady] = useState(false);
    const [errors, setErrors] = useState<Errors>({});
    const [editingId, setEditingId] = useState<number | null>(null);

    const [form, setForm] = useState({
        name: '',
        username: '',
        email: '',
        phone: '',
        password: '',
    });

    useEffect(() => {
        const wakeUpServer = async () => {
            try {
                await fetch(`${resolveApiUrl()}/receptionists`);
                setServerReady(true);
            } catch {
                setServerReady(false);
            }
        };
        wakeUpServer();
    }, []);

    useFocusEffect(
        useCallback(() => {
            if (isEditMode) {
                try {
                    const data = JSON.parse(editData as string);
                    setEditingId(data.receptionist_id ?? null);
                    setForm({
                        name: data.name || '',
                        username: data.username || '',
                        email: data.email || '',
                        phone: data.phone || '',
                        password: '',
                    });
                } catch (e) {
                    console.error('Failed to parse editData', e);
                }
            } else {
                setEditingId(null);
                setForm({
                    name: '',
                    username: '',
                    email: '',
                    phone: '',
                    password: '',
                });
            }
            setErrors({});
        }, [editData, isEditMode])
    );

    const validateName = (v: string) => {
        if (!v.trim()) return 'Full name is required.';
        if (!NAME_REGEX.test(v.trim())) return 'Name must be 3-50 letters (no numbers/symbols).';
        return undefined;
    };

    const validateUsername = (v: string) => {
        if (!v.trim()) return 'Username is required.';
        if (!USERNAME_REGEX.test(v.trim())) return '3-20 chars: lowercase letters, numbers, underscore only.';
        return undefined;
    };

    const validateEmail = (v: string) => {
        if (!v.trim()) return 'Email is required.';
        if (!EMAIL_REGEX.test(v.trim())) return 'Enter a valid email address.';
        return undefined;
    };

    const validatePhone = (v: string) => {
        const cleaned = v.trim().replace(/[\s-]/g, '');
        if (!cleaned) return undefined;
        if (!PHONE_REGEX.test(cleaned)) return 'Use format 03XXXXXXXXX or +92XXXXXXXXXX.';
        return undefined;
    };

    const validatePassword = (v: string) => {
        if (!isEditMode) {
            if (!v) return 'Password is required.';
            if (v.length < 6) return 'Password must be at least 6 characters.';
        } else if (v && v.length < 6) {
            return 'Password must be at least 6 characters.';
        }
        return undefined;
    };

    const validateForm = (): boolean => {
        const newErrors: Errors = {
            name: validateName(form.name),
            username: validateUsername(form.username),
            email: validateEmail(form.email),
            phone: validatePhone(form.phone),
            password: validatePassword(form.password),
        };

        setErrors(newErrors);
        const firstError = Object.values(newErrors).find(Boolean);
        if (firstError) {
            Alert.alert('Please fix the following', firstError);
            return false;
        }
        return true;
    };

    const handleRegisterOrUpdate = async () => {
        if (!validateForm()) return;

        setLoading(true);

        try {
            const apiUrl = resolveApiUrl();

            if (isEditMode && editingId) {
                const payload: any = {
                    name: form.name.trim(),
                    username: form.username.trim().toLowerCase(),
                    email: form.email.trim().toLowerCase(),
                    phone: form.phone.trim() || null,
                };
                if (form.password) {
                    payload.password = form.password;
                }

                const response = await fetch(`${apiUrl}/receptionists/${editingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

                const responseText = await response.text();
                let data: any = {};
                try {
                    data = JSON.parse(responseText);
                } catch {
                    setLoading(false);
                    Alert.alert('Error', responseText || 'Unknown error');
                    return;
                }

                setLoading(false);
                if (response.ok) {
                    Alert.alert('Updated!', 'Receptionist updated successfully.', [
                        { text: 'OK', onPress: () => router.replace('/(admin)/receptionist') },
                    ]);
                } else {
                    Alert.alert('Error', typeof data.detail === 'string' ? data.detail : 'Update failed.');
                }
                return;
            }

            const payload = {
                user_data: {
                    name: form.name.trim(),
                    username: form.username.trim().toLowerCase(),
                    email: form.email.trim().toLowerCase(),
                    phone: form.phone.trim() || null,
                    password: form.password,
                    role: 'receptionist',
                },
            };

            const response = await fetch(`${apiUrl}/admin/add-receptionist`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const responseText = await response.text();
            let data: any = {};
            try {
                data = JSON.parse(responseText);
            } catch {
                setLoading(false);
                Alert.alert('Error', responseText || 'Unknown error');
                return;
            }

            setLoading(false);
            if (response.ok) {
                Alert.alert('Success!', 'Receptionist registered successfully!', [
                    { text: 'OK', onPress: () => router.replace('/(admin)/receptionist') },
                ]);
            } else {
                let errorMsg = 'Something went wrong.';
                if (typeof data.detail === 'string') {
                    errorMsg = data.detail;
                } else if (Array.isArray(data.detail)) {
                    errorMsg = data.detail.map((e: any) => e.msg || JSON.stringify(e)).join('\n');
                }
                Alert.alert('Error', errorMsg);
            }
        } catch (error) {
            setLoading(false);
            console.log('Fetch error:', error);
            Alert.alert('Connection Error', 'Cannot connect to server. Please check internet and try again.');
        }
    };

    return (
        <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
                <View className="px-6 py-4 flex-row items-center border-b border-slate-100 bg-white">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4 w-10 h-10 items-center justify-center rounded-full bg-slate-50">
                        <MaterialCommunityIcons name="chevron-left" size={28} color={colors.darkText} />
                    </TouchableOpacity>
                    <View className="flex-1">
                        <Text className="text-xl font-bold">{isEditMode ? 'Edit Receptionist' : 'Register Receptionist'}</Text>
                        {!serverReady && (
                            <Text className="text-xs text-orange-400">Connecting to server...</Text>
                        )}
                        {serverReady && (
                            <Text className="text-xs text-green-500">Server connected</Text>
                        )}
                    </View>
                </View>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    className="px-6 pt-4"
                    contentContainerStyle={{ paddingBottom: 32 }}
                >
                    <View className="bg-white p-6 rounded-[32px] border border-slate-100 gap-y-5">
                        <FormInput
                            label="Full Name"
                            icon="account-circle-outline"
                            placeholder="Ayesha Khan"
                            value={form.name}
                            error={errors.name}
                            onChange={(v: string) => {
                                setForm({ ...form, name: v });
                                if (errors.name) setErrors({ ...errors, name: undefined });
                            }}
                            onBlur={() => setErrors({ ...errors, name: validateName(form.name) })}
                        />

                        <FormInput
                            label="Email"
                            icon="email-outline"
                            placeholder="ayesha@hospital.com"
                            value={form.email}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            error={errors.email}
                            onChange={(v: string) => {
                                setForm({ ...form, email: v });
                                if (errors.email) setErrors({ ...errors, email: undefined });
                            }}
                            onBlur={() => setErrors({ ...errors, email: validateEmail(form.email) })}
                        />

                        <FormInput
                            label="Phone"
                            icon="phone-outline"
                            placeholder="03001234567"
                            value={form.phone}
                            keyboardType="phone-pad"
                            error={errors.phone}
                            onChange={(v: string) => {
                                setForm({ ...form, phone: v });
                                if (errors.phone) setErrors({ ...errors, phone: undefined });
                            }}
                            onBlur={() => setErrors({ ...errors, phone: validatePhone(form.phone) })}
                        />

                        <FormInput
                            label="Login Username"
                            icon="account-outline"
                            placeholder="ayesha_desk"
                            value={form.username}
                            autoCapitalize="none"
                            error={errors.username}
                            onChange={(v: string) => {
                                const cleaned = v.toLowerCase().replace(/[^a-z0-9_]/g, '');
                                setForm({ ...form, username: cleaned });
                                if (errors.username) setErrors({ ...errors, username: undefined });
                            }}
                            onBlur={() => setErrors({ ...errors, username: validateUsername(form.username) })}
                        />

                        <View>
                            <Text className="text-[10px] font-bold mb-2 ml-1 uppercase tracking-widest text-slate-400">
                                {isEditMode ? 'New Password (optional)' : 'Temporary Password'}
                            </Text>
                            <View className="relative">
                                <View className="absolute left-4 top-4 z-10">
                                    <MaterialCommunityIcons name="lock-outline" size={20} color={colors.primary} />
                                </View>
                                <TextInput
                                    value={form.password}
                                    onChangeText={(v) => {
                                        setForm({ ...form, password: v });
                                        if (errors.password) setErrors({ ...errors, password: undefined });
                                    }}
                                    onBlur={() => setErrors({ ...errors, password: validatePassword(form.password) })}
                                    placeholder={isEditMode ? 'Leave blank to keep current' : 'Min 6 characters'}
                                    placeholderTextColor="#CBD5E1"
                                    secureTextEntry={!showPassword}
                                    style={{ borderColor: errors.password ? '#EF4444' : undefined }}
                                    className="bg-slate-50 p-4 pl-12 pr-12 rounded-2xl border border-slate-100 text-slate-800"
                                />
                                <TouchableOpacity
                                    onPress={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-4"
                                >
                                    <MaterialCommunityIcons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.mutedText} />
                                </TouchableOpacity>
                            </View>
                            {!!errors.password && (
                                <Text className="text-[11px] text-red-500 mt-1 ml-1">{errors.password}</Text>
                            )}
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={handleRegisterOrUpdate}
                        disabled={loading}
                        style={{ backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }}
                        className="mt-6 mb-8 h-[56px] rounded-[20px] items-center justify-center"
                    >
                        <Text className="text-white font-bold text-base">
                            {loading ? 'Saving...' : isEditMode ? 'Update Receptionist' : 'Register Receptionist'}
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const FormInput = ({ label, icon, value, onChange, onBlur, placeholder, error, ...props }: any) => (
    <View>
        <Text className="text-[10px] font-bold mb-2 ml-1 uppercase tracking-widest text-slate-400">{label}</Text>
        <View className="relative">
            <TextInput
                value={value}
                onChangeText={(text) => onChange(text)}
                onBlur={onBlur}
                placeholder={placeholder}
                placeholderTextColor="#CBD5E1"
                style={{ borderColor: error ? '#EF4444' : undefined }}
                className="bg-slate-50 p-4 pl-12 rounded-2xl border border-slate-100 text-slate-800"
                {...props}
            />
            <View className="absolute left-4 top-4">
                <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
            </View>
        </View>
        {!!error && (
            <Text className="text-[11px] text-red-500 mt-1 ml-1">{error}</Text>
        )}
    </View>
);
