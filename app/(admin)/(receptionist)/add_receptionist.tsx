import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL } from '../../../src/config/api';
import { colors } from '../../../src/theme/colors';

// React Native's Alert.alert doesn't reliably show a popup on Expo Web —
// it often just console.logs. This fallback guarantees you actually SEE
// errors while testing in the browser, instead of the screen doing nothing.
const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
        window.alert(`${title}\n\n${message}`);
        if (onOk) onOk();
    } else {
        Alert.alert(title, message, onOk ? [{ text: "OK", onPress: onOk }] : undefined);
    }
};

// schemas.py's UserCreate requires `username` with no default — the backend
// will 422 without it. Receptionists log in with email, so we auto-generate
// a username from their email instead of showing an extra field to the admin.
const generateUsername = (name: string, email: string): string => {
    const fromEmail = email.trim().toLowerCase().split('@')[0].replace(/[^a-z0-9_]/g, '');
    if (fromEmail.length >= 3) return fromEmail;
    const fromName = name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    return fromName || `receptionist_${Date.now()}`;
};

const NAME_REGEX = /^[A-Za-z.\s]{3,50}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(\+92|0)[0-9]{10}$/; // e.g. 03001234567 or +923001234567

export default function AddReceptionist() {
    const router = useRouter();
    const [submitting, setSubmitting] = useState<boolean>(false);

    // Form States
    const [fullName, setFullName] = useState<string>('');
    const [email, setEmail] = useState<string>('');
    const [phone, setPhone] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [showPassword, setShowPassword] = useState<boolean>(false);

    // Field-level Validation Error States
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    const validateField = (field: string, value: string) => {
        switch (field) {
            case 'fullName':
                if (!value.trim()) return "Full name is required.";
                if (!NAME_REGEX.test(value.trim())) return "Name must be 3-50 letters only.";
                return '';
            case 'email':
                if (!value.trim()) return "Email address is required.";
                if (!EMAIL_REGEX.test(value.trim())) return "Please enter a valid email format.";
                return '';
            case 'phone':
                if (!value.trim()) return ''; // optional
                if (!PHONE_REGEX.test(value.trim().replace(/[\s-]/g, ''))) {
                    return "Use format 03XXXXXXXXX or +92XXXXXXXXXX.";
                }
                return '';
            case 'password':
                if (!value) return "Temporary password is required.";
                if (value.length < 6) return "Password must be at least 6 characters.";
                return '';
            default:
                return '';
        }
    };

    // Validate All Input Fields
    const validateForm = (): boolean => {
        const tempErrors: { [key: string]: string } = {
            fullName: validateField('fullName', fullName),
            email: validateField('email', email),
            phone: validateField('phone', phone),
            password: validateField('password', password),
        };

        // Drop empty (i.e. passing) entries
        Object.keys(tempErrors).forEach((k) => {
            if (!tempErrors[k]) delete tempErrors[k];
        });

        setErrors(tempErrors);

        const firstError = Object.values(tempErrors)[0];
        if (firstError) {
            showAlert("Please fix the following", firstError);
        }

        return Object.keys(tempErrors).length === 0;
    };

    const handleSave = async (): Promise<void> => {
        if (!validateForm()) return;

        setSubmitting(true);
        try {
            // Matches schemas.ReceptionistCreate: { user_data: UserCreate }
            // username is required by UserCreate with no default, so we
            // auto-generate one. The deployed schema also requires `role`
            // inside user_data (same as add-doctor.tsx does for doctors).
            const payload = {
                user_data: {
                    name: fullName.trim(),
                    email: email.trim().toLowerCase(),
                    username: generateUsername(fullName, email),
                    phone: phone.trim() || null,
                    password: password,
                    role: 'receptionist',
                },
            };

            console.log("Sending payload:", JSON.stringify(payload));

            const response = await fetch(`${API_URL}/admin/add-receptionist`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const responseText = await response.text();
            console.log("Raw response:", responseText);

            let result: any = {};
            try {
                result = JSON.parse(responseText);
            } catch (e) {
                setSubmitting(false);
                showAlert("Error", responseText || "Unexpected server response.");
                return;
            }

            if (response.ok) {
                showAlert("Success 🎉", "Receptionist registered successfully!", () => router.back());
            } else {
                let errorMsg = "Could not save receptionist.";
                if (result.detail) {
                    if (typeof result.detail === 'string') {
                        errorMsg = result.detail;
                    } else if (Array.isArray(result.detail)) {
                        errorMsg = result.detail
                            .map((e: any) => {
                                const field = e.loc ? e.loc.join(' → ') : '';
                                const msg = e.msg || e.message || JSON.stringify(e);
                                return field ? `${field}: ${msg}` : msg;
                            })
                            .join('\n');
                    } else {
                        errorMsg = JSON.stringify(result.detail);
                    }
                }
                showAlert("Failed", errorMsg);
            }
        } catch (error) {
            console.error("Staff Onboarding Error:", error);
            showAlert("Connection Error", "Cannot connect to server. Please check your internet and try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1">
            <StatusBar style="dark" />

            {/* Header Toolbar Component */}
            <View className="flex-row items-center px-6 py-4 border-b border-slate-100">
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.primary} />
                </TouchableOpacity>
                <Text style={{ color: colors.darkText }} className="text-xl font-extrabold flex-1">
                    Add Receptionist
                </Text>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                className="px-6 mt-6"
                contentContainerStyle={{ paddingBottom: 32 }}
            >
                <View className="bg-white rounded-[32px] p-6 border shadow-xs mb-10" style={{ borderColor: colors.accent }}>

                    <Text style={{ color: colors.primary }} className="text-sm font-bold uppercase mb-6 tracking-wide">
                        Personal Credentials
                    </Text>

                    {/* Field 1: Full Name */}
                    <Text style={{ color: colors.darkText }} className="text-xs font-bold mb-2 ml-1">Full Name *</Text>
                    <TextInput
                        className={`p-4 rounded-2xl bg-slate-50 border text-[15px] ${errors.fullName ? 'border-red-500 bg-red-50' : 'border-slate-100'}`}
                        placeholder="e.g. Ali Ahmed"
                        placeholderTextColor="#94A3B8"
                        value={fullName}
                        onChangeText={(text) => {
                            setFullName(text);
                            if (errors.fullName) setErrors(prev => ({ ...prev, fullName: '' }));
                        }}
                        onBlur={() => setErrors(prev => ({ ...prev, fullName: validateField('fullName', fullName) }))}
                    />
                    {!!errors.fullName && <Text className="text-red-500 text-xs ml-1 mb-3 font-semibold">{errors.fullName}</Text>}

                    {/* Field 2: Email */}
                    <Text style={{ color: colors.darkText }} className="text-xs font-bold mb-2 ml-1 mt-2">Email Address *</Text>
                    <TextInput
                        className={`p-4 rounded-2xl bg-slate-50 border text-[15px] ${errors.email ? 'border-red-500 bg-red-50' : 'border-slate-100'}`}
                        placeholder="receptionist@medscribe.com"
                        placeholderTextColor="#94A3B8"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={email}
                        onChangeText={(text) => {
                            setEmail(text);
                            if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                        }}
                        onBlur={() => setErrors(prev => ({ ...prev, email: validateField('email', email) }))}
                    />
                    {!!errors.email && <Text className="text-red-500 text-xs ml-1 mb-3 font-semibold">{errors.email}</Text>}

                    {/* Field 3: Phone */}
                    <Text style={{ color: colors.darkText }} className="text-xs font-bold mb-2 ml-1 mt-2">Phone Number</Text>
                    <TextInput
                        className={`p-4 rounded-2xl bg-slate-50 border text-[15px] ${errors.phone ? 'border-red-500 bg-red-50' : 'border-slate-100'}`}
                        placeholder="03XXXXXXXXX"
                        placeholderTextColor="#94A3B8"
                        keyboardType="phone-pad"
                        value={phone}
                        onChangeText={(text) => {
                            setPhone(text);
                            if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
                        }}
                        onBlur={() => setErrors(prev => ({ ...prev, phone: validateField('phone', phone) }))}
                    />
                    {!!errors.phone && <Text className="text-red-500 text-xs ml-1 mb-3 font-semibold">{errors.phone}</Text>}

                    {/* Field 4: Password */}
                    <Text style={{ color: colors.darkText }} className="text-xs font-bold mb-2 ml-1 mt-2">Temporary Password *</Text>
                    <View className="relative">
                        <TextInput
                            className={`p-4 pr-12 rounded-2xl bg-slate-50 border text-[15px] ${errors.password ? 'border-red-500 bg-red-50' : 'border-slate-100'}`}
                            placeholder="Assign temporary password"
                            placeholderTextColor="#94A3B8"
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            value={password}
                            onChangeText={(text) => {
                                setPassword(text);
                                if (errors.password) setErrors(prev => ({ ...prev, password: '' }));
                            }}
                            onBlur={() => setErrors(prev => ({ ...prev, password: validateField('password', password) }))}
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="absolute right-4 top-4">
                            <MaterialCommunityIcons name={showPassword ? "eye-off" : "eye"} size={20} color={colors.mutedText} />
                        </TouchableOpacity>
                    </View>
                    {!!errors.password && <Text className="text-red-500 text-xs ml-1 mt-1 mb-4 font-semibold">{errors.password}</Text>}

                    {/* Save Button */}
                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={submitting}
                        className="py-4 rounded-2xl flex-row items-center justify-center shadow-sm mt-2"
                        style={{ backgroundColor: colors.primary, opacity: submitting ? 0.7 : 1 }}
                    >
                        {submitting ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <>
                                <MaterialCommunityIcons name="content-save-check-outline" size={20} color="#FFF" />
                                <Text className="text-white font-bold text-base ml-2">Register Receptionist</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}