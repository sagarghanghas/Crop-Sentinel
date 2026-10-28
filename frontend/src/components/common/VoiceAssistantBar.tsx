import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Mic,
  MicOff,
  Volume2,
  Square,
  RotateCcw,
  Sprout,
  ScanSearch,
  CloudSun,
  ClipboardCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { useI18n } from '@/i18n/translations'
import { useWeatherStore } from '@/store/weatherStore'
import {
  speechOutput,
  parseVoiceCommand,
  isSpeechRecognitionSupported,
  type ParsedVoiceCommand,
  type VoiceIntentType,
} from '@/services/speechService'
import { reportsApi, weatherApi, fieldsApi } from '@/services/cropsentinel'

type RecognitionStatus =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'success'
  | 'permission-denied'
  | 'unsupported-browser'
  | 'recognition-error'

export default function VoiceAssistantBar() {
  const navigate = useNavigate()
  const { language, setLanguage, t } = useI18n()
  const { location } = useWeatherStore()

  const [status, setStatus] = useState<RecognitionStatus>('idle')
  const [transcript, setTranscript] = useState<string>('')
  const [assistantMessage, setAssistantMessage] = useState<string>('')
  const [pendingCommand, setPendingCommand] = useState<ParsedVoiceCommand | null>(null)
  const [speechState, setSpeechState] = useState({
    isSpeaking: speechOutput.isSpeaking,
    lastText: speechOutput.lastText,
    voiceWarning: speechOutput.voiceWarning,
  })

  const recognitionRef = useRef<any>(null)

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

  useEffect(() => {
    return speechOutput.subscribe(st => setSpeechState(st))
  }, [])

  // Build concise, farmer-friendly spoken summaries from actual data (never fabricates readings)
  const buildWeatherSpeech = (lang: 'en' | 'hi'): string => {
    if (!location) {
      return lang === 'hi'
        ? 'अभी कोई गांव या शहर नहीं चुना गया है। कृपया मौसम पेज पर अपना स्थान चुनें।'
        : 'No farm location is selected yet. Please select your city or village on the Weather page.'
    }
    const w = weatherQuery.data
    if (!w) {
      return lang === 'hi'
        ? `${location.name} के लिए लाइव मौसम डेटा अभी लोड हो रहा है या उपलब्ध नहीं है।`
        : `Live weather data for ${location.name} is currently loading or unavailable.`
    }
    const temp = w.current.temperature_c ?? '—'
    const hum = w.current.relative_humidity_pct ?? '—'
    const rain7d = w.daily.reduce((acc, d) => acc + (d.precipitation_sum_mm ?? 0), 0).toFixed(1)
    const topAlert = w.weather_risks?.[0]

    if (lang === 'hi') {
      return `${w.location_name} का ताज़ा मौसम: वर्तमान तापमान ${temp} डिग्री सेल्सियस है और हवा में नमी ${hum} प्रतिशत है। अगले 7 दिनों में कुल ${rain7d} मिलीमीटर बारिश का अनुमान है। ${
        topAlert ? `प्रमुख सूचना: ${topAlert.title}।` : ''
      }`
    }
    return `Weather for ${w.location_name}: Current temperature is ${temp} degrees Celsius with ${hum} percent humidity. Expected 7-day rainfall is ${rain7d} millimeters. ${
      topAlert ? `Advisory: ${topAlert.title}.` : ''
    }`
  }

  const buildFieldsSpeech = (lang: 'en' | 'hi'): string => {
    const list = fieldsQuery.data ?? []
    if (list.length === 0) {
      return lang === 'hi'
        ? 'अभी आपका कोई खेत दर्ज नहीं है। अपनी फसल चुनने के लिए नया खेत जोड़ें बटन दबाएं।'
        : 'You have no fields registered yet. Tap Add New Field to select your crop.'
    }
    const names = list.slice(0, 3).map(f => `${f.name} (${f.crop_type})`).join(', ')
    if (lang === 'hi') {
      return `आपके कुल ${list.length} खेत दर्ज हैं: ${names}। आप किसी भी खेत पर टैप करके पूरी जानकारी देख सकते हैं।`
    }
    return `You have ${list.length} monitored fields: ${names}. Tap any field card to view its details.`
  }

  const buildTodayAdviceSpeech = (lang: 'en' | 'hi'): string => {
    const actions = summaryQuery.data?.recommended_actions ?? []
    if (actions.length === 0) {
      return lang === 'hi'
        ? 'आज के लिए कोई लंबित चेतावनी नहीं है। आप बचाव कार्य योजना में जाकर अपने खेत की जांच कर सकते हैं।'
        : 'There are no urgent pending tasks today. You can open the Rescue Planner to generate field tasks.'
    }
    const first = actions[0]
    if (lang === 'hi') {
      return `आज के लिए कुल ${actions.length} प्रमुख सुझाव हैं। पहला कार्य: ${first.title}। कारण: ${first.reason}`
    }
    return `You have ${actions.length} recommended actions today. Top priority: ${first.title}. Reason: ${first.reason}`
  }

  const executeIntent = (intent: VoiceIntentType) => {
    setPendingCommand(null)

    if (intent === 'BLOCKED_DESTRUCTIVE') {
      const msg = t.voice.safetyBlockedDelete
      setAssistantMessage(msg)
      speechOutput.speak(msg, language)
      return
    }

    if (intent === 'SWITCH_HINDI') {
      setLanguage('hi')
      const msg = 'भाषा हिंदी में बदल दी गई है। अब आप हिंदी में बोल सकते हैं और सलाह सुन सकते हैं।'
      setAssistantMessage(msg)
      speechOutput.speak(msg, 'hi')
      return
    }

    if (intent === 'SWITCH_ENGLISH') {
      setLanguage('en')
      const msg = 'Language switched to English. You can now speak and listen in English.'
      setAssistantMessage(msg)
      speechOutput.speak(msg, 'en')
      return
    }

    if (intent === 'NAV_WEATHER') {
      navigate('/weather')
      const msg = buildWeatherSpeech(language)
      setAssistantMessage(msg)
      speechOutput.speak(msg, language)
      return
    }

    if (intent === 'NAV_FIELDS') {
      navigate('/fields')
      const msg = buildFieldsSpeech(language)
      setAssistantMessage(msg)
      speechOutput.speak(msg, language)
      return
    }

    if (intent === 'NAV_DETECTION') {
      navigate('/detection')
      const msg =
        language === 'hi'
          ? 'फसल रोग पहचान पेज खुल गया है। कृपया अपनी फसल चुनें और पत्ते की फोटो अपलोड करें।'
          : 'Opened Crop Disease Detection. Please select your crop and upload a clear leaf photo.'
      setAssistantMessage(msg)
      speechOutput.speak(msg, language)
      return
    }

    if (intent === 'NAV_PLANNER_TODAY') {
      navigate('/planner')
      const msg = buildTodayAdviceSpeech(language)
      setAssistantMessage(msg)
      speechOutput.speak(msg, language)
      return
    }

    if (intent === 'NAV_BUDGET') {
      navigate('/budget')
      const msg =
        language === 'hi'
          ? 'बजट मंथन पेज खुल गया है। यहाँ आप बीज, खाद और सिंचाई के खर्च का हिसाब देख सकते हैं।'
          : 'Opened Budget Manthan. Here you can track planned and actual farm expenses.'
      setAssistantMessage(msg)
      speechOutput.speak(msg, language)
      return
    }

    if (intent === 'NAV_REPORTS') {
      navigate('/reports')
      const msg =
        language === 'hi'
          ? 'रिपोर्ट और इतिहास पेज खुल गया है।'
          : 'Opened Reports and Crop Memory history.'
      setAssistantMessage(msg)
      speechOutput.speak(msg, language)
      return
    }

    if (intent === 'NAV_SIMULATOR') {
      navigate('/simulator')
      const msg =
        language === 'hi'
          ? 'मुनाफा सिम्युलेटर खुल गया है।'
          : 'Opened the What-If Profit Simulator.'
      setAssistantMessage(msg)
      speechOutput.speak(msg, language)
      return
    }

    const unknownMsg =
      language === 'hi'
        ? 'माफ़ करें, मैं यह बात समझ नहीं पाया। कृपया बोलें: "मौसम बताओ", "मेरी फसल दिखाओ", "फसल की बीमारी बताओ", या "आज क्या करना चाहिए?"'
        : 'Sorry, I did not catch that command. Try saying: "Tell me the weather", "Show my crops", "Check crop disease", or "What should I do today?"'
    setAssistantMessage(unknownMsg)
    speechOutput.speak(unknownMsg, language)
  }

  const handleStartListening = () => {
    setPendingCommand(null)
    setAssistantMessage('')
    speechOutput.stop()

    if (!isSpeechRecognitionSupported()) {
      setStatus('unsupported-browser')
      return
    }

    try {
      const SpeechRecognitionCtor =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      const recognition = new SpeechRecognitionCtor()
      recognitionRef.current = recognition

      recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN'
      recognition.continuous = false
      recognition.interimResults = true
      recognition.maxAlternatives = 1

      let finalCaptured = ''
      let finalConfidence = 0.9

      recognition.onstart = () => {
        setTranscript('')
        setStatus('listening')
      }

      recognition.onresult = (event: any) => {
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i]
          if (res.isFinal) {
            finalCaptured += res[0].transcript
            finalConfidence = typeof res[0].confidence === 'number' ? res[0].confidence : 0.9
          } else {
            interim += res[0].transcript
          }
        }
        setTranscript((finalCaptured || interim).trim())
      }

      recognition.onerror = (event: any) => {
        const errCode = event?.error || ''
        if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
          setStatus('permission-denied')
        } else {
          setStatus('recognition-error')
        }
      }

      recognition.onend = () => {
        const spoken = finalCaptured.trim()
        if (!spoken) {
          setStatus(prev => (prev === 'listening' ? 'recognition-error' : prev))
          return
        }
        setStatus('processing')
        const parsed = parseVoiceCommand(spoken, finalConfidence)
        setStatus('success')

        if (parsed.requiresConfirmation) {
          setPendingCommand(parsed)
        } else {
          executeIntent(parsed.intent)
        }
      }

      recognition.start()
    } catch {
      setStatus('recognition-error')
    }
  }

  const handleStopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
    }
    setStatus('idle')
  }

  return (
    <section
      aria-label={t.voice.assistantTitle}
      className="bg-white border-2 border-[#14532d]/25 rounded-2xl p-4 shadow-sm mb-5 no-print"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Assistant Header & Status Indicator */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-[#14532d]">
              <Volume2 className="w-3.5 h-3.5" />
              {t.voice.assistantTitle}
            </span>
            <span className="text-xs font-semibold text-slate-600">
              {status === 'listening' && (
                <span className="text-amber-700 font-bold animate-pulse">● {t.voice.listeningStatus}</span>
              )}
              {status === 'processing' && (
                <span className="text-emerald-700 font-bold">
                  <Loader2 className="w-3.5 h-3.5 inline animate-spin mr-1" />
                  {t.voice.processingStatus}
                </span>
              )}
              {(status === 'idle' || status === 'success') && t.voice.readyStatus}
            </span>
          </div>

          <p className="text-xs text-slate-500">
            <strong>{t.voice.sampleCommandsTitle}</strong> {t.voice.sampleCmdWeather} · {t.voice.sampleCmdCrops} ·{' '}
            {t.voice.sampleCmdDisease} · {t.voice.sampleCmdToday}
          </p>
        </div>

        {/* Right: Prominent Microphone + Stop Speaking + Replay Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {status !== 'listening' ? (
            <button
              type="button"
              onClick={handleStartListening}
              className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-[#14532d] hover:bg-[#0f3d20] text-white font-bold text-sm shadow-md active:scale-95 transition-all"
            >
              <Mic className="w-5 h-5" />
              <span>{t.voice.speakBtn} (बोलकर बताएं)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStopListening}
              className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md animate-pulse"
            >
              <MicOff className="w-5 h-5" />
              <span>{t.voice.stopListeningBtn}</span>
            </button>
          )}

          {speechState.isSpeaking && (
            <button
              type="button"
              onClick={() => speechOutput.stop()}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>{t.voice.stopSpeakingBtn}</span>
            </button>
          )}

          {speechState.lastText && !speechState.isSpeaking && (
            <button
              type="button"
              onClick={() => speechOutput.replay(language)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-300"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{t.voice.replayBtn}</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Large Touch-Friendly Manual / Farmer Instruction Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3.5 pt-3.5 border-t border-slate-100">
        <button
          type="button"
          onClick={() => executeIntent('NAV_FIELDS')}
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#f7f9f6] hover:bg-emerald-50 border border-slate-200 hover:border-[#14532d] text-xs font-bold text-slate-900 transition-colors"
        >
          <Sprout className="w-4 h-4 text-[#14532d] flex-shrink-0" />
          <span>{t.voice.quickChooseCrop}</span>
        </button>

        <button
          type="button"
          onClick={() => executeIntent('NAV_DETECTION')}
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#f7f9f6] hover:bg-emerald-50 border border-slate-200 hover:border-[#14532d] text-xs font-bold text-slate-900 transition-colors"
        >
          <ScanSearch className="w-4 h-4 text-[#14532d] flex-shrink-0" />
          <span>{t.voice.quickUploadLeaf}</span>
        </button>

        <button
          type="button"
          onClick={() => executeIntent('NAV_WEATHER')}
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#f7f9f6] hover:bg-emerald-50 border border-slate-200 hover:border-[#14532d] text-xs font-bold text-slate-900 transition-colors"
        >
          <CloudSun className="w-4 h-4 text-[#14532d] flex-shrink-0" />
          <span>{t.voice.quickListenWeather}</span>
        </button>

        <button
          type="button"
          onClick={() => executeIntent('NAV_PLANNER_TODAY')}
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#f7f9f6] hover:bg-emerald-50 border border-slate-200 hover:border-[#14532d] text-xs font-bold text-slate-900 transition-colors"
        >
          <ClipboardCheck className="w-4 h-4 text-[#14532d] flex-shrink-0" />
          <span>{t.voice.quickListenAdvice}</span>
        </button>
      </div>

      {/* Recognized Speech & Assistant Feedback Box */}
      {(transcript || assistantMessage || pendingCommand) && (
        <div className="mt-3 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs space-y-1.5">
          {transcript && (
            <p className="text-slate-800">
              <strong className="text-[#14532d]">{t.voice.heardLabel}</strong> "{transcript}"
            </p>
          )}

          {pendingCommand && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="font-bold text-amber-900">
                {t.voice.confirmActionPrompt} (
                {language === 'hi' ? pendingCommand.summaryLabelHi : pendingCommand.summaryLabelEn})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => executeIntent(pendingCommand.intent)}
                  className="btn-primary py-1 px-3 text-xs"
                >
                  {t.voice.confirmYes}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingCommand(null)}
                  className="btn-secondary py-1 px-3 text-xs"
                >
                  {t.voice.confirmCancel}
                </button>
              </div>
            </div>
          )}

          {assistantMessage && (
            <p className="text-slate-900 font-medium flex items-start gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
              <span>
                <strong>{t.voice.responseLabel}</strong> {assistantMessage}
              </span>
            </p>
          )}
        </div>
      )}

      {/* Error / Permission / Browser Support Alerts */}
      {status === 'permission-denied' && (
        <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{t.voice.permissionDenied}</span>
        </div>
      )}

      {status === 'unsupported-browser' && (
        <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{t.voice.unsupportedBrowser}</span>
        </div>
      )}

      {status === 'recognition-error' && (
        <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{t.voice.recognitionError}</span>
        </div>
      )}

      {speechState.voiceWarning && (
        <div className="mt-2 text-[11px] text-amber-800 bg-amber-50/70 px-3 py-1.5 rounded-lg border border-amber-200">
          {speechState.voiceWarning}
        </div>
      )}
    </section>
  )
}
