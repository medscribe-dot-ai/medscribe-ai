export type NavItem = {
  id: string;
  label: string;
  href?: string;
};

export const adminNav: NavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/admin" },
  { id: "doctors", label: "Doctors", href: "/admin/doctors" },
  { id: "receptionists", label: "Receptionists", href: "/admin/receptionists" },
  { id: "patients", label: "Patients", href: "/admin/patients" },
  { id: "profile", label: "Profile", href: "/admin/profile" },
];

export const receptionistNav: NavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/reception" },
  { id: "patients", label: "Patients", href: "/reception/patients" },
  { id: "register", label: "Register", href: "/reception/register" },
  { id: "appointments", label: "Appointments", href: "/reception/appointments" },
  { id: "queue", label: "Queue", href: "/reception/queue" },
];

export const doctorNav: NavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/doctor" },
  { id: "queue", label: "Queue", href: "/doctor/queue" },
  { id: "patients", label: "Patients", href: "/doctor/patients" },
  { id: "profile", label: "Profile", href: "/doctor/profile" },
];
