import { Stack } from "expo-router";

export default function ReceptionistLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { flex: 1 },
      }}
    />
  );
}