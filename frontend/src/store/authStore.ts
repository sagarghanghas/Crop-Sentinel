import { create } from 'zustand'
import { AUTH_TOKEN_KEY } from '@/services/api'
import { authApi } from '@/services/cropsentinel'
import { useWeatherStore } from '@/store/weatherStore'
import type {
  AuthSessionResponse,
  UserAccount,
  FarmerProfileRecord,
  CropDetailsRecord,
} from '@/types'

const AUTH_SESSION_CACHE_KEY = 'cropsentinel_auth_session_v1'

interface CachedSession {
  user: UserAccount | null
  farmerProfile: FarmerProfileRecord | null
  latestCrop: CropDetailsRecord | null
}

function cleanCrop(crop: CropDetailsRecord | null | undefined): CropDetailsRecord | null {
  if (!crop) return null
  const clean = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = String(v).trim()
    return s === 'undefined' || s === 'null' || s === 'NaN' ? '' : s
  }
  return {
    ...crop,
    crop_name: clean(crop.crop_name),
    crop_variety: clean(crop.crop_variety),
    field_location: clean(crop.field_location),
    sowing_date: clean(crop.sowing_date),
    growth_stage: clean(crop.growth_stage) || 'Vegetative',
    irrigation_method: clean(crop.irrigation_method) || 'Drip Irrigation',
    fertilizer_used: clean(crop.fertilizer_used),
    pesticide_used: clean(crop.pesticide_used),
    visible_symptoms: clean(crop.visible_symptoms),
    image_filename: clean(crop.image_filename) || null,
    image_url: clean(crop.image_url) || null,
  }
}

function loadCachedSession(): CachedSession {
  try {
    const raw = sessionStorage.getItem(AUTH_SESSION_CACHE_KEY)
    if (!raw) return { user: null, farmerProfile: null, latestCrop: null }
    const parsed = JSON.parse(raw)
    return {
      user: parsed?.user ?? null,
      farmerProfile: parsed?.farmerProfile ?? null,
      latestCrop: cleanCrop(parsed?.latestCrop),
    }
  } catch {
    return { user: null, farmerProfile: null, latestCrop: null }
  }
}

function saveCachedSession(data: CachedSession) {
  try {
    sessionStorage.setItem(
      AUTH_SESSION_CACHE_KEY,
      JSON.stringify({
        ...data,
        latestCrop: cleanCrop(data.latestCrop),
      })
    )
  } catch {
    // ignore storage errors
  }
}

interface AuthStoreState {
  token: string | null
  user: UserAccount | null
  farmerProfile: FarmerProfileRecord | null
  latestCrop: CropDetailsRecord | null
  isHydrated: boolean
  setSession: (session: AuthSessionResponse) => void
  setFarmerProfile: (profile: FarmerProfileRecord) => void
  setLatestCrop: (crop: CropDetailsRecord) => void
  hydrateFromServer: () => Promise<void>
  logout: () => void
}

const initialToken = (() => {
  try {
    const t = localStorage.getItem(AUTH_TOKEN_KEY)
    return t && t !== 'undefined' && t !== 'null' ? t : null
  } catch {
    return null
  }
})()

const initialCache = loadCachedSession()

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  token: initialToken,
  user: initialToken ? initialCache.user : null,
  farmerProfile: initialToken ? initialCache.farmerProfile : null,
  latestCrop: initialToken ? initialCache.latestCrop : null,
  isHydrated: !initialToken,

  setSession: (session) => {
    try {
      localStorage.setItem(AUTH_TOKEN_KEY, session.token)
    } catch {
      // ignore
    }
    const lang = session.farmer_profile?.preferred_language || session.user?.preferred_language
    if (lang === 'en' || lang === 'hi') {
      useWeatherStore.getState().setLanguage(lang)
    }
    const nextCache: CachedSession = {
      user: session.user,
      farmerProfile: session.farmer_profile ?? null,
      latestCrop: cleanCrop(session.latest_crop),
    }
    saveCachedSession(nextCache)
    set({
      token: session.token,
      user: session.user,
      farmerProfile: session.farmer_profile ?? null,
      latestCrop: cleanCrop(session.latest_crop),
      isHydrated: true,
    })
  },

  setFarmerProfile: (profile) => {
    if (profile.preferred_language === 'en' || profile.preferred_language === 'hi') {
      useWeatherStore.getState().setLanguage(profile.preferred_language)
    }
    const state = get()
    const updatedUser = state.user
      ? {
          ...state.user,
          full_name: profile.farmer_name,
          mobile_number: profile.mobile_number,
          preferred_language: profile.preferred_language,
        }
      : null
    saveCachedSession({
      user: updatedUser,
      farmerProfile: profile,
      latestCrop: state.latestCrop,
    })
    set({ farmerProfile: profile, user: updatedUser })
  },

  setLatestCrop: (crop) => {
    const cleaned = cleanCrop(crop)
    const state = get()
    saveCachedSession({
      user: state.user,
      farmerProfile: state.farmerProfile,
      latestCrop: cleaned,
    })
    set({ latestCrop: cleaned })
  },

  hydrateFromServer: async () => {
    const token = get().token
    if (!token) {
      set({ isHydrated: true })
      return
    }
    try {
      const session = await authApi.me()
      get().setSession(session)
    } catch (err: any) {
      if (err?.response?.status === 401) {
        get().logout()
      } else {
        set({ isHydrated: true })
      }
    }
  },

  logout: () => {
    try {
      localStorage.removeItem(AUTH_TOKEN_KEY)
      localStorage.removeItem(AUTH_SESSION_CACHE_KEY)
      sessionStorage.removeItem(AUTH_SESSION_CACHE_KEY)
    } catch {
      // ignore
    }
    set({
      token: null,
      user: null,
      farmerProfile: null,
      latestCrop: null,
      isHydrated: true,
    })
  },
}))
