import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  Sprout,
  User,
  Phone,
  MapPin,
  Layers,
  Droplets,
  Calendar,
  IndianRupee,
  Globe,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Volume2,
  RotateCcw,
  Square,
} from 'lucide-react'
import {
  farmerApi,
  weatherApi,
  cropsApi,
  safeStr,
  type CropCatalogueItem,
} from '@/services/cropsentinel'
import { useAuthStore } from '@/store/authStore'
import { useWeatherStore } from '@/store/weatherStore'
import { useI18n } from '@/i18n/translations'
import { speechOutput } from '@/services/speechService'
import type { VoiceFormFillEventDetail } from '@/components/common/FloatingVoiceAssistant'

export const INDIAN_STATES_AND_UTS = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi (NCT)',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
]

export const SOIL_TYPES = [
  { value: 'Alluvial Soil', en: 'Alluvial Soil (जलोढ़ मिट्टी)', hi: 'जलोढ़ मिट्टी (Alluvial Soil)' },
  { value: 'Black (Regur)', en: 'Black / Regur Soil (काली मिट्टी)', hi: 'काली मिट्टी (Black Soil)' },
  { value: 'Red Soil', en: 'Red Soil (लाल मिट्टी)', hi: 'लाल मिट्टी (Red Soil)' },
  { value: 'Loamy Soil', en: 'Loamy Soil (दोमट मिट्टी)', hi: 'दोमट मिट्टी (Loamy Soil)' },
  { value: 'Laterite Soil', en: 'Laterite Soil (लैटेराइट मिट्टी)', hi: 'लैटेराइट मिट्टी (Laterite Soil)' },
  { value: 'Sandy Soil', en: 'Sandy / Arid Soil (बलुई मिट्टी)', hi: 'बलुई मिट्टी (Sandy Soil)' },
  { value: 'Clayey Soil', en: 'Clayey Soil (चिकनी मिट्टी)', hi: 'चिकनी मिट्टी (Clayey Soil)' },
  { value: 'Mountain Soil', en: 'Mountain / Forest Soil (पर्वतीय मिट्टी)', hi: 'पर्वतीय मिट्टी (Mountain Soil)' },
]

export const IRRIGATION_SOURCES = [
  { value: 'Borewell / Tubewell', en: 'Borewell / Tubewell (बोरवेल / ट्यूबवेल)', hi: 'बोरवेल / ट्यूबवेल (Borewell / Tubewell)' },
  { value: 'Canal Irrigation', en: 'Canal Irrigation (नहर सिंचाई)', hi: 'नहर सिंचाई (Canal Irrigation)' },
  { value: 'Drip / Micro-Irrigation', en: 'Drip / Sprinkler Irrigation (ड्रिप / फव्वारा)', hi: 'ड्रिप / फव्वारा सिंचाई (Drip / Sprinkler)' },
  { value: 'Rainfed (Monsoon)', en: 'Rainfed / Monsoon (वर्षा आधारित)', hi: 'वर्षा आधारित (Rainfed)' },
  { value: 'Farm Pond / Tank', en: 'Farm Pond / Tank (तालाब / कुंड)', hi: 'तालाब / कुंड (Farm Pond)' },
  { value: 'River / Lift Irrigation', en: 'River / Lift Irrigation (नदी / लिफ्ट सिंचाई)', hi: 'नदी / लिफ्ट सिंचाई (River)' },
  { value: 'Open Well', en: 'Open Well (कुआं)', hi: 'कुआं (Open Well)' },
]

export const MAIN_CROPS = [
  'Wheat',
  'Rice (Paddy)',
  'Maize (Corn)',
  'Cotton',
  'Tomato',
  'Potato',
  'Soybean',
  'Mustard',
  'Sugarcane',
  'Chickpea (Chana)',
  'Onion',
  'Groundnut',
  'Chilli',
  'Bajra (Pearl Millet)',
]

export const GROWING_SEASONS = [
  { value: 'Rabi', en: 'Rabi (Winter — Oct to Mar)', hi: 'रबी (सर्दियों की फसल — अक्टूबर से मार्च)' },
  { value: 'Kharif', en: 'Kharif (Monsoon — Jun to Oct)', hi: 'खरीफ (मानसून की फसल — जून से अक्टूबर)' },
  { value: 'Zaid', en: 'Zaid (Summer — Mar to Jun)', hi: 'जायद (गर्मी की फसल — मार्च से जून)' },
  { value: 'Year-Round', en: 'Year-Round / Annual (वार्षिक फसल)', hi: 'वार्षिक / बारहमासी फसल (Year-Round)' },
]

export default function FarmerDetails() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, farmerProfile, setFarmerProfile } = useAuthStore()
  const { language, setLanguage, location: savedWeatherLoc, setLocation } = useWeatherStore()
  const { tKey } = useI18n()
  const isHi = language === 'hi'

  const [farmerName, setFarmerName] = useState(() =>
    safeStr(farmerProfile?.farmer_name || user?.full_name)
  )
  const [mobileNumber, setMobileNumber] = useState(() =>
    safeStr(farmerProfile?.mobile_number || user?.mobile_number)
  )
  const [stateName, setStateName] = useState(() =>
    safeStr(farmerProfile?.state, 'Madhya Pradesh')
  )
  const [district, setDistrict] = useState(() =>
    safeStr(farmerProfile?.district)
  )
  const [villageTown, setVillageTown] = useState(() =>
    safeStr(farmerProfile?.village_town)
  )
  const [totalLandAcres, setTotalLandAcres] = useState(() =>
    farmerProfile?.total_land_acres ? String(farmerProfile.total_land_acres) : '2.5'
  )
  const [soilType, setSoilType] = useState(() =>
    safeStr(farmerProfile?.soil_type, 'Alluvial Soil')
  )
  const [irrigationSource, setIrrigationSource] = useState(() =>
    safeStr(farmerProfile?.irrigation_source, 'Borewell / Tubewell')
  )
  const [mainCrop, setMainCrop] = useState(() =>
    safeStr(farmerProfile?.main_crop, 'Wheat')
  )
  const [growingSeason, setGrowingSeason] = useState(() =>
    safeStr(farmerProfile?.growing_season, 'Rabi')
  )
  const [budgetPerAcre, setBudgetPerAcre] = useState(() =>
    farmerProfile?.budget_per_acre !== undefined && farmerProfile?.budget_per_acre !== null
      ? String(farmerProfile.budget_per_acre)
      : '15000'
  )
  const [prefLang, setPrefLang] = useState<'en' | 'hi'>(() =>
    farmerProfile?.preferred_language === 'hi' || language === 'hi' ? 'hi' : 'en'
  )

  const [loadingProfile, setLoadingProfile] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [voiceFillNotice, setVoiceFillNotice] = useState<string | null>(null)
  const [catalogueCrops, setCatalogueCrops] = useState<CropCatalogueItem[]>([])

  useEffect(() => {
    let active = true
    cropsApi
      .getCatalogue()
      .then(res => {
        if (active && res?.items) {
          setCatalogueCrops(res.items)
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  // Listen for voice-guided form filling events from FloatingVoiceAssistant
  useEffect(() => {
    const onVoiceFill = (ev: Event) => {
      const detail = (ev as CustomEvent<VoiceFormFillEventDetail>).detail
      if (!detail) return
      if (detail.field === 'crop') {
        setMainCrop(detail.value)
      } else if (detail.field === 'village') {
        setVillageTown(detail.value)
      } else if (detail.field === 'district') {
        setDistrict(detail.value)
      } else if (detail.field === 'soil_type') {
        setSoilType(detail.value)
      }
      setVoiceFillNotice(isHi ? detail.summaryHi : detail.summaryEn)
    }
    window.addEventListener('cropsentinel:voice-form-fill', onVoiceFill)
    return () => window.removeEventListener('cropsentinel:voice-form-fill', onVoiceFill)
  }, [isHi])

  const speakFieldHelp = (helpKey: string) => {
    speechOutput.speak(tKey(helpKey), language)
  }

  const handleReadAllInstructions = () => {
    speechOutput.speak(tKey('farmer.fullFormSpeech'), language)
  }

  useEffect(() => {
    let mounted = true
    setLoadingProfile(true)
    farmerApi
      .getProfile()
      .then(prof => {
        if (!mounted || !prof) return
        setFarmerProfile(prof)
        setFarmerName(safeStr(prof.farmer_name))
        setMobileNumber(safeStr(prof.mobile_number))
        setStateName(safeStr(prof.state, 'Madhya Pradesh'))
        setDistrict(safeStr(prof.district))
        setVillageTown(safeStr(prof.village_town))
        setTotalLandAcres(prof.total_land_acres ? String(prof.total_land_acres) : '2.5')
        setSoilType(safeStr(prof.soil_type, 'Alluvial Soil'))
        setIrrigationSource(safeStr(prof.irrigation_source, 'Borewell / Tubewell'))
        setMainCrop(safeStr(prof.main_crop, 'Wheat'))
        setGrowingSeason(safeStr(prof.growing_season, 'Rabi'))
        setBudgetPerAcre(
          prof.budget_per_acre !== undefined && prof.budget_per_acre !== null
            ? String(prof.budget_per_acre)
            : ''
        )
        if (prof.preferred_language === 'en' || prof.preferred_language === 'hi') {
          setPrefLang(prof.preferred_language)
        }
      })
      .catch(() => {
        // ignore if no profile yet
      })
      .finally(() => {
        if (mounted) setLoadingProfile(false)
      })
    return () => {
      mounted = false
    }
  }, [setFarmerProfile])

  const handleLangChange = (val: 'en' | 'hi') => {
    setPrefLang(val)
    setLanguage(val)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (farmerName.trim().length < 2) {
      setError(isHi ? 'कृपया किसान का नाम दर्ज करें।' : "Please enter Farmer's Name.")
      return
    }
    const digits = mobileNumber.replace(/\D/g, '')
    if (digits.length < 10 || digits.length > 15) {
      setError(
        isHi
          ? 'कृपया 10 अंकों का मान्य मोबाइल नंबर दर्ज करें।'
          : 'Please enter a valid 10-digit Mobile Number.'
      )
      return
    }
    if (!stateName.trim()) {
      setError(isHi ? 'कृपया अपना राज्य चुनें।' : 'Please select your State.')
      return
    }
    if (district.trim().length < 2) {
      setError(isHi ? 'कृपया अपना जिला (District) दर्ज करें।' : 'Please enter your District.')
      return
    }
    const acres = Number(totalLandAcres)
    if (!Number.isFinite(acres) || acres <= 0) {
      setError(
        isHi
          ? 'कुल ज़मीन (एकड़ में) 0 से अधिक होनी चाहिए।'
          : 'Total Land (acres) must be a valid number greater than 0.'
      )
      return
    }
    const budget = budgetPerAcre.trim() === '' ? 0 : Number(budgetPerAcre)
    if (!Number.isFinite(budget) || budget < 0) {
      setError(
        isHi
          ? 'प्रति एकड़ बजट ऋणात्मक नहीं हो सकता।'
          : 'Farming Budget per Acre cannot be negative.'
      )
      return
    }

    setSaving(true)
    try {
      const saved = await farmerApi.saveProfile({
        farmer_name: farmerName.trim(),
        mobile_number: mobileNumber.trim(),
        state: stateName.trim(),
        district: district.trim(),
        village_town: villageTown.trim(),
        total_land_acres: acres,
        soil_type: soilType,
        irrigation_source: irrigationSource,
        main_crop: mainCrop,
        growing_season: growingSeason,
        budget_per_acre: budget,
        preferred_language: prefLang,
      })
      setFarmerProfile(saved)
      setLanguage(prefLang)

      // Auto-sync weather location from District / State if not set yet
      if (!savedWeatherLoc) {
        try {
          const geoQuery = district.trim() || stateName.trim()
          const matches = await weatherApi.searchLocations(geoQuery)
          if (matches && matches.length > 0) {
            const top = matches[0]
            setLocation({
              name: top.name,
              lat: top.latitude,
              lon: top.longitude,
              country: top.country,
              admin1: top.admin1 ?? stateName.trim(),
            })
          }
        } catch {
          // non-blocking
        }
      }

      queryClient.invalidateQueries({ queryKey: ['fields'] })
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] })
      queryClient.invalidateQueries({ queryKey: ['reports-summary'] })

      setSuccess(
        isHi
          ? 'किसान विवरण सफलतापूर्वक सहेजा गया! अब अपनी फसल का विवरण भरें…'
          : 'Farmer details saved! Proceeding to Crop Details…'
      )
      setTimeout(() => {
        navigate('/crop-details')
      }, 350)
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        err?.message ||
        (isHi ? 'विवरण सहेजने में त्रुटि हुई।' : 'Failed to save farmer details.')
      setError(String(detail))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f7f4] pb-12">
      {/* Top Branding Header */}
      <header className="bg-[#14532d] text-white px-4 sm:px-8 py-4 shadow-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center">
              <Sprout className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight leading-none">CropSentinel</h1>
              <p className="text-xs text-emerald-200 mt-0.5">
                {isHi ? 'स्मार्ट कृषि मंच • चरण 1 / 2' : 'Smart Agriculture Platform • Step 1 of 2'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleReadAllInstructions}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold text-white border border-white/20 transition-colors cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5 text-emerald-300" />
              {tKey('common.readAllInstructions')}
            </button>
            <button
              type="button"
              onClick={() => speechOutput.replay(language)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors cursor-pointer"
              title={tKey('common.repeat')}
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-200" />
              {tKey('common.repeat')}
            </button>
            <button
              type="button"
              onClick={() => speechOutput.stop()}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-500/30 hover:bg-red-500/50 text-xs font-semibold text-white transition-colors cursor-pointer"
              title={tKey('common.stopSpeaking')}
            >
              <Square className="w-3 h-3 fill-current" />
              {tKey('common.stopSpeaking')}
            </button>
            <div className="flex items-center bg-black/20 rounded-xl p-1 border border-white/15">
              <button
                type="button"
                onClick={() => handleLangChange('en')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  language === 'en' ? 'bg-white text-[#14532d]' : 'text-emerald-100 hover:text-white'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => handleLangChange('hi')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  language === 'hi' ? 'bg-white text-[#14532d]' : 'text-emerald-100 hover:text-white'
                }`}
              >
                हिन्दी
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200/90 overflow-hidden">
          {/* Green Title Banner */}
          <div className="bg-gradient-to-r from-[#14532d] via-[#166534] to-[#15803d] px-6 sm:px-8 py-6 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/15 text-emerald-200 mb-1.5">
                {isHi ? 'किसान और खेत प्रोफ़ाइल' : 'FARMER & LAND PROFILE'}
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {tKey('farmer.pageTitle')}
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100 mt-1">
                {tKey('farmer.pageSubtitle')}
              </p>
            </div>

            {farmerProfile && (
              <button
                type="button"
                onClick={() => navigate('/')}
                className="self-start sm:self-center px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold text-white border border-white/20 transition-colors"
              >
                {isHi ? 'डैशबोर्ड पर जाएं' : 'Go to Dashboard'}
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6" noValidate>
            {/* Voice Instruction Bar inside Form */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[#14532d]">
                {isHi
                  ? '🔊 किसी भी प्रश्न के आगे स्पीकर बटन दबाकर उसका अर्थ सुनें, या बोलकर भरें।'
                  : '🔊 Tap the speaker icon beside any field label to hear an explanation in your language.'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReadAllInstructions}
                  className="px-3 py-1.5 rounded-xl bg-[#14532d] text-white font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  {tKey('common.readAllInstructions')}
                </button>
              </div>
            </div>

            {voiceFillNotice && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center justify-between gap-2">
                <span>🎤 {voiceFillNotice}</span>
                <button
                  type="button"
                  onClick={() => setVoiceFillNotice(null)}
                  className="text-emerald-700 hover:underline"
                >
                  {isHi ? 'ठीक है' : 'Dismiss'}
                </button>
              </div>
            )}

            {loadingProfile && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-[#15803d]" />
                <span>{isHi ? 'सहेजा गया प्रोफ़ाइल लोड हो रहा है…' : 'Loading saved farmer profile…'}</span>
              </div>
            )}

            {error && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            {/* Grid of 12 Farmer Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* 1. Farmer's Name */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label htmlFor="farmer-name" className="text-sm font-bold text-slate-700 inline-flex items-center gap-1.5">
                    <User className="w-4 h-4 text-[#15803d]" />
                    {tKey('farmer.name')} <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => speakFieldHelp('help.farmer.name')}
                    aria-label={tKey('farmer.name')}
                    className="p-1 rounded-lg text-[#15803d] hover:bg-emerald-50"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
                <input
                  id="farmer-name"
                  type="text"
                  required
                  value={farmerName}
                  onChange={e => setFarmerName(e.target.value)}
                  placeholder={isHi ? 'अपना पूरा नाम लिखें' : 'Enter full name'}
                  className="input-field py-3 text-base"
                />
              </div>

              {/* 2. Mobile Number */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label htmlFor="farmer-mobile" className="text-sm font-bold text-slate-700 inline-flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-[#15803d]" />
                    {tKey('farmer.mobile')} <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => speakFieldHelp('help.farmer.mobile')}
                    aria-label={tKey('farmer.mobile')}
                    className="p-1 rounded-lg text-[#15803d] hover:bg-emerald-50"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
                <input
                  id="farmer-mobile"
                  type="tel"
                  required
                  value={mobileNumber}
                  onChange={e => setMobileNumber(e.target.value)}
                  placeholder={isHi ? '10 अंकों का मोबाइल नंबर' : '10-digit mobile number'}
                  className="input-field py-3 text-base"
                />
              </div>

              {/* 3. State */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label htmlFor="farmer-state" className="text-sm font-bold text-slate-700 inline-flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#15803d]" />
                    {tKey('farmer.state')} <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => speakFieldHelp('help.farmer.state')}
                    aria-label={tKey('farmer.state')}
                    className="p-1 rounded-lg text-[#15803d] hover:bg-emerald-50"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
                <select
                  id="farmer-state"
                  value={stateName}
                  onChange={e => setStateName(e.target.value)}
                  className="input-field py-3 text-base"
                >
                  {INDIAN_STATES_AND_UTS.map(st => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. District */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label htmlFor="farmer-district" className="text-sm font-bold text-slate-700 inline-flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#15803d]" />
                    {tKey('farmer.district')} <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => speakFieldHelp('help.farmer.district')}
                    aria-label={tKey('farmer.district')}
                    className="p-1 rounded-lg text-[#15803d] hover:bg-emerald-50"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
                <input
                  id="farmer-district"
                  type="text"
                  required
                  value={district}
                  onChange={e => setDistrict(e.target.value)}
                  placeholder={isHi ? 'जैसे: सीहोर, करनाल, पुणे, लुधियाना' : 'e.g. Sehore, Karnal, Pune, Ludhiana'}
                  className="input-field py-3 text-base"
                />
              </div>

              {/* 5. Village / Town (Optional) */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label htmlFor="farmer-village" className="text-sm font-bold text-slate-700 inline-flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#15803d]" />
                    {tKey('farmer.village')}{' '}
                    <span className="text-xs font-normal text-slate-400">
                      ({tKey('common.optional')})
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => speakFieldHelp('help.farmer.village')}
                    aria-label={tKey('farmer.village')}
                    className="p-1 rounded-lg text-[#15803d] hover:bg-emerald-50"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
                <input
                  id="farmer-village"
                  type="text"
                  value={villageTown}
                  onChange={e => setVillageTown(e.target.value)}
                  placeholder={isHi ? 'अपने गाँव या तहसील का नाम लिखें' : 'Enter your village or tehsil name'}
                  className="input-field py-3 text-base"
                />
              </div>

              {/* 6. Total Land (acres) */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label htmlFor="farmer-land" className="text-sm font-bold text-slate-700 inline-flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#15803d]" />
                    {tKey('farmer.land_area')} <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => speakFieldHelp('help.farmer.land_area')}
                    aria-label={tKey('farmer.land_area')}
                    className="p-1 rounded-lg text-[#15803d] hover:bg-emerald-50"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
                <input
                  id="farmer-land"
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="50000"
                  required
                  value={totalLandAcres}
                  onChange={e => setTotalLandAcres(e.target.value)}
                  placeholder="e.g. 5.0"
                  className="input-field py-3 text-base"
                />
              </div>

              {/* 7. Soil Type */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label htmlFor="farmer-soil" className="text-sm font-bold text-slate-700 inline-flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#15803d]" />
                    {tKey('farmer.soil_type')} <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => speakFieldHelp('help.farmer.soil_type')}
                    aria-label={tKey('farmer.soil_type')}
                    className="p-1 rounded-lg text-[#15803d] hover:bg-emerald-50"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
                <select
                  id="farmer-soil"
                  value={soilType}
                  onChange={e => setSoilType(e.target.value)}
                  className="input-field py-3 text-base"
                >
                  {SOIL_TYPES.map(s => (
                    <option key={s.value} value={s.value}>
                      {isHi ? s.hi : s.en}
                    </option>
                  ))}
                </select>
              </div>

              {/* 8. Water / Irrigation Source */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label htmlFor="farmer-water" className="text-sm font-bold text-slate-700 inline-flex items-center gap-1.5">
                    <Droplets className="w-4 h-4 text-[#15803d]" />
                    {tKey('farmer.water_source')} <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => speakFieldHelp('help.farmer.water_source')}
                    aria-label={tKey('farmer.water_source')}
                    className="p-1 rounded-lg text-[#15803d] hover:bg-emerald-50"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
                <select
                  id="farmer-water"
                  value={irrigationSource}
                  onChange={e => setIrrigationSource(e.target.value)}
                  className="input-field py-3 text-base"
                >
                  {IRRIGATION_SOURCES.map(irr => (
                    <option key={irr.value} value={irr.value}>
                      {isHi ? irr.hi : irr.en}
                    </option>
                  ))}
                </select>
              </div>

              {/* 9. Main Crop */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label htmlFor="farmer-crop" className="text-sm font-bold text-slate-700 inline-flex items-center gap-1.5">
                    <Sprout className="w-4 h-4 text-[#15803d]" />
                    {tKey('farmer.main_crop')} <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => speakFieldHelp('help.farmer.main_crop')}
                    aria-label={tKey('farmer.main_crop')}
                    className="p-1 rounded-lg text-[#15803d] hover:bg-emerald-50"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
                <select
                  id="farmer-crop"
                  value={mainCrop}
                  onChange={e => setMainCrop(e.target.value)}
                  className="input-field py-3 text-base"
                >
                  {catalogueCrops.length > 0
                    ? catalogueCrops.map(item => (
                        <option key={item.record_id} value={item.crop}>
                          {item.crop} ({item.crop_group} • {item.indicative_temperature_c}°C)
                        </option>
                      ))
                    : MAIN_CROPS.map(c => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                </select>
              </div>

              {/* 10. Current Growing Season */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label htmlFor="farmer-season" className="text-sm font-bold text-slate-700 inline-flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[#15803d]" />
                    {tKey('farmer.growing_season')} <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => speakFieldHelp('help.farmer.growing_season')}
                    aria-label={tKey('farmer.growing_season')}
                    className="p-1 rounded-lg text-[#15803d] hover:bg-emerald-50"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
                <select
                  id="farmer-season"
                  value={growingSeason}
                  onChange={e => setGrowingSeason(e.target.value)}
                  className="input-field py-3 text-base"
                >
                  {GROWING_SEASONS.map(gs => (
                    <option key={gs.value} value={gs.value}>
                      {isHi ? gs.hi : gs.en}
                    </option>
                  ))}
                </select>
              </div>

              {/* 11. Farming Budget per Acre (per season) */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label htmlFor="farmer-budget" className="text-sm font-bold text-slate-700 inline-flex items-center gap-1.5">
                    <IndianRupee className="w-4 h-4 text-[#15803d]" />
                    {tKey('farmer.budget')}{' '}
                    <span className="text-xs font-normal text-slate-400">
                      ({tKey('common.optional')})
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => speakFieldHelp('help.farmer.budget')}
                    aria-label={tKey('farmer.budget')}
                    className="p-1 rounded-lg text-[#15803d] hover:bg-emerald-50"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
                <input
                  id="farmer-budget"
                  type="number"
                  min="0"
                  step="500"
                  value={budgetPerAcre}
                  onChange={e => setBudgetPerAcre(e.target.value)}
                  placeholder={isHi ? 'जैसे: 15000' : 'e.g. 15000'}
                  className="input-field py-3 text-base"
                />
              </div>

              {/* 12. Preferred Language */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label htmlFor="farmer-lang" className="text-sm font-bold text-slate-700 inline-flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-[#15803d]" />
                    {tKey('farmer.preferred_language')} <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => speakFieldHelp('help.farmer.preferred_language')}
                    aria-label={tKey('farmer.preferred_language')}
                    className="p-1 rounded-lg text-[#15803d] hover:bg-emerald-50"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
                <select
                  id="farmer-lang"
                  value={prefLang}
                  onChange={e => handleLangChange(e.target.value as 'en' | 'hi')}
                  className="input-field py-3 text-base"
                >
                  <option value="en">English (अंग्रेज़ी)</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-5 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => navigate('/language')}
                className="px-5 py-3.5 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                {tKey('common.back')}
              </button>

              <button
                type="submit"
                disabled={saving}
                className="px-7 py-3.5 rounded-2xl bg-[#15803d] hover:bg-[#14532d] disabled:opacity-60 text-white font-bold text-base shadow-md hover:shadow-lg inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{tKey('common.loading')}</span>
                  </>
                ) : (
                  <>
                    <span>{tKey('farmer.saveBtn')}</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
