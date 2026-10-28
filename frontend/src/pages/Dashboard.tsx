import { useEffect } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Sprout,
  Activity,
  AlertTriangle,
  ClipboardCheck,
  TrendingDown,
  MapPin,
  CloudSun,
  ArrowRight,
  Clock,
  ShieldAlert,
  Plus,
  ScanSearch,
  Droplets,
  Thermometer,
  UserCheck,
  FileEdit,
  FlaskConical,
  Camera,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import {
  reportsApi,
  fieldsApi,
  weatherApi,
  farmerApi,
  cropsApi,
  safeStr,
} from '@/services/cropsentinel'
import { useWeatherStore } from '@/store/weatherStore'
import { useAuthStore } from '@/store/authStore'
import { useI18n, translateRiskStatus, translateGrowthStage } from '@/i18n/translations'
import SpeakButton from '@/components/common/SpeakButton'

interface OutletCtx {
  openLocationModal: () => void
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { openLocationModal } = useOutletContext<OutletCtx>()
  const { location, setLocation, currencySymbol } = useWeatherStore()
  const { user, farmerProfile, latestCrop, setFarmerProfile, setLatestCrop } = useAuthStore()
  const { language, t } = useI18n()
  const isHi = language === 'hi'
  const d = t.dashboard

  const farmerProfileQuery = useQuery({
    queryKey: ['farmer-profile'],
    queryFn: farmerApi.getProfile,
  })

  const latestCropQuery = useQuery({
    queryKey: ['latest-crop'],
    queryFn: cropsApi.getLatest,
  })

  useEffect(() => {
    if (farmerProfileQuery.data) {
      setFarmerProfile(farmerProfileQuery.data)
    }
  }, [farmerProfileQuery.data, setFarmerProfile])

  useEffect(() => {
    if (latestCropQuery.data) {
      setLatestCrop(latestCropQuery.data)
    }
  }, [latestCropQuery.data, setLatestCrop])

  const activeProfile = farmerProfileQuery.data ?? farmerProfile
  const activeCrop = latestCropQuery.data ?? latestCrop

  // Auto-resolve weather location from farmer's District / State if no location chosen yet
  useEffect(() => {
    if (location || !activeProfile) return
    const queryStr = safeStr(activeProfile.district) || safeStr(activeProfile.state)
    if (!queryStr) return
    weatherApi
      .searchLocations(queryStr)
      .then(res => {
        if (res && res.length > 0) {
          const top = res[0]
          setLocation({
            name: top.name,
            lat: top.latitude,
            lon: top.longitude,
            country: top.country,
            admin1: top.admin1 ?? safeStr(activeProfile.state),
          })
        }
      })
      .catch(() => {
        // ignore
      })
  }, [location, activeProfile, setLocation])

  const summaryQuery = useQuery({
    queryKey: ['reports-summary'],
    queryFn: () => reportsApi.getSummary(),
  })

  const fieldsQuery = useQuery({
    queryKey: ['fields'],
    queryFn: fieldsApi.list,
  })

  const weatherQuery = useQuery({
    queryKey: ['weather-forecast', location?.lat, location?.lon],
    queryFn: () => weatherApi.getForecast(location!.lat, location!.lon, location!.name),
    enabled: !!location,
    retry: 1,
  })

  const targetCropForModel = safeStr(activeCrop?.crop_name || activeProfile?.main_crop)
  const cropModelQuery = useQuery({
    queryKey: [
      'crop-model-eval',
      targetCropForModel,
      activeCrop?.field_temperature_c,
      activeCrop?.recent_rainfall_mm,
      activeCrop?.soil_moisture_pct,
      activeCrop?.humidity_pct,
      activeProfile?.soil_type,
      activeCrop?.growth_stage,
      activeCrop?.growth_progress_pct,
      activeCrop?.visible_symptoms,
      activeCrop?.image_filename,
    ],
    queryFn: () =>
      cropsApi.evaluateModel({
        crop_name: targetCropForModel,
        field_temperature_c: activeCrop?.field_temperature_c ?? weatherQuery.data?.current?.temperature_c ?? null,
        recent_rainfall_mm: activeCrop?.recent_rainfall_mm ?? null,
        soil_moisture_pct: activeCrop?.soil_moisture_pct ?? null,
        humidity_pct: activeCrop?.humidity_pct ?? weatherQuery.data?.current?.relative_humidity_pct ?? null,
        soil_type: activeProfile?.soil_type ?? null,
        growth_stage: activeCrop?.growth_stage ?? 'Vegetative',
        growth_progress_pct: activeCrop?.growth_progress_pct ?? null,
        visible_symptoms: activeCrop?.visible_symptoms ?? null,
        image_filename: activeCrop?.image_filename ?? null,
      }),
    enabled: !!targetCropForModel,
  })
  const modelEval = cropModelQuery.data

  const summary = summaryQuery.data
  const cards = summary?.summary_cards
  const fields = fieldsQuery.data ?? []
  const isDemo = summary?.is_demo ?? false

  const farmerDisplayName = safeStr(
    activeProfile?.farmer_name || user?.full_name,
    isHi ? 'किसान भाई' : 'Farmer'
  )
  const farmLocationText = [
    safeStr(activeProfile?.village_town),
    safeStr(activeProfile?.district),
    safeStr(activeProfile?.state),
  ]
    .filter(Boolean)
    .join(', ')

  // Compute real irrigation recommendation from saved Crop Details + Weather
  const moistureVal = activeCrop?.soil_moisture_pct
  const recentRainVal = activeCrop?.recent_rainfall_mm
  const irrigationAdviceEn = (() => {
    if (moistureVal !== null && moistureVal !== undefined) {
      if (moistureVal < 35) {
        return `Soil moisture is low (${moistureVal}%). Schedule ${safeStr(
          activeCrop?.irrigation_method,
          'irrigation'
        )} within the next 24 hours during early morning or evening.`
      }
      if (moistureVal > 75 || (recentRainVal && recentRainVal >= 20)) {
        return `Soil moisture is adequate/high (${moistureVal}%). Avoid additional irrigation for 2–3 days and ensure proper field drainage.`
      }
      return `Soil moisture is balanced (${moistureVal}%). Maintain regular ${safeStr(
        activeCrop?.irrigation_method,
        'scheduled'
      )} cycle based on evapotranspiration.`
    }
    return `Monitor topsoil moisture at 5–10 cm depth and adjust ${safeStr(
      activeCrop?.irrigation_method || activeProfile?.irrigation_source,
      'irrigation'
    )} according to local rainfall.`
  })()

  const irrigationAdviceHi = (() => {
    if (moistureVal !== null && moistureVal !== undefined) {
      if (moistureVal < 35) {
        return `मिट्टी की नमी कम (${moistureVal}%) है। अगले 24 घंटों में सुबह या शाम के समय ${safeStr(
          activeCrop?.irrigation_method,
          'सिंचाई'
        )} करें।`
      }
      if (moistureVal > 75 || (recentRainVal && recentRainVal >= 20)) {
        return `मिट्टी में पर्याप्त नमी (${moistureVal}%) है। अगले 2–3 दिन अतिरिक्त सिंचाई न करें और जल निकासी का ध्यान रखें।`
      }
      return `मिट्टी की नमी संतुलित (${moistureVal}%) है। ${safeStr(
        activeCrop?.irrigation_method,
        'नियमित सिंचाई'
      )} चक्र बनाए रखें।`
    }
    return `5–10 सेमी गहराई पर मिट्टी की नमी जांचें और बारिश के अनुसार ${safeStr(
      activeCrop?.irrigation_method || activeProfile?.irrigation_source,
      'सिंचाई'
    )} करें।`
  })()

  // Farmer-friendly spoken overview summary
  const overviewSpeechEn = `Welcome ${farmerDisplayName}. ${
    activeCrop
      ? `Your main crop is ${activeCrop.crop_name} at ${activeCrop.growth_stage} stage (${activeCrop.growth_progress_pct}% progress). ${irrigationAdviceEn}`
      : ''
  } You have ${cards?.total_fields ?? 0} monitored fields, ${
    cards?.total_assessments ?? 0
  } logged crop assessments, and ${cards?.active_recommendations ?? 0} active recommended tasks.`

  const overviewSpeechHi = `नमस्ते ${farmerDisplayName}। ${
    activeCrop
      ? `आपकी मुख्य फसल ${activeCrop.crop_name} (${translateGrowthStage(
          activeCrop.growth_stage,
          'hi'
        )}, ${activeCrop.growth_progress_pct}% प्रगति) है। ${irrigationAdviceHi}`
      : ''
  } आपके कुल ${cards?.total_fields ?? 0} खेत दर्ज हैं, ${
    cards?.total_assessments ?? 0
  } फसल जांच पूरी हुई हैं, और आज के लिए ${cards?.active_recommendations ?? 0} ज़रूरी कार्य हैं।`

  // Farmer-friendly spoken weather summary
  const wData = weatherQuery.data
  const rain7dSum = wData
    ? wData.daily.reduce((acc, item) => acc + (item.precipitation_sum_mm ?? 0), 0).toFixed(1)
    : '0'
  const weatherSpeechEn = wData
    ? `Weather for ${wData.location_name}: Temperature is ${wData.current.temperature_c ?? 'unknown'} degrees Celsius, humidity is ${
        wData.current.relative_humidity_pct ?? 'unknown'
      } percent, and 7-day forecast rainfall is ${rain7dSum} millimeters. ${
        wData.weather_risks?.[0]?.title || ''
      }`
    : 'No live weather forecast is currently loaded. Please select your farm location first.'

  const weatherSpeechHi = wData
    ? `${wData.location_name} का मौसम: अभी तापमान ${wData.current.temperature_c ?? '—'} डिग्री सेल्सियस है, हवा में नमी ${
        wData.current.relative_humidity_pct ?? '—'
      } प्रतिशत है, और अगले 7 दिनों में ${rain7dSum} मिलीमीटर बारिश का अनुमान है। ${
        wData.weather_risks?.[0]?.title || ''
      }`
    : 'अभी कोई मौसम स्थान नहीं चुना गया है। कृपया अपना गांव या शहर चुनें।'

  // Farmer-friendly spoken recommendations
  const actionsList = summary?.recommended_actions ?? []
  const adviceSpeechEn =
    actionsList.length > 0
      ? `Recommended actions today: ${actionsList
          .slice(0, 3)
          .map((a, idx) => `Action ${idx + 1}: ${a.title}. ${a.reason}`)
          .join(' ')}`
      : 'There are no pending recommended actions right now.'

  const adviceSpeechHi =
    actionsList.length > 0
      ? `आज की प्रमुख कृषि सलाह: ${actionsList
          .slice(0, 3)
          .map((a, idx) => `सलाह ${idx + 1}: ${a.title}। ${a.reason}`)
          .join(' ')}`
      : 'अभी कोई लंबित कृषि कार्य नहीं है।'

  return (
    <div className="space-y-6">
      {/* Top Welcome Banner with Farmer Profile & Onboarding Controls */}
      <div className="rounded-3xl bg-gradient-to-r from-[#14532d] via-[#166534] to-[#15803d] text-white p-6 shadow-md border border-emerald-800/40">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/15 text-emerald-200">
                {isHi ? 'किसान डैशबोर्ड • स्मार्ट कृषि मंच' : 'FARMER DASHBOARD • SMART AGRICULTURE PLATFORM'}
              </span>
              {activeProfile?.growing_season && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-400/20 text-emerald-100 border border-emerald-300/30">
                  {isHi ? `सीजन: ${activeProfile.growing_season}` : `Season: ${activeProfile.growing_season}`}
                </span>
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {isHi ? `नमस्ते, ${farmerDisplayName}!` : `Welcome, ${farmerDisplayName}!`}
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100/90 flex flex-wrap items-center gap-x-4 gap-y-1">
              {farmLocationText && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-300" />
                  {farmLocationText}
                </span>
              )}
              {activeProfile?.total_land_acres ? (
                <span>
                  • {isHi ? 'कुल ज़मीन:' : 'Land:'}{' '}
                  <strong>{activeProfile.total_land_acres} {isHi ? 'एकड़' : 'acres'}</strong>
                </span>
              ) : null}
              {activeProfile?.soil_type ? (
                <span>
                  • {isHi ? 'मिट्टी:' : 'Soil:'} <strong>{activeProfile.soil_type}</strong>
                </span>
              ) : null}
              {activeProfile?.irrigation_source ? (
                <span>
                  • {isHi ? 'सिंचाई स्रोत:' : 'Water Source:'} <strong>{activeProfile.irrigation_source}</strong>
                </span>
              ) : null}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <SpeakButton
              textEn={overviewSpeechEn}
              textHi={overviewSpeechHi}
              labelEn={d.listenOverviewBtn}
              labelHi={d.listenOverviewBtn}
            />
            <button
              type="button"
              onClick={() => navigate('/farmer-details')}
              className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold border border-white/20 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <UserCheck className="w-4 h-4 text-emerald-300" />
              {isHi ? 'किसान विवरण' : 'Farmer Details'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/crop-details')}
              className="px-3.5 py-2 rounded-xl bg-white text-[#14532d] hover:bg-emerald-50 text-xs font-extrabold shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileEdit className="w-4 h-4 text-[#15803d]" />
              {isHi ? 'फसल विवरण अपडेट करें' : 'Update Crop Details'}
            </button>
          </div>
        </div>
      </div>

      {/* ─── DECISION LAB & BUTTERFLY ENGINE HERO LAUNCHER ────────────── */}
      <div className="surface-card p-5 border-2 border-emerald-500/50 bg-gradient-to-r from-emerald-50/60 via-white to-stone-50 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-600 text-white">
              {isHi ? 'नया फीचर • डिसीजन लैब' : 'NEW FEATURE • DECISION LAB'}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-stone-100 text-stone-700 border border-stone-200">
              {isHi ? 'बटरफ्लाई रिस्क इंजन सक्रिय' : 'Butterfly Effect Engine Active'}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-stone-100 text-stone-700 border border-stone-200">
              {isHi ? 'शून्य-बजट मोड उपलब्ध' : 'Zero-Budget Mode Ready'}
            </span>
          </div>
          <h3 className="font-extrabold text-base text-stone-900 mt-1">
            {isHi
              ? 'समानांतर कृषि सिमुलेशन: क्या होगा यदि आज अलग निर्णय लिया जाए?'
              : 'Parallel Universe Farming: What if you make a different decision today?'}
          </h3>
          <p className="text-xs text-stone-600 max-w-2xl leading-relaxed">
            {isHi
              ? 'यथास्थिति, अनुशंसित उपाय, और प्रतिकूल मौसम के 3 समानांतर परिदृश्यों की तुलना करें। बजट व जल सीमाओं के तहत सटीक आरओआई देखें।'
              : 'Compare 3 simultaneous futures (Status Quo vs Recommended Action vs Adverse Climate Shock) grounded in 182-crop biological envelopes and resource limits.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap self-start md:self-center">
          <button
            type="button"
            onClick={() => navigate('/simulator')}
            className="btn-primary text-xs py-2.5 px-4 font-bold shadow-md bg-emerald-700 hover:bg-emerald-800 flex items-center gap-2"
          >
            <span>{isHi ? 'डिसीजन लैब खोलें' : 'Open Decision Lab'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/planner')}
            className="btn-secondary text-xs py-2.5 px-3.5 font-bold"
          >
            {isHi ? 'बचाव अनुकूलक' : 'Rescue Optimizer'}
          </button>
        </div>
      </div>

      {/* Main Crop, Irrigation, Fertilizer/Pesticide & Photograph Overview */}
      {activeCrop ? (
        <div className="surface-card p-5 sm:p-6 border-l-4 border-l-[#15803d]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#15803d]">
                {isHi ? 'मुख्य फसल और खेत की स्थिति' : 'MAIN CROP & FIELD CONDITIONS'}
              </span>
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2 mt-0.5">
                <Sprout className="w-5 h-5 text-[#15803d]" />
                <span>{safeStr(activeCrop.crop_name)}</span>
                {safeStr(activeCrop.crop_variety) && (
                  <span className="text-sm font-semibold text-slate-500">
                    ({safeStr(activeCrop.crop_variety)})
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isHi ? 'खेत का स्थान:' : 'Field Location:'}{' '}
                <strong className="text-slate-700">{safeStr(activeCrop.field_location, '—')}</strong>
                {safeStr(activeCrop.sowing_date) && (
                  <>
                    {' '}• {isHi ? 'बुवाई तिथि:' : 'Sowing Date:'}{' '}
                    <strong className="text-slate-700">{safeStr(activeCrop.sowing_date)}</strong>
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => navigate('/detection')}
                className="btn-primary text-xs py-2 px-3.5"
              >
                <ScanSearch className="w-4 h-4" />
                {isHi ? 'बीमारी की जांच करें (Disease Detection)' : 'Run Disease Detection'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/crop-details')}
                className="btn-secondary text-xs py-2 px-3"
              >
                <FileEdit className="w-3.5 h-3.5" />
                {isHi ? 'फसल विवरण बदलें' : 'Edit Crop'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Column 1: Growth Progress & Field Conditions */}
            <div className="space-y-3 bg-[#f7f9f6] p-4 rounded-2xl border border-slate-200/80">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">
                  {isHi ? 'विकास अवस्था:' : 'Growth Stage:'}{' '}
                  <span className="text-[#14532d]">
                    {translateGrowthStage(safeStr(activeCrop.growth_stage, 'Vegetative'), language)}
                  </span>
                </span>
                <span className="font-extrabold text-[#15803d]">
                  {activeCrop.growth_progress_pct ?? 0}%
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-[#15803d]"
                  style={{
                    width: `${Math.min(100, Math.max(0, Number(activeCrop.growth_progress_pct) || 0))}%`,
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2 text-xs">
                <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
                  <span className="text-slate-500 block">
                    {isHi ? 'मिट्टी की नमी' : 'Soil Moisture'}
                  </span>
                  <span className="text-sm font-extrabold text-slate-900">
                    {activeCrop.soil_moisture_pct !== null && activeCrop.soil_moisture_pct !== undefined
                      ? `${activeCrop.soil_moisture_pct}%`
                      : '—'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
                  <span className="text-slate-500 block">
                    {isHi ? 'खेत का तापमान' : 'Field Temp'}
                  </span>
                  <span className="text-sm font-extrabold text-slate-900">
                    {activeCrop.field_temperature_c !== null && activeCrop.field_temperature_c !== undefined
                      ? `${activeCrop.field_temperature_c}°C`
                      : '—'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
                  <span className="text-slate-500 block">
                    {isHi ? 'हवा में नमी' : 'Humidity'}
                  </span>
                  <span className="text-sm font-extrabold text-slate-900">
                    {activeCrop.humidity_pct !== null && activeCrop.humidity_pct !== undefined
                      ? `${activeCrop.humidity_pct}%`
                      : '—'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
                  <span className="text-slate-500 block">
                    {isHi ? 'हाल की बारिश' : 'Recent Rain'}
                  </span>
                  <span className="text-sm font-extrabold text-slate-900">
                    {activeCrop.recent_rainfall_mm !== null && activeCrop.recent_rainfall_mm !== undefined
                      ? `${activeCrop.recent_rainfall_mm} mm`
                      : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Column 2: Irrigation Advisory & Fertilizer / Pesticide Inputs */}
            <div className="space-y-3 bg-[#f7f9f6] p-4 rounded-2xl border border-slate-200/80">
              <div className="p-3 rounded-xl bg-emerald-50/90 border border-emerald-200 text-xs space-y-1">
                <p className="font-extrabold text-[#14532d] flex items-center gap-1.5">
                  <Droplets className="w-4 h-4 text-[#15803d]" />
                  {isHi ? 'सिंचाई सलाह (Irrigation Recommendation)' : 'Irrigation Recommendation'}
                </p>
                <p className="text-slate-700 leading-relaxed">
                  {isHi ? irrigationAdviceHi : irrigationAdviceEn}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200/80 text-xs space-y-2">
                <p className="font-extrabold text-slate-800 flex items-center gap-1.5">
                  <FlaskConical className="w-4 h-4 text-[#15803d]" />
                  {isHi ? 'खाद और कीटनाशक विवरण' : 'Fertilizer & Pesticide Applied'}
                </p>
                <div className="grid grid-cols-1 gap-1.5 text-slate-600">
                  <div>
                    <span className="font-semibold text-slate-800">
                      {isHi ? 'खाद (Fertilizer): ' : 'Fertilizer: '}
                    </span>
                    <span>
                      {safeStr(
                        activeCrop.fertilizer_used,
                        isHi ? 'अभी दर्ज नहीं किया गया' : 'Not recorded yet'
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">
                      {isHi ? 'कीटनाशक (Pesticide): ' : 'Pesticide: '}
                    </span>
                    <span>
                      {safeStr(
                        activeCrop.pesticide_used,
                        isHi ? 'अभी दर्ज नहीं किया गया' : 'Not recorded yet'
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 3: Uploaded Crop Photograph & Visible Symptoms */}
            <div className="space-y-3 bg-[#f7f9f6] p-4 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
              <div>
                <p className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5 mb-2">
                  <Camera className="w-4 h-4 text-[#15803d]" />
                  {isHi ? 'फसल की फोटो और लक्षण' : 'Crop Photograph & Symptoms'}
                </p>

                {safeStr(activeCrop.image_url) ? (
                  <img
                    src={safeStr(activeCrop.image_url)}
                    alt={safeStr(activeCrop.crop_name)}
                    className="w-full h-32 object-cover rounded-xl border border-slate-200 mb-2"
                  />
                ) : (
                  <div className="w-full h-24 rounded-xl border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-center p-2 mb-2">
                    <span className="text-xs text-slate-500">
                      {isHi ? 'कोई फसल फोटो अपलोड नहीं की गई' : 'No crop photograph uploaded yet'}
                    </span>
                  </div>
                )}

                <p className="text-xs text-slate-700">
                  <span className="font-semibold">
                    {isHi ? 'दिखाई देने वाले लक्षण: ' : 'Reported Symptoms: '}
                  </span>
                  {safeStr(
                    activeCrop.visible_symptoms,
                    isHi ? 'कोई लक्षण दर्ज नहीं (स्वस्थ)' : 'No visible symptoms reported'
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate('/crop-details')}
                className="text-xs font-bold text-[#15803d] hover:underline inline-flex items-center gap-1 mt-2"
              >
                {isHi ? 'फोटो या लक्षण अपडेट करें' : 'Update Photo or Symptoms'} <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Integrated 182-Crop Trained Model (FAO EcoCrop / ICAR) Screening Banner */}
          {modelEval?.matched && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#14532d] text-white">
                      {isHi
                        ? `प्रशिक्षित 182-फसल मॉडल (#${modelEval.record_id})`
                        : `Trained 182-Crop Model (#${modelEval.record_id})`}
                    </span>
                    <span className="text-xs font-extrabold text-[#14532d]">
                      {modelEval.crop} ({modelEval.crop_group}) • {modelEval.reference_basis}
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
                      {isHi ? 'अनुकूलता स्कोर:' : 'Suitability Score:'} {modelEval.suitability_score}%
                    </span>
                  </div>

                  <SpeakButton
                    textEn={modelEval.summary_en || ''}
                    textHi={modelEval.summary_hi || ''}
                    labelEn="Listen Crop Model"
                    labelHi="फसल मॉडल सुनें"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 rounded-xl bg-white border border-emerald-100">
                    <span className="text-slate-500 block">{isHi ? 'मौसम / क्षेत्र' : 'Typical Season'}</span>
                    <span className="font-bold text-slate-800">{modelEval.typical_season_or_region}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white border border-emerald-100">
                    <span className="text-slate-500 block">{isHi ? 'उपयुक्त तापमान' : 'Indicative Temp'}</span>
                    <span className="font-bold text-slate-800">{modelEval.indicative_temperature_c}°C</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white border border-emerald-100">
                    <span className="text-slate-500 block">{isHi ? 'मिट्टी का pH' : 'Indicative Soil pH'}</span>
                    <span className="font-bold text-slate-800">{modelEval.indicative_soil_ph}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white border border-emerald-100">
                    <span className="text-slate-500 block">{isHi ? 'वार्षिक वर्षा' : 'Annual Rainfall'}</span>
                    <span className="font-bold text-slate-800">{modelEval.indicative_annual_rainfall_mm} mm</span>
                  </div>
                </div>

                <p className="text-xs text-slate-700">
                  <strong className="text-[#14532d]">{isHi ? 'मिट्टी व जल निकासी:' : 'Soil & Drainage:'}</strong>{' '}
                  {modelEval.soil_texture_and_drainage} •{' '}
                  <strong className="text-amber-800">{isHi ? 'मुख्य सावधानी:' : 'Stress Watchouts:'}</strong>{' '}
                  {modelEval.stress_watchouts}
                </p>

                {modelEval.stage_expected_leaf_colour && (
                  <p className="text-xs text-emerald-900 bg-white/70 p-2 rounded-xl border border-emerald-100">
                    <strong className="text-[#14532d]">
                      {isHi
                        ? `अवस्था (${activeCrop?.growth_stage || 'Vegetative'}) के लिए आदर्श पत्ती रंग:`
                        : `Ideal Leaf Colour (${activeCrop?.growth_stage || 'Vegetative'}):`}
                    </strong>{' '}
                    {modelEval.stage_expected_leaf_colour}
                  </p>
                )}

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
                        <div key={comp.key} className="p-2 rounded-lg bg-slate-50 border border-slate-200/80">
                          <span className="text-slate-500 block truncate">
                            {isHi ? comp.label_hi : comp.label_en} ({comp.base_weight_pct}%)
                          </span>
                          <strong className="text-slate-900">
                            {comp.available && comp.score !== null
                              ? `${comp.score}% (eff. ${comp.effective_weight_pct}%)`
                              : isHi
                              ? 'अनुपलब्ध'
                              : 'Unavailable'}
                          </strong>
                        </div>
                      ))}
                    </div>

                    {modelEval.leaf_colour_analysis && (
                      <div className="pt-1.5 border-t border-slate-100 text-[11px] text-slate-700">
                        <strong>
                          {isHi ? 'फोटो पत्ती-रंग विश्लेषण:' : 'Uploaded Leaf Photo Colour Comparison:'}
                        </strong>{' '}
                        Green: {modelEval.leaf_colour_analysis.green_foliage_pct}% • Chlorosis:{' '}
                        {modelEval.leaf_colour_analysis.chlorosis_yellowing_pct}% • Necrosis:{' '}
                        {modelEval.leaf_colour_analysis.browning_necrosis_pct}% • Uniformity:{' '}
                        {modelEval.leaf_colour_analysis.colour_uniformity_score}%
                      </div>
                    )}
                  </div>
                )}

                {modelEval.alerts && modelEval.alerts.length > 0 && (
                  <div className="space-y-1">
                    {modelEval.alerts.map((al, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-medium"
                      >
                        ⚠️ <strong>{al.code}:</strong> {isHi ? al.reason_hi : al.reason_en}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="surface-card p-5 border border-emerald-200 bg-emerald-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sprout className="w-6 h-6 text-[#15803d] flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                {isHi
                  ? 'अपनी मुख्य फसल और खेत का विवरण जोड़ें'
                  : 'Complete Your Farm & Crop Details'}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {isHi
                  ? 'सिंचाई, मिट्टी की नमी, खाद-कीटनाशक और पत्ते की फोटो जोड़ने के लिए नीचे दिए गए बटन पर क्लिक करें।'
                  : 'Add your crop variety, soil moisture, irrigation method, fertilizers, and leaf photograph to personalize this dashboard.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => navigate('/farmer-details')}
              className="btn-secondary text-xs py-2 px-3"
            >
              {isHi ? 'किसान विवरण' : 'Farmer Details'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/crop-details')}
              className="btn-primary text-xs py-2 px-3.5"
            >
              <Plus className="w-4 h-4" />
              {isHi ? 'फसल विवरण जोड़ें' : 'Add Crop Details'}
            </button>
          </div>
        </div>
      )}

      {/* First-run / Demo Data Banner */}
      {isDemo && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="badge badge-demo">{d.demoBadge}</span>
                <span className="text-sm font-bold text-amber-950">{d.demoTitle}</span>
              </div>
              <p className="text-xs text-amber-800 mt-0.5">{d.demoDesc}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <button onClick={() => navigate('/fields')} className="btn-primary text-xs py-2 px-3">
              <Plus className="w-3.5 h-3.5" /> {d.addFirstField}
            </button>
            <button onClick={() => navigate('/detection')} className="btn-secondary text-xs py-2 px-3">
              <ScanSearch className="w-3.5 h-3.5" /> {d.analyzeLeaf}
            </button>
          </div>
        </div>
      )}

      {/* A. Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="metric-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {d.monitoredFields}
            </span>
            <Sprout className="w-4 h-4 text-[#14532d]" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{cards?.total_fields ?? 0}</div>
          <p className="text-xs text-slate-500 mt-1">{d.storedInSqlite}</p>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {d.assessments}
            </span>
            <Activity className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{cards?.total_assessments ?? 0}</div>
          <p className="text-xs text-slate-500 mt-1">{d.completedChecks}</p>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {d.elevatedRisk}
            </span>
            <ShieldAlert className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700">{cards?.elevated_risk_fields ?? 0}</div>
          <p className="text-xs text-slate-500 mt-1">
            {d.watchOrHighRisk} ({cards?.high_risk_fields ?? 0})
          </p>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {d.activeActions}
            </span>
            <ClipboardCheck className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{cards?.active_recommendations ?? 0}</div>
          <p className="text-xs text-slate-500 mt-1">{d.pendingRescueTasks}</p>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {d.estPotentialLoss}
            </span>
            <TrendingDown className="w-4 h-4 text-red-600" />
          </div>
          {cards?.has_loss_estimate && cards.estimated_potential_loss !== null ? (
            <>
              <div className="text-2xl font-bold text-slate-900">
                {currencySymbol}
                {Number(cards.estimated_potential_loss).toLocaleString()}
              </div>
              <p className="text-xs text-slate-500 mt-1">{d.fromLatestScenario}</p>
            </>
          ) : (
            <>
              <div className="text-sm font-semibold text-slate-600 mt-1">{d.insufficientData}</div>
              <button
                onClick={() => navigate('/simulator')}
                className="text-xs font-semibold text-[#14532d] hover:underline mt-1 inline-flex items-center gap-1"
              >
                {d.runSimulator} <ArrowRight className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* B. Crop Health Overview & Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="chart-container lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="section-title">{d.healthTrendTitle}</h3>
              <p className="text-xs text-slate-500">{d.healthTrendSub}</p>
            </div>
            {summary?.health_trend?.[0]?.is_demo && (
              <span className="badge badge-demo">{d.demoBadge}</span>
            )}
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={summary?.health_trend ?? []} margin={{ left: -15, right: 10, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="overviewHealthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14532d" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#14532d" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => v.slice(5)} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 12 }}
                  formatter={(value: any, _name: any, props: any) => [
                    `${value} / 100${props?.payload?.is_demo ? ' (DEMO)' : ''}`,
                    'Health Index',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="health_index"
                  stroke="#14532d"
                  strokeWidth={2.5}
                  fill="url(#overviewHealthGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-container">
          <div className="mb-4">
            <h3 className="section-title">{d.riskDistTitle}</h3>
            <p className="text-xs text-slate-500">{d.riskDistSub}</p>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary?.risk_distribution ?? []} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 12 }} />
                <Bar dataKey="fields" name="Fields" radius={[6, 6, 0, 0]} maxBarSize={42}>
                  {(summary?.risk_distribution ?? []).map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
                <Bar dataKey="assessments" name="Assessments" fill="#64748b" radius={[6, 6, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* C. Field Overview & D. Weather Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Field Overview Table */}
        <div className="surface-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="section-title">{d.fieldsOverviewTitle}</h3>
              <p className="text-xs text-slate-500">{d.fieldsOverviewSub}</p>
            </div>
            <button onClick={() => navigate('/fields')} className="btn-secondary text-xs py-1.5 px-3">
              {d.manageFields} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {fields.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-slate-200 rounded-xl space-y-2">
              <Sprout className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">{d.noFieldsTitle}</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">{d.noFieldsDesc}</p>
              <button onClick={() => navigate('/fields')} className="btn-primary text-xs mt-2">
                <Plus className="w-4 h-4" /> {d.addFieldPlot}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="pb-2.5">{d.colFieldName}</th>
                    <th className="pb-2.5">{d.colCrop}</th>
                    <th className="pb-2.5">{d.colStage}</th>
                    <th className="pb-2.5">{d.colLocation}</th>
                    <th className="pb-2.5">{d.colHealthRisk}</th>
                    <th className="pb-2.5 text-right">{d.colAction}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fields.slice(0, 6).map(f => (
                    <tr key={f.id} className="hover:bg-slate-50/80">
                      <td className="py-3 font-semibold text-slate-900">{f.name}</td>
                      <td className="py-3 text-slate-700">{f.crop_type}</td>
                      <td className="py-3 text-slate-600 text-xs">
                        {translateGrowthStage(f.growth_stage, language)}
                      </td>
                      <td className="py-3 text-slate-500 text-xs">{f.location || '—'}</td>
                      <td className="py-3">
                        <span
                          className={`badge ${
                            f.status === 'high-risk'
                              ? 'badge-high-risk'
                              : f.status === 'watch'
                              ? 'badge-watch'
                              : 'badge-healthy'
                          }`}
                        >
                          {translateRiskStatus(f.status, language)}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => navigate(`/fields?select=${f.id}`)}
                          className="text-xs font-semibold text-[#14532d] hover:underline"
                        >
                          {d.viewDetails}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Weather Summary Card */}
        <div className="surface-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <CloudSun className="w-5 h-5 text-[#14532d]" />
                <h3 className="section-title">{d.weatherSummaryTitle}</h3>
              </div>
              <button
                onClick={openLocationModal}
                className="text-xs font-semibold text-[#14532d] hover:underline flex items-center gap-1"
              >
                <MapPin className="w-3.5 h-3.5" />
                {location ? t.changeLocation : t.selectLocation}
              </button>
            </div>

            {wData && (
              <div className="mb-3">
                <SpeakButton
                  textEn={weatherSpeechEn}
                  textHi={weatherSpeechHi}
                  labelEn={d.listenWeatherBtn}
                  labelHi="मौसम सुनें"
                  size="sm"
                />
              </div>
            )}

            {!location ? (
              <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl p-4 space-y-2">
                <MapPin className="w-7 h-7 text-slate-400 mx-auto" />
                <p className="text-sm font-semibold text-slate-800">{d.noLocationTitle}</p>
                <p className="text-xs text-slate-500">{d.noLocationDesc}</p>
                <button onClick={openLocationModal} className="btn-primary text-xs mt-2">
                  {d.chooseLocation}
                </button>
              </div>
            ) : weatherQuery.isLoading ? (
              <div className="py-8 text-center text-xs text-slate-500">
                {d.fetchingWeather} {location.name}…
              </div>
            ) : weatherQuery.isError ? (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 space-y-2">
                <p className="font-semibold">{d.weatherUnavailable}</p>
                <p>{d.weatherUnavailableDesc}</p>
                <button onClick={() => weatherQuery.refetch()} className="btn-secondary text-xs py-1 px-2.5">
                  {d.retry}
                </button>
              </div>
            ) : wData ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-[#f7f9f6] border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{wData.location_name}</p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {wData.latitude.toFixed(3)}°N, {wData.longitude.toFixed(3)}°E
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-slate-900">
                        {wData.current.temperature_c ?? '—'}°C
                      </span>
                      <p className="text-xs text-slate-600">{wData.current.weather_label}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-200/80 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Droplets className="w-3.5 h-3.5 text-sky-600" />
                      <span>
                        {d.humidity}: {wData.current.relative_humidity_pct ?? '—'}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Thermometer className="w-3.5 h-3.5 text-amber-600" />
                      <span>
                        {d.rain7d}: {rain7dSum} mm
                      </span>
                    </div>
                  </div>
                </div>

                {/* Weather Risk Rules Summary */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {d.forecastRuleAlerts}
                  </p>
                  {wData.weather_risks.slice(0, 2).map(alert => (
                    <div
                      key={alert.rule_id}
                      className={`p-2.5 rounded-xl border text-xs ${
                        alert.severity === 'high'
                          ? 'bg-red-50 border-red-200 text-red-900'
                          : alert.severity === 'watch'
                          ? 'bg-amber-50 border-amber-200 text-amber-900'
                          : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      }`}
                    >
                      <p className="font-semibold">{alert.title}</p>
                      <p className="text-[11px] opacity-90 mt-0.5 line-clamp-2">{alert.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <button
            onClick={() => navigate('/weather')}
            className="btn-secondary w-full mt-4 text-xs py-2"
          >
            {d.openWeatherIntel} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* E. Recent Activity & F. Recommended Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recommended Actions */}
        <div className="surface-card p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="section-title">{d.recommendedActionsTitle}</h3>
              <p className="text-xs text-slate-500">{d.recommendedActionsSub}</p>
            </div>
            <SpeakButton
              textEn={adviceSpeechEn}
              textHi={adviceSpeechHi}
              labelEn={d.listenAdviceBtn}
              labelHi="सलाह सुनें"
              size="sm"
            />
          </div>

          <div className="space-y-3">
            {actionsList.map(act => (
              <div
                key={act.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-[#f7f9f6] flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">{act.title}</span>
                  <div className="flex items-center gap-1.5">
                    {act.is_demo && <span className="badge badge-demo">DEMO</span>}
                    <span
                      className={`badge ${
                        act.urgency === 'immediate' || act.urgency === 'high'
                          ? 'badge-high-risk'
                          : 'badge-watch'
                      }`}
                    >
                      {act.urgency.toUpperCase()}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-600">{act.reason}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>
                    {d.colFieldName}: <strong>{act.field_name}</strong> · {act.source}
                  </span>
                  <button
                    onClick={() => navigate(act.field_id ? `/planner?field_id=${act.field_id}` : '/planner')}
                    className="font-semibold text-[#14532d] hover:underline"
                  >
                    {d.openTask}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="surface-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="section-title">{d.recentActivityTitle}</h3>
              <p className="text-xs text-slate-500">{d.recentActivitySub}</p>
            </div>
            <button onClick={() => navigate('/reports')} className="text-xs font-semibold text-[#14532d] hover:underline">
              {d.fullHistory}
            </button>
          </div>

          {(summary?.recent_activity ?? []).length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500 space-y-2">
              <Clock className="w-6 h-6 text-slate-400 mx-auto" />
              <p>{d.noActivityYet}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(summary?.recent_activity ?? []).map(item => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl border border-slate-200/80 flex items-start justify-between gap-3"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{item.detail}</p>
                    {item.field_name && (
                      <span className="inline-block mt-1 text-[11px] text-[#14532d] font-medium">
                        {d.colFieldName}: {item.field_name}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">
                    {new Date(item.timestamp).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
