export function roleHome(role: string): string | null {
  if (role === "admin") {
    return "/admin";
  }
  if (role === "receptionist") {
    return "/reception";
  }
  if (role === "doctor") {
    return "/doctor";
  }
  return null;
}
