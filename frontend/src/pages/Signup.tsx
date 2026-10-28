import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Sprout,
  User,
  Mail,
  Phone,
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

export default function Signup() {
  const navigate = useNavigate()
  const { setSession } = useAuthStore()
  const { language, setLanguage } = useWeatherStore()
  const isHi = language === 'hi'

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const validateForm = (): string | null => {
    if (fullName.trim().length < 2) {
      return isHi
        ? 'कृपया अपना पूरा नाम लिखें (कम से कम 2 अक्षर)।'
        : 'Please enter your Full Name (at least 2 characters).'
    }
    const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
    if (!emailPattern.test(email.trim())) {
      return isHi
        ? 'कृपया एक मान्य ईमेल पता दर्ज करें।'
        : 'Please enter a valid Email Address.'
    }
    const digits = mobileNumber.replace(/\D/g, '')
    if (digits.length < 10 || digits.length > 15) {
      return isHi
        ? 'कृपया 10 अंकों का मान्य मोबाइल नंबर दर्ज करें।'
        : 'Please enter a valid 10-digit Mobile Number.'
    }
    if (password.length < 6) {
      return isHi
        ? 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।'
        : 'Password must be at least 6 characters long.'
    }
    return null
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    try {
      const session = await authApi.signup({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        mobile_number: mobileNumber.trim(),
        password,
        preferred_language: language,
      })
      setSession(session)
      setSuccess(
        isHi
          ? 'खाता सफलतापूर्वक बन गया! अब अपनी भाषा और खेत का विवरण चुनें…'
          : 'Account created successfully! Proceeding to Language Selection & Farmer Details…'
      )
      setTimeout(() => {
        navigate('/language?next=/farmer-details')
      }, 400)
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        err?.message ||
        (isHi ? 'खाता बनाने में समस्या हुई। कृपया पुनः प्रयास करें।' : 'Unable to create account. Please try again.')
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

              {/* Language Switcher */}
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
                ? 'स्मार्ट खेती और फसल सुरक्षा के लिए जुड़ें'
                : 'Join India’s Smart Crop Health & Advisory Platform'}
            </h2>
            <p className="text-sm text-emerald-100/90 mt-3 leading-relaxed">
              {isHi
                ? 'अपनी फसल, मौसम, सिंचाई, खाद और पत्ते की बीमारी की सटीक जानकारी हिन्दी और अंग्रेज़ी आवाज़ सहायक के साथ पाएं।'
                : 'Monitor your fields, check real-time local weather, detect crop leaf diseases with AI, and receive spoken Hindi & English farming advisories.'}
            </p>

            <ul className="mt-8 space-y-3.5 text-sm text-emerald-50">
              <li className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-300 flex-shrink-0" />
                <span>{isHi ? 'खेत और मिट्टी के अनुसार फसल सलाह' : 'Personalized farm & soil profile management'}</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-300 flex-shrink-0" />
                <span>{isHi ? 'पत्ते की फोटो से बीमारी की पहचान' : 'AI leaf disease diagnosis & field verification checks'}</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-300 flex-shrink-0" />
                <span>{isHi ? 'बोलकर चलाने वाला किसान वॉइस असिस्टेंट' : 'Hindi & English voice assistant for every farmer'}</span>
              </li>
            </ul>
          </div>

          <div className="pt-8 mt-8 border-t border-white/15 flex items-center justify-between text-xs text-emerald-200">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              {isHi ? 'सुरक्षित किसान खाता' : 'Encrypted Farmer Account'}
            </span>
            <Link to="/language" className="inline-flex items-center gap-1 hover:underline text-white font-semibold">
              <Globe className="w-3.5 h-3.5" />
              {isHi ? 'भाषा बदलें' : 'Change Language'}
            </Link>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-center">
          <div className="max-w-md mx-auto w-full">
            <div className="mb-6">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-[#14532d] mb-2">
                {isHi ? 'नया किसान पंजीकरण' : 'FARMER REGISTRATION'}
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {isHi ? 'नया खाता बनाएं (Create Account)' : 'Create Your Account'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {isHi
                  ? 'शुरू करने के लिए नीचे अपना विवरण भरें'
                  : 'Enter your details below to register your farm on CropSentinel'}
              </p>
            </div>

            {error && (
              <div className="mb-5 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Full Name */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  {isHi ? 'पूरा नाम (Full Name)' : 'Full Name'} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder={isHi ? 'जैसे: रमेश कुमार' : 'e.g. Ramesh Kumar'}
                    className="input-field pl-11 py-3 text-base"
                  />
                </div>
              </div>

              {/* Email Address */}
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
                    placeholder={isHi ? 'ramesh@example.com' : 'farmer@example.com'}
                    className="input-field pl-11 py-3 text-base"
                  />
                </div>
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  {isHi ? 'मोबाइल नंबर (Mobile Number)' : 'Mobile Number'} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    value={mobileNumber}
                    onChange={e => setMobileNumber(e.target.value)}
                    placeholder={isHi ? '10 अंकों का मोबाइल नंबर (जैसे 9876543210)' : '10-digit mobile number (e.g. 9876543210)'}
                    className="input-field pl-11 py-3 text-base"
                  />
                </div>
              </div>

              {/* Create Password */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  {isHi ? 'पासवर्ड बनाएं (Create Password)' : 'Create Password'} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={isHi ? 'कम से कम 6 अक्षर' : 'Minimum 6 characters'}
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
                className="w-full py-3.5 px-6 rounded-2xl bg-[#15803d] hover:bg-[#14532d] disabled:opacity-60 text-white font-bold text-base shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{isHi ? 'खाता बनाया जा रहा है…' : 'Creating Account…'}</span>
                  </>
                ) : (
                  <span>{isHi ? 'खाता बनाएं (Create Account)' : 'Create Account'}</span>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 text-center text-sm text-slate-600">
              {isHi ? 'क्या आपका पहले से खाता है?' : 'Already have an account?'}{' '}
              <Link to="/login" className="font-bold text-[#15803d] hover:text-[#14532d] hover:underline">
                {isHi ? 'यहाँ लॉगिन करें (Login)' : 'Login here'}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
