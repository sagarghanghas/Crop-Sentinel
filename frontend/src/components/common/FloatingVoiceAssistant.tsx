import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Mic,
  MicOff,
  Volume2,
  Square,
  RotateCcw,
  X,
  Globe,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { useI18n } from '@/i18n/translations'
import { useAuthStore } from '@/store/authStore'
import {
  speechOutput,
  parseVoiceCommand,
  isSpeechRecognitionSupported,
  type ParsedVoiceCommand,
} from '@/services/speechService'

export interface VoiceFormFillEventDetail {
  field: string
  value: string
  summaryEn: string
  summaryHi: string
}

export default function FloatingVoiceAssistant() {
  const navigate = useNavigate()
  const routerLocation = useLocation()
  const { language, setLanguage, t, tKey } = useI18n()
  const { token } = useAuthStore()
  const isHi = language === 'hi'

  const [isOpen, setIsOpen] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [spokenResponse, setSpokenResponse] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [speechState, setSpeechState] = useState({
    isSpeaking: speechOutput.isSpeaking,
    lastText: speechOutput.lastText,
    voiceWarning: speechOutput.voiceWarning,
  })

  const recognitionRef = useRef<any>(null)
  const sttSupported = isSpeechRecognitionSupported()

  useEffect(() => {
    return speechOutput.subscribe(setSpeechState)
  }, [])

  // Stop microphone whenever panel closes or route changes
  useEffect(() => {
    if (!isOpen && recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
      setIsListening(false)
    }
  }, [isOpen, routerLocation.pathname])

  const getCurrentPageInstruction = (lang: 'en' | 'hi'): string => {
    const path = routerLocation.pathname
    if (path.startsWith('/farmer-details')) {
      return lang === 'hi'
        ? tKey('farmer.fullFormSpeech')
        : tKey('farmer.fullFormSpeech')
    }
    if (path.startsWith('/crop-details')) {
      return lang === 'hi'
        ? tKey('crop.fullFormSpeech')
        : tKey('crop.fullFormSpeech')
    }
    if (path.startsWith('/signup')) {
      return lang === 'hi'
        ? 'नया किसान खाता बनाने के लिए अपना पूरा नाम, ईमेल पता, 10 अंकों का मोबाइल नंबर और कम से कम 6 अक्षरों का पासवर्ड भरें, फिर खाता बनाएं बटन दबाएं।'
        : 'To create your farmer account, enter your full name, email address, 10-digit mobile number, and a password of at least 6 characters, then press Create Account.'
    }
    if (path.startsWith('/login')) {
      return lang === 'hi'
        ? 'लॉगिन करने के लिए अपना पंजीकृत ईमेल पता और पासवर्ड भरें और लॉगिन बटन दबाएं।'
        : 'Enter your registered email address and password, then press Login.'
    }
    if (path.startsWith('/language')) {
      return lang === 'hi'
        ? 'अपनी पसंदीदा भाषा English या हिन्दी चुनें और आगे बढ़ें बटन दबाएं।'
        : 'Select English or Hindi and press Continue.'
    }
    return lang === 'hi'
      ? 'आप बोल सकते हैं: "इस फॉर्म को समझाओ", "मिट्टी का प्रकार क्या है?", "मेरी फसल गेहूँ है", "मेरा गाँव रामपुर है", "मौसम बताओ", या "फसल की बीमारी बताओ"।'
      : 'You can say: "Read this form", "What is soil type?", "My crop is wheat", "My village is Rampur", "Tell me the weather", or "Open crop details".'
  }

  const speakAndShow = (textEn: string, textHi: string, targetLang = language) => {
    const chosen = targetLang === 'hi' ? textHi : textEn
    setSpokenResponse(chosen)
    speechOutput.speak(chosen, targetLang)
  }

  const handleReadCurrentPage = () => {
    setErrorMsg(null)
    const msg = getCurrentPageInstruction(language)
    setSpokenResponse(msg)
    speechOutput.speak(msg, language)
  }

  const executeParsedCommand = (cmd: ParsedVoiceCommand) => {
    switch (cmd.intent) {
      case 'STOP_SPEAKING': {
        speechOutput.stop()
        setSpokenResponse(isHi ? 'बोलना बंद कर दिया गया।' : 'Stopped speaking.')
        break
      }
      case 'REPEAT_SPEECH': {
        if (speechState.lastText) {
          speechOutput.replay(language)
        } else {
          handleReadCurrentPage()
        }
        break
      }
      case 'READ_PAGE': {
        handleReadCurrentPage()
        break
      }
      case 'SWITCH_HINDI': {
        setLanguage('hi')
        speakAndShow(
          'Language changed to Hindi.',
          'भाषा हिन्दी में बदल दी गई है। अब सभी निर्देश हिन्दी में दिए जाएंगे।',
          'hi'
        )
        break
      }
      case 'SWITCH_ENGLISH': {
        setLanguage('en')
        speakAndShow(
          'Language changed to English. Instructions will now be spoken in English.',
          'Language changed to English.',
          'en'
        )
        break
      }
      case 'EXPLAIN_FIELD': {
        speakAndShow(
          cmd.explanationEn || cmd.summaryLabelEn,
          cmd.explanationHi || cmd.summaryLabelHi
        )
        break
      }
      case 'FILL_FIELD': {
        if (cmd.fillField && cmd.fillValue) {
          window.dispatchEvent(
            new CustomEvent<VoiceFormFillEventDetail>('cropsentinel:voice-form-fill', {
              detail: {
                field: cmd.fillField,
                value: cmd.fillValue,
                summaryEn: cmd.summaryLabelEn,
                summaryHi: cmd.summaryLabelHi,
              },
            })
          )
          speakAndShow(
            cmd.explanationEn || cmd.summaryLabelEn,
            cmd.explanationHi || cmd.summaryLabelHi
          )
        }
        break
      }
      case 'NAV_BACK': {
        speakAndShow('Going back to the previous page.', 'पिछले पेज पर वापस जा रहे हैं।')
        navigate(-1)
        break
      }
      case 'NAV_FARMER_DETAILS': {
        if (!token) {
          speakAndShow(
            'Please log in first to open Farmer Details.',
            'किसान विवरण खोलने के लिए कृपया पहले लॉगिन करें।'
          )
          navigate('/login')
          return
        }
        speakAndShow('Opening Farmer Details page.', 'किसान विवरण पेज खुल रहा है।')
        navigate('/farmer-details')
        break
      }
      case 'NAV_CROP_DETAILS': {
        if (!token) {
          speakAndShow(
            'Please log in first to open Crop Details.',
            'फसल विवरण खोलने के लिए कृपया पहले लॉगिन करें।'
          )
          navigate('/login')
          return
        }
        speakAndShow('Opening Crop Details page.', 'फसल विवरण पेज खुल रहा है।')
        navigate('/crop-details')
        break
      }
      case 'NAV_DETECTION': {
        if (!token) {
          speakAndShow('Please log in first.', 'कृपया पहले लॉगिन करें।')
          navigate('/login')
          return
        }
        speakAndShow(
          'Opening Crop Disease Detection. Upload a clear leaf photo to check your crop.',
          'फसल रोग पहचान पेज खुल रहा है। यहाँ पत्ते की साफ फोटो अपलोड करें।'
        )
        navigate('/detection')
        break
      }
      case 'NAV_WEATHER': {
        if (!token) {
          speakAndShow('Please log in first.', 'कृपया पहले लॉगिन करें।')
          navigate('/login')
          return
        }
        speakAndShow('Opening Weather Intelligence.', 'मौसम जानकारी पेज खुल रहा है।')
        navigate('/weather')
        break
      }
      case 'NAV_FIELDS': {
        if (!token) {
          speakAndShow('Please log in first.', 'कृपया पहले लॉगिन करें।')
          navigate('/login')
          return
        }
        speakAndShow('Opening your crops and fields.', 'आपके खेत और फसल पेज खुल रहा है।')
        navigate('/fields')
        break
      }
      case 'NAV_PLANNER_TODAY': {
        if (!token) {
          speakAndShow('Please log in first.', 'कृपया पहले लॉगिन करें।')
          navigate('/login')
          return
        }
        speakAndShow('Opening today’s farming tasks and recommendations.', 'आज के कृषि कार्य और सलाह खुल रहे हैं।')
        navigate('/planner')
        break
      }
      case 'BLOCKED_DESTRUCTIVE': {
        speakAndShow(t.voice.safetyBlockedDelete, t.voice.safetyBlockedDelete)
        break
      }
      default: {
        speakAndShow(
          'I did not clearly understand that command. Please repeat or try saying "Read this form", "What is soil type?", or "My crop is wheat".',
          'मैं आपकी बात स्पष्ट रूप से समझ नहीं पाया। कृपया दोबारा बोलें, जैसे "इस फॉर्म को समझाओ", "मिट्टी का प्रकार क्या है?", या "मेरी फसल गेहूँ है"।'
        )
        break
      }
    }
  }

  const toggleListening = () => {
    setErrorMsg(null)
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
      setIsListening(false)
      return
    }

    if (!sttSupported) {
      setErrorMsg(t.voice.unsupportedBrowser)
      return
    }

    try {
      speechOutput.stop()
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      const rec = new SpeechRec()
      rec.lang = language === 'hi' ? 'hi-IN' : 'en-IN'
      rec.continuous = false
      rec.interimResults = false
      rec.maxAlternatives = 1

      rec.onstart = () => {
        setIsListening(true)
      }

      rec.onresult = (event: any) => {
        const resultItem = event?.results?.[0]?.[0]
        const text = (resultItem?.transcript || '').trim()
        const conf = typeof resultItem?.confidence === 'number' ? resultItem.confidence : 0.9
        setIsListening(false)
        if (!text) {
          setErrorMsg(t.voice.recognitionError)
          return
        }
        setTranscript(text)
        const parsed = parseVoiceCommand(text, conf)
        executeParsedCommand(parsed)
      }

      rec.onerror = (event: any) => {
        setIsListening(false)
        const errCode = event?.error || ''
        if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
          setErrorMsg(t.voice.permissionDenied)
        } else {
          setErrorMsg(t.voice.recognitionError)
        }
      }

      rec.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = rec
      rec.start()
    } catch {
      setIsListening(false)
      setErrorMsg(t.voice.recognitionError)
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end">
      {/* Open Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label={isHi ? 'किसान आवाज़ सहायक पैनल' : 'Farmer Voice Assistant Panel'}
          className="mb-3 w-[340px] sm:w-[380px] max-w-[calc(100vw-2rem)] bg-white rounded-3xl shadow-2xl border-2 border-[#15803d]/30 overflow-hidden"
        >
          {/* Panel Header: Title, Language Selector & Close Button */}
          <div className="bg-gradient-to-r from-[#14532d] to-[#15803d] text-white px-4 py-3.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                <Volume2 className="w-4 h-4 text-emerald-300" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold truncate">
                  {isHi ? 'किसान आवाज़ सहायक' : 'Kisan Voice Assistant'}
                </h3>
                <p className="text-[11px] text-emerald-200 truncate">
                  {isHi ? 'बोलकर पूछें या फॉर्म भरें' : 'Speak commands or ask form help'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Language Selector */}
              <div className="inline-flex items-center bg-black/20 rounded-lg p-0.5 border border-white/15">
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                    language === 'en' ? 'bg-white text-[#14532d]' : 'text-emerald-100'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('hi')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                    language === 'hi' ? 'bg-white text-[#14532d]' : 'text-emerald-100'
                  }`}
                >
                  हिन्दी
                </button>
              </div>

              {/* Close Panel Button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label={isHi ? 'आवाज़ सहायक बंद करें' : 'Close Voice Assistant'}
                className="p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-white/15"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-3.5 max-h-[75vh] overflow-y-auto">
            {/* Short Instruction Explaining What the Farmer Can Say */}
            <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs text-slate-800 space-y-1">
              <p className="font-bold text-[#14532d] flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-[#15803d]" />
                {isHi ? 'आप क्या बोल सकते हैं:' : 'What you can say:'}
              </p>
              <p className="text-[11px] text-slate-700 leading-relaxed">
                {isHi
                  ? '• "इस फॉर्म को समझाओ" • "मिट्टी का प्रकार क्या है?" • "सिंचाई क्या होती है?" • "मेरी फसल गेहूँ है" • "मेरा गाँव रामपुर है"'
                  : '• "Read this form" • "What is soil type?" • "What is irrigation?" • "My crop is wheat" • "My village is Rampur"'}
              </p>
            </div>

            {/* Primary Controls: Microphone, Read Page, Repeat, Stop */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleListening}
                className={`flex-1 py-2.5 px-4 rounded-2xl font-bold text-xs inline-flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer ${
                  isListening
                    ? 'bg-red-600 text-white animate-pulse'
                    : 'bg-[#15803d] hover:bg-[#14532d] text-white'
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff className="w-4 h-4" />
                    <span>{isHi ? 'सुनना बंद करें' : 'Stop Listening'}</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span>{isHi ? 'बोलकर बताएं (Speak)' : 'Speak'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleReadCurrentPage}
                className="py-2.5 px-3 rounded-2xl bg-emerald-100 hover:bg-emerald-200 text-[#14532d] font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>{isHi ? 'पेज सुनें' : 'Read Page'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (speechState.lastText) {
                    speechOutput.replay(language)
                  } else {
                    handleReadCurrentPage()
                  }
                }}
                className="flex-1 py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#14532d]" />
                <span>{tKey('common.repeat')}</span>
              </button>

              <button
                type="button"
                onClick={() => speechOutput.stop()}
                disabled={!speechState.isSpeaking}
                className="flex-1 py-2 px-3 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-45 text-red-700 font-semibold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>{tKey('common.stopSpeaking')}</span>
              </button>
            </div>

            {/* Clear Listening Indicator */}
            {isListening && (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                <span>{isHi ? 'सुन रहा हूँ… कृपया स्पष्ट बोलें' : 'Listening… Speak clearly now'}</span>
              </div>
            )}

            {/* Recognized Speech Text */}
            {transcript && (
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <span className="font-bold text-slate-500 block text-[10px] uppercase">
                  {isHi ? 'आपने कहा (Recognized Speech):' : 'Recognized Speech:'}
                </span>
                <span className="font-semibold text-slate-900">"{transcript}"</span>
              </div>
            )}

            {/* Spoken Response Display */}
            {spokenResponse && (
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-slate-800 space-y-1">
                <span className="font-bold text-[#14532d] flex items-center gap-1 text-[10px] uppercase">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#15803d]" />
                  {isHi ? 'सहायक का उत्तर:' : 'Spoken Response:'}
                </span>
                <p className="leading-relaxed">{spokenResponse}</p>
              </div>
            )}

            {/* Error or Unsupported Message */}
            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Quick Tap Spoken Questions for Farmers */}
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <p className="text-[11px] font-bold text-slate-500">
                {isHi ? 'सुनने के लिए नीचे किसी भी प्रश्न को दबाएं:' : 'Tap a question to hear the answer:'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    executeParsedCommand(
                      parseVoiceCommand(isHi ? 'मिट्टी का प्रकार क्या है?' : 'What is soil type?')
                    )
                  }
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-[#14532d] text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  {isHi ? 'मिट्टी का प्रकार क्या है?' : 'What is soil type?'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    executeParsedCommand(
                      parseVoiceCommand(isHi ? 'सिंचाई क्या होती है?' : 'What is irrigation?')
                    )
                  }
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-[#14532d] text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  {isHi ? 'सिंचाई क्या होती है?' : 'What is irrigation?'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    executeParsedCommand(
                      parseVoiceCommand(
                        isHi ? 'पानी के स्रोत में क्या चुनना है?' : 'What should I select for water source?'
                      )
                    )
                  }
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-[#14532d] text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  {isHi ? 'पानी का स्रोत कैसे चुनें?' : 'Water source options?'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen(o => !o)}
        aria-label={
          isHi
            ? 'किसान आवाज़ सहायक खोलें (Open Voice Assistant)'
            : 'Open Farmer Voice Assistant'
        }
        className={`group flex items-center gap-2.5 px-4 py-3.5 rounded-full shadow-xl border-2 transition-all cursor-pointer ${
          isListening
            ? 'bg-red-600 text-white border-red-300 animate-pulse'
            : 'bg-[#14532d] hover:bg-[#15803d] text-white border-emerald-400/40'
        }`}
      >
        <Mic className="w-5 h-5 text-emerald-300" />
        <span className="text-xs sm:text-sm font-extrabold tracking-tight">
          {isHi ? 'आवाज़ सहायक (Voice Help)' : 'Voice Assistant'}
        </span>
        <Globe className="w-3.5 h-3.5 text-emerald-200 opacity-80" />
      </button>
    </div>
  )
}
