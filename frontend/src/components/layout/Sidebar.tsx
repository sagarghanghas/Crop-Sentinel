import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Sprout,
  ScanSearch,
  CloudSun,
  FileBarChart2,
  ClipboardCheck,
  Wallet,
  Sliders,
  Settings,
  ChevronLeft,
  ChevronRight,
  Leaf,
  X,
  UserCheck,
  FileEdit,
  Globe,
  LogOut,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useI18n } from '@/i18n/translations'
import { useAuthStore } from '@/store/authStore'

interface SidebarProps {
  collapsed: boolean
  mobileOpen: boolean
  onToggle: () => void
  onCloseMobile: () => void
}

export const NAV_ITEMS = [
  { to: '/',          key: 'overview' as const,  icon: LayoutDashboard, label: 'Overview',             subtitle: 'Executive crop health & risk summary' },
  { to: '/fields',    key: 'fields' as const,    icon: Sprout,          label: 'Field Monitor',        subtitle: 'Zones, microclimates & stress trends' },
  { to: '/detection', key: 'detection' as const, icon: ScanSearch,      label: 'Disease Detection',    subtitle: 'Root-cause diagnostics & leaf AI' },
  { to: '/weather',   key: 'weather' as const,   icon: CloudSun,        label: 'Weather Intelligence', subtitle: 'Open-Meteo forecasts & stress rules' },
  { to: '/reports',   key: 'reports' as const,   icon: FileBarChart2,   label: 'Reports & History',    subtitle: 'Farm Autopsy, Decision Memory & Ledger' },
  { to: '/planner',   key: 'planner' as const,   icon: ClipboardCheck,  label: 'Rescue Planner',       subtitle: 'Rescue Optimizer & Zero-Budget mode' },
  { to: '/budget',    key: 'budget' as const,    icon: Wallet,          label: 'Budget Manthan',       subtitle: 'Field-level input expense planning' },
  { to: '/simulator', key: 'simulator' as const, icon: Sliders,         label: 'Decision Lab',         subtitle: 'Parallel Universe Farming (3 scenarios)' },
  { to: '/settings',  key: 'settings' as const,  icon: Settings,        label: 'Settings',             subtitle: 'Preferences, units & service health' },
]

export default function Sidebar({ collapsed, mobileOpen, onToggle, onCloseMobile }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { language, t } = useI18n()
  const { logout } = useAuthStore()
  const isHi = language === 'hi'

  const handleLogout = () => {
    logout()
    onCloseMobile()
    navigate('/login')
  }

  const navContent = (
    <>
      {/* Brand Header */}
      <div
        className={clsx(
          'flex items-center justify-between gap-3 px-4 py-5 border-b border-white/10',
          collapsed && 'md:justify-center md:px-2'
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center shadow-sm border border-emerald-400/30">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          {(!collapsed || mobileOpen) && (
            <div>
              <h1 className="text-white font-bold text-base tracking-tight leading-tight">CropSentinel</h1>
              <p className="text-emerald-300/90 text-[10px] font-semibold tracking-wider uppercase">
                {isHi ? 'स्मार्ट कृषि मंच' : 'Smart Agriculture Platform'}
              </p>
            </div>
          )}
        </div>
        {mobileOpen && (
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-2.5 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ to, key, icon: Icon }) => {
          const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
          const localizedLabel = t.nav[key]

          return (
            <NavLink
              key={to}
              to={to}
              onClick={onCloseMobile}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150',
                collapsed && !mobileOpen && 'md:justify-center md:px-2',
                isActive
                  ? 'bg-emerald-700/80 text-white border border-emerald-500/30 shadow-sm'
                  : 'text-emerald-100/80 hover:text-white hover:bg-white/10'
              )}
              title={collapsed ? localizedLabel : undefined}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {(!collapsed || mobileOpen) && <span className="truncate">{localizedLabel}</span>}
            </NavLink>
          )
        })}

        {/* Farmer Onboarding & Profile Shortcuts */}
        <div className="pt-3 mt-3 border-t border-white/10 space-y-1">
          {(!collapsed || mobileOpen) && (
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300/70">
              {isHi ? 'किसान और फसल विवरण' : 'Farmer & Crop Profile'}
            </p>
          )}
          <NavLink
            to="/farmer-details"
            onClick={onCloseMobile}
            className={clsx(
              'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-100/85 hover:text-white hover:bg-white/10 transition-colors',
              collapsed && !mobileOpen && 'md:justify-center md:px-2'
            )}
            title={isHi ? 'किसान विवरण' : 'Farmer Details'}
          >
            <UserCheck className="w-4 h-4 flex-shrink-0 text-emerald-300" />
            {(!collapsed || mobileOpen) && (
              <span className="truncate">{isHi ? 'किसान विवरण (Farm Profile)' : 'Farmer Details'}</span>
            )}
          </NavLink>

          <NavLink
            to="/crop-details"
            onClick={onCloseMobile}
            className={clsx(
              'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-100/85 hover:text-white hover:bg-white/10 transition-colors',
              collapsed && !mobileOpen && 'md:justify-center md:px-2'
            )}
            title={isHi ? 'फसल विवरण' : 'Crop Details'}
          >
            <FileEdit className="w-4 h-4 flex-shrink-0 text-emerald-300" />
            {(!collapsed || mobileOpen) && (
              <span className="truncate">{isHi ? 'फसल विवरण (Crop Details)' : 'Crop Details'}</span>
            )}
          </NavLink>

          <NavLink
            to="/language"
            onClick={onCloseMobile}
            className={clsx(
              'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-100/85 hover:text-white hover:bg-white/10 transition-colors',
              collapsed && !mobileOpen && 'md:justify-center md:px-2'
            )}
            title={isHi ? 'भाषा चुनें' : 'Choose Language'}
          >
            <Globe className="w-4 h-4 flex-shrink-0 text-emerald-300" />
            {(!collapsed || mobileOpen) && (
              <span className="truncate">{isHi ? 'भाषा चुनें (Language)' : 'Choose Language'}</span>
            )}
          </NavLink>
        </div>
      </nav>

      {/* Logout & Collapse Controls */}
      <div className="px-2.5 pb-4 pt-2 border-t border-white/10 space-y-1.5">
        <button
          type="button"
          onClick={handleLogout}
          className={clsx(
            'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-red-200 hover:text-white hover:bg-red-500/20 transition-colors text-xs font-bold cursor-pointer',
            collapsed && !mobileOpen && 'md:justify-center'
          )}
          title={isHi ? 'लॉगआउट करें' : 'Logout'}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {(!collapsed || mobileOpen) && <span>{isHi ? 'लॉगआउट (Logout)' : 'Logout'}</span>}
        </button>

        <button
          onClick={onToggle}
          className={clsx(
            'hidden md:flex w-full items-center gap-2 px-3 py-2 rounded-xl text-emerald-200/80',
            'hover:text-white hover:bg-white/10 transition-colors text-xs font-medium',
            collapsed && 'justify-center'
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>{t.collapseSidebar}</span>
            </>
          )}
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/50 z-40 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={clsx(
          'fixed left-0 top-0 h-full z-50 flex flex-col bg-[#0f3d20] text-white transition-all duration-200',
          collapsed ? 'md:w-16' : 'md:w-64',
          mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'
        )}
      >
        {navContent}
      </aside>
    </>
  )
}
