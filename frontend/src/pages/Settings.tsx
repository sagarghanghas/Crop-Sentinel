import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  MapPin,
  Database,
  Cpu,
  CloudSun,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'
import { healthApi } from '@/services/cropsentinel'
import { useWeatherStore } from '@/store/weatherStore'
import { useI18n } from '@/i18n/translations'
import LocationSearch from '@/components/weather/LocationSearch'

export default function Settings() {
  const {
    language,
    setLanguage,
    location,
    setLocation,
    preferredAreaUnit,
    setPreferredAreaUnit,
    currencySymbol,
    setCurrencySymbol,
    compactTables,
    setCompactTables,
  } = useWeatherStore()
  const { t } = useI18n()

  const [locModalOpen, setLocModalOpen] = useState(false)

  const healthQuery = useQuery({
    queryKey: ['system-health'],
    queryFn: healthApi.getStatus,
  })

  const health = healthQuery.data

  return (
    <div className="space-y-6 max-w-4xl">
      {/* 1. User Preferences */}
      <div className="surface-card p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Sliders className="w-5 h-5 text-[#14532d]" />
          <div>
            <h3 className="section-title">{t.settings.prefsTitle}</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-xl bg-[#f7f9f6] border border-slate-200 space-y-2">
            <label className="label-text">{t.languageLabel}</label>
            <select
              value={language}
              onChange={e => setLanguage(e.target.value as 'en' | 'hi')}
              className="input-field py-2 text-xs font-bold"
            >
              <option value="en">English (en-IN)</option>
              <option value="hi">हिन्दी (hi-IN)</option>
            </select>
          </div>

          <div className="p-3.5 rounded-xl bg-[#f7f9f6] border border-slate-200 flex flex-col justify-between">
            <div>
              <span className="label-text">{t.selectLocation}</span>
              <p className="text-sm font-bold text-slate-900">
                {location ? `${location.name}${location.country ? `, ${location.country}` : ''}` : 'Not selected'}
              </p>
            </div>
            <button
              onClick={() => setLocModalOpen(true)}
              className="btn-secondary text-xs py-1.5 px-3 mt-3 w-fit"
            >
              <MapPin className="w-3.5 h-3.5" /> {location ? t.changeLocation : t.selectLocation}
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-[#f7f9f6] border border-slate-200 space-y-2">
            <label className="label-text">Area Unit</label>
            <select
              value={preferredAreaUnit}
              onChange={e => setPreferredAreaUnit(e.target.value as 'hectares' | 'acres')}
              className="input-field py-2 text-xs"
            >
              <option value="hectares">Hectares (ha)</option>
              <option value="acres">Acres (ac)</option>
            </select>
          </div>

          <div className="p-3.5 rounded-xl bg-[#f7f9f6] border border-slate-200 space-y-2">
            <label className="label-text">Currency Symbol</label>
            <select
              value={currencySymbol}
              onChange={e => setCurrencySymbol(e.target.value)}
              className="input-field py-2 text-xs"
            >
              <option value="₹">INR (₹)</option>
              <option value="$">USD ($)</option>
              <option value="€">EUR (€)</option>
              <option value="£">GBP (£)</option>
            </select>
            <label className="flex items-center gap-2 text-xs text-slate-700 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={compactTables}
                onChange={e => setCompactTables(e.target.checked)}
              />
              <span>Compact tables</span>
            </label>
          </div>
        </div>
      </div>

      {/* 2. API & Service Connectivity Status */}
      <div className="surface-card p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[#14532d]" />
            <div>
              <h3 className="section-title">{t.settings.serviceHealthTitle}</h3>
            </div>
          </div>
          <button onClick={() => healthQuery.refetch()} className="btn-secondary text-xs py-1.5 px-3">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {health ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl border border-slate-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">SQLite Persistence</span>
                <span className="badge badge-healthy">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </span>
              </div>
              <p className="text-slate-500">All records persist in local SQLite.</p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">Open-Meteo Weather Service</span>
                <span className="badge badge-healthy">Active</span>
              </div>
              <p className="text-slate-500 truncate">{health.weather_api_url}</p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 space-y-1 sm:col-span-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-[#14532d]" /> AI Inference Provider Configuration
                </span>
                {health.ai_configured ? (
                  <span className="badge badge-healthy">API Key Configured</span>
                ) : (
                  <span className="badge badge-watch">
                    <AlertTriangle className="w-3 h-3" /> API Key Not Set
                  </span>
                )}
              </div>
              <p className="text-slate-600">
                Provider: <strong>{health.ai_provider}</strong> · Model ID: <code>{health.ai_model_id}</code>
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {/* 3. Administrator Environment Setup Guide */}
      <div className="surface-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <CloudSun className="w-5 h-5 text-[#14532d]" />
          <h3 className="section-title">{t.settings.adminConfigTitle}</h3>
        </div>
        <pre className="p-3.5 rounded-xl bg-slate-900 text-emerald-300 text-xs font-mono overflow-x-auto">
{`AI_PROVIDER=huggingface
HF_TOKEN=hf_your_token_here
AI_MODEL_ID=linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification
DATABASE_URL=sqlite+aiosqlite:///./cropsentinel.db
FRONTEND_ORIGIN=http://localhost:5173`}
        </pre>
      </div>

      {locModalOpen && (
        <LocationSearch
          onSelect={loc => {
            setLocation(loc)
            setLocModalOpen(false)
          }}
          onClose={() => setLocModalOpen(false)}
        />
      )}
    </div>
  )
}
