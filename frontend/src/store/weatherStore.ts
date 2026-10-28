import { create } from 'zustand'

export type AppLanguage = 'en' | 'hi'

export interface SavedLocation {
  name: string
  lat: number
  lon: number
  country?: string
  admin1?: string
}

interface AppPreferencesState {
  language: AppLanguage
  location: SavedLocation | null
  preferredAreaUnit: 'hectares' | 'acres'
  currencySymbol: string
  compactTables: boolean
  setLanguage: (lang: AppLanguage) => void
  setLocation: (loc: SavedLocation | null) => void
  setPreferredAreaUnit: (unit: 'hectares' | 'acres') => void
  setCurrencySymbol: (sym: string) => void
  setCompactTables: (compact: boolean) => void
}

const STORAGE_KEY = 'cropsentinel_preferences_v2'
const LANG_KEY = 'cropsentinel_language'

function loadInitialState() {
  try {
    const savedLang = localStorage.getItem(LANG_KEY) as AppLanguage | null
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        ...parsed,
        language: savedLang === 'hi' || savedLang === 'en' ? savedLang : (parsed.language ?? 'en'),
      }
    }
    if (savedLang === 'hi' || savedLang === 'en') {
      return {
        language: savedLang,
        location: null,
        preferredAreaUnit: 'hectares' as const,
        currencySymbol: '₹',
        compactTables: false,
      }
    }
  } catch {
    // ignore storage errors
  }
  return {
    language: 'en' as AppLanguage,
    location: null,
    preferredAreaUnit: 'hectares' as const,
    currencySymbol: '₹',
    compactTables: false,
  }
}

function persistState(partial: Record<string, any>) {
  try {
    const existing = loadInitialState()
    const merged = { ...existing, ...partial }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    if (partial.language) {
      localStorage.setItem(LANG_KEY, partial.language)
    }
  } catch {
    // ignore
  }
}

const initial = loadInitialState()

export const useWeatherStore = create<AppPreferencesState>((set) => ({
  language: initial.language ?? 'en',
  location: initial.location ?? null,
  preferredAreaUnit: initial.preferredAreaUnit ?? 'hectares',
  currencySymbol: initial.currencySymbol ?? '₹',
  compactTables: initial.compactTables ?? false,
  setLanguage: (language) => {
    persistState({ language })
    set({ language })
  },
  setLocation: (location) => {
    persistState({ location })
    set({ location })
  },
  setPreferredAreaUnit: (preferredAreaUnit) => {
    persistState({ preferredAreaUnit })
    set({ preferredAreaUnit })
  },
  setCurrencySymbol: (currencySymbol) => {
    persistState({ currencySymbol })
    set({ currencySymbol })
  },
  setCompactTables: (compactTables) => {
    persistState({ compactTables })
    set({ compactTables })
  },
}))
