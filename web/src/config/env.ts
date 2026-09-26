function readEnv(value: string | undefined): string {
  return value?.trim() ?? "";
}

export const env = {
  apiUrl: readEnv(import.meta.env.VITE_API_URL),
  supabaseUrl: readEnv(import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: readEnv(import.meta.env.VITE_SUPABASE_ANON_KEY),
  clinicTz: readEnv(import.meta.env.VITE_CLINIC_TZ) || "Asia/Karachi",
};
