import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  MapPin,
  Search,
  Thermometer,
  Droplets,
  Wind,
  CloudRain,
  RefreshCw,
  AlertTriangle,
  Loader2,
  ShieldAlert,
  Info,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { weatherApi } from '@/services/cropsentinel'
import { useWeatherStore } from '@/store/weatherStore'
import { useI18n } from '@/i18n/translations'
import SpeakButton from '@/components/common/SpeakButton'
import LocationSearch from '@/components/weather/LocationSearch'

export default function WeatherPage() {
  const { location, setLocation } = useWeatherStore()
  const { t } = useI18n()
  const w = t.weather
  const [searchModalOpen, setSearchModalOpen] = useState(false)

  const forecastQuery = useQuery({
    queryKey: ['weather-forecast', location?.lat, location?.lon],
    queryFn: () => weatherApi.getForecast(location!.lat, location!.lon, location!.name),
    enabled: !!location,
    retry: 1,
  })

  const data = forecastQuery.data

  const hourlyChartData = (data?.hourly ?? []).map(h => ({
    time: new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    temp: h.temperature_c,
    rainProb: h.precipitation_probability_pct,
    humidity: h.relative_humidity_pct,
  }))

  const dailyChartData = (data?.daily ?? []).map(d => ({
    date: d.date.slice(5),
    maxTemp: d.temp_max_c,
    minTemp: d.temp_min_c,
    rainMm: d.precipitation_sum_mm,
    rainProb: d.precipitation_probability_max_pct,
    label: d.weather_label,
  }))

  const totalRain7d = data
    ? data.daily.reduce((s, d) => s + (d.precipitation_sum_mm ?? 0), 0).toFixed(1)
    : '0'

  const weatherSpeechEn = data
    ? `Weather forecast for ${data.location_name}: Current temperature is ${data.current.temperature_c ?? 'unknown'} degrees Celsius, feels like ${data.current.apparent_temperature_c ?? 'unknown'} degrees. Relative humidity is ${data.current.relative_humidity_pct ?? 'unknown'} percent, wind speed is ${data.current.wind_speed_kmh ?? 'unknown'} kilometers per hour, and 7-day forecast rainfall is ${totalRain7d} millimeters. ${data.weather_risks.map(r => `${r.title}: ${r.explanation}`).join(' ')}`
    : 'No weather data available.'

  const weatherSpeechHi = data
    ? `${data.location_name} का मौसम पूर्वानुमान: वर्तमान तापमान ${data.current.temperature_c ?? '—'} डिग्री सेल्सियस है, हवा में नमी ${data.current.relative_humidity_pct ?? '—'} प्रतिशत है, और हवा की गति ${data.current.wind_speed_kmh ?? '—'} किलोमीटर प्रति घंटा है। आगामी 7 दिनों में कुल ${totalRain7d} मिलीमीटर बारिश की संभावना है। प्रमुख चेतावनी: ${data.weather_risks[0]?.title || 'मौसम सामान्य है'}।`
    : 'अभी कोई मौसम डेटा उपलब्ध नहीं है।'

  return (
    <div className="space-y-6">
      {/* Location Selection Bar */}
      <div className="surface-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[#14532d]">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {location
                ? `${location.name}${location.admin1 ? `, ${location.admin1}` : ''}${
                    location.country ? `, ${location.country}` : ''
                  }`
                : w.noLocationTitle}
            </h3>
            {data ? (
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Coordinates: {data.latitude.toFixed(4)}°N, {data.longitude.toFixed(4)}°E · Timezone: {data.timezone} · Open-Meteo Live API
              </p>
            ) : (
              <p className="text-xs text-slate-500 mt-0.5">{w.noLocationSub}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {data && (
            <SpeakButton
              textEn={weatherSpeechEn}
              textHi={weatherSpeechHi}
              labelEn={w.listenWeatherReportBtn}
              labelHi="मौसम सुनें"
            />
          )}
          {location && (
            <button
              onClick={() => forecastQuery.refetch()}
              disabled={forecastQuery.isFetching}
              className="btn-secondary text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${forecastQuery.isFetching ? 'animate-spin' : ''}`} />
              {w.refreshBtn}
            </button>
          )}
          <button onClick={() => setSearchModalOpen(true)} className="btn-primary text-xs">
            <Search className="w-3.5 h-3.5" /> {location ? w.changeLocationBtn : w.searchLocationBtn}
          </button>
        </div>
      </div>

      {/* Empty State when no location selected */}
      {!location && (
        <div className="surface-card p-12 text-center space-y-3">
          <MapPin className="w-10 h-10 text-[#14532d] mx-auto" />
          <h4 className="text-base font-bold text-slate-900">{w.chooseLocationCardTitle}</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">{w.chooseLocationCardDesc}</p>
          <button onClick={() => setSearchModalOpen(true)} className="btn-primary">
            <Search className="w-4 h-4" /> {w.openLocationSearchBtn}
          </button>
        </div>
      )}

      {/* Loading State */}
      {location && forecastQuery.isLoading && (
        <div className="surface-card p-12 flex flex-col items-center justify-center gap-3 text-slate-600">
          <Loader2 className="w-7 h-7 animate-spin text-[#14532d]" />
          <p className="text-sm font-medium">
            {w.loadingForecast} {location.name}…
          </p>
        </div>
      )}

      {/* Honest Error State */}
      {location && forecastQuery.isError && (
        <div className="surface-card p-6 border-red-200 bg-red-50/60 space-y-3">
          <div className="flex items-center gap-2 text-red-800 font-bold text-sm">
            <AlertTriangle className="w-5 h-5" />
            <span>{w.unavailableTitle}</span>
          </div>
          <p className="text-xs text-red-700">
            {(forecastQuery.error as any)?.response?.data?.detail ||
              (forecastQuery.error as any)?.message ||
              'Could not reach Open-Meteo forecast endpoint. CropSentinel never fabricates weather readings when live data fails.'}
          </p>
          <button onClick={() => forecastQuery.refetch()} className="btn-secondary text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> {w.refreshBtn}
          </button>
        </div>
      )}

      {/* Forecast Content */}
      {data && (
        <>
          {/* Current Weather Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="metric-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase">{w.tempCard}</span>
                <Thermometer className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {data.current.temperature_c !== null ? `${data.current.temperature_c}°C` : '—'}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {w.feelsLike} {data.current.apparent_temperature_c ?? '—'}°C · {data.current.weather_label}
              </p>
            </div>

            <div className="metric-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase">{w.humidityCard}</span>
                <Droplets className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {data.current.relative_humidity_pct !== null ? `${data.current.relative_humidity_pct}%` : '—'}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {w.currentPrecip}: {data.current.precipitation_mm ?? 0} mm
              </p>
            </div>

            <div className="metric-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase">{w.windCard}</span>
                <Wind className="w-4 h-4 text-slate-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {data.current.wind_speed_kmh !== null ? `${data.current.wind_speed_kmh} km/h` : '—'}
              </div>
              <p className="text-xs text-slate-500 mt-1">WMO Code: {data.current.weather_code ?? '—'}</p>
            </div>

            <div className="metric-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase">{w.rain7dCard}</span>
                <CloudRain className="w-4 h-4 text-emerald-700" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{totalRain7d} mm</div>
              <p className="text-xs text-slate-500 mt-1">{w.forecastHorizon}</p>
            </div>
          </div>

          {/* Transparent Weather-Risk Rules Section */}
          <div className="surface-card p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="section-title flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[#14532d]" />
                  {w.rulesTitle}
                </h3>
                <p className="text-xs text-slate-500">{w.rulesSub}</p>
              </div>
              <div className="text-[11px] font-mono text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">
                Rain ≥ {data.thresholds_config.high_rain_mm_day}mm/d · Heat ≥ {data.thresholds_config.heat_stress_c}°C · Cold ≤ {data.thresholds_config.cold_stress_c}°C · RH ≥ {data.thresholds_config.high_humidity_pct}%
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.weather_risks.map(rule => (
                <div
                  key={rule.rule_id}
                  className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                    rule.severity === 'high'
                      ? 'bg-red-50/70 border-red-200 text-red-950'
                      : rule.severity === 'watch'
                      ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                      : 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm">{rule.title}</span>
                    <span className="badge badge-info uppercase">{rule.severity}</span>
                  </div>
                  <p className="opacity-90">{rule.explanation}</p>
                  <div className="pt-1.5 text-[11px] opacity-80 flex flex-col gap-0.5 border-t border-black/10">
                    <span><strong>Rule Threshold:</strong> {rule.threshold_used}</span>
                    <span className="flex items-center gap-1">
                      <Info className="w-3 h-3 flex-shrink-0" /> {rule.assumption_note}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 24-Hour Forecast Chart */}
          <div className="chart-container">
            <h3 className="section-title mb-1">{w.hourlyChartTitle}</h3>
            <div className="h-64 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyChartData} margin={{ left: -15, right: 10, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} interval={2} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey="temp"
                    name="Temperature (°C)"
                    stroke="#d97706"
                    fill="#fef3c7"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="rainProb"
                    name="Rain Probability (%)"
                    stroke="#0284c7"
                    fill="#e0f2fe"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 7-Day Daily Table & Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="chart-container">
              <h3 className="section-title mb-4">{w.dailyChartTitle}</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyChartData} margin={{ left: -15, right: 10, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="maxTemp" name="Max °C" fill="#d97706" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="minTemp" name="Min °C" fill="#64748b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="rainMm" name="Rain (mm)" fill="#14532d" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="surface-card p-5 overflow-x-auto">
              <h3 className="section-title mb-4">{w.dailyTableTitle}</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500 uppercase">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Condition</th>
                    <th className="pb-2">Min / Max °C</th>
                    <th className="pb-2">Rain Sum</th>
                    <th className="pb-2">Rain Prob</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.daily.map(d => (
                    <tr key={d.date} className="hover:bg-slate-50">
                      <td className="py-2.5 font-semibold text-slate-900">{d.date}</td>
                      <td className="py-2.5 text-slate-700">{d.weather_label}</td>
                      <td className="py-2.5 text-slate-700">
                        {d.temp_min_c ?? '—'}° / <strong>{d.temp_max_c ?? '—'}°C</strong>
                      </td>
                      <td className="py-2.5 text-slate-700">{d.precipitation_sum_mm ?? 0} mm</td>
                      <td className="py-2.5 text-slate-700">{d.precipitation_probability_max_pct ?? 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {searchModalOpen && (
        <LocationSearch
          onSelect={loc => {
            setLocation(loc)
            setSearchModalOpen(false)
          }}
          onClose={() => setSearchModalOpen(false)}
        />
      )}
    </div>
  )
}
