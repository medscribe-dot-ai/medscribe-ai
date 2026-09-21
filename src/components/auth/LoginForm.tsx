import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_URL } from '../../config/api';
import { colors } from '../../theme/colors';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_@.\-]{3,100}$/;
const MIN_PASSWORD_LENGTH = 6;

function getLoginErrorMessage(error: unknown): string {
  const err = error as {
    response?: { status?: number; data?: { detail?: unknown; message?: unknown } };
    message?: string;
  };
  const status = err?.response?.status;
  const data = err?.response?.data;

  if (status === 401 || status === 403) {
    const detail = data?.detail;
    const message = data?.message;
    if (typeof detail === 'string' && detail.trim()) return detail.trim();
    if (typeof message === 'string' && message.trim()) return message.trim();
    return 'Invalid email or password.';
  }

  if (!err?.response) {
    return 'Unable to reach the server. Check your connection and try again.';
  }

  return 'Unable to sign in. Please try again.';
}

const LoginForm = () => {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState('checking');
    // checking | ready | offline
  const loginInFlightRef = useRef(false);

  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});

  // Wake up Render server when login screen opens (retry for cold starts)
  useEffect(() => {
    let cancelled = false;

    const checkServer = async () => {
      setServerStatus('checking');

      const maxAttempts = 4;
      const delayMs = 2500;
      const timeoutMs = 15000;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (cancelled) return;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const res = await fetch(`${API_URL}/doctors`, { signal: controller.signal });
          clearTimeout(timer);
          console.log('[health]', attempt, API_URL, res.status, res.ok);
          if (res.ok) {
            if (!cancelled) setServerStatus('ready');
            return;
          }
        } catch (err) {
          clearTimeout(timer);
          console.log('[health] error', attempt, API_URL, err);
        }

        if (attempt < maxAttempts && !cancelled) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }

      if (!cancelled) setServerStatus('offline');
    };

    checkServer();
    return () => {
      cancelled = true;
    };
  }, []);

  const validate = () => {
    const newErrors: { identifier?: string; password?: string } = {};
    const trimmedIdentifier = identifier.trim();

    if (!trimmedIdentifier) {
      newErrors.identifier = "Email or username is required.";
    } else if (!EMAIL_REGEX.test(trimmedIdentifier) && !USERNAME_REGEX.test(trimmedIdentifier)) {
      newErrors.identifier = "Enter a valid email address or username.";
    }

    if (!password.trim()) {
      newErrors.password = "Password is required.";
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      newErrors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) {
      return;
    }

    if (serverStatus === 'checking') {
      Alert.alert("Please Wait", "Server is starting up, please wait a moment and try again.");
      return;
    }

    if (serverStatus === 'offline') {
      Alert.alert("Server Offline", "Cannot reach the server. Check your internet connection and try again.");
      return;
    }

    if (loginInFlightRef.current) return;
    loginInFlightRef.current = true;
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/login`, {
        email: identifier.trim(),   // backend accepts email OR username in this field
        password: password
      });

      if (response.data.status === "success") {
        const userData = response.data.user;

        await AsyncStorage.setItem('user_data', JSON.stringify(userData));

        const role = userData.role.toLowerCase();

        if (role === 'admin') {
          router.replace('/(admin)/dashboard');
        } else if (role === 'doctor') {
          router.replace('/(doctor)/dashboard');
        } else if (role === 'receptionist') {
          router.replace('/(receptionist)/dashboard');
        } else if (role === 'patient') {
          // TODO: router.replace('/(patient)/dashboard') — route not yet created
          Alert.alert("Login Successful", "Your credentials are valid. The patient portal is currently being set up.");
        } else {
          Alert.alert("Access Denied", "You are not authorized to access this portal.");
        }
      } else {
        // Backend responded with 200 OK but status !== "success"
        // (e.g. { status: "fail", message: "Invalid credentials" })
        const failRaw = response.data.message || response.data.detail;
        const failMessage =
          typeof failRaw === 'string' && failRaw.trim()
            ? failRaw.trim()
            : "Invalid email or password.";
        Alert.alert("Login Failed", failMessage);
      }
    } catch (error: unknown) {
      // Log the raw error so we can see exactly what the backend sends back
      const err = error as { response?: { status?: number; data?: unknown } };
      console.log("Login error status:", err.response?.status);
      console.log("Login error data:", JSON.stringify(err.response?.data, null, 2));

      Alert.alert("Login Failed", getLoginErrorMessage(error));
    } finally {
      loginInFlightRef.current = false;
      setLoading(false);
    }
  };

  return (
    <View className="w-full gap-y-4">

      {/* Server Status Banner */}
      {serverStatus === 'checking' && (
        <View className="bg-orange-50 border border-orange-200 rounded-2xl p-3 flex-row items-center gap-x-2">
          <ActivityIndicator size="small" color="#F97316" />
          <Text className="text-orange-500 text-xs font-semibold">
            Connecting to the server...
          </Text>
        </View>
      )}

      {serverStatus === 'ready' && (
        <View className="bg-green-50 border border-green-200 rounded-2xl p-3 flex-row items-center gap-x-2">
          <MaterialCommunityIcons name="check-circle" size={16} color="#22C55E" />
          <Text className="text-green-500 text-xs font-semibold">
            Connected successfully.
          </Text>
        </View>
      )}

      {serverStatus === 'offline' && (
        <View className="bg-red-50 border border-red-200 rounded-2xl p-3 flex-row items-center gap-x-2">
          <MaterialCommunityIcons name="wifi-off" size={16} color="#EF4444" />
          <Text className="text-red-500 text-xs font-semibold">
            Server offline. Check internet connection.
          </Text>
        </View>
      )}

      {/* Email / Username Input */}
      <View>
        <View className="relative">
          <TextInput
            placeholder="Email or Username"
            placeholderTextColor={colors.mutedText}
            value={identifier}
            onChangeText={(val) => {
              setIdentifier(val);
              if (errors.identifier) setErrors((prev) => ({ ...prev, identifier: undefined }));
            }}
            style={{ borderColor: errors.identifier ? '#EF4444' : colors.accent, color: colors.darkText }}
            className="bg-white p-4 pl-12 rounded-2xl border"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="default"
          />
          <View className="absolute left-4 top-4">
            <MaterialCommunityIcons name="account-outline" size={20} color={colors.mutedText} />
          </View>
        </View>
        {errors.identifier && (
          <Text className="text-red-500 text-xs mt-1 ml-1">{errors.identifier}</Text>
        )}
      </View>

      {/* Password Input */}
      <View>
        <View className="relative">
          <TextInput
            placeholder="Password"
            placeholderTextColor={colors.mutedText}
            value={password}
            onChangeText={(val) => {
              setPassword(val);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            secureTextEntry={!showPassword}
            style={{ borderColor: errors.password ? '#EF4444' : colors.accent, color: colors.darkText }}
            className="bg-white p-4 pl-12 rounded-2xl border"
          />
          <View className="absolute left-4 top-4">
            <MaterialCommunityIcons name="lock-outline" size={20} color={colors.mutedText} />
          </View>
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-4"
          >
            <MaterialCommunityIcons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={20} color={colors.mutedText}
            />
          </TouchableOpacity>
        </View>
        {errors.password && (
          <Text className="text-red-500 text-xs mt-1 ml-1">{errors.password}</Text>
        )}
      </View>

      {/* Sign In Button */}
      <TouchableOpacity
        onPress={handleLogin}
        disabled={loading || serverStatus === 'checking' || serverStatus === 'offline'}
        style={{
          backgroundColor:
            serverStatus === 'checking' || serverStatus === 'offline'
              ? colors.mutedText
              : colors.primary,
        }}
        className="w-full h-[58px] rounded-2xl items-center justify-center shadow-md mt-2 active:opacity-90"
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white text-lg font-bold">
            {serverStatus === 'checking' ? 'Connecting...' : 'Sign In'}
          </Text>
        )}
      </TouchableOpacity>

    </View>
  );
};

export default LoginForm;