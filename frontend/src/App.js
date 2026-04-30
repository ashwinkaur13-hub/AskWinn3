import React from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import RoleSelect from "@/pages/RoleSelect";
import Dashboard from "@/pages/Dashboard";
import Directory from "@/pages/Directory";
import AgentDetail from "@/pages/AgentDetail";
import NewRFQ from "@/pages/NewRFQ";
import RFQDetail from "@/pages/RFQDetail";
import MyRFQs from "@/pages/MyRFQs";
import AgentProfileEdit from "@/pages/AgentProfileEdit";
import Messages from "@/pages/Messages";
import AdminDashboard from "@/pages/AdminDashboard";

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center font-mono text-sm">Loading…</div>;
  if (!user) return <Navigate to="/" replace />;
  if (user.role === "unassigned") return <Navigate to="/select-role" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
};

function AppRouter() {
  const location = useLocation();
  // Detect OAuth session_id in URL fragment BEFORE rendering routes
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/select-role" element={<RoleSelect />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/directory" element={<Directory />} />
      <Route path="/agents/:agentId" element={<AgentDetail />} />
      <Route path="/rfqs/new" element={<ProtectedRoute roles={["buyer"]}><NewRFQ /></ProtectedRoute>} />
      <Route path="/rfqs" element={<ProtectedRoute><MyRFQs /></ProtectedRoute>} />
      <Route path="/rfqs/:rfqId" element={<ProtectedRoute><RFQDetail /></ProtectedRoute>} />
      <Route path="/profile/edit" element={<ProtectedRoute roles={["agent"]}><AgentProfileEdit /></ProtectedRoute>} />
      <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
      <Route path="/messages/:otherUserId" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute roles={["admin"]}><AdminDashboard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRouter />
        <Toaster position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  );
}
