import { useEffect, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import LanguageSelect from '@/pages/LanguageSelect'
import Signup from '@/pages/Signup'
import Login from '@/pages/Login'
import FarmerDetails from '@/pages/FarmerDetails'
import CropDetails from '@/pages/CropDetails'
import Dashboard from '@/pages/Dashboard'
import FieldMonitor from '@/pages/FieldMonitor'
import DiseaseDetection from '@/pages/DiseaseDetection'
import WeatherPage from '@/pages/Weather'
import Reports from '@/pages/Reports'
import RescuePlanner from '@/pages/RescuePlanner'
import BudgetManthan from '@/pages/BudgetManthan'
import WhatIfSimulator from '@/pages/WhatIfSimulator'
import Settings from '@/pages/Settings'
import FloatingVoiceAssistant from '@/components/common/FloatingVoiceAssistant'
import { useAuthStore } from '@/store/authStore'

function RequireAuth({ children }: { children: ReactNode }) {
  const { token } = useAuthStore()
  const location = useLocation()
  if (!token) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  return <>{children}</>
}

export default function App() {
  const { hydrateFromServer } = useAuthStore()

  useEffect(() => {
    hydrateFromServer()
  }, [hydrateFromServer])

  return (
    <BrowserRouter>
      <Routes>
        {/* Language & Authentication Pages */}
        <Route path="/language" element={<LanguageSelect />} />
        <Route path="/signup"   element={<Signup />} />
        <Route path="/login"    element={<Login />} />

        {/* Protected Onboarding Forms */}
        <Route
          path="/farmer-details"
          element={
            <RequireAuth>
              <FarmerDetails />
            </RequireAuth>
          }
        />
        <Route
          path="/crop-details"
          element={
            <RequireAuth>
              <CropDetails />
            </RequireAuth>
          }
        />

        {/* Protected Farmer Dashboard & Agricultural Modules */}
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/"          element={<Dashboard />} />
          <Route path="/fields"    element={<FieldMonitor />} />
          <Route path="/detection" element={<DiseaseDetection />} />
          <Route path="/weather"   element={<WeatherPage />} />
          <Route path="/reports"   element={<Reports />} />
          <Route path="/planner"   element={<RescuePlanner />} />
          <Route path="/budget"    element={<BudgetManthan />} />
          <Route path="/simulator" element={<WhatIfSimulator />} />
          <Route path="/settings"  element={<Settings />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <FloatingVoiceAssistant />
    </BrowserRouter>
  )
}
