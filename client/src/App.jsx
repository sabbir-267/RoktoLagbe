import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import FindDonors from "./pages/FindDonors";
import BloodRequests from "./pages/BloodRequests";
import NewRequest from "./pages/NewRequest";
import RequestDetail from "./pages/RequestDetail";
import BloodBanks from "./pages/BloodBanks";
import BloodBankDetail from "./pages/BloodBankDetail";
import ManageStock from "./pages/ManageStock";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ResetPasswordEmail from "./pages/ResetPasswordEmail";
import VerifyEmail from "./pages/VerifyEmail";
import AddPhone from "./pages/AddPhone";
import Dashboard from "./pages/Dashboard";
import DonorProfile from "./pages/DonorProfile";
import Notifications from "./pages/Notifications";
import NotFound from "./pages/NotFound";
import Eligibility from "./pages/Eligibility";
import Settings from "./pages/Settings";
import Messages from "./pages/Messages";
import Leaderboard from "./pages/Leaderboard";
import Complaints from "./pages/Complaints";
import DoctorsHome from "./pages/doctors/DoctorsHome";
import AskDoctor from "./pages/doctors/AskDoctor";
import DoctorJoin from "./pages/doctors/DoctorJoin";
import MyConsultations from "./pages/doctors/MyConsultations";
import ConsultationDetail from "./pages/doctors/ConsultationDetail";
import DoctorPortal from "./pages/doctors/DoctorPortal";
import AdminPortal from "./pages/admin/AdminPortal";
import BankPortal from "./pages/bank/BankPortal";
import BankApply from "./pages/bank/BankApply";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/donors" element={<FindDonors />} />
        <Route path="/requests" element={<BloodRequests />} />
        <Route
          path="/requests/new"
          element={
            <ProtectedRoute>
              <NewRequest />
            </ProtectedRoute>
          }
        />
        <Route path="/requests/:id" element={<RequestDetail />} />
        <Route path="/blood-banks" element={<BloodBanks />} />
        <Route path="/blood-banks/:id" element={<BloodBankDetail />} />
        <Route
          path="/blood-banks/:id/manage"
          element={
            <ProtectedRoute roles={["bank_staff", "admin"]}>
              <ManageStock />
            </ProtectedRoute>
          }
        />
        <Route path="/eligibility" element={<Eligibility />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/complaints" element={<Complaints />} />
        <Route path="/doctors" element={<DoctorsHome />} />
        <Route path="/doctors/ask" element={<ProtectedRoute><AskDoctor /></ProtectedRoute>} />
        <Route path="/doctors/join" element={<ProtectedRoute><DoctorJoin /></ProtectedRoute>} />
        <Route path="/consultations" element={<ProtectedRoute><MyConsultations /></ProtectedRoute>} />
        <Route path="/consultations/:id" element={<ProtectedRoute><ConsultationDetail /></ProtectedRoute>} />
        <Route path="/doctor-portal" element={<ProtectedRoute roles={["doctor"]}><DoctorPortal /></ProtectedRoute>} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/reset-password/:token" element={<ResetPasswordEmail />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route
          path="/add-phone"
          element={
            <ProtectedRoute>
              <AddPhone />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/donor-profile"
          element={
            <ProtectedRoute>
              <DonorProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages/:id?"
          element={
            <ProtectedRoute>
              <Messages />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Notifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminPortal />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bank-portal"
          element={
            <ProtectedRoute roles={["bank_staff"]}>
              <BankPortal />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bank-portal/register"
          element={
            <ProtectedRoute>
              <BankApply />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}