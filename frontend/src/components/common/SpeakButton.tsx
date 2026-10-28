import { useState, useEffect } from 'react'
import { Volume2, Square, RotateCcw } from 'lucide-react'
import { speechOutput } from '@/services/speechService'
import { useI18n } from '@/i18n/translations'

interface SpeakButtonProps {
  textEn: string
  textHi: string
  labelEn?: string
  labelHi?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function SpeakButton({
  textEn,
  textHi,
  labelEn,
  labelHi,
  size = 'md',
  className = '',
}: SpeakButtonProps) {
  const { language, t } = useI18n()
  const [speakingState, setSpeakingState] = useState({
    isSpeaking: speechOutput.isSpeaking,
    lastText: speechOutput.lastText,
  })

  useEffect(() => {
    return speechOutput.subscribe(st => {
      setSpeakingState({ isSpeaking: st.isSpeaking, lastText: st.lastText })
    })
  }, [])

  const targetText = language === 'hi' ? textHi : textEn
  const isThisSpeaking = speakingState.isSpeaking && speakingState.lastText === targetText.trim()
  const buttonLabel =
    language === 'hi'
      ? labelHi || t.voice.listenBtn
      : labelEn || t.voice.listenBtn

  const sizeClasses =
    size === 'lg'
      ? 'px-4 py-2.5 text-sm'
      : size === 'sm'
      ? 'px-2.5 py-1.5 text-xs'
      : 'px-3.5 py-2 text-xs'

  return (
    <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
      {!isThisSpeaking ? (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            speechOutput.speak(targetText, language)
          }}
          className={`inline-flex items-center gap-2 rounded-xl font-bold bg-emerald-700 hover:bg-[#0f3d20] text-white shadow-sm transition-colors ${sizeClasses}`}
          title={buttonLabel}
        >
          <Volume2 className="w-4 h-4 flex-shrink-0" />
          <span>{buttonLabel}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            speechOutput.stop()
          }}
          className={`inline-flex items-center gap-2 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white shadow-sm transition-colors ${sizeClasses}`}
        >
          <Square className="w-3.5 h-3.5 flex-shrink-0 fill-current" />
          <span>{t.voice.stopSpeakingBtn}</span>
        </button>
      )}

      {speakingState.lastText === targetText.trim() && !isThisSpeaking && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            speechOutput.speak(targetText, language)
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
          title={t.voice.replayBtn}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{t.voice.replayBtn}</span>
        </button>
      )}
    </div>
  )
}
