import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar, { NAV_ITEMS } from './Sidebar'
import Header from './Header'
import LocationSearch from '@/components/weather/LocationSearch'
import VoiceAssistantBar from '@/components/common/VoiceAssistantBar'
import { useWeatherStore } from '@/store/weatherStore'
import { useI18n } from '@/i18n/translations'
import { clsx } from 'clsx'

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const { setLocation } = useWeatherStore()
  const { t } = useI18n()
  const routerLocation = useLocation()

  const currentNav =
    NAV_ITEMS.find(item =>
      item.to === '/' ? routerLocation.pathname === '/' : routerLocation.pathname.startsWith(item.to)
    ) ?? NAV_ITEMS[0]

  const subKey = `${currentNav.key}Sub` as keyof typeof t.nav

  return (
    <div className="min-h-screen flex bg-[#f7f9f6]">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggle={() => setCollapsed(c => !c)}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div
        className={clsx(
          'flex-1 flex flex-col min-w-0 transition-all duration-200',
          collapsed ? 'md:ml-16' : 'md:ml-64'
        )}
      >
        <Header
          title={t.nav[currentNav.key]}
          subtitle={t.nav[subKey]}
          onOpenMobileNav={() => setMobileOpen(true)}
          onOpenLocationModal={() => setLocationModalOpen(true)}
        />

        <main className="flex-1 p-3 sm:p-4 md:p-6 max-w-7xl w-full mx-auto">
          <VoiceAssistantBar />
          <Outlet context={{ openLocationModal: () => setLocationModalOpen(true) }} />
        </main>
      </div>

      {locationModalOpen && (
        <LocationSearch
          onSelect={loc => {
            setLocation(loc)
            setLocationModalOpen(false)
          }}
          onClose={() => setLocationModalOpen(false)}
        />
      )}
    </div>
  )
}
