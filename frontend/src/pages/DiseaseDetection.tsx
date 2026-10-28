import { useState, useRef, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Upload,
  ScanSearch,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ClipboardCheck,
  FileText,
  HelpCircle,
  Compass,
  Sparkles,
} from 'lucide-react'
import { fieldsApi, analysisApi, healthApi, cropsApi } from '@/services/cropsentinel'
import { useI18n, translateRiskStatus, translateGrowthStage } from '@/i18n/translations'
import SpeakButton from '@/components/common/SpeakButton'
import type { AssessmentRecord } from '@/types'

const SUPPORTED_PLANTVILLAGE_CROPS = [
  'Tomato',
  'Potato',
  'Corn (Maize)',
  'Bell Pepper / Chilli',
  'Apple',
  'Grape',
  'Peach',
  'Orange / Citrus',
  'Strawberry',
  'Cherry',
  'Squash / Cucurbit',
  'Soybean',
  'Blueberry',
  'Raspberry',
]

const HEALTHY_ONLY_CROPS = new Set(['Soybean', 'Blueberry', 'Raspberry'])

const UNSUPPORTED_PLANTVILLAGE_CROPS = [
  'Wheat',
  'Rice',
  'Cotton',
  'Sugarcane',
  'Mustard',
  'Chickpea (Chana)',
  'Other',
]

const STAGES = ['Seedling', 'Vegetative', 'Flowering', 'Fruiting/Grain Fill', 'Maturity']

export default function DiseaseDetection() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { language, t } = useI18n()
  const dt = t.detection

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fieldId, setFieldId] = useState<number | ''>('')
  const [cropType, setCropType] = useState('Tomato')
  const [growthStage, setGrowthStage] = useState('Vegetative')
  const [userNotes, setUserNotes] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [result, setResult] = useState<AssessmentRecord | null>(null)

  const fieldsQuery = useQuery({ queryKey: ['fields'], queryFn: fieldsApi.list })
  const healthQuery = useQuery({ queryKey: ['system-health'], queryFn: healthApi.getStatus })
  const modelInfoQuery = useQuery({ queryKey: ['disease-model-info'], queryFn: analysisApi.getModelInfo })
  const cropProfileQuery = useQuery({
    queryKey: ['crop-profile-eval', cropType, growthStage],
    queryFn: () => cropsApi.evaluateModel({ crop_name: cropType, growth_stage: growthStage }),
    enabled: !!cropType,
  })
  const cropProfile = cropProfileQuery.data

  const [diagAnswers, setDiagAnswers] = useState<Record<string, string>>({})
  const diagnosticQuery = useQuery({
    queryKey: ['root-cause-diagnostics', cropType, growthStage, userNotes, diagAnswers],
    queryFn: () =>
      analysisApi.evaluateDiagnostics({
        crop_name: cropType,
        growth_stage: growthStage,
        visible_symptoms: userNotes || 'yellowing with leaf spots',
        distribution_pattern: 'focal_patches',
        recent_rainfall_or_irrigation: 'normal',
        answered_questions: diagAnswers,
      }),
  })

  useEffect(() => {
    const fId = searchParams.get('field_id')
    if (fId && fieldsQuery.data) {
      const matched = fieldsQuery.data.find(f => f.id === Number(fId))
      if (matched) {
        setFieldId(matched.id)
        setCropType(matched.crop_type)
        setGrowthStage(matched.growth_stage)
      }
    }
  }, [searchParams, fieldsQuery.data])

  const handleFilePicked = (file: File | undefined) => {
    setValidationError(null)
    if (!file) return

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type.toLowerCase())) {
      setValidationError(
        language === 'hi'
          ? 'अमान्य फोटो प्रकार। कृपया JPEG, PNG या WEBP फोटो चुनें।'
          : 'Unsupported image format. Please choose a JPEG, PNG, or WEBP image.'
      )
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setValidationError(
        language === 'hi'
          ? 'फोटो 10 MB से बड़ी है। कृपया छोटी फोटो चुनें।'
          : 'File size exceeds 10 MB limit. Please choose a smaller leaf photo.'
      )
      return
    }

    setSelectedFile(file)
    setResult(null)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
  }

  const analyzeMutation = useMutation({
    mutationFn: () =>
      analysisApi.analyzeImage({
        file: selectedFile!,
        crop_type: cropType,
        growth_stage: growthStage,
        field_id: fieldId === '' ? null : Number(fieldId),
        user_notes: userNotes,
      }),
    onSuccess: data => {
      setResult(data)
      queryClient.invalidateQueries({ queryKey: ['reports-summary'] })
      queryClient.invalidateQueries({ queryKey: ['history'] })
      queryClient.invalidateQueries({ queryKey: ['fields'] })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) {
      setValidationError(
        language === 'hi'
          ? 'कृपया पहले पत्ते की फोटो अपलोड करें।'
          : 'Please select or drag-and-drop a crop leaf image first.'
      )
      return
    }
    analyzeMutation.mutate()
  }

  const aiConfigured = healthQuery.data?.ai_configured ?? false

  // Build honest, farmer-friendly spoken explanation of the analysis result
  const buildResultSpeechEn = (r: AssessmentRecord): string => {
    const aiPart =
      r.analysis_status === 'completed' && r.predicted_condition
        ? `Preliminary AI image result for ${r.crop_type}: ${r.predicted_condition} with ${
            r.model_confidence !== null && r.model_confidence !== undefined
              ? `${(r.model_confidence * 100).toFixed(0)} percent`
              : 'reported'
          } confidence.`
        : `AI image classification was not available, so no AI disease diagnosis was fabricated.`
    const riskPart = `Rule-based risk level is ${r.risk_category} with a score of ${r.risk_score ?? 0} out of 100.`
    const stepPart = r.recommended_next_steps?.[0] ? `Recommended next step: ${r.recommended_next_steps[0]}` : ''
    return `${aiPart} ${riskPart} ${stepPart} Please confirm with a qualified agricultural expert before applying any chemical treatment.`
  }

  const buildResultSpeechHi = (r: AssessmentRecord): string => {
    const aiPart =
      r.analysis_status === 'completed' && r.predicted_condition
        ? `${r.crop_type} की पत्ती जांच का प्रारंभिक AI परिणाम: ${r.predicted_condition} (${
            r.model_confidence !== null && r.model_confidence !== undefined
              ? `${(r.model_confidence * 100).toFixed(0)} प्रतिशत`
              : ''
          } विश्वास)।`
        : `AI मॉडल कुंजी उपलब्ध न होने के कारण कोई नकली AI बीमारी निदान नहीं बनाया गया है।`
    const riskPart = `नियम-आधारित जोखिम स्तर ${translateRiskStatus(r.risk_category, 'hi')} है और जोखिम अंक 100 में से ${
      r.risk_score ?? 0
    } है।`
    const stepPart =
      r.recommended_next_steps?.[0]
        ? `प्रमुख सलाह: खेत में 10 से 15 पौधों के पत्तों का निरीक्षण करें और किसी भी दवा के छिड़काव से पहले स्थानीय कृषि विशेषज्ञ से सलाह लें।`
        : ''
    return `${aiPart} ${riskPart} ${stepPart}`
  }

  return (
    <div className="space-y-6">
      {/* Simple 3-Step Visual Farmer Banner */}
      <div className="surface-card p-4 bg-emerald-50/70 border-emerald-200">
        <p className="text-xs font-bold uppercase tracking-wider text-[#14532d] mb-2">
          {dt.farmerGuideTitle}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-bold text-slate-900">
          <div className="p-2.5 rounded-xl bg-white border border-emerald-200">{dt.step1}</div>
          <div className="p-2.5 rounded-xl bg-white border border-emerald-200">{dt.step2}</div>
          <div className="p-2.5 rounded-xl bg-white border border-emerald-200">{dt.step3}</div>
        </div>
      </div>

      {/* AI Configuration & Verified Plant-Disease Model Banner */}
      <div
        className={`p-4 rounded-2xl border flex items-start gap-3 text-xs ${
          aiConfigured
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
            : 'bg-amber-50 border-amber-200 text-amber-950'
        }`}
      >
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#14532d]" />
        <div className="space-y-1.5 flex-1">
          <p className="font-bold text-sm">
            {aiConfigured
              ? `${dt.aiConfiguredTitle} (${healthQuery.data?.ai_provider} · ${healthQuery.data?.ai_model_id})`
              : dt.aiUnconfiguredTitle}
          </p>
          <p className="opacity-90">{aiConfigured ? dt.aiConfiguredDesc : dt.aiUnconfiguredDesc}</p>
          {modelInfoQuery.data && (
            <div className="pt-1.5 mt-1.5 border-t border-black/10 text-[11px] space-y-1">
              <p>
                <strong>{language === 'hi' ? 'चयनित पादप-रोग मॉडल:' : 'Verified Plant-Disease Model:'}</strong>{' '}
                <code>{modelInfoQuery.data.configured_model_id}</code> ({modelInfoQuery.data.supported_classes.length}{' '}
                {language === 'hi' ? 'रोग/स्वस्थ वर्ग' : 'PlantVillage disease/healthy classes'})
              </p>
              <p>
                <strong>{language === 'hi' ? 'सीधे समर्थित फसलें (14):' : 'Directly Trained Crops (14):'}</strong>{' '}
                {modelInfoQuery.data.supported_crops.join(', ')}
              </p>
              <p className="opacity-90">
                <strong>{language === 'hi' ? 'PlantVillage सीमा सूचना:' : 'PlantVillage Coverage & Limitation Note:'}</strong>{' '}
                {language === 'hi'
                  ? 'यह मॉडल प्रयोगशाला में एकल टूटे हुए पत्तों के फोटो पर प्रशिक्षित है; यह खेत में बीमारी का अंतिम प्रमाण नहीं है। सोयाबीन, ब्लूबेरी और रास्पबेरी के लिए केवल स्वस्थ (healthy) वर्ग उपलब्ध है, और गेहूं, धान, कपास, गन्ना इस पत्ती मॉडल में शामिल नहीं हैं (उनके लिए नियम-आधारित जोखिम इंजन सक्रिय रहता है)।'
                  : 'Trained on controlled studio photos of single detached leaves—not standalone proof of field disease. Soybean, Blueberry, and Raspberry only include a healthy class (0 disease classes), and major cereal/fiber crops (Wheat, Rice, Cotton, Sugarcane) are evaluated by the Rule-Based Risk Engine.'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Upload & Context Form */}
        <form onSubmit={handleSubmit} className="surface-card p-5 lg:col-span-5 space-y-4 h-fit">
          <h3 className="section-title">{dt.section1Title}</h3>

          {/* Drag and drop zone */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault()
              handleFilePicked(e.dataTransfer.files?.[0])
            }}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-[#14532d] rounded-2xl p-5 text-center cursor-pointer transition-colors bg-[#f7f9f6]"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={e => handleFilePicked(e.target.files?.[0])}
            />
            {previewUrl ? (
              <div className="space-y-2">
                <img
                  src={previewUrl}
                  alt="Selected crop leaf preview"
                  className="max-h-52 mx-auto rounded-xl object-contain border border-slate-200 bg-white"
                />
                <p className="text-xs font-semibold text-slate-700 truncate">{selectedFile?.name}</p>
                <p className="text-[11px] text-[#14532d] font-medium">{dt.replaceFilePrompt}</p>
              </div>
            ) : (
              <div className="py-6 space-y-2">
                <Upload className="w-9 h-9 text-[#14532d] mx-auto" />
                <p className="text-sm font-bold text-slate-900">{dt.dropzonePrompt}</p>
                <p className="text-xs text-slate-500">{dt.dropzoneSub}</p>
              </div>
            )}
          </div>

          {validationError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <div>
            <label className="label-text">{dt.associatedFieldLabel}</label>
            <select
              value={fieldId}
              onChange={e => {
                const val = e.target.value === '' ? '' : Number(e.target.value)
                setFieldId(val)
                if (val !== '') {
                  const found = fieldsQuery.data?.find(f => f.id === val)
                  if (found) {
                    setCropType(found.crop_type)
                    setGrowthStage(found.growth_stage)
                  }
                }
              }}
              className="input-field"
            >
              <option value="">{dt.unlinkedSample}</option>
              {(fieldsQuery.data ?? []).map(f => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.crop_type})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-text">{dt.cropTypeLabel}</label>
              <select
                value={cropType}
                onChange={e => setCropType(e.target.value)}
                className="input-field"
              >
                <optgroup
                  label={
                    language === 'hi'
                      ? 'AI पत्ती मॉडल द्वारा समर्थित (14 PlantVillage फसलें)'
                      : 'Supported by AI Leaf Model (14 PlantVillage Crops)'
                  }
                >
                  {SUPPORTED_PLANTVILLAGE_CROPS.map(c => (
                    <option key={c} value={c}>
                      {c} {HEALTHY_ONLY_CROPS.has(c) ? '(Healthy-only class)' : ''}
                    </option>
                  ))}
                </optgroup>
                <optgroup
                  label={
                    language === 'hi'
                      ? 'अन्य फसलें (केवल नियम-आधारित जोखिम इंजन)'
                      : 'Other Crops (Rule-Based Risk Engine Only)'
                  }
                >
                  {UNSUPPORTED_PLANTVILLAGE_CROPS.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="label-text">{dt.growthStageLabel}</label>
              <select
                value={growthStage}
                onChange={e => setGrowthStage(e.target.value)}
                className="input-field"
              >
                {STAGES.map(s => (
                  <option key={s} value={s}>
                    {translateGrowthStage(s, language)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Crop support indicator */}
          {UNSUPPORTED_PLANTVILLAGE_CROPS.includes(cropType) && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
              <strong>
                {language === 'hi' ? 'असमर्थित पादप-रोग वर्ग:' : 'Unsupported PlantVillage Crop:'}
              </strong>{' '}
              {language === 'hi'
                ? `'${cropType}' इस 38-वर्ग PlantVillage मॉडल में शामिल नहीं है। कोई नकली AI निदान नहीं दिखाया जाएगा, लेकिन नियम-आधारित जोखिम इंजन फिर भी काम करेगा।`
                : `'${cropType}' has 0 classes in linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification. AI diagnosis will honestly report unavailable while the Rule-Based Risk Engine still runs.`}
            </div>
          )}
          {HEALTHY_ONLY_CROPS.has(cropType) && (
            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-900">
              <strong>
                {language === 'hi' ? 'सीमित वर्ग सूचना:' : 'Healthy-Only Class Notice:'}
              </strong>{' '}
              {language === 'hi'
                ? `'${cropType}' के लिए PlantVillage में केवल स्वस्थ (healthy) वर्ग है और कोई विशिष्ट रोग वर्ग नहीं है।`
                : `PlantVillage includes only a '${cropType}___healthy' class and 0 specific disease classes for ${cropType}.`}
            </div>
          )}

          {cropProfile?.stage_expected_leaf_colour && (
            <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-[11px] text-emerald-950 space-y-0.5">
              <strong>
                {language === 'hi'
                  ? `आदर्श पत्ती रंग (${translateGrowthStage(growthStage, language)}):`
                  : `Ideal Leaf Appearance (${growthStage}):`}
              </strong>
              <p className="opacity-90">{cropProfile.stage_expected_leaf_colour}</p>
            </div>
          )}

          <div>
            <label className="label-text">{dt.symptomsNotesLabel}</label>
            <textarea
              rows={3}
              value={userNotes}
              onChange={e => setUserNotes(e.target.value)}
              placeholder={dt.symptomsPlaceholder}
              className="input-field"
            />
          </div>

          <button
            type="submit"
            disabled={analyzeMutation.isPending || !selectedFile}
            className="btn-primary w-full py-3 text-sm"
          >
            {analyzeMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> {dt.analyzingBtn}
              </>
            ) : (
              <>
                <ScanSearch className="w-4 h-4" /> {dt.analyzeBtn}
              </>
            )}
          </button>

          {analyzeMutation.isError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 space-y-2">
              <p className="font-bold">Analysis Request Failed</p>
              <p>
                {(analyzeMutation.error as any)?.response?.data?.detail ||
                  (analyzeMutation.error as any)?.message ||
                  'Unexpected server error.'}
              </p>
              <button
                type="button"
                onClick={() => analyzeMutation.mutate()}
                className="btn-secondary text-xs py-1 px-2.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
            </div>
          )}
        </form>

        {/* Analysis & Risk Output Panel */}
        <div className="surface-card p-5 lg:col-span-7 space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="section-title">{dt.section2Title}</h3>
            {result && (
              <SpeakButton
                textEn={buildResultSpeechEn(result)}
                textHi={buildResultSpeechHi(result)}
                labelEn={dt.listenResultBtn}
                labelHi="सलाह सुनें (Listen)"
                size="lg"
              />
            )}
          </div>

          {analyzeMutation.isPending ? (
            <div className="py-16 text-center text-xs text-slate-600 space-y-3 border border-dashed border-emerald-300 bg-emerald-50/40 rounded-2xl">
              <Loader2 className="w-10 h-10 text-[#14532d] animate-spin mx-auto" />
              <p className="text-sm font-bold text-slate-900">
                {language === 'hi'
                  ? 'पत्ती की फोटो और नियम-आधारित जोखिम का विश्लेषण हो रहा है...'
                  : 'Running Plant-Disease Classifier & Rule-Based Risk Engine...'}
              </p>
              <p className="max-w-md mx-auto text-slate-500">
                {language === 'hi'
                  ? 'मॉडल समर्थित फसल वर्ग, विश्वास स्कोर और खेत के लक्षणों की जांच कर रहा है।'
                  : 'Verifying crop class compatibility with linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification and evaluating field risk factors.'}
              </p>
            </div>
          ) : !result ? (
            <div className="py-16 text-center text-xs text-slate-500 space-y-2 border border-dashed border-slate-200 rounded-2xl">
              <ScanSearch className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">{dt.noImageAnalyzedTitle}</p>
              <p className="max-w-md mx-auto">{dt.noImageAnalyzedDesc}</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Preliminary Disclaimer */}
              <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700">
                {result.disclaimer}
              </div>

              {/* AI Model Output Box */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-[#f7f9f6] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {dt.aiStatusLabel}
                    </span>
                    <h4 className="text-base font-bold text-slate-900">
                      {result.analysis_status === 'completed'
                        ? result.predicted_condition
                        : dt.aiUnavailableTitle}
                    </h4>
                  </div>
                  <span
                    className={`badge ${
                      result.analysis_status === 'completed' ? 'badge-healthy' : 'badge-watch'
                    }`}
                  >
                    Status: {result.analysis_status.toUpperCase()}
                  </span>
                </div>

                {result.analysis_status === 'completed' && result.predicted_condition ? (
                  <div className="space-y-3 pt-2 border-t border-slate-200">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 block">
                          {language === 'hi'
                            ? 'मॉडल विश्वास स्कोर (अंतिम संभावना नहीं)'
                            : 'Model Confidence (Uncalibrated Score)'}
                        </span>
                        <strong className="text-slate-900 text-sm">
                          {result.model_confidence !== null && result.model_confidence !== undefined
                            ? `${(result.model_confidence * 100).toFixed(1)}%`
                            : 'Not reported'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">{dt.estimatedSeverity}</span>
                        <strong className="text-slate-900 uppercase">{result.severity}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">{dt.expertVerification}</span>
                        <strong className="text-amber-800">
                          {result.expert_confirmation_needed ? dt.recommended : dt.routineCheck}
                        </strong>
                      </div>
                    </div>

                    {result.raw_predictions && result.raw_predictions.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-[11px] space-y-1">
                        <span className="font-bold text-slate-700 block">
                          {language === 'hi' ? 'शीर्ष मॉडल वर्ग स्कोर (Top Class Scores):' : 'Top Model Class Scores:'}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {result.raw_predictions.slice(0, 3).map((pred, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 font-medium"
                            >
                              {pred.label}: {(pred.confidence * 100).toFixed(1)}%
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200 text-[11px] text-blue-950 space-y-1.5">
                      <p>
                        <strong>
                          {language === 'hi'
                            ? 'विश्वास स्कोर स्पष्टीकरण (Model Confidence vs Calibrated Probability): '
                            : 'Model Confidence vs Calibrated Probability: '}
                        </strong>
                        {language === 'hi'
                          ? 'दिखाया गया मॉडल विश्वास स्कोर 38 प्रशिक्षित वर्गों पर एक अनकैलिब्रेटेड सॉफ्टमैक्स (softmax) स्कोर है—यह वैज्ञानिक या चिकित्सकीय रूप से प्रमाणित संभावना (calibrated probability) नहीं है।'
                          : 'The returned score is an uncalibrated softmax confidence score across the model’s 38 trained classes—it is NOT a medically or scientifically calibrated probability of true disease.'}
                      </p>
                      <p>
                        <strong>
                          {language === 'hi'
                            ? 'PlantVillage डेटासेट सीमा (Dataset Limitation Notice): '
                            : 'PlantVillage Dataset Limitation Notice: '}
                        </strong>
                        {language === 'hi'
                          ? 'यह मॉडल प्रयोगशाला में एकल टूटे हुए पत्तों के फोटो पर प्रशिक्षित है। खेत की धूप, मिट्टी की पृष्ठभूमि, पोषक तत्वों की कमी या कीट क्षति से परिणाम भिन्न हो सकते हैं। किसी भी रासायनिक छिड़काव से पहले कृषि विशेषज्ञ से पुष्टि करें।'
                          : 'linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification was trained on studio photos of single detached leaves on uniform backgrounds. Real-world field lighting, multiple leaves, soil backgrounds, or nutrient deficiencies may cause misclassification. Do not use this output as standalone proof of field disease.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
                    <p className="font-semibold">{dt.whyAiUnavailable}</p>
                    <p>
                      {result.troubleshooting_hint ||
                        'Configure HF_TOKEN in backend/.env to enable live Hugging Face inference.'}
                    </p>
                    {result.raw_predictions && result.raw_predictions.length > 0 && (
                      <div className="pt-1.5 border-t border-amber-200/80 text-[11px]">
                        <span className="font-bold">
                          {language === 'hi'
                            ? 'अस्वीकृत/अस्पष्ट मॉडल आउटपुट (निदान के रूप में उपयोग नहीं किया गया): '
                            : 'Rejected/Ambiguous Raw Model Output (not used as diagnosis): '}
                        </span>
                        {result.raw_predictions
                          .slice(0, 3)
                          .map(p => `${p.label} (${(p.confidence * 100).toFixed(1)}%)`)
                          .join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 182-Crop FAO/ICAR Reference & Visual Leaf Model Card */}
              {cropProfile?.matched && (
                <div className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/70 text-xs space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-bold text-[#14532d]">
                      {language === 'hi' ? '182-फसल संदर्भ व पत्ती रंग मॉडल' : '182-Crop Reference & Leaf Colour Model'}: {cropProfile.crop} ({cropProfile.crop_group})
                    </span>
                    <span className="badge badge-healthy">
                      {language === 'hi' ? 'अनुकूलता:' : 'Suitability:'} {cropProfile.suitability_score}%
                    </span>
                  </div>
                  {cropProfile.stage_expected_leaf_colour && (
                    <p className="text-[11px] text-slate-700">
                      <strong>{language === 'hi' ? 'अवस्था अनुसार अपेक्षित पत्ती रंग:' : 'Stage-Expected Leaf Colour:'}</strong>{' '}
                      {cropProfile.stage_expected_leaf_colour}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-600">
                    <strong>{language === 'hi' ? 'अनुकूल सीमा:' : 'Indicative Envelope:'}</strong>{' '}
                    Temp: {cropProfile.indicative_temperature_c}°C • pH: {cropProfile.indicative_soil_ph} • Rain: {cropProfile.indicative_annual_rainfall_mm} mm
                  </p>
                  <p className="text-[10px] text-slate-500 italic">
                    {cropProfile.image_comparison_safety_note || cropProfile.confidence_note}
                  </p>
                </div>
              )}

              {/* Transparent Risk Assessment Engine Box */}
              <div className="p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {dt.riskEngineLabel}
                    </span>
                    <h4 className="text-base font-bold text-slate-900">
                      {dt.riskScoreLabel}: {result.risk_score ?? '—'} / 100 (
                      {translateRiskStatus(result.risk_category, language)})
                    </h4>
                  </div>
                  <span className="badge badge-info">
                    {dt.dataCompleteness}: {result.data_completeness_pct}%
                  </span>
                </div>

                <p className="text-[11px] text-slate-500">{result.scoring_method_note}</p>

                {/* Contributing Risk Factors */}
                <div className="space-y-2 pt-1">
                  <span className="text-xs font-bold text-slate-800">{dt.contributingFactors}</span>
                  {result.risk_factors.map((rf, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex items-start justify-between gap-3"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{rf.factor}</p>
                        <p className="text-slate-600 text-[11px] mt-0.5">{rf.detail}</p>
                      </div>
                      <span className="badge badge-info whitespace-nowrap">{rf.source}</span>
                    </div>
                  ))}
                </div>

                {/* Missing Data Gaps */}
                {result.missing_data.length > 0 && (
                  <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900">
                    <span className="font-bold block mb-1">{dt.missingDataTitle}</span>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                      {result.missing_data.map((gap, i) => (
                        <li key={i}>{gap}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Rule-Based Next Steps & Preventive Measures */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-slate-200 space-y-2">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-[#14532d]">
                    {dt.nextStepsTitle}
                  </h5>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {result.recommended_next_steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#14532d] flex-shrink-0 mt-0.5" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 space-y-2">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    {dt.preventiveTitle}
                  </h5>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {result.preventive_measures.map((pm, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <span>{pm}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* ─── ROOT-CAUSE DIAGNOSTIC INVESTIGATION ENGINE ────────────── */}
              {diagnosticQuery.data && (
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-stone-200 text-stone-800">
                          {language === 'hi' ? 'मूल-कारण विभेदक निदान' : 'Root-Cause Differential Diagnosis'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            diagnosticQuery.data.uncertainty_level === 'adequate_preliminary'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {diagnosticQuery.data.uncertainty_level === 'adequate_preliminary'
                            ? language === 'hi' ? 'पर्याप्त प्रारंभिक साक्ष्य' : 'Adequate Evidence'
                            : language === 'hi' ? 'उच्च अनिश्चितता (अतिरिक्त जांच जरूरी)' : 'High Uncertainty'}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-600 mt-1">
                        {diagnosticQuery.data.guidance_note}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/simulator?crop=${cropType}&field_id=${fieldId}`
                        )
                      }
                      className="px-3 py-1.5 rounded-xl bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 hover:bg-emerald-800 transition-colors shadow-sm whitespace-nowrap self-start"
                    >
                      <Compass className="w-3.5 h-3.5" />
                      {language === 'hi' ? 'डिसीजन लैब में भेजें' : 'Send to Decision Lab'}
                    </button>
                  </div>

                  {/* Ranked Hypotheses */}
                  <div className="space-y-2">
                    <span className="font-bold text-xs text-stone-800 block uppercase tracking-wider">
                      {language === 'hi' ? 'संभावित कारणों की प्राथमिक रैंकिंग:' : 'Ranked Competing Hypotheses:'}
                    </span>
                    <div className="grid grid-cols-1 gap-2.5">
                      {diagnosticQuery.data.hypotheses.slice(0, 3).map((h, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl border border-stone-200 bg-white text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-stone-900">
                              #{h.probability_rank} {h.cause_name}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                h.confidence_level === 'high_suspicion'
                                  ? 'bg-red-100 text-red-800'
                                  : h.confidence_level === 'moderate_suspicion'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-stone-100 text-stone-600'
                              }`}
                            >
                              {h.confidence_level}
                            </span>
                          </div>

                          <div className="text-[11px] text-stone-600 space-y-0.5">
                            <p>
                              <strong className="text-emerald-800">
                                {language === 'hi' ? 'समर्थक साक्ष्य:' : 'Supporting:'}
                              </strong>{' '}
                              {h.supporting_evidence.join('; ')}
                            </p>
                            <p>
                              <strong className="text-stone-800">
                                {language === 'hi' ? 'खेत सत्यापन कदम:' : 'Field Verification:'}
                              </strong>{' '}
                              {h.suggested_field_verification}
                            </p>
                            <p className="text-[10px] text-emerald-900 font-semibold">
                              👉 {h.safer_agronomic_step}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Interactive Diagnostic Follow-Up Questions */}
                  {diagnosticQuery.data.next_follow_up_questions.length > 0 && (
                    <div className="p-3 bg-white rounded-xl border border-stone-200 space-y-3">
                      <span className="font-bold text-xs text-stone-900 flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-emerald-700" />
                        {language === 'hi'
                          ? 'निदान निश्चित करने हेतु अनुवर्ती प्रश्न:'
                          : 'Targeted Questions to Reduce Diagnostic Uncertainty:'}
                      </span>
                      {diagnosticQuery.data.next_follow_up_questions.map(q => (
                        <div key={q.question_id} className="space-y-1 text-xs">
                          <p className="font-semibold text-stone-800 text-[11px]">
                            {q.question_text}
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
                            {q.options.map((opt, optIdx) => (
                              <button
                                key={optIdx}
                                type="button"
                                onClick={() =>
                                  setDiagAnswers(prev => ({
                                    ...prev,
                                    [q.question_id]: opt,
                                  }))
                                }
                                className={`text-left p-2 rounded-lg border text-[11px] transition-all ${
                                  diagAnswers[q.question_id] === opt
                                    ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-900'
                                    : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-[10px] text-stone-500 italic">
                    {diagnosticQuery.data.safety_protocol_note}
                  </p>
                </div>
              )}

              {/* Action Footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs text-slate-500">
                <span>
                  Assessment #{result.id} · {new Date(result.created_at).toLocaleString()}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate('/reports')}
                    className="btn-secondary text-xs py-1.5 px-3"
                  >
                    <FileText className="w-3.5 h-3.5" /> {dt.viewInCropMemory}
                  </button>
                  {result.field_id && (
                    <button
                      onClick={() => navigate(`/planner?field_id=${result.field_id}`)}
                      className="btn-primary text-xs py-1.5 px-3"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" /> {dt.generateRescuePlan}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
