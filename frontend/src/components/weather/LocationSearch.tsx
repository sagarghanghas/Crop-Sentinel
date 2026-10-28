import { useState, useEffect } from 'react'
import { Search, MapPin, Loader2, X, AlertCircle } from 'lucide-react'
import { weatherApi } from '@/services/cropsentinel'
import { useI18n } from '@/i18n/translations'
import type { GeoLocationResult } from '@/types'
import type { SavedLocation } from '@/store/weatherStore'

interface LocationSearchProps {
  onSelect: (loc: SavedLocation) => void
  onClose: () => void
}

export default function LocationSearch({ onSelect, onClose }: LocationSearchProps) {
  const { language } = useI18n()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeoLocationResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      setError(null)
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await weatherApi.searchLocations(trimmed)
        setResults(res)
      } catch (err: any) {
        const msg =
          err?.response?.data?.detail ||
          err?.message ||
          (language === 'hi'
            ? 'Open-Meteo जियोकोडिंग API से स्थान खोजने में असमर्थ।'
            : 'Unable to search locations from Open-Meteo geocoding API.')
        setError(msg)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 350)

    return () => clearTimeout(timer)
  }, [query, language])

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#14532d]" />
            <h3 className="font-bold text-slate-900 text-base">
              {language === 'hi' ? 'खेत / मौसम स्थान चुनें' : 'Select Farm / Weather Location'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={
                language === 'hi'
                  ? 'कोई भी शहर, गाँव या कृषि क्षेत्र खोजें (जैसे पुणे, करनाल, भोपाल)…'
                  : 'Search any city, town, or agricultural region (e.g. Pune, Karnal, Fresno, Nairobi)…'
              }
              className="input-field pl-10"
              autoFocus
            />
          </div>

          {loading && (
            <div className="flex items-center justify-center py-6 gap-2 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-[#14532d]" />
              <span>
                {language === 'hi'
                  ? 'Open-Meteo जियोकोडिंग API से स्थान खोज रहे हैं…'
                  : 'Querying Open-Meteo Geocoding API…'}
              </span>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && query.trim().length >= 2 && results.length === 0 && (
            <p className="text-center py-6 text-sm text-slate-500">
              {language === 'hi'
                ? `"${query.trim()}" के लिए कोई स्थान नहीं मिला। पास के शहर या जिले का नाम लिखें।`
                : `No matching locations found for "${query.trim()}". Try a nearby city or district name.`}
            </p>
          )}

          {results.length > 0 && (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-64 overflow-y-auto">
              {results.map(item => (
                <button
                  key={`${item.id}-${item.latitude}-${item.longitude}`}
                  onClick={() =>
                    onSelect({
                      name: item.name,
                      lat: item.latitude,
                      lon: item.longitude,
                      country: item.country,
                      admin1: item.admin1 ?? undefined,
                    })
                  }
                  className="w-full text-left px-4 py-3 hover:bg-emerald-50/70 transition-colors flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {item.name}
                      {item.admin1 ? `, ${item.admin1}` : ''}
                    </p>
                    <p className="text-xs text-slate-500">{item.country}</p>
                  </div>
                  <div className="text-right text-[11px] font-mono text-slate-500">
                    <div>Lat {item.latitude.toFixed(3)}</div>
                    <div>Lon {item.longitude.toFixed(3)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <p className="text-[11px] text-slate-400">
            {language === 'hi'
              ? 'लाइव Open-Meteo जियोकोडिंग API द्वारा संचालित। निर्देशांक आपके ब्राउज़र में सहेजे जाते हैं।'
              : 'Powered by live Open-Meteo Geocoding API. Coordinates are saved in your browser preferences.'}
          </p>
        </div>
      </div>
    </div>
  )
}
