import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  Sprout,
  Droplets,
  Thermometer,
  FlaskConical,
  Camera,
  UploadCloud,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Image as ImageIcon,
  Volume2,
  RotateCcw,
  Square,
} from 'lucide-react'
import {
  cropsApi,
  safeStr,
  type CropCatalogueItem,
  type CropModelEvaluation,
} from '@/services/cropsentinel'
import { useAuthStore } from '@/store/authStore'
import { useWeatherStore } from '@/store/weatherStore'
import { useI18n } from '@/i18n/translations'
import { speechOutput } from '@/services/speechService'
import type { VoiceFormFillEventDetail } from '@/components/common/FloatingVoiceAssistant'

const GROWTH_STAGES = [
  { value: 'Seedling', en: 'Seedling (अंकुरण अवस्था)', hi: 'अंकुरण अवस्था (Seedling)' },
  { value: 'Vegetative', en: 'Vegetative (वानस्पतिक वृद्धि)', hi: 'वानस्पतिक वृद्धि (Vegetative)' },
  { value: 'Flowering', en: 'Flowering (फूल आने की अवस्था)', hi: 'फूल आने की अवस्था (Flowering)' },
  { value: 'Fruiting/Grain Fill', en: 'Fruiting / Grain Fill (दाना बनने की अवस्था)', hi: 'फल / दाना बनने की अवस्था (Grain Fill)' },
  { value: 'Maturity', en: 'Maturity / Harvest Ready (पकने की अवस्था)', hi: 'पकने / कटाई की अवस्था (Maturity)' },
]

const IRRIGATION_METHODS = [
  { value: 'Drip Irrigation', en: 'Drip Irrigation (ड्रिप सिंचाई)', hi: 'ड्रिप सिंचाई (Drip Irrigation)' },
  { value: 'Sprinkler Irrigation', en: 'Sprinkler Irrigation (फव्वारा सिंचाई)', hi: 'फव्वारा सिंचाई (Sprinkler Irrigation)' },
  { value: 'Flood / Furrow Irrigation', en: 'Flood / Furrow Irrigation (क्यारी / सतही सिंचाई)', hi: 'क्यारी / सतही सिंचाई (Furrow Irrigation)' },
  { value: 'Canal Irrigation', en: 'Canal Water (नहर का पानी)', hi: 'नहर का पानी (Canal Irrigation)' },
  { value: 'Borewell / Tubewell', en: 'Borewell / Tubewell (बोरवेल / ट्यूबवेल)', hi: 'बोरवेल / ट्यूबवेल (Borewell)' },
  { value: 'Rainfed', en: 'Rainfed (वर्षा आधारित)', hi: 'वर्षा आधारित (Rainfed)' },
]

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

function numToInputStr(val: number | null | undefined): string {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return ''
  return String(val)
}

export default function CropDetails() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { farmerProfile, latestCrop, setLatestCrop } = useAuthStore()
  const { language, setLanguage } = useWeatherStore()
  const { tKey } = useI18n()
  const isHi = language === 'hi'

  const defaultLocation = [
    safeStr(farmerProfile?.village_town),
    safeStr(farmerProfile?.district),
    safeStr(farmerProfile?.state),
  ]
    .filter(Boolean)
    .join(', ')

  const [cropId, setCropId] = useState<number | null>(() => latestCrop?.id ?? null)

  // SECTION 1 — CROP INFORMATION
  const [cropName, setCropName] = useState(() =>
    safeStr(latestCrop?.crop_name || farmerProfile?.main_crop, 'Wheat')
  )
  const [cropVariety, setCropVariety] = useState(() =>
    safeStr(latestCrop?.crop_variety)
  )
  const [fieldLocation, setFieldLocation] = useState(() =>
    safeStr(latestCrop?.field_location || defaultLocation)
  )
  const [sowingDate, setSowingDate] = useState(() =>
    safeStr(latestCrop?.sowing_date, new Date().toISOString().slice(0, 10))
  )

  // SECTION 2 — GROWTH AND IRRIGATION
  const [growthStage, setGrowthStage] = useState(() =>
    safeStr(latestCrop?.growth_stage, 'Vegetative')
  )
  const [growthProgressPct, setGrowthProgressPct] = useState(() =>
    numToInputStr(latestCrop?.growth_progress_pct) || '35'
  )
  const [irrigationMethod, setIrrigationMethod] = useState(() =>
    safeStr(latestCrop?.irrigation_method, 'Drip Irrigation')
  )
  const [recentRainfallMm, setRecentRainfallMm] = useState(() =>
    numToInputStr(latestCrop?.recent_rainfall_mm)
  )

  // SECTION 3 — FIELD CONDITIONS
  const [soilMoisturePct, setSoilMoisturePct] = useState(() =>
    numToInputStr(latestCrop?.soil_moisture_pct)
  )
  const [fieldTemperatureC, setFieldTemperatureC] = useState(() =>
    numToInputStr(latestCrop?.field_temperature_c)
  )
  const [humidityPct, setHumidityPct] = useState(() =>
    numToInputStr(latestCrop?.humidity_pct)
  )

  // SECTION 4 — FERTILIZER AND PESTICIDE
  const [fertilizerUsed, setFertilizerUsed] = useState(() =>
    safeStr(latestCrop?.fertilizer_used)
  )
  const [pesticideUsed, setPesticideUsed] = useState(() =>
    safeStr(latestCrop?.pesticide_used)
  )

  // SECTION 5 — CROP PHOTOGRAPH AND SYMPTOMS
  const [visibleSymptoms, setVisibleSymptoms] = useState(() =>
    safeStr(latestCrop?.visible_symptoms)
  )
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(() =>
    safeStr(latestCrop?.image_url) || null
  )
  const [existingFileName, setExistingFileName] = useState<string>(() =>
    safeStr(latestCrop?.image_filename)
  )

  const [loadingRecord, setLoadingRecord] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [voiceFillNotice, setVoiceFillNotice] = useState<string | null>(null)
  const [catalogueCrops, setCatalogueCrops] = useState<CropCatalogueItem[]>([])
  const [modelEval, setModelEval] = useState<CropModelEvaluation | null>(null)

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

  useEffect(() => {
    const cleanName = safeStr(cropName)
    if (!cleanName) {
      setModelEval(null)
      return
    }
    let active = true
    const timer = setTimeout(() => {
      cropsApi
        .evaluateModel({
          crop_name: cleanName,
          field_temperature_c: fieldTemperatureC !== '' ? Number(fieldTemperatureC) : null,
          recent_rainfall_mm: recentRainfallMm !== '' ? Number(recentRainfallMm) : null,
          soil_moisture_pct: soilMoisturePct !== '' ? Number(soilMoisturePct) : null,
          humidity_pct: humidityPct !== '' ? Number(humidityPct) : null,
          soil_type: farmerProfile?.soil_type || null,
          growth_stage: growthStage || 'Vegetative',
          growth_progress_pct: growthProgressPct !== '' ? Number(growthProgressPct) : null,
          visible_symptoms: visibleSymptoms || null,
          image_filename: existingFileName || null,
        })
        .then(res => {
          if (active) setModelEval(res)
        })
        .catch(() => {})
    }, 250)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [
    cropName,
    fieldTemperatureC,
    recentRainfallMm,
    soilMoisturePct,
    humidityPct,
    growthStage,
    growthProgressPct,
    visibleSymptoms,
    existingFileName,
    farmerProfile?.soil_type,
  ])

  useEffect(() => {
    const onVoiceFill = (ev: Event) => {
      const detail = (ev as CustomEvent<VoiceFormFillEventDetail>).detail
      if (!detail) return
      if (detail.field === 'crop') {
        setCropName(safeStr(detail.value))
      } else if (detail.field === 'village' || detail.field === 'district') {
        setFieldLocation(safeStr(detail.value))
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
    speechOutput.speak(tKey('crop.fullFormSpeech'), language)
  }

  useEffect(() => {
    let mounted = true
    setLoadingRecord(true)
    cropsApi
      .getLatest()
      .then(rec => {
        if (!mounted || !rec) return
        setLatestCrop(rec)
        setCropId(rec.id)
        setCropName(safeStr(rec.crop_name, 'Wheat'))
        setCropVariety(safeStr(rec.crop_variety))
        setFieldLocation(safeStr(rec.field_location || defaultLocation))
        setSowingDate(safeStr(rec.sowing_date))
        setGrowthStage(safeStr(rec.growth_stage, 'Vegetative'))
        setGrowthProgressPct(numToInputStr(rec.growth_progress_pct) || '35')
        setIrrigationMethod(safeStr(rec.irrigation_method, 'Drip Irrigation'))
        setRecentRainfallMm(numToInputStr(rec.recent_rainfall_mm))
        setSoilMoisturePct(numToInputStr(rec.soil_moisture_pct))
        setFieldTemperatureC(numToInputStr(rec.field_temperature_c))
        setHumidityPct(numToInputStr(rec.humidity_pct))
        setFertilizerUsed(safeStr(rec.fertilizer_used))
        setPesticideUsed(safeStr(rec.pesticide_used))
        setVisibleSymptoms(safeStr(rec.visible_symptoms))
        if (safeStr(rec.image_url)) {
          setPhotoPreviewUrl(safeStr(rec.image_url))
        }
        setExistingFileName(safeStr(rec.image_filename))
      })
      .catch(() => {
        // ignore if no saved crop record yet
      })
      .finally(() => {
        if (mounted) setLoadingRecord(false)
      })
    return () => {
      mounted = false
    }
  }, [defaultLocation, setLatestCrop])

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const file = e.target.files?.[0]
    if (!file) return

    if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
      setError(
        isHi
          ? 'कृपया केवल JPG, PNG या WEBP फ़ोटो अपलोड करें।'
          : 'Invalid image format. Please upload a JPG, PNG, or WEBP photograph.'
      )
      e.target.value = ''
      return
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setError(
        isHi
          ? 'फ़ोटो का आकार 10 MB से कम होना चाहिए।'
          : 'Image size exceeds 10 MB. Please choose a smaller photograph.'
      )
      e.target.value = ''
      return
    }

    setPhotoFile(file)
    const objectUrl = URL.createObjectURL(file)
    setPhotoPreviewUrl(objectUrl)
  }

  const clearSelectedPhoto = () => {
    setPhotoFile(null)
    setPhotoPreviewUrl(safeStr(latestCrop?.image_url) || null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const validateNumericRange = (
    raw: string,
    label: string,
    min: number,
    max: number,
    required = false
  ): string | null => {
    const trimmed = safeStr(raw)
    if (trimmed === '') {
      return required ? `${label} is required.` : null
    }
    const n = Number(trimmed)
    if (!Number.isFinite(n) || n < min || n > max) {
      return isHi
        ? `${label} ${min} और ${max} के बीच होना चाहिए।`
        : `${label} must be between ${min} and ${max}.`
    }
    return null
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!safeStr(cropName)) {
      setError(isHi ? 'कृपया फसल का नाम दर्ज करें।' : 'Crop Name is required.')
      return
    }
    if (!safeStr(fieldLocation)) {
      setError(isHi ? 'कृपया खेत का स्थान (Field Location) दर्ज करें।' : 'Field Location is required.')
      return
    }

    const checks = [
      validateNumericRange(
        growthProgressPct,
        isHi ? 'अनुमानित विकास प्रगति (%)' : 'Estimated Growth Progress (%)',
        0,
        100,
        true
      ),
      validateNumericRange(
        recentRainfallMm,
        isHi ? 'हाल की वर्षा (mm)' : 'Recent Rainfall (mm)',
        0,
        5000
      ),
      validateNumericRange(
        soilMoisturePct,
        isHi ? 'मिट्टी की नमी (%)' : 'Soil Moisture (%)',
        0,
        100
      ),
      validateNumericRange(
        fieldTemperatureC,
        isHi ? 'खेत का तापमान (°C)' : 'Field Temperature (°C)',
        -20,
        65
      ),
      validateNumericRange(
        humidityPct,
        isHi ? 'आर्द्रता / नमी (%)' : 'Humidity (%)',
        0,
        100
      ),
    ]

    const firstErr = checks.find(Boolean)
    if (firstErr) {
      setError(firstErr)
      return
    }

    setSaving(true)
    try {
      const saved = await cropsApi.saveCrop({
        crop_id: cropId,
        crop_name: safeStr(cropName),
        crop_variety: safeStr(cropVariety),
        field_location: safeStr(fieldLocation),
        sowing_date: safeStr(sowingDate),
        growth_stage: safeStr(growthStage, 'Vegetative'),
        growth_progress_pct: safeStr(growthProgressPct, '35'),
        irrigation_method: safeStr(irrigationMethod, 'Drip Irrigation'),
        recent_rainfall_mm: safeStr(recentRainfallMm),
        soil_moisture_pct: safeStr(soilMoisturePct),
        field_temperature_c: safeStr(fieldTemperatureC),
        humidity_pct: safeStr(humidityPct),
        fertilizer_used: safeStr(fertilizerUsed),
        pesticide_used: safeStr(pesticideUsed),
        visible_symptoms: safeStr(visibleSymptoms),
        photo: photoFile,
      })

      setLatestCrop(saved)
      setCropId(saved.id)
      queryClient.invalidateQueries({ queryKey: ['fields'] })
      queryClient.invalidateQueries({ queryKey: ['history'] })
      queryClient.invalidateQueries({ queryKey: ['reports-summary'] })
      queryClient.invalidateQueries({ queryKey: ['latest-crop'] })

      setSuccess(
        isHi
          ? 'फसल का विवरण और फोटो सफलतापूर्वक सहेजे गए! डैशबोर्ड खुल रहा है…'
          : 'Crop details saved successfully! Opening your Farmer Dashboard…'
      )
      setTimeout(() => {
        navigate('/')
      }, 400)
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        err?.message ||
        (isHi ? 'फसल विवरण सहेजने में त्रुटि हुई।' : 'Failed to save crop details.')
      setError(String(detail))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f7f4] pb-14">
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
                {isHi ? 'स्मार्ट कृषि मंच • चरण 2 / 2' : 'Smart Agriculture Platform • Step 2 of 2'}
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
                onClick={() => setLanguage('en')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  language === 'en' ? 'bg-white text-[#14532d]' : 'text-emerald-100 hover:text-white'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLanguage('hi')}
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
          {/* Page Header Banner */}
          <div className="bg-gradient-to-r from-[#14532d] via-[#166534] to-[#15803d] px-6 sm:px-8 py-6 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/15 text-emerald-200 mb-1.5">
                {isHi ? 'फसल और खेत स्वास्थ्य रिकॉर्ड' : 'CROP & FIELD HEALTH RECORD'}
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {tKey('crop.pageTitle')}
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100 mt-1">
                {tKey('crop.pageSubtitle')}
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/')}
              className="self-start sm:self-center px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold text-white border border-white/20 transition-colors"
            >
              {isHi ? 'डैशबोर्ड पर जाएं' : 'Go to Dashboard'}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8" noValidate>
            {/* Voice Instruction Bar inside Form */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[#14532d]">
                {isHi
                  ? '🔊 किसी भी प्रश्न के आगे स्पीकर बटन दबाकर उसका अर्थ सुनें, या पूरा फॉर्म सुनें।'
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

            {loadingRecord && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-[#15803d]" />
                <span>{isHi ? 'फसल रिकॉर्ड लोड हो रहा है…' : 'Loading saved crop record…'}</span>
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

            {/* SECTION 1 — CROP INFORMATION */}
            <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                <span className="w-8 h-8 rounded-xl bg-[#14532d] text-white font-extrabold text-sm flex items-center justify-center">
                  1
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Sprout className="w-4 h-4 text-[#15803d]" />
                    {tKey('crop.section1')}
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label htmlFor="crop-name" className="text-sm font-bold text-slate-700">
                      {tKey('crop.name')} <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => speakFieldHelp('help.crop.name')}
                      aria-label={tKey('crop.name')}
                      className="p-1 rounded-lg text-[#15803d] hover:bg-emerald-50"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    id="crop-name"
                    type="text"
                    list="crop-catalogue-182"
                    required
                    value={safeStr(cropName)}
                    onChange={e => setCropName(safeStr(e.target.value))}
                    placeholder={isHi ? 'जैसे: गेहूँ (Wheat), धान (Rice/Paddy), टमाटर (182 फसलें)' : 'e.g. Wheat, Rice/Paddy, Cotton, Tomato (182 crops trained)'}
                    className="input-field py-2.5 bg-white"
                  />
                  <datalist id="crop-catalogue-182">
                    {catalogueCrops.map(item => (
                      <option
                        key={item.record_id}
                        value={item.crop}
                        label={`${item.crop_group} • ${item.typical_season_or_region} • ${item.indicative_temperature_c}°C`}
                      />
                    ))}
                  </datalist>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label htmlFor="crop-variety" className="text-sm font-bold text-slate-700">
                      {tKey('crop.variety')}
                    </label>
                    <button
                      type="button"
                      onClick={() => speakFieldHelp('help.crop.variety')}
                      aria-label={tKey('crop.variety')}
                      className="p-1 rounded-lg text-[#15803d] hover:bg-emerald-50"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    id="crop-variety"
                    type="text"
                    value={safeStr(cropVariety)}
                    onChange={e => setCropVariety(safeStr(e.target.value))}
                    placeholder={isHi ? 'जैसे: शरबती HI-1544, बासमती 1121' : 'e.g. HD-2967, Sharbati, Pusa Basmati'}
                    className="input-field py-2.5 bg-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label htmlFor="crop-location" className="text-sm font-bold text-slate-700">
                      {tKey('crop.location')} <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => speakFieldHelp('help.crop.location')}
                      aria-label={tKey('crop.location')}
                      className="p-1 rounded-lg text-[#15803d] hover:bg-emerald-50"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    id="crop-location"
                    type="text"
                    required
                    value={safeStr(fieldLocation)}
                    onChange={e => setFieldLocation(safeStr(e.target.value))}
                    placeholder={isHi ? 'गाँव, जिला, राज्य' : 'Village, District, State'}
                    className="input-field py-2.5 bg-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label htmlFor="crop-sowing-date" className="text-sm font-bold text-slate-700">
                      {tKey('crop.sowing_date')}
                    </label>
                    <button
                      type="button"
                      onClick={() => speakFieldHelp('help.crop.sowing_date')}
                      aria-label={tKey('crop.sowing_date')}
                      className="p-1 rounded-lg text-[#15803d] hover:bg-emerald-50"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    id="crop-sowing-date"
                    type="date"
                    value={safeStr(sowingDate)}
                    onChange={e => setSowingDate(safeStr(e.target.value))}
                    className="input-field py-2.5 bg-white"
                  />
                </div>
              </div>

              {/* Trained 182-Crop Reference & Suitability Model Card */}
              {modelEval?.matched && (
                <div className="mt-4 p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#14532d] text-white">
                        {isHi
                          ? `प्रशिक्षित 182-फसल मॉडल (#${modelEval.record_id})`
                          : `Trained 182-Crop Model (#${modelEval.record_id})`}
                      </span>
                      <span className="text-sm font-extrabold text-[#14532d]">
                        {modelEval.crop} ({modelEval.crop_group})
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          modelEval.overall_status === 'stress_alert'
                            ? 'bg-red-100 text-red-800 border border-red-300'
                            : modelEval.overall_status === 'watch'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {isHi ? 'अनुकूलता स्कोर:' : 'Suitability:'} {modelEval.suitability_score}%
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        speechOutput.speak(
                          (isHi ? modelEval.summary_hi : modelEval.summary_en) || '',
                          language
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white hover:bg-emerald-100 text-xs font-bold text-[#14532d] border border-emerald-300 transition-colors cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      {isHi ? 'फसल संदर्भ सुनें' : 'Listen Crop Profile'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-xl bg-white border border-emerald-100">
                      <span className="text-slate-500 block">
                        {isHi ? 'मौसम / क्षेत्र' : 'Typical Season'}
                      </span>
                      <span className="font-bold text-slate-800">
                        {modelEval.typical_season_or_region}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-emerald-100">
                      <span className="text-slate-500 block">
                        {isHi ? 'उपयुक्त तापमान (°C)' : 'Indicative Temp (°C)'}
                      </span>
                      <span className="font-bold text-slate-800">
                        {modelEval.indicative_temperature_c}°C
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-emerald-100">
                      <span className="text-slate-500 block">
                        {isHi ? 'मिट्टी का pH' : 'Indicative Soil pH'}
                      </span>
                      <span className="font-bold text-slate-800">
                        {modelEval.indicative_soil_ph}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-emerald-100">
                      <span className="text-slate-500 block">
                        {isHi ? 'वार्षिक वर्षा (mm)' : 'Annual Rainfall (mm)'}
                      </span>
                      <span className="font-bold text-slate-800">
                        {modelEval.indicative_annual_rainfall_mm}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-700 space-y-1">
                    <p>
                      <span className="font-bold text-[#14532d]">
                        {isHi ? 'मिट्टी और जल निकासी:' : 'Soil & Drainage:'}
                      </span>{' '}
                      {modelEval.soil_texture_and_drainage}
                    </p>
                    <p>
                      <span className="font-bold text-amber-800">
                        {isHi ? 'मुख्य तनाव सावधानियाँ:' : 'Stress Watchouts:'}
                      </span>{' '}
                      {modelEval.stress_watchouts}
                    </p>
                    {modelEval.stage_expected_leaf_colour && (
                      <p>
                        <span className="font-bold text-emerald-900">
                          {isHi
                            ? `इस अवस्था (${growthStage}) के लिए आदर्श पत्ती रंग:`
                            : `Ideal Leaf Colour for Stage (${growthStage}):`}
                        </span>{' '}
                        {modelEval.stage_expected_leaf_colour}
                      </p>
                    )}
                  </div>

                  {/* Prototype Healthy Rate (40/25/20/15 Weighted Model) */}
                  {modelEval.healthy_rate_evaluation && (
                    <div className="p-3 rounded-xl bg-white border border-emerald-200 space-y-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-extrabold text-[#14532d]">
                          {isHi
                            ? `प्रोटोटाइप स्वस्थ दर (Prototype Healthy Rate): ${modelEval.healthy_rate_evaluation.healthy_rate_pct}%`
                            : `Prototype Healthy Rate (4-Component Weighted Score): ${modelEval.healthy_rate_evaluation.healthy_rate_pct}%`}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-900 border border-blue-200 font-bold text-[11px]">
                          {isHi ? 'डेटा विश्वास (Data Confidence):' : 'Data Confidence:'}{' '}
                          {modelEval.healthy_rate_evaluation.data_confidence_pct}%
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                        {modelEval.healthy_rate_evaluation.components.map(comp => (
                          <div
                            key={comp.key}
                            className="p-2 rounded-lg bg-slate-50 border border-slate-200/80"
                          >
                            <span className="text-slate-500 block truncate">
                              {isHi ? comp.label_hi : comp.label_en} ({comp.base_weight_pct}%)
                            </span>
                            <strong className="text-slate-900">
                              {comp.available && comp.score !== null
                                ? `${comp.score}% (eff. ${comp.effective_weight_pct}%)`
                                : isHi
                                ? 'अनुपलब्ध (फोटो अपलोड करें)'
                                : 'Unavailable (upload photo)'}
                            </strong>
                          </div>
                        ))}
                      </div>

                      {modelEval.leaf_colour_analysis && (
                        <div className="pt-1.5 border-t border-slate-100 text-[11px] text-slate-700">
                          <strong>
                            {isHi ? 'फोटो पत्ती-रंग विश्लेषण:' : 'Uploaded Leaf Photo Colour Comparison:'}
                          </strong>{' '}
                          Green foliage: {modelEval.leaf_colour_analysis.green_foliage_pct}% • Yellowing/chlorosis:{' '}
                          {modelEval.leaf_colour_analysis.chlorosis_yellowing_pct}% • Browning/necrosis:{' '}
                          {modelEval.leaf_colour_analysis.browning_necrosis_pct}% • Uniformity:{' '}
                          {modelEval.leaf_colour_analysis.colour_uniformity_score}%
                        </div>
                      )}

                      <p className="text-[10px] text-slate-500">
                        {modelEval.image_comparison_safety_note ||
                          modelEval.healthy_rate_evaluation.safety_note}
                      </p>
                    </div>
                  )}

                  {modelEval.alerts && modelEval.alerts.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {modelEval.alerts.map((al, i) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start justify-between gap-2"
                        >
                          <span>
                            ⚠️ <strong>{al.code}:</strong> {isHi ? al.reason_hi : al.reason_en}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              speechOutput.speak(isHi ? al.reason_hi : al.reason_en, language)
                            }
                            className="p-1 rounded-lg text-amber-900 hover:bg-amber-100 flex-shrink-0"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-[11px] text-slate-500 italic">
                    {modelEval.reference_basis} • {modelEval.confidence_note}
                  </p>
                </div>
              )}
            </section>

            {/* SECTION 2 — GROWTH AND IRRIGATION */}
            <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                <span className="w-8 h-8 rounded-xl bg-[#14532d] text-white font-extrabold text-sm flex items-center justify-center">
                  2
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-[#15803d]" />
                    {tKey('crop.section2')}
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label htmlFor="crop-growth-stage" className="text-sm font-bold text-slate-700">
                      {tKey('crop.growth_stage')} <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => speakFieldHelp('help.crop.growth_stage')}
                      aria-label={tKey('crop.growth_stage')}
                      className="p-1 rounded-lg text-[#15803d] hover:bg-emerald-50"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                  <select
                    id="crop-growth-stage"
                    value={safeStr(growthStage, 'Vegetative')}
                    onChange={e => setGrowthStage(e.target.value)}
                    className="input-field py-2.5 bg-white"
                  >
                    {GROWTH_STAGES.map(st => (
                      <option key={st.value} value={st.value}>
                        {isHi ? st.hi : st.en}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label htmlFor="crop-growth-progress" className="text-sm font-bold text-slate-700">
                      {tKey('crop.growth_progress')} <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => speakFieldHelp('help.crop.growth_progress')}
                      aria-label={tKey('crop.growth_progress')}
                      className="p-1 rounded-lg text-[#15803d] hover:bg-emerald-50"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    <input
                      id="crop-growth-progress"
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      required
                      value={safeStr(growthProgressPct)}
                      onChange={e => setGrowthProgressPct(safeStr(e.target.value))}
                      placeholder="0 - 100"
                      className="input-field py-2.5 bg-white"
                    />
                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-[#15803d] transition-all"
                        style={{
                          width: `${Math.min(100, Math.max(0, Number(growthProgressPct) || 0))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label htmlFor="crop-irrigation" className="text-sm font-bold text-slate-700">
                      {tKey('crop.irrigation_method')} <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => speakFieldHelp('help.crop.irrigation_method')}
                      aria-label={tKey('crop.irrigation_method')}
                      className="p-1 rounded-lg text-[#15803d] hover:bg-emerald-50"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                  <select
                    id="crop-irrigation"
                    value={safeStr(irrigationMethod, 'Drip Irrigation')}
                    onChange={e => setIrrigationMethod(e.target.value)}
                    className="input-field py-2.5 bg-white"
                  >
                    {IRRIGATION_METHODS.map(m => (
                      <option key={m.value} value={m.value}>
                        {isHi ? m.hi : m.en}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label htmlFor="crop-rainfall" className="text-sm font-bold text-slate-700">
                      {tKey('crop.rainfall')}{' '}
                      <span className="text-xs font-normal text-slate-400">
                        ({tKey('common.optional')})
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => speakFieldHelp('help.crop.rainfall')}
                      aria-label={tKey('crop.rainfall')}
                      className="p-1 rounded-lg text-[#15803d] hover:bg-emerald-50"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    id="crop-rainfall"
                    type="number"
                    min="0"
                    max="5000"
                    step="0.5"
                    value={safeStr(recentRainfallMm)}
                    onChange={e => setRecentRainfallMm(safeStr(e.target.value))}
                    placeholder={isHi ? 'जैसे: 15' : 'e.g. 15'}
                    className="input-field py-2.5 bg-white"
                  />
                </div>
              </div>
            </section>

            {/* SECTION 3 — FIELD CONDITIONS */}
            <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                <span className="w-8 h-8 rounded-xl bg-[#14532d] text-white font-extrabold text-sm flex items-center justify-center">
                  3
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Thermometer className="w-4 h-4 text-[#15803d]" />
                    {tKey('crop.section3')}
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label htmlFor="crop-moisture" className="text-sm font-bold text-slate-700">
                      {tKey('crop.soil_moisture')}
                    </label>
                    <button
                      type="button"
                      onClick={() => speakFieldHelp('help.crop.soil_moisture')}
                      aria-label={tKey('crop.soil_moisture')}
                      className="p-1 rounded-lg text-[#15803d] hover:bg-emerald-50"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    id="crop-moisture"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={safeStr(soilMoisturePct)}
                    onChange={e => setSoilMoisturePct(safeStr(e.target.value))}
                    placeholder="0 - 100%"
                    className="input-field py-2.5 bg-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label htmlFor="crop-temp" className="text-sm font-bold text-slate-700">
                      {tKey('crop.temperature')}
                    </label>
                    <button
                      type="button"
                      onClick={() => speakFieldHelp('help.crop.temperature')}
                      aria-label={tKey('crop.temperature')}
                      className="p-1 rounded-lg text-[#15803d] hover:bg-emerald-50"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    id="crop-temp"
                    type="number"
                    min="-10"
                    max="60"
                    step="0.5"
                    value={safeStr(fieldTemperatureC)}
                    onChange={e => setFieldTemperatureC(safeStr(e.target.value))}
                    placeholder="e.g. 26.5"
                    className="input-field py-2.5 bg-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label htmlFor="crop-humidity" className="text-sm font-bold text-slate-700">
                      {tKey('crop.humidity')}
                    </label>
                    <button
                      type="button"
                      onClick={() => speakFieldHelp('help.crop.humidity')}
                      aria-label={tKey('crop.humidity')}
                      className="p-1 rounded-lg text-[#15803d] hover:bg-emerald-50"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    id="crop-humidity"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={safeStr(humidityPct)}
                    onChange={e => setHumidityPct(safeStr(e.target.value))}
                    placeholder="0 - 100%"
                    className="input-field py-2.5 bg-white"
                  />
                </div>
              </div>
            </section>

            {/* SECTION 4 — FERTILIZER AND PESTICIDE */}
            <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                <span className="w-8 h-8 rounded-xl bg-[#14532d] text-white font-extrabold text-sm flex items-center justify-center">
                  4
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-[#15803d]" />
                    {tKey('crop.section4')}
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label htmlFor="crop-fertilizer" className="text-sm font-bold text-slate-700">
                      {tKey('crop.fertilizer')}
                    </label>
                    <button
                      type="button"
                      onClick={() => speakFieldHelp('help.crop.fertilizer')}
                      aria-label={tKey('crop.fertilizer')}
                      className="p-1 rounded-lg text-[#15803d] hover:bg-emerald-50"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    id="crop-fertilizer"
                    type="text"
                    value={safeStr(fertilizerUsed)}
                    onChange={e => setFertilizerUsed(safeStr(e.target.value))}
                    placeholder={isHi ? 'जैसे: डीएपी (DAP), यूरिया, वर्मीकम्पोस्ट' : 'e.g. DAP, Urea, NPK 19:19:19, Vermicompost'}
                    className="input-field py-2.5 bg-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label htmlFor="crop-pesticide" className="text-sm font-bold text-slate-700">
                      {tKey('crop.pesticide')}
                    </label>
                    <button
                      type="button"
                      onClick={() => speakFieldHelp('help.crop.pesticide')}
                      aria-label={tKey('crop.pesticide')}
                      className="p-1 rounded-lg text-[#15803d] hover:bg-emerald-50"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    id="crop-pesticide"
                    type="text"
                    value={safeStr(pesticideUsed)}
                    onChange={e => setPesticideUsed(safeStr(e.target.value))}
                    placeholder={isHi ? 'जैसे: नीम तेल, मैंकोज़ेब, इमिडाक्लोप्रिड (या कोई नहीं)' : 'e.g. Neem Oil, Mancozeb, Imidacloprid (or None)'}
                    className="input-field py-2.5 bg-white"
                  />
                </div>
              </div>
            </section>

            {/* SECTION 5 — CROP PHOTOGRAPH AND SYMPTOMS */}
            <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                <span className="w-8 h-8 rounded-xl bg-[#14532d] text-white font-extrabold text-sm flex items-center justify-center">
                  5
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-[#15803d]" />
                    {tKey('crop.section5')}
                  </h3>
                </div>
              </div>

              {/* Instructions Box */}
              <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-950 space-y-1">
                <p className="font-bold">
                  {isHi
                    ? 'फोटो अपलोड करने के निर्देश:'
                    : 'Instructions for Uploading Crop / Leaf Photograph:'}
                </p>
                <p>
                  {isHi
                    ? '• पौधे या प्रभावित पत्ते की दिन की रोशनी में साफ और नजदीक से फोटो लें। • स्वीकार्य प्रारूप: JPG, PNG, WEBP (अधिकतम 10 MB)।'
                    : '• Capture a clear, well-lit close-up photograph of the plant or affected leaf surface. • Supported formats: JPG, PNG, WEBP (up to 10 MB).'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Photograph Upload */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label htmlFor="crop-photo-upload" className="text-sm font-bold text-slate-700">
                      {tKey('crop.photo')}
                    </label>
                    <button
                      type="button"
                      onClick={() => speakFieldHelp('help.crop.photo')}
                      aria-label={tKey('crop.photo')}
                      className="p-1 rounded-lg text-[#15803d] hover:bg-emerald-50"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>

                  <input
                    id="crop-photo-upload"
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />

                  {photoPreviewUrl ? (
                    <div className="relative rounded-2xl border-2 border-emerald-300 bg-white p-3 space-y-2">
                      <img
                        src={photoPreviewUrl}
                        alt="Crop preview"
                        className="w-full h-44 object-cover rounded-xl border border-slate-200"
                      />
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-slate-700 truncate flex items-center gap-1.5">
                          <ImageIcon className="w-4 h-4 text-[#15803d] flex-shrink-0" />
                          {photoFile?.name || safeStr(existingFileName) || (isHi ? 'सहेजी गई फसल फोटो' : 'Saved Crop Photograph')}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-2.5 py-1 rounded-lg bg-emerald-100 text-[#14532d] font-bold hover:bg-emerald-200"
                          >
                            {isHi ? 'बदलें' : 'Change'}
                          </button>
                          {photoFile && (
                            <button
                              type="button"
                              onClick={clearSelectedPhoto}
                              className="p-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-red-100 hover:text-red-700"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-44 rounded-2xl border-2 border-dashed border-emerald-300 hover:border-[#15803d] bg-white hover:bg-emerald-50/40 transition-all flex flex-col items-center justify-center p-4 text-center cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-[#14532d] flex items-center justify-center mb-2">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <span className="text-sm font-bold text-slate-800">
                        {isHi ? 'फोटो चुनने के लिए यहाँ क्लिक करें' : 'Click to Upload Plant or Leaf Photograph'}
                      </span>
                      <span className="text-xs text-slate-500 mt-1">
                        JPG, PNG, WEBP • Max 10 MB
                      </span>
                    </button>
                  )}
                </div>

                {/* Visible Symptoms */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label htmlFor="crop-symptoms" className="text-sm font-bold text-slate-700">
                      {tKey('crop.symptoms')}
                    </label>
                    <button
                      type="button"
                      onClick={() => speakFieldHelp('help.crop.symptoms')}
                      aria-label={tKey('crop.symptoms')}
                      className="p-1 rounded-lg text-[#15803d] hover:bg-emerald-50"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                  <textarea
                    id="crop-symptoms"
                    rows={6}
                    value={safeStr(visibleSymptoms)}
                    onChange={e => setVisibleSymptoms(safeStr(e.target.value))}
                    placeholder={
                      isHi
                        ? 'जैसे: निचली पत्तियों पर पीले धब्बे, किनारे सूखना, या पत्तियों का मुड़ना (यदि फसल स्वस्थ है तो खाली छोड़ें)…'
                        : 'Describe any yellowing, brown spots, wilting, leaf curl, or pest damage (leave blank if crop appears healthy)…'
                    }
                    className="input-field py-2.5 bg-white resize-none"
                  />
                </div>
              </div>
            </section>

            {/* Bottom Navigation & Save Buttons */}
            <div className="pt-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => navigate('/farmer-details')}
                className="px-5 py-3.5 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                {tKey('crop.backToFarmerBtn')}
              </button>

              <button
                type="submit"
                disabled={saving}
                className="px-8 py-3.5 rounded-2xl bg-[#15803d] hover:bg-[#14532d] disabled:opacity-60 text-white font-bold text-base shadow-md hover:shadow-lg inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{tKey('common.loading')}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>{tKey('crop.saveBtn')}</span>
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
