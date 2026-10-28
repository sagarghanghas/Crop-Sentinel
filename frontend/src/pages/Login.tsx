import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Sprout,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Globe,
  ShieldCheck,
} from 'lucide-react'
import { authApi } from '@/services/cropsentinel'
import { useAuthStore } from '@/store/authStore'
import { useWeatherStore } from '@/store/weatherStore'

export default function Login() {
  const navigate = useNavigate()
  const { setSession } = useAuthStore()
  const { language, setLanguage } = useWeatherStore()
  const isHi = language === 'hi'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError(isHi ? 'कृपया अपना ईमेल पता दर्ज करें।' : 'Please enter your email address.')
      return
    }
    if (!password) {
      setError(isHi ? 'कृपया अपना पासवर्ड दर्ज करें।' : 'Please enter your password.')
      return
    }

    setLoading(true)
    try {
      const session = await authApi.login({
        email: email.trim().toLowerCase(),
        password,
      })
      setSession(session)

      if (!session.has_farmer_profile) {
        navigate('/language?next=/farmer-details')
      } else if (!session.has_crop_record) {
        navigate('/crop-details')
      } else {
        navigate('/')
      }
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        err?.message ||
        (isHi
          ? 'ईमेल या पासवर्ड गलत है। कृपया पुनः प्रयास करें।'
          : 'Invalid email address or password. Please try again.')
      setError(String(detail))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f7f4] flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl w-full mx-auto bg-white rounded-3xl shadow-xl border border-slate-200/90 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Left Forest-Green Branding Panel */}
        <div className="lg:col-span-5 bg-gradient-to-br from-[#14532d] via-[#166534] to-[#15803d] text-white p-8 sm:p-10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shadow-inner">
                  <Sprout className="w-6 h-6 text-emerald-300" />
                </div>
                <div>
                  <h1 className="text-xl font-extrabold tracking-tight leading-none">CropSentinel</h1>
                  <p className="text-xs text-emerald-200 mt-1">
                    {isHi ? 'स्मार्ट कृषि मंच' : 'Smart Agriculture Platform'}
                  </p>
                </div>
              </div>

              <div className="flex items-center bg-black/20 rounded-xl p-1 border border-white/15">
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                    language === 'en' ? 'bg-white text-[#14532d]' : 'text-emerald-100 hover:text-white'
                  }`}
                >
                  EN
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

            <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight">
              {isHi
                ? 'आपके खेत का डिजिटल और एआई साथी'
                : 'AI-Powered Crop Health Monitoring & Decision Support'}
            </h2>
            <p className="text-sm text-emerald-100/90 mt-3 leading-relaxed">
              {isHi
                ? 'अपने खेत के मौसम, मिट्टी की नमी, सिंचाई, खाद और फसल के रोगों की निगरानी एक ही जगह करें।'
                : 'Sign in to access your farm profile, crop conditions, live Open-Meteo weather forecasts, AI leaf diagnosis, and Hindi/English voice assistant.'}
            </p>

            <ul className="mt-8 space-y-3.5 text-sm text-emerald-50">
              <li className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-300 flex-shrink-0" />
                <span>{isHi ? 'वास्तविक समय का मौसम और वर्षा पूर्वानुमान' : 'Real-time Open-Meteo weather & rainfall alerts'}</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-300 flex-shrink-0" />
                <span>{isHi ? 'पत्ते की फोटो से रोग जांच और बचाव योजना' : 'AI leaf disease classification & rescue planner'}</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-300 flex-shrink-0" />
                <span>{isHi ? 'हिन्दी और अंग्रेज़ी बोलकर चलाने की सुविधा' : 'Spoken Hindi & English farmer voice assistant'}</span>
              </li>
            </ul>
          </div>

          <div className="pt-8 mt-8 border-t border-white/15 flex items-center justify-between text-xs text-emerald-200">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              {isHi ? 'सुरक्षित किसान लॉगिन' : 'Secure Farmer Authentication'}
            </span>
            <Link to="/language" className="inline-flex items-center gap-1 hover:underline text-white font-semibold">
              <Globe className="w-3.5 h-3.5" />
              {isHi ? 'भाषा चुनें' : 'Choose Language'}
            </Link>
          </div>
        </div>

        {/* Right Login Form Panel */}
        <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-center">
          <div className="max-w-md mx-auto w-full">
            <div className="mb-6">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-[#14532d] mb-2">
                {isHi ? 'किसान पोर्टल लॉगिन' : 'WELCOME BACK'}
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {isHi ? 'अपने खाते में लॉगिन करें (Login)' : 'Login to CropSentinel'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {isHi
                  ? 'अपना पंजीकृत ईमेल और पासवर्ड दर्ज करें'
                  : 'Enter your registered email address and password to access your farm dashboard'}
              </p>
            </div>

            {error && (
              <div className="mb-5 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* Email */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  {isHi ? 'ईमेल पता (Email Address)' : 'Email Address'} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={isHi ? 'अपना ईमेल लिखें' : 'Enter your email address'}
                    className="input-field pl-11 py-3 text-base"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  {isHi ? 'पासवर्ड (Password)' : 'Password'} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={isHi ? 'अपना पासवर्ड लिखें' : 'Enter your password'}
                    className="input-field pl-11 pr-11 py-3 text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-6 rounded-2xl bg-[#15803d] hover:bg-[#14532d] disabled:opacity-60 text-white font-bold text-base shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{isHi ? 'लॉगिन हो रहा है…' : 'Signing in…'}</span>
                  </>
                ) : (
                  <span>{isHi ? 'लॉगिन करें (Login)' : 'Login'}</span>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-600">
              <div>
                {isHi ? 'नए किसान हैं?' : 'New to CropSentinel?'}{' '}
                <Link to="/signup" className="font-bold text-[#15803d] hover:text-[#14532d] hover:underline">
                  {isHi ? 'नया खाता बनाएं (Create Account)' : 'Create Account'}
                </Link>
              </div>
              <Link to="/language" className="text-xs font-semibold text-slate-500 hover:text-[#14532d] inline-flex items-center gap-1">
                <Globe className="w-3.5 h-3.5" />
                {isHi ? 'भाषा चुनें' : 'Choose Language'}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
