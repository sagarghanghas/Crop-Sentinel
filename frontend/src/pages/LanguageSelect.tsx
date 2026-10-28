import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Sprout, CheckCircle2, ArrowRight, ArrowLeft, Volume2 } from 'lucide-react'
import { useWeatherStore } from '@/store/weatherStore'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/services/cropsentinel'
import { speechOutput } from '@/services/speechService'

export default function LanguageSelect() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { language, setLanguage } = useWeatherStore()
  const { token, farmerProfile } = useAuthStore()
  const [selected, setSelected] = useState<'en' | 'hi'>(language)
  const [saving, setSaving] = useState(false)

  const handleSelect = (lang: 'en' | 'hi') => {
    setSelected(lang)
    setLanguage(lang)
  }

  const handleContinue = async () => {
    setSaving(true)
    setLanguage(selected)
    try {
      if (token) {
        await authApi.updateLanguage(selected)
      }
    } catch {
      // non-blocking if offline or unauthenticated
    } finally {
      setSaving(false)
    }

    const nextParam = searchParams.get('next')
    if (nextParam) {
      navigate(nextParam)
      return
    }
    if (token) {
      if (!farmerProfile) {
        navigate('/farmer-details')
      } else {
        navigate('/')
      }
    } else {
      navigate('/signup')
    }
  }

  const speakPreview = (lang: 'en' | 'hi') => {
    const msg =
      lang === 'hi'
        ? 'नमस्ते किसान भाई! क्रॉप सेंटिनल स्मार्ट कृषि मंच में आपका स्वागत है। आगे बढ़ने के लिए हरा बटन दबाएं।'
        : 'Welcome to CropSentinel Smart Agriculture Platform. Click Continue to proceed.'
    speechOutput.speak(msg, lang)
  }

  return (
    <div className="min-h-screen bg-[#f4f7f4] flex flex-col justify-between">
      {/* Top Branding Bar */}
      <header className="bg-[#14532d] text-white px-6 py-4 shadow-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
              <Sprout className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-none">CropSentinel</h1>
              <p className="text-xs text-emerald-200 mt-0.5">
                {selected === 'hi' ? 'स्मार्ट कृषि मंच (Smart Agriculture Platform)' : 'Smart Agriculture Platform'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => speakPreview(selected)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
          >
            <Volume2 className="w-4 h-4 text-emerald-300" />
            {selected === 'hi' ? 'आवाज़ में सुनें' : 'Listen Audio'}
          </button>
        </div>
      </header>

      {/* Main Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-xl bg-white rounded-3xl shadow-xl border border-slate-200/90 overflow-hidden">
          {/* Card Header Banner */}
          <div className="bg-gradient-to-br from-[#14532d] to-[#166534] px-8 py-8 text-center text-white">
            <div className="w-16 h-16 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Sprout className="w-9 h-9 text-emerald-300" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Choose Your Language
            </h2>
            <p className="text-base sm:text-lg font-semibold text-emerald-200 mt-1">
              अपनी भाषा चुनें
            </p>
            <p className="text-xs text-emerald-100/80 mt-2 max-w-md mx-auto">
              {selected === 'hi'
                ? 'आप किसी भी समय डैशबोर्ड के ऊपर से भाषा बदल सकते हैं।'
                : 'Select your preferred language for forms, voice assistant, and crop advisories.'}
            </p>
          </div>

          {/* Language Option Cards */}
          <div className="p-6 sm:p-8 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* English Option */}
              <button
                type="button"
                onClick={() => handleSelect('en')}
                className={`group relative flex flex-col items-start p-5 rounded-2xl border-2 text-left transition-all ${
                  selected === 'en'
                    ? 'border-[#15803d] bg-emerald-50/70 shadow-md ring-2 ring-[#15803d]/20'
                    : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                }`}
              >
                <div className="w-full flex items-center justify-between mb-3">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#14532d] text-white font-bold text-sm">
                    EN
                  </span>
                  {selected === 'en' && (
                    <CheckCircle2 className="w-6 h-6 text-[#15803d]" />
                  )}
                </div>
                <span className="text-xl font-extrabold text-slate-900">English</span>
                <span className="text-xs text-slate-600 mt-1">
                  Continue in English with Indian English voice support
                </span>
              </button>

              {/* Hindi Option */}
              <button
                type="button"
                onClick={() => handleSelect('hi')}
                className={`group relative flex flex-col items-start p-5 rounded-2xl border-2 text-left transition-all ${
                  selected === 'hi'
                    ? 'border-[#15803d] bg-emerald-50/70 shadow-md ring-2 ring-[#15803d]/20'
                    : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                }`}
              >
                <div className="w-full flex items-center justify-between mb-3">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#14532d] text-white font-bold text-base">
                    अ
                  </span>
                  {selected === 'hi' && (
                    <CheckCircle2 className="w-6 h-6 text-[#15803d]" />
                  )}
                </div>
                <span className="text-xl font-extrabold text-slate-900">हिन्दी</span>
                <span className="text-xs text-slate-600 mt-1">
                  सरल हिन्दी भाषा और किसान आवाज़ सहायक के साथ आगे बढ़ें
                </span>
              </button>
            </div>

            {/* Continue Button */}
            <button
              type="button"
              onClick={handleContinue}
              disabled={saving}
              className="w-full py-4 px-6 rounded-2xl bg-[#15803d] hover:bg-[#14532d] text-white font-bold text-base shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>
                {selected === 'hi' ? 'जारी रखें (Continue)' : 'Continue'}
              </span>
              <ArrowRight className="w-5 h-5" />
            </button>

            {/* Back to Login / Dashboard Link */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-sm">
              {token ? (
                <Link
                  to="/"
                  className="inline-flex items-center gap-1.5 font-semibold text-[#14532d] hover:underline"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {selected === 'hi' ? 'डैशबोर्ड पर वापस जाएं' : 'Back to Dashboard'}
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 font-semibold text-[#14532d] hover:underline"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {selected === 'hi' ? 'लॉगिन पर वापस जाएं (Back to Login)' : 'Back to Login'}
                </Link>
              )}

              <span className="text-xs text-slate-400">
                {selected === 'hi' ? 'चुनी गई भाषा: हिन्दी' : 'Selected: English'}
              </span>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-slate-500">
        CropSentinel — Smart Agriculture Platform • {selected === 'hi' ? 'किसान सहायता प्रणाली' : 'AI Crop Health & Decision Support'}
      </footer>
    </div>
  )
}
