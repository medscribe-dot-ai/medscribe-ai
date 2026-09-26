import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { RequireAuth, RequireRole } from "./auth/guards";
import { ToastProvider } from "./components/ui/toast-context";
import { AdminLayout } from "./layouts/AdminLayout";
import { DoctorLayout } from "./layouts/DoctorLayout";
import { ReceptionistLayout } from "./layouts/ReceptionistLayout";
import { HomeRedirect } from "./pages/HomeRedirect";
import { LoginPage } from "./pages/LoginPage";
import { DoctorDashboardPage } from "./pages/doctor/DoctorDashboardPage";
import { DoctorHistoryPage } from "./pages/doctor/DoctorHistoryPage";
import { DoctorPatientsPage } from "./pages/doctor/DoctorPatientsPage";
import { DoctorProfilePage } from "./pages/doctor/DoctorProfilePage";
import { DoctorQueuePage } from "./pages/doctor/DoctorQueuePage";
import { DoctorRecordPage } from "./pages/doctor/DoctorRecordPage";
import { DoctorSoapPage } from "./pages/doctor/DoctorSoapPage";
import { ReceptionAppointmentsPage } from "./pages/reception/ReceptionAppointmentsPage";
import { ReceptionBookPage } from "./pages/reception/ReceptionBookPage";
import { ReceptionDashboardPage } from "./pages/reception/ReceptionDashboardPage";
import { ReceptionPatientsPage } from "./pages/reception/ReceptionPatientsPage";
import { ReceptionQueuePage } from "./pages/reception/ReceptionQueuePage";
import { ReceptionRegisterPage } from "./pages/reception/ReceptionRegisterPage";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { AdminProfilePage } from "./pages/admin/AdminProfilePage";
import { DoctorDetailPage } from "./pages/admin/DoctorDetailPage";
import { DoctorFormPage } from "./pages/admin/DoctorFormPage";
import { DoctorsPage } from "./pages/admin/DoctorsPage";
import { PatientDetailPage } from "./pages/admin/PatientDetailPage";
import { PatientsPage } from "./pages/admin/PatientsPage";
import { ReceptionistDetailPage } from "./pages/admin/ReceptionistDetailPage";
import { ReceptionistFormPage } from "./pages/admin/ReceptionistFormPage";
import { ReceptionistsPage } from "./pages/admin/ReceptionistsPage";
import { UnauthorizedPage } from "./pages/UnauthorizedPage";

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<RequireRole roles={["admin"]} />}>
                <Route element={<AdminLayout />}>
                  <Route path="/admin" element={<AdminDashboardPage />} />
                  <Route path="/admin/doctors" element={<DoctorsPage />} />
                  <Route path="/admin/doctors/new" element={<DoctorFormPage />} />
                  <Route path="/admin/doctors/:doctorId" element={<DoctorDetailPage />} />
                  <Route path="/admin/doctors/:doctorId/edit" element={<DoctorFormPage />} />
                  <Route path="/admin/receptionists" element={<ReceptionistsPage />} />
                  <Route path="/admin/receptionists/new" element={<ReceptionistFormPage />} />
                  <Route path="/admin/receptionists/:receptionistId" element={<ReceptionistDetailPage />} />
                  <Route path="/admin/receptionists/:receptionistId/edit" element={<ReceptionistFormPage />} />
                  <Route path="/admin/patients" element={<PatientsPage />} />
                  <Route path="/admin/patients/:patientId" element={<PatientDetailPage />} />
                  <Route path="/admin/profile" element={<AdminProfilePage />} />
                </Route>
              </Route>
              <Route element={<RequireRole roles={["receptionist"]} />}>
                <Route element={<ReceptionistLayout />}>
                  <Route path="/reception" element={<ReceptionDashboardPage />} />
                  <Route path="/reception/patients" element={<ReceptionPatientsPage />} />
                  <Route path="/reception/register" element={<ReceptionRegisterPage />} />
                  <Route path="/reception/book" element={<ReceptionBookPage />} />
                  <Route path="/reception/appointments" element={<ReceptionAppointmentsPage />} />
                  <Route path="/reception/queue" element={<ReceptionQueuePage />} />
                </Route>
              </Route>
              <Route element={<RequireRole roles={["doctor"]} />}>
                <Route element={<DoctorLayout />}>
                  <Route path="/doctor" element={<DoctorDashboardPage />} />
                  <Route path="/doctor/queue" element={<DoctorQueuePage />} />
                  <Route path="/doctor/patients" element={<DoctorPatientsPage />} />
                  <Route path="/doctor/patients/:patientId/history" element={<DoctorHistoryPage />} />
                  <Route path="/doctor/profile" element={<DoctorProfilePage />} />
                  <Route path="/doctor/visits/:appointmentId/record" element={<DoctorRecordPage />} />
                  <Route path="/doctor/consultations/:consultationId/soap" element={<DoctorSoapPage />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
