export type DoctorSummary = {
  doctor_id: number;
  user_id: number;
  name: string;
  specialization: string | null;
  experience_years: number | null;
  availability_status: string | null;
};

export type DoctorDetail = DoctorSummary & {
  username: string;
  email: string;
  phone: string | null;
  schedule: Record<string, string>;
};

export type DoctorWrite = {
  name: string;
  username: string;
  email: string;
  phone: string;
  password?: string;
  specialization: string;
  experience_years: number | null;
  schedule: Record<string, string>;
};

export type ReceptionistSummary = {
  receptionist_id: number;
  user_id: number;
  name: string;
  email: string;
  username: string;
  phone: string | null;
};

export type ReceptionistDetail = ReceptionistSummary & {
  created_at: string | null;
};

export type ReceptionistWrite = {
  name: string;
  username: string;
  email: string;
  phone: string;
  password?: string;
};

export type PatientListItem = {
  patient_id: number;
  name: string;
  patient_code: string | null;
  age: number | null;
  phone: string | null;
  department: string | null;
  status: string | null;
  created_at: string | null;
  visit_count: number;
  latest_clinical_summary: string | null;
};

export type PatientHistoryVisit = {
  appointment_id: number;
  scheduled_time: string | null;
  doctor_id: number | null;
  doctor_name: string | null;
  status: string | null;
  queue_token: string | null;
  consultation_id: number | null;
  consultation_status: string | null;
  soap_note: string | null;
  soap_sections: {
    subjective: string | null;
    objective: string | null;
    assessment: string | null;
    plan: string | null;
  } | null;
  clinical_summary: string | null;
};

export type PatientHistory = {
  patient_id: number;
  patient_name: string | null;
  patient_code: string | null;
  visits: PatientHistoryVisit[];
};

export type AppointmentRow = {
  appointment_id: number;
  patient_id?: number;
  doctor_id?: number;
  patient_name: string | null;
  patient_code: string | null;
  doctor_name: string | null;
  status: string | null;
  scheduled_time: string | null;
  queue_token: string | null;
  created_at?: string | null;
  department?: string | null;
  doctor_specialization?: string | null;
};

export type RegisteredPatient = {
  patient_id: number;
  name: string;
  patient_code: string | null;
  department: string | null;
  status: string | null;
  created_at: string | null;
  username: string | null;
  temp_password: string | null;
};

export type DuplicatePatient = {
  patient_id: number;
  patient_code: string | null;
  name: string;
  age?: number | null;
  phone?: string | null;
};

export type PatientRegisterInput = {
  name: string;
  age: number;
  phone: string | null;
  gender: string;
  marital_status: string;
  registered_by: number | null;
  allow_duplicate_phone: boolean;
};

export type RecentPatient = {
  patient_id: number;
  name: string;
  patient_code: string | null;
  department: string | null;
  status: string | null;
  created_at: string | null;
};

export type ReceptionistStats = {
  registered_today: number;
  in_queue: number;
  appointments_today: number;
  avg_wait_minutes: number | null;
};

export type AppointmentCreateInput = {
  patient_id: number;
  doctor_id: number;
  scheduled_time: string;
  status: "waiting" | "scheduled";
};
