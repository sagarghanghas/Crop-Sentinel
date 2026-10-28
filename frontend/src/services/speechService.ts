/**
 * Reusable Browser Speech Synthesis (TTS) & Speech Recognition (STT) Service
 * Designed for English (en-IN) and Hindi (hi-IN) farmers.
 * - Uses browser-native Web Speech APIs only (no audio sent to paid third-party clouds).
 * - Single-shot recognition: starts only when the user clicks "Speak / बोलकर बताएं" and stops automatically.
 * - Prefers hi-IN and en-IN voices and gracefully falls back if a local voice pack is missing.
 */
import type { AppLanguage } from '@/store/weatherStore'

export type VoiceIntentType =
  | 'NAV_WEATHER'
  | 'NAV_FIELDS'
  | 'NAV_DETECTION'
  | 'NAV_PLANNER_TODAY'
  | 'NAV_BUDGET'
  | 'NAV_REPORTS'
  | 'NAV_SIMULATOR'
  | 'NAV_FARMER_DETAILS'
  | 'NAV_CROP_DETAILS'
  | 'NAV_BACK'
  | 'READ_PAGE'
  | 'REPEAT_SPEECH'
  | 'STOP_SPEAKING'
  | 'EXPLAIN_FIELD'
  | 'FILL_FIELD'
  | 'SWITCH_HINDI'
  | 'SWITCH_ENGLISH'
  | 'BLOCKED_DESTRUCTIVE'
  | 'UNKNOWN'

export interface ParsedVoiceCommand {
  intent: VoiceIntentType
  confidence: number
  transcript: string
  requiresConfirmation: boolean
  summaryLabelEn: string
  summaryLabelHi: string
  explanationEn?: string
  explanationHi?: string
  fillField?: string
  fillValue?: string
}

type SpeechListener = (state: {
  isSpeaking: boolean
  lastText: string
  voiceWarning: string | null
}) => void

class SpeechOutputManager {
  private listeners = new Set<SpeechListener>()
  public isSpeaking = false
  public lastText = ''
  public voiceWarning: string | null = null

  subscribe(fn: SpeechListener): () => void {
    this.listeners.add(fn)
    fn({
      isSpeaking: this.isSpeaking,
      lastText: this.lastText,
      voiceWarning: this.voiceWarning,
    })
    return () => {
      this.listeners.delete(fn)
    }
  }

  private notify() {
    for (const fn of this.listeners) {
      fn({
        isSpeaking: this.isSpeaking,
        lastText: this.lastText,
        voiceWarning: this.voiceWarning,
      })
    }
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window
  }

  private selectBestVoice(lang: AppLanguage): { voice: SpeechSynthesisVoice | null; missingNativeHi: boolean } {
    if (!this.isSupported()) return { voice: null, missingNativeHi: false }
    const voices = window.speechSynthesis.getVoices() || []
    if (voices.length === 0) return { voice: null, missingNativeHi: false }

    if (lang === 'hi') {
      const exactHiIn = voices.find(v => v.lang.toLowerCase().replace('_', '-') === 'hi-in')
      if (exactHiIn) return { voice: exactHiIn, missingNativeHi: false }
      const anyHi = voices.find(v => v.lang.toLowerCase().startsWith('hi') || v.name.toLowerCase().includes('hindi'))
      if (anyHi) return { voice: anyHi, missingNativeHi: false }
      const enInFallback = voices.find(v => v.lang.toLowerCase().replace('_', '-') === 'en-in')
      return { voice: enInFallback || voices[0], missingNativeHi: true }
    } else {
      const exactEnIn = voices.find(v => v.lang.toLowerCase().replace('_', '-') === 'en-in')
      if (exactEnIn) return { voice: exactEnIn, missingNativeHi: false }
      const anyEn = voices.find(v => v.lang.toLowerCase().startsWith('en'))
      return { voice: anyEn || voices[0], missingNativeHi: false }
    }
  }

  speak(text: string, lang: AppLanguage) {
    const cleaned = text.trim()
    if (!cleaned) return
    this.lastText = cleaned

    if (!this.isSupported()) {
      this.voiceWarning =
        lang === 'hi'
          ? 'इस ब्राउज़र में आवाज़ सुनाने की सुविधा (Speech Synthesis) उपलब्ध नहीं है।'
          : 'Speech output is not supported in this browser.'
      this.notify()
      return
    }

    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(cleaned)
      utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
      utterance.rate = 0.95

      const { voice, missingNativeHi } = this.selectBestVoice(lang)
      if (voice) {
        utterance.voice = voice
      }
      this.voiceWarning = missingNativeHi
        ? lang === 'hi'
          ? 'इस डिवाइस पर हिंदी आवाज़ (hi-IN) पैक नहीं मिला; उपलब्ध आवाज़ और स्क्रीन पाठ दिखाया जा रहा है।'
          : 'Hindi (hi-IN) voice pack not found on this device; using fallback system voice.'
        : null

      utterance.onstart = () => {
        this.isSpeaking = true
        this.notify()
      }
      utterance.onend = () => {
        this.isSpeaking = false
        this.notify()
      }
      utterance.onerror = () => {
        this.isSpeaking = false
        this.notify()
      }

      this.isSpeaking = true
      this.notify()
      window.speechSynthesis.speak(utterance)
    } catch {
      this.isSpeaking = false
      this.notify()
    }
  }

  stop() {
    if (this.isSupported()) {
      window.speechSynthesis.cancel()
    }
    this.isSpeaking = false
    this.notify()
  }

  replay(lang: AppLanguage) {
    if (this.lastText) {
      this.speak(this.lastText, lang)
    }
  }
}

export const speechOutput = new SpeechOutputManager()

/**
 * Classifies spoken Hindi (Devanagari or Roman) and English commands into safe intents.
 */
export function parseVoiceCommand(rawTranscript: string, confidence = 0.9): ParsedVoiceCommand {
  const t = rawTranscript.trim()
  const lower = t.toLowerCase()

  // 1. Safety guard: block destructive / delete commands via voice
  if (
    lower.includes('delete') ||
    lower.includes('remove') ||
    lower.includes('हटाओ') ||
    lower.includes('हटा दें') ||
    lower.includes('मिटाओ') ||
    lower.includes('डिलीट')
  ) {
    return {
      intent: 'BLOCKED_DESTRUCTIVE',
      confidence,
      transcript: t,
      requiresConfirmation: false,
      summaryLabelEn: 'Blocked destructive action for safety',
      summaryLabelHi: 'सुरक्षा के लिए हटाने का कार्य रोका गया',
    }
  }

  // 2. Stop speaking / Repeat / Read form or page commands
  if (
    lower.includes('stop speaking') ||
    lower.includes('बोलना बंद') ||
    lower.includes('चुप') ||
    lower.includes('रुक जाओ') ||
    lower === 'stop' ||
    lower === 'रुको'
  ) {
    return {
      intent: 'STOP_SPEAKING',
      confidence,
      transcript: t,
      requiresConfirmation: false,
      summaryLabelEn: 'Stop speaking',
      summaryLabelHi: 'बोलना बंद करें',
    }
  }

  if (
    lower === 'repeat' ||
    lower.includes('repeat instruction') ||
    lower.includes('say again') ||
    lower.includes('दोबारा बताओ') ||
    lower.includes('दोबारा बोलो') ||
    lower.includes('फिर से बताओ') ||
    lower.includes('फिर से सुनाओ') ||
    lower === 'दोबारा'
  ) {
    return {
      intent: 'REPEAT_SPEECH',
      confidence,
      transcript: t,
      requiresConfirmation: false,
      summaryLabelEn: 'Repeat last spoken instruction',
      summaryLabelHi: 'पिछला निर्देश दोबारा सुनें',
    }
  }

  if (
    lower.includes('read this form') ||
    lower.includes('read the form') ||
    lower.includes('read the current page') ||
    lower.includes('read this page') ||
    lower.includes('explain this form') ||
    lower.includes('इस फॉर्म को समझाओ') ||
    lower.includes('फॉर्म समझाओ') ||
    lower.includes('यह पेज पढ़ो') ||
    lower.includes('निर्देश पढ़ो') ||
    lower.includes('निर्देश सुनाओ')
  ) {
    return {
      intent: 'READ_PAGE',
      confidence,
      transcript: t,
      requiresConfirmation: false,
      summaryLabelEn: 'Read current page / form instructions aloud',
      summaryLabelHi: 'वर्तमान पेज या फॉर्म के निर्देश सुनें',
    }
  }

  if (
    lower === 'go back' ||
    lower.includes('previous page') ||
    lower.includes('पीछे जाओ') ||
    lower.includes('वापस जाओ') ||
    lower.includes('पीछे चलो')
  ) {
    return {
      intent: 'NAV_BACK',
      confidence,
      transcript: t,
      requiresConfirmation: false,
      summaryLabelEn: 'Go back to previous page',
      summaryLabelHi: 'पिछले पेज पर वापस जाएं',
    }
  }

  // 2b. Field Q&A Explanations ("What is soil type?", "What is irrigation?", "What should I select for water source?")
  if (
    lower.includes('what is soil type') ||
    lower.includes('soil type meaning') ||
    lower.includes('मिट्टी का प्रकार क्या') ||
    lower.includes('मिट्टी के प्रकार')
  ) {
    return {
      intent: 'EXPLAIN_FIELD',
      confidence,
      transcript: t,
      requiresConfirmation: false,
      summaryLabelEn: 'Explain Soil Type',
      summaryLabelHi: 'मिट्टी का प्रकार समझाएं',
      explanationEn:
        'Soil type describes the texture and color of your farm soil. Select Alluvial for river-plain soil, Black soil for cotton or soybean regions, Red soil, Loamy soil, Sandy soil, or Clayey soil.',
      explanationHi:
        'मिट्टी का प्रकार बताता है कि आपके खेत की मिट्टी कैसी है। नदी क्षेत्र के लिए जलोढ़ मिट्टी, कपास या सोयाबीन के लिए काली मिट्टी, लाल मिट्टी, दोमट मिट्टी, बलुई या चिकनी मिट्टी चुनें।',
    }
  }

  if (
    lower.includes('what should i select for water source') ||
    lower.includes('what is water source') ||
    lower.includes('पानी के स्रोत में क्या') ||
    lower.includes('पानी का स्रोत क्या') ||
    lower.includes('सिंचाई का स्रोत क्या')
  ) {
    return {
      intent: 'EXPLAIN_FIELD',
      confidence,
      transcript: t,
      requiresConfirmation: false,
      summaryLabelEn: 'Explain Water / Irrigation Source',
      summaryLabelHi: 'पानी के स्रोत के विकल्प समझाएं',
      explanationEn:
        'For Water Source, select how water reaches your farm: Borewell or Tubewell, Canal Irrigation, Drip or Sprinkler, Rainfed if you rely on monsoon rain, Farm Pond, River, or Open Well.',
      explanationHi:
        'पानी के स्रोत में वह साधन चुनें जिससे आप खेत में पानी देते हैं: बोरवेल या ट्यूबवेल, नहर सिंचाई, ड्रिप या फव्वारा, केवल बारिश पर निर्भर होने पर वर्षा आधारित, तालाब, नदी या कुआं।',
    }
  }

  if (
    lower.includes('what is irrigation') ||
    lower.includes('irrigation method') ||
    lower.includes('सिंचाई क्या होती है') ||
    lower.includes('सिंचाई क्या है') ||
    lower.includes('सिंचाई की विधि क्या')
  ) {
    return {
      intent: 'EXPLAIN_FIELD',
      confidence,
      transcript: t,
      requiresConfirmation: false,
      summaryLabelEn: 'Explain Irrigation',
      summaryLabelHi: 'सिंचाई का अर्थ समझाएं',
      explanationEn:
        'Irrigation means supplying water to your crops. You can choose Drip Irrigation for drop-by-drop root watering, Sprinkler Irrigation, Flood or Furrow watering, Canal, Borewell, or Rainfed.',
      explanationHi:
        'सिंचाई का मतलब है फसलों को समय पर पानी देना। इसमें बूंद-बूंद पानी के लिए ड्रिप सिंचाई, फव्वारा सिंचाई, क्यारी या सतही सिंचाई, नहर या बोरवेल चुन सकते हैं।',
    }
  }

  // 2c. Voice-Guided Form Filling ("My crop is wheat", "My village is Rampur", "My soil is sandy")
  const cropMatchEn = lower.match(/(?:my crop is|crop name is|crop is)\s+([a-z\s]+)/i)
  const cropMatchHi = t.match(/(?:मेरी फसल|फसल का नाम)\s+([^\s।,.]+)(?:\s+है)?/)
  if (cropMatchEn || cropMatchHi) {
    const rawCrop = (cropMatchEn ? cropMatchEn[1] : cropMatchHi![1]).trim()
    const cropMap: Record<string, string> = {
      wheat: 'Wheat',
      गेहूँ: 'Wheat',
      गेहूं: 'Wheat',
      gehu: 'Wheat',
      rice: 'Rice (Paddy)',
      paddy: 'Rice (Paddy)',
      धान: 'Rice (Paddy)',
      चावल: 'Rice (Paddy)',
      maize: 'Maize (Corn)',
      corn: 'Maize (Corn)',
      मक्का: 'Maize (Corn)',
      cotton: 'Cotton',
      कपास: 'Cotton',
      tomato: 'Tomato',
      टमाटर: 'Tomato',
      potato: 'Potato',
      आलू: 'Potato',
      soybean: 'Soybean',
      सोयाबीन: 'Soybean',
      mustard: 'Mustard',
      सरसों: 'Mustard',
      sugarcane: 'Sugarcane',
      गन्ना: 'Sugarcane',
      onion: 'Onion',
      प्याज: 'Onion',
      chana: 'Chickpea (Chana)',
      चना: 'Chickpea (Chana)',
    }
    const matchedCrop = cropMap[rawCrop.toLowerCase()] || rawCrop.charAt(0).toUpperCase() + rawCrop.slice(1)
    return {
      intent: 'FILL_FIELD',
      confidence,
      transcript: t,
      requiresConfirmation: false,
      fillField: 'crop',
      fillValue: matchedCrop,
      summaryLabelEn: `Set crop to "${matchedCrop}"`,
      summaryLabelHi: `फसल "${matchedCrop}" भरी गई`,
      explanationEn: `Filled crop as ${matchedCrop}. Please review on screen before saving.`,
      explanationHi: `आपकी फसल "${matchedCrop}" भर दी गई है। सहेजने से पहले स्क्रीन पर जांच लें।`,
    }
  }

  const villageMatchEn = t.match(/(?:my village is|village is|my town is)\s+([a-zA-Z\s]+)/i)
  const villageMatchHi = t.match(/(?:मेरा गाँव|मेरा गांव|गाँव का नाम|गांव का नाम)\s+([^\s।,.]+)(?:\s+है)?/)
  if (villageMatchEn || villageMatchHi) {
    const rawVillage = (villageMatchEn ? villageMatchEn[1] : villageMatchHi![1]).trim()
    return {
      intent: 'FILL_FIELD',
      confidence,
      transcript: t,
      requiresConfirmation: false,
      fillField: 'village',
      fillValue: rawVillage,
      summaryLabelEn: `Set village to "${rawVillage}"`,
      summaryLabelHi: `गाँव "${rawVillage}" भरा गया`,
      explanationEn: `Filled Village / Town as ${rawVillage}. Please review on screen.`,
      explanationHi: `गाँव का नाम "${rawVillage}" भर दिया गया है।`,
    }
  }

  const districtMatchEn = t.match(/(?:my district is|district is)\s+([a-zA-Z\s]+)/i)
  const districtMatchHi = t.match(/(?:मेरा जिला|जिले का नाम)\s+([^\s।,.]+)(?:\s+है)?/)
  if (districtMatchEn || districtMatchHi) {
    const rawDistrict = (districtMatchEn ? districtMatchEn[1] : districtMatchHi![1]).trim()
    return {
      intent: 'FILL_FIELD',
      confidence,
      transcript: t,
      requiresConfirmation: false,
      fillField: 'district',
      fillValue: rawDistrict,
      summaryLabelEn: `Set district to "${rawDistrict}"`,
      summaryLabelHi: `जिला "${rawDistrict}" भरा गया`,
      explanationEn: `Filled District as ${rawDistrict}. Please review on screen.`,
      explanationHi: `जिला "${rawDistrict}" भर दिया गया है।`,
    }
  }

  if (
    lower.includes('my soil is') ||
    lower.includes('soil is') ||
    lower.includes('मेरी मिट्टी') ||
    lower.includes('मिट्टी रेतीली') ||
    lower.includes('मिट्टी काली') ||
    lower.includes('मिट्टी लाल') ||
    lower.includes('मिट्टी दोमट') ||
    lower.includes('मिट्टी जलोढ़')
  ) {
    let matchedSoil = ''
    if (lower.includes('sandy') || lower.includes('रेतीली') || lower.includes('बलुई')) {
      matchedSoil = 'Sandy Soil'
    } else if (lower.includes('black') || lower.includes('regur') || lower.includes('काली')) {
      matchedSoil = 'Black (Regur)'
    } else if (lower.includes('red') || lower.includes('लाल')) {
      matchedSoil = 'Red Soil'
    } else if (lower.includes('loam') || lower.includes('दोमट')) {
      matchedSoil = 'Loamy Soil'
    } else if (lower.includes('alluvial') || lower.includes('जलोढ़')) {
      matchedSoil = 'Alluvial Soil'
    } else if (lower.includes('clay') || lower.includes('चिकनी')) {
      matchedSoil = 'Clayey Soil'
    } else if (lower.includes('laterite') || lower.includes('लैटेराइट')) {
      matchedSoil = 'Laterite Soil'
    }

    if (matchedSoil) {
      return {
        intent: 'FILL_FIELD',
        confidence,
        transcript: t,
        requiresConfirmation: false,
        fillField: 'soil_type',
        fillValue: matchedSoil,
        summaryLabelEn: `Set Soil Type to "${matchedSoil}"`,
        summaryLabelHi: `मिट्टी का प्रकार "${matchedSoil}" चुना गया`,
        explanationEn: `Selected Soil Type: ${matchedSoil}. Please review on screen.`,
        explanationHi: `मिट्टी का प्रकार "${matchedSoil}" चुन लिया गया है।`,
      }
    } else {
      return {
        intent: 'EXPLAIN_FIELD',
        confidence,
        transcript: t,
        requiresConfirmation: false,
        summaryLabelEn: 'Clarify Soil Type choices',
        summaryLabelHi: 'मिट्टी के उपलब्ध विकल्प सुनें',
        explanationEn:
          'Could not match that soil type. Available options are: Alluvial Soil, Black Soil, Red Soil, Loamy Soil, Sandy Soil, Clayey Soil, or Laterite Soil.',
        explanationHi:
          'मिट्टी का प्रकार स्पष्ट नहीं हुआ। उपलब्ध विकल्प हैं: जलोढ़ मिट्टी, काली मिट्टी, लाल मिट्टी, दोमट मिट्टी, बलुई मिट्टी, या चिकनी मिट्टी।',
      }
    }
  }

  // 2d. Navigation to Farmer Details or Crop Details
  if (
    lower.includes('open farmer details') ||
    lower.includes('farmer details') ||
    lower.includes('farm profile') ||
    lower.includes('किसान विवरण') ||
    lower.includes('खेत का विवरण खोलो')
  ) {
    return {
      intent: 'NAV_FARMER_DETAILS',
      confidence,
      transcript: t,
      requiresConfirmation: false,
      summaryLabelEn: 'Open Farmer Details form',
      summaryLabelHi: 'किसान विवरण फॉर्म खोलें',
    }
  }

  if (
    lower.includes('open crop details') ||
    lower.includes('crop details') ||
    lower.includes('फसल विवरण') ||
    lower.includes('फसल का विवरण खोलो')
  ) {
    return {
      intent: 'NAV_CROP_DETAILS',
      confidence,
      transcript: t,
      requiresConfirmation: false,
      summaryLabelEn: 'Open Crop Details form',
      summaryLabelHi: 'फसल विवरण फॉर्म खोलें',
    }
  }
  if (
    lower.includes('हिंदी में') ||
    lower.includes('हिन्दी में') ||
    lower.includes('speak in hindi') ||
    lower.includes('hindi mein bolo') ||
    lower.includes('switch to hindi') ||
    lower === 'हिंदी' ||
    lower === 'hindi'
  ) {
    return {
      intent: 'SWITCH_HINDI',
      confidence,
      transcript: t,
      requiresConfirmation: false,
      summaryLabelEn: 'Switch language to Hindi (हिन्दी)',
      summaryLabelHi: 'भाषा हिंदी में बदलें',
    }
  }

  if (
    lower.includes('अंग्रेज़ी में') ||
    lower.includes('अंग्रेजी में') ||
    lower.includes('इंग्लिश में') ||
    lower.includes('speak in english') ||
    lower.includes('english mein bolo') ||
    lower.includes('switch to english') ||
    lower === 'english' ||
    lower === 'अंग्रेजी'
  ) {
    return {
      intent: 'SWITCH_ENGLISH',
      confidence,
      transcript: t,
      requiresConfirmation: false,
      summaryLabelEn: 'Switch language to English',
      summaryLabelHi: 'भाषा अंग्रेज़ी में बदलें',
    }
  }

  // 3. Weather commands ("मौसम बताओ" / "Tell me the weather")
  if (
    lower.includes('मौसम') ||
    lower.includes('बारिश') ||
    lower.includes('तापमान') ||
    lower.includes('mausam') ||
    lower.includes('barish') ||
    lower.includes('weather') ||
    lower.includes('forecast') ||
    lower.includes('rain')
  ) {
    return {
      intent: 'NAV_WEATHER',
      confidence,
      transcript: t,
      requiresConfirmation: confidence > 0 && confidence < 0.55,
      summaryLabelEn: 'Open Weather Intelligence & read forecast',
      summaryLabelHi: 'मौसम की जानकारी खोलें और सुनें',
    }
  }

  // 4. Disease detection commands ("फसल की बीमारी बताओ" / "Check crop disease")
  if (
    lower.includes('बीमारी') ||
    lower.includes('रोग') ||
    lower.includes('पत्ते') ||
    lower.includes('पत्ती') ||
    lower.includes('कीड़ा') ||
    lower.includes('फोटो') ||
    lower.includes('bimari') ||
    lower.includes('disease') ||
    lower.includes('leaf') ||
    lower.includes('infection') ||
    lower.includes('pest')
  ) {
    return {
      intent: 'NAV_DETECTION',
      confidence,
      transcript: t,
      requiresConfirmation: confidence > 0 && confidence < 0.55,
      summaryLabelEn: 'Open Crop Disease Detection',
      summaryLabelHi: 'फसल रोग पहचान खोलें',
    }
  }

  // 5. Today's actions / Rescue planner ("आज क्या करना चाहिए?" / "What should I do today?")
  if (
    lower.includes('क्या करना') ||
    lower.includes('क्या करें') ||
    lower.includes('आज क्या') ||
    lower.includes('सलाह') ||
    lower.includes('उपाय') ||
    lower.includes('योजना') ||
    lower.includes('kya karna') ||
    lower.includes('salah') ||
    lower.includes('what should i do') ||
    lower.includes('today') ||
    lower.includes('recommend') ||
    lower.includes('advice') ||
    lower.includes('rescue') ||
    lower.includes('plan')
  ) {
    return {
      intent: 'NAV_PLANNER_TODAY',
      confidence,
      transcript: t,
      requiresConfirmation: confidence > 0 && confidence < 0.55,
      summaryLabelEn: 'Check today’s recommended actions & Rescue Planner',
      summaryLabelHi: 'आज की प्रमुख कृषि सलाह और कार्य देखें',
    }
  }

  // 6. Show my crops / fields ("मेरी फसल दिखाओ" / "Show my crops")
  if (
    lower.includes('मेरी फसल') ||
    lower.includes('फसल दिखाओ') ||
    lower.includes('खेत दिखाओ') ||
    lower.includes('मेरे खेत') ||
    lower.includes('फसल') ||
    lower.includes('खेत') ||
    lower.includes('meri fasal') ||
    lower.includes('khet') ||
    lower.includes('show my crop') ||
    lower.includes('my crop') ||
    lower.includes('my field') ||
    lower.includes('fields') ||
    lower.includes('crops')
  ) {
    return {
      intent: 'NAV_FIELDS',
      confidence,
      transcript: t,
      requiresConfirmation: confidence > 0 && confidence < 0.55,
      summaryLabelEn: 'Open Field Monitor (My Crops)',
      summaryLabelHi: 'मेरी फसल और खेत दिखाएं',
    }
  }

  // 7. Budget / Expense commands
  if (
    lower.includes('बजट') ||
    lower.includes('खर्च') ||
    lower.includes('लागत') ||
    lower.includes('budget') ||
    lower.includes('expense')
  ) {
    return {
      intent: 'NAV_BUDGET',
      confidence,
      transcript: t,
      requiresConfirmation: false,
      summaryLabelEn: 'Open Budget Manthan',
      summaryLabelHi: 'बजट मंथन खोलें',
    }
  }

  // 8. Reports / History commands
  if (
    lower.includes('रिपोर्ट') ||
    lower.includes('इतिहास') ||
    lower.includes('report') ||
    lower.includes('history')
  ) {
    return {
      intent: 'NAV_REPORTS',
      confidence,
      transcript: t,
      requiresConfirmation: false,
      summaryLabelEn: 'Open Reports & History',
      summaryLabelHi: 'रिपोर्ट और इतिहास खोलें',
    }
  }

  // 9. Simulator commands
  if (
    lower.includes('मुनाफा') ||
    lower.includes('सिम्युलेटर') ||
    lower.includes('simulator') ||
    lower.includes('profit')
  ) {
    return {
      intent: 'NAV_SIMULATOR',
      confidence,
      transcript: t,
      requiresConfirmation: false,
      summaryLabelEn: 'Open What-If Simulator',
      summaryLabelHi: 'मुनाफा सिम्युलेटर खोलें',
    }
  }

  return {
    intent: 'UNKNOWN',
    confidence,
    transcript: t,
    requiresConfirmation: false,
    summaryLabelEn: 'Command not recognized',
    summaryLabelHi: 'आवाज़ कमांड पहचानी नहीं गई',
  }
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
}
