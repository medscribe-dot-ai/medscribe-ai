import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, SafeAreaView, Dimensions, ActivityIndicator, Alert, Modal } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../../src/config/api';

const { height: screenHeight } = Dimensions.get('window');

const RegisterPatient = () => {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('Male');
  const [maritalStatus, setMaritalStatus] = useState('Single');

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [submitting, setSubmitting] = useState(false);

  // Success modal state
  const [showSuccess, setShowSuccess] = useState(false);
  const [registeredPatient, setRegisteredPatient] = useState<{
    patient_id: number;
    name: string;
    patient_code: string;
    username: string;
    temp_password: string;
  } | null>(null);

  const validate = () => {
    const newErrors: { [key: string]: string } = {};

    if (!fullName.trim() || fullName.trim().length < 3) {
      newErrors.fullName = "Enter the patient's full name (min 3 characters).";
    }
    if (!age.trim() || isNaN(Number(age)) || Number(age) <= 0 || Number(age) > 120) {
      newErrors.age = "Enter a valid age.";
    }
    if (phone.trim() && !/^[0-9+\-\s]{7,15}$/.test(phone.trim())) {
      newErrors.phone = "Enter a valid phone number.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setFullName('');
    setAge('');
    setPhone('');
    setGender('Male');
    setMaritalStatus('Single');
    setErrors({});
  };

  const handleSubmit = async () => {
    if (!validate()) {
      Alert.alert("Missing Information", "Please fix the highlighted fields.");
      return;
    }

    setSubmitting(true);
    try {
      const userDataRaw = await AsyncStorage.getItem('user_data');
      const userData = userDataRaw ? JSON.parse(userDataRaw) : null;
      const receptionistId = userData?.receptionist_id ?? null;

      const response = await axios.post(`${API_URL}/receptionist/register-patient`, {
        name: fullName.trim(),
        age: Number(age),
        phone: phone.trim() || null,
        gender,
        marital_status: maritalStatus,
        registered_by: receptionistId,
      });

      setSubmitting(false);
      setRegisteredPatient({
        patient_id: response.data.patient_id,
        name: response.data.name,
        patient_code: response.data.patient_code,
        username: response.data.username,
        temp_password: response.data.temp_password,
      });
      setShowSuccess(true);
    } catch (error: any) {
      setSubmitting(false);
      const errorDetail = error.response?.data?.detail || "Could not register patient. Please try again.";
      Alert.alert("Registration Failed", errorDetail);
      console.error("Register patient error:", error.response?.data || error.message);
    }
  };

  const handleRegisterAnother = () => {
    setShowSuccess(false);
    setRegisteredPatient(null);
    resetForm();
  };

  const handleGoToDashboard = () => {
    setShowSuccess(false);
    setRegisteredPatient(null);
    router.replace('/(receptionist)/dashboard');
  };

  return (
    <SafeAreaView style={{ flex: 1, height: screenHeight }} className="bg-white">
      <ScrollView 
        nestedScrollEnabled={true}
        showsVerticalScrollIndicator={true} 
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 160 }}
        style={{ flex: 1 }}
      >
        {/* HEADER SECTION */}
        <View className="px-6 pt-6 pb-4 bg-white flex-row justify-between items-start">
          <View>
            <View className="flex-row items-center gap-x-2">
              <Text className="text-lg font-bold text-slate-900">MedScribe AI</Text>
              <View className="bg-purple-100 px-2.5 py-0.5 rounded-full">
                <Text className="text-[10px] font-bold text-purple-600">Receptionist</Text>
              </View>
            </View>
          </View>

          <View className="flex-row items-center gap-x-3">
            <TouchableOpacity className="p-2 bg-slate-50 rounded-full relative border border-slate-100">
              <MaterialCommunityIcons name="bell-outline" size={20} color="#64748B" />
              <View className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white" />
            </TouchableOpacity>
            <View className="w-10 h-10 bg-teal-50 rounded-full items-center justify-center border border-teal-100">
              <Text className="text-sm font-bold text-teal-600">AH</Text>
            </View>
          </View>
        </View>

        {/* TITLE BAR */}
        <View className="px-6 mt-4 flex-row justify-between items-center">
          <View>
            <Text className="text-2xl font-black text-slate-900">Register Patient</Text>
            <View className="h-1 bg-teal-600 w-28 mt-1 rounded-full" />
          </View>
        </View>

        {/* FORM CONTAINER */}
        <View className="mx-6 mt-6 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
          <View className="flex-row items-center gap-x-2 mb-6">
            <MaterialCommunityIcons name="account-outline" size={20} color="#0D9488" />
            <Text className="text-base font-bold text-slate-800">Patient Information</Text>
          </View>

          <View className="mb-1">
            <Text className="text-xs font-bold text-slate-700 mb-2">Full Name *</Text>
            <TextInput
              placeholder="Enter patient name"
              placeholderTextColor="#94A3B8"
              value={fullName}
              onChangeText={(val) => { setFullName(val); if (errors.fullName) setErrors((p) => ({ ...p, fullName: '' })); }}
              className="w-full bg-slate-50/50 border border-slate-200 p-3.5 rounded-2xl text-slate-800 text-sm"
              style={{ borderColor: errors.fullName ? '#EF4444' : undefined }}
            />
            {errors.fullName && <Text className="text-red-500 text-xs mt-1">{errors.fullName}</Text>}
          </View>

          <View className="flex-row justify-between mb-1 mt-4">
            <View className="w-[47%]">
              <Text className="text-xs font-bold text-slate-700 mb-2">Age *</Text>
              <TextInput
                placeholder="Years"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={age}
                onChangeText={(val) => { setAge(val); if (errors.age) setErrors((p) => ({ ...p, age: '' })); }}
                className="w-full bg-slate-50/50 border border-slate-200 p-3.5 rounded-2xl text-slate-800 text-sm"
                style={{ borderColor: errors.age ? '#EF4444' : undefined }}
              />
              {errors.age && <Text className="text-red-500 text-xs mt-1">{errors.age}</Text>}
            </View>
            <View className="w-[47%]">
              <Text className="text-xs font-bold text-slate-700 mb-2">Phone</Text>
              <TextInput
                placeholder="03XX-XXXXXXX"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={(val) => { setPhone(val); if (errors.phone) setErrors((p) => ({ ...p, phone: '' })); }}
                className="w-full bg-slate-50/50 border border-slate-200 p-3.5 rounded-2xl text-slate-800 text-sm"
                style={{ borderColor: errors.phone ? '#EF4444' : undefined }}
              />
              {errors.phone && <Text className="text-red-500 text-xs mt-1">{errors.phone}</Text>}
            </View>
          </View>

          <View className="mb-5 mt-4">
            <Text className="text-xs font-bold text-slate-700 mb-2.5">Gender *</Text>
            <View className="flex-row gap-x-6">
              {['Male', 'Female', 'Other'].map((item) => (
                <TouchableOpacity key={item} onPress={() => setGender(item)} className="flex-row items-center gap-x-2">
                  <MaterialCommunityIcons name={gender === item ? "radiobox-marked" : "radiobox-blank"} size={20} color={gender === item ? "#0D9488" : "#94A3B8"} />
                  <Text className="text-sm font-medium text-slate-700">{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View className="mb-1">
            <Text className="text-xs font-bold text-slate-700 mb-2.5">Marital Status</Text>
            <View className="flex-row gap-x-6">
              {['Single', 'Married'].map((item) => (
                <TouchableOpacity key={item} onPress={() => setMaritalStatus(item)} className="flex-row items-center gap-x-2">
                  <MaterialCommunityIcons name={maritalStatus === item ? "radiobox-marked" : "radiobox-blank"} size={20} color={maritalStatus === item ? "#0D9488" : "#94A3B8"} />
                  <Text className="text-sm font-medium text-slate-700">{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            className="w-full bg-teal-600 p-4 rounded-2xl flex-row justify-center items-center gap-x-2 active:opacity-90 mt-5"
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text className="text-white font-bold text-base">Register Patient</Text>
                <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* SUCCESS MODAL WITH TOKEN */}
      <Modal
        visible={showSuccess}
        transparent
        animationType="fade"
        onRequestClose={handleGoToDashboard}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)' }} className="items-center justify-center px-8">
          <View className="w-full bg-white rounded-3xl p-7 items-center shadow-lg">

            {/* PRINT BUTTON — TOP RIGHT */}
            <TouchableOpacity
              className="absolute top-4 right-4 w-9 h-9 bg-slate-50 border border-slate-200 rounded-full items-center justify-center z-10"
            >
              <MaterialCommunityIcons name="printer-outline" size={18} color="#475569" />
            </TouchableOpacity>

            <View className="w-16 h-16 bg-emerald-50 rounded-full items-center justify-center mb-4">
              <MaterialCommunityIcons name="check-circle" size={36} color="#10B981" />
            </View>

            <Text className="text-lg font-black text-slate-900 text-center">Patient Registered</Text>
            <Text className="text-sm text-slate-500 text-center mt-1">
              {registeredPatient?.name} is registered. Next: book their appointment.
            </Text>

            {/* PATIENT CODE */}
            <View className="mt-6 items-center">
              <Text className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Patient Code
              </Text>
              <View className="bg-teal-50 border-2 border-dashed border-teal-200 px-6 py-3 rounded-2xl mt-2">
                <Text className="text-2xl font-black text-teal-700 tracking-wider">
                  {registeredPatient?.patient_code}
                </Text>
              </View>
            </View>

            {/* FEE TEXT */}
            <Text className="text-sm font-semibold text-slate-600 mt-4">
              Consultation Fee: <Text className="font-bold text-slate-900">PKR 1000</Text>
            </Text>

            {/* LOGIN CREDENTIALS */}
            {registeredPatient?.username ? (
              <View className="w-full mt-5 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <View className="flex-row items-center gap-x-2 mb-3">
                  <MaterialCommunityIcons name="key-outline" size={16} color="#0D9488" />
                  <Text className="text-xs font-bold text-slate-700 uppercase tracking-widest">Patient Login Credentials</Text>
                </View>
                <View className="mb-2">
                  <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Username</Text>
                  <View className="bg-white border border-slate-200 px-3 py-2 rounded-xl">
                    <Text className="text-sm font-mono font-bold text-slate-800" selectable>{registeredPatient.username}</Text>
                  </View>
                </View>
                <View>
                  <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Temporary Password</Text>
                  <View className="bg-white border border-slate-200 px-3 py-2 rounded-xl">
                    <Text className="text-sm font-mono font-bold text-teal-700" selectable>{registeredPatient.temp_password}</Text>
                  </View>
                </View>
                <Text className="text-[10px] text-slate-400 mt-2 text-center">Share these credentials with the patient. They can log in and change their password.</Text>
              </View>
            ) : null}

            {/* ACTIONS */}
            <View className="w-full gap-y-3 mt-7">
              <TouchableOpacity
                onPress={() => {
                  if (!registeredPatient?.patient_id) return;
                  setShowSuccess(false);
                  router.push({
                    pathname: '/(receptionist)/book-appointment',
                    params: {
                      patient_id: String(registeredPatient.patient_id),
                      name: registeredPatient.name,
                      patient_code: registeredPatient.patient_code,
                    },
                  });
                }}
                className="w-full bg-teal-600 p-4 rounded-2xl items-center flex-row justify-center gap-x-2"
              >
                <MaterialCommunityIcons name="calendar-plus" size={18} color="#FFFFFF" />
                <Text className="text-white font-bold text-sm">Book Appointment</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleRegisterAnother}
                className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl items-center flex-row justify-center gap-x-2"
              >
                <MaterialCommunityIcons name="account-plus-outline" size={18} color="#475569" />
                <Text className="text-slate-700 font-bold text-sm">Register Another</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleGoToDashboard}
                className="w-full bg-white border border-slate-200 p-4 rounded-2xl items-center flex-row justify-center gap-x-2"
              >
                <MaterialCommunityIcons name="view-dashboard-outline" size={18} color="#475569" />
                <Text className="text-slate-700 font-bold text-sm">Go to Dashboard</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* FIXED BOTTOM NAVIGATION BAR */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} className="bg-white border-t border-slate-100 py-3 flex-row justify-around items-center shadow-lg">
        <TouchableOpacity onPress={() => router.push('/(receptionist)/dashboard')} className="items-center justify-center p-2">
          <MaterialCommunityIcons name="view-dashboard-outline" size={22} color="#94A3B8" />
        </TouchableOpacity>
        
        <TouchableOpacity className="items-center justify-center">
          <View className="bg-teal-600 px-4 py-2 rounded-xl flex-row items-center gap-x-1.5">
            <MaterialCommunityIcons name="account-plus" size={18} color="#FFFFFF" />
            <Text className="text-white text-xs font-bold">Register</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(receptionist)/patients')} className="items-center justify-center p-2">
          <MaterialCommunityIcons name="account-group-outline" size={22} color="#94A3B8" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(receptionist)/settings')} className="items-center justify-center p-2">
          <MaterialCommunityIcons name="cog-outline" size={22} color="#94A3B8" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default RegisterPatient;