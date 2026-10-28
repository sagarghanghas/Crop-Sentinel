import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Bell,
  MapPin,
  Menu,
  Settings,
  Wifi,
  WifiOff,
  CheckCircle2,
  Globe,
  User,
  LogOut,
  Sprout,
} from 'lucide-react'
import { healthApi, reportsApi, safeStr } from '@/services/cropsentinel'
import { useWeatherStore } from '@/store/weatherStore'
import { useAuthStore } from '@/store/authStore'
import { useI18n } from '@/i18n/translations'

interface HeaderProps {
  title: string
  subtitle?: string
  onOpenMobileNav: () => void
  onOpenLocationModal: () => void
}

export default function Header({
  title,
  subtitle,
  onOpenMobileNav,
  onOpenLocationModal,
}: HeaderProps) {
  const navigate = useNavigate()
  const { location } = useWeatherStore()
  const { user, farmerProfile, logout } = useAuthStore()
  const { language, setLanguage, t } = useI18n()
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const isHi = language === 'hi'
  const displayFarmerName = safeStr(farmerProfile?.farmer_name || user?.full_name, isHi ? 'किसान' : 'Farmer')

  const healthQuery = useQuery({
    queryKey: ['system-health'],
    queryFn: healthApi.getStatus,
    refetchInterval: 30000,
    retry: 1,
  })

  const summaryQuery = useQuery({
    queryKey: ['reports-summary-header'],
    queryFn: () => reportsApi.getSummary(),
    refetchInterval: 30000,
  })

  const backendOnline = healthQuery.isSuccess && healthQuery.data?.status === 'ok'
  const actions = summaryQuery.data?.recommended_actions ?? []

  return (
    <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex items-center justify-between gap-2 sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileNav}
          className="md:hidden p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h2 className="text-base md:text-lg font-bold text-slate-900 truncate">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 truncate hidden sm:block">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-end">
        {/* Prominent Language Selector (English | हिन्दी) */}
        <div
          role="group"
          aria-label={t.languageLabel}
          className="inline-flex items-center bg-[#f0f5ee] border border-emerald-800/20 rounded-xl p-0.5"
        >
          <Globe className="w-3.5 h-3.5 text-[#14532d] ml-2 mr-1 hidden sm:inline" />
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              language === 'en'
                ? 'bg-[#14532d] text-white shadow-xs'
                : 'text-slate-700 hover:text-[#14532d]'
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLanguage('hi')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              language === 'hi'
                ? 'bg-[#14532d] text-white shadow-xs'
                : 'text-slate-700 hover:text-[#14532d]'
            }`}
          >
            हिन्दी
          </button>
        </div>

        {/* Selected Location Pill */}
        <button
          onClick={onOpenLocationModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-[#14532d]/40 bg-[#f7f9f6] text-xs font-semibold text-slate-700 transition-colors"
          title={t.selectLocation}
        >
          <MapPin className="w-3.5 h-3.5 text-[#14532d] flex-shrink-0" />
          <span className="max-w-[110px] md:max-w-[160px] truncate">
            {location ? `${location.name}${location.country ? `, ${location.country}` : ''}` : t.selectLocation}
          </span>
        </button>

        {/* Backend Status Indicator */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-xs">
          {healthQuery.isLoading ? (
            <span className="text-slate-500">{t.checkingApi}</span>
          ) : backendOnline ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-700" />
              <span className="text-emerald-800 font-semibold">{t.apiConnected}</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-red-600" />
              <span className="text-red-700 font-semibold">{t.apiOffline}</span>
            </>
          )}
        </div>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(o => !o)}
            className="relative p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {actions.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center">
                {actions.length}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-lg p-3 z-50">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {t.activeRecommendations}
                </span>
                <button
                  onClick={() => {
                    setNotifOpen(false)
                    navigate('/planner')
                  }}
                  className="text-xs font-semibold text-[#14532d] hover:underline"
                >
                  {t.openPlanner}
                </button>
              </div>
              {actions.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 flex flex-col items-center gap-1.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>{t.noPendingAlerts}</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {actions.slice(0, 5).map(act => (
                    <div
                      key={act.id}
                      onClick={() => {
                        setNotifOpen(false)
                        navigate('/planner')
                      }}
                      className="p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50/60 cursor-pointer border border-slate-200/70 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-900 line-clamp-1">{act.title}</span>
                        {act.is_demo && <span className="badge badge-demo">DEMO</span>}
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{act.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Settings Button */}
        <button
          onClick={() => navigate('/settings')}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors"
          title={t.settingsBtn}
        >
          <Settings className="w-4 h-4 text-[#14532d]" />
          <span className="hidden lg:inline text-xs font-semibold">{t.settingsBtn}</span>
        </button>

        {/* Farmer Profile & Logout Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen(p => !p)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#14532d] hover:bg-[#15803d] text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <User className="w-3.5 h-3.5 text-emerald-300" />
            <span className="max-w-[100px] truncate">{displayFarmerName}</span>
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-60 bg-white border border-slate-200 rounded-2xl shadow-xl p-2.5 z-50 space-y-1">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-900 truncate">{displayFarmerName}</p>
                {user?.email && (
                  <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false)
                  navigate('/farmer-details')
                }}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-emerald-50 text-xs font-semibold text-slate-700 flex items-center gap-2"
              >
                <User className="w-3.5 h-3.5 text-[#14532d]" />
                {isHi ? 'किसान विवरण (Farmer Details)' : 'Farmer Details'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false)
                  navigate('/crop-details')
                }}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-emerald-50 text-xs font-semibold text-slate-700 flex items-center gap-2"
              >
                <Sprout className="w-3.5 h-3.5 text-[#14532d]" />
                {isHi ? 'फसल विवरण (Crop Details)' : 'Crop Details'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false)
                  navigate('/language')
                }}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-emerald-50 text-xs font-semibold text-slate-700 flex items-center gap-2"
              >
                <Globe className="w-3.5 h-3.5 text-[#14532d]" />
                {isHi ? 'भाषा बदलें (Change Language)' : 'Change Language'}
              </button>

              <div className="pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false)
                    logout()
                    navigate('/login')
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-red-50 text-xs font-bold text-red-600 flex items-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {isHi ? 'लॉगआउट करें (Logout)' : 'Logout'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
