import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Sprout,
  Plus,
  Edit3,
  Trash2,
  Eye,
  MapPin,
  Calendar,
  X,
  ClipboardCheck,
  ScanSearch,
  AlertCircle,
  CheckCircle2,
  Compass,
  Layers,
  AlertTriangle,
  TrendingDown,
  Droplets,
} from 'lucide-react'
import { fieldsApi, historyApi, analysisApi } from '@/services/cropsentinel'
import { useWeatherStore } from '@/store/weatherStore'
import { useI18n, translateRiskStatus, translateGrowthStage } from '@/i18n/translations'
import SpeakButton from '@/components/common/SpeakButton'
import type { FieldRecord, FieldCreatePayload } from '@/types'

const SUGGESTED_CROPS = [
  'Wheat',
  'Rice',
  'Maize',
  'Cotton',
  'Sugarcane',
  'Tomato',
  'Potato',
  'Other',
]

const GROWTH_STAGES = [
  'Seedling',
  'Vegetative',
  'Flowering',
  'Fruiting/Grain Fill',
  'Maturity',
]

export default function FieldMonitor() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { preferredAreaUnit } = useWeatherStore()
  const { language, t } = useI18n()
  const fm = t.fields

  const [modalOpen, setModalOpen] = useState(false)
  const [editingField, setEditingField] = useState<FieldRecord | null>(null)
  const [selectedField, setSelectedField] = useState<FieldRecord | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [bannerMsg, setBannerMsg] = useState<string | null>(null)

  const [form, setForm] = useState<FieldCreatePayload>({
    name: '',
    crop_type: 'Wheat',
    area_value: 2.5,
    area_unit: preferredAreaUnit,
    location: '',
    planting_date: new Date().toISOString().slice(0, 10),
    growth_stage: 'Vegetative',
    notes: '',
  })

  const fieldsQuery = useQuery({
    queryKey: ['fields'],
    queryFn: fieldsApi.list,
  })

  const fieldHistoryQuery = useQuery({
    queryKey: ['field-history', selectedField?.id],
    queryFn: () => historyApi.list({ field_id: selectedField!.id }),
    enabled: !!selectedField,
  })

  const zonesQuery = useQuery({
    queryKey: ['field-zones', selectedField?.id],
    queryFn: () => fieldsApi.listZones(selectedField!.id),
    enabled: !!selectedField,
  })

  const trendsQuery = useQuery({
    queryKey: ['field-trends', selectedField?.id],
    queryFn: () => fieldsApi.getTrends(selectedField!.id),
    enabled: !!selectedField,
  })

  const butterflyQuery = useQuery({
    queryKey: ['field-butterfly', selectedField?.id],
    queryFn: () =>
      analysisApi.evaluateButterflyRisk({
        crop_name: selectedField!.crop_type,
        growth_stage: selectedField!.growth_stage,
        current_temp_c: 32.0,
        soil_moisture_pct: 26.0,
        relative_humidity_pct: 78.0,
        rainfall_3d_sum_mm: 12.0,
        drainage_quality: 'Moderate',
      }),
    enabled: !!selectedField,
  })

  useEffect(() => {
    const selectId = searchParams.get('select')
    if (selectId && fieldsQuery.data) {
      const found = fieldsQuery.data.find(f => f.id === Number(selectId))
      if (found) setSelectedField(found)
    }
  }, [searchParams, fieldsQuery.data])

  const createMutation = useMutation({
    mutationFn: fieldsApi.create,
    onSuccess: newField => {
      queryClient.invalidateQueries({ queryKey: ['fields'] })
      queryClient.invalidateQueries({ queryKey: ['reports-summary'] })
      setModalOpen(false)
      setSelectedField(newField)
      setBannerMsg(
        language === 'hi'
          ? `खेत "${newField.name}" सफलतापूर्वक सुरक्षित हो गया।`
          : `Field "${newField.name}" saved to SQLite.`
      )
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.detail || 'Failed to save field.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FieldCreatePayload }) => fieldsApi.update(id, data),
    onSuccess: updated => {
      queryClient.invalidateQueries({ queryKey: ['fields'] })
      queryClient.invalidateQueries({ queryKey: ['reports-summary'] })
      setModalOpen(false)
      setEditingField(null)
      setSelectedField(updated)
      setBannerMsg(
        language === 'hi'
          ? `खेत "${updated.name}" का विवरण अपडेट हो गया।`
          : `Field "${updated.name}" updated.`
      )
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.detail || 'Failed to update field.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: fieldsApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fields'] })
      queryClient.invalidateQueries({ queryKey: ['reports-summary'] })
      if (selectedField?.id === confirmDeleteId) setSelectedField(null)
      setConfirmDeleteId(null)
      setBannerMsg(language === 'hi' ? 'खेत हटाया गया।' : 'Field deleted.')
    },
  })

  const openAddModal = () => {
    setEditingField(null)
    setFormError(null)
    setForm({
      name: '',
      crop_type: 'Wheat',
      area_value: 2.0,
      area_unit: preferredAreaUnit,
      location: '',
      planting_date: new Date().toISOString().slice(0, 10),
      growth_stage: 'Vegetative',
      notes: '',
    })
    setModalOpen(true)
  }

  const openEditModal = (field: FieldRecord) => {
    setEditingField(field)
    setFormError(null)
    setForm({
      name: field.name,
      crop_type: field.crop_type,
      area_value: field.area_value,
      area_unit: field.area_unit,
      location: field.location,
      planting_date: field.planting_date || '',
      growth_stage: field.growth_stage,
      notes: field.notes || '',
    })
    setModalOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!form.name.trim()) {
      setFormError(language === 'hi' ? 'कृपया खेत का नाम लिखें।' : 'Field name is required.')
      return
    }
    if (!form.crop_type.trim()) {
      setFormError(language === 'hi' ? 'कृपया अपनी फसल चुनें।' : 'Crop type is required.')
      return
    }
    if (!form.area_value || form.area_value <= 0) {
      setFormError(language === 'hi' ? 'क्षेत्रफल 0 से अधिक होना चाहिए।' : 'Field area must be greater than 0.')
      return
    }

    if (editingField) {
      updateMutation.mutate({ id: editingField.id, data: form })
    } else {
      createMutation.mutate(form)
    }
  }

  const fields = fieldsQuery.data ?? []

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">{fm.title}</h3>
          <p className="text-xs text-slate-500">{fm.subtitle}</p>
        </div>
        <button onClick={openAddModal} className="btn-primary">
          <Plus className="w-4 h-4" /> {fm.addNewField} (अपनी फसल चुनें)
        </button>
      </div>

      {bannerMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            <span className="font-medium">{bannerMsg}</span>
          </div>
          <button onClick={() => setBannerMsg(null)} className="text-emerald-700 hover:underline">
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Field List + Selected Field Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Field Cards List */}
        <div className="lg:col-span-2 space-y-4">
          {fieldsQuery.isLoading ? (
            <div className="surface-card p-8 text-center text-sm text-slate-500">{fm.loadingFields}</div>
          ) : fields.length === 0 ? (
            <div className="surface-card p-10 text-center space-y-3">
              <Sprout className="w-10 h-10 text-slate-400 mx-auto" />
              <h4 className="text-base font-bold text-slate-800">{fm.noFieldsYet}</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">{fm.noFieldsYetDesc}</p>
              <button onClick={openAddModal} className="btn-primary">
                <Plus className="w-4 h-4" /> {fm.createFirstField}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fields.map(field => {
                const isSelected = selectedField?.id === field.id
                return (
                  <div
                    key={field.id}
                    onClick={() => setSelectedField(field)}
                    className={`surface-card p-5 cursor-pointer transition-all ${
                      isSelected ? 'ring-2 ring-[#14532d] border-[#14532d]' : 'hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-slate-900 text-base">{field.name}</h4>
                        <p className="text-xs font-semibold text-[#14532d]">
                          {field.crop_type} · {field.area_value} {field.area_unit}
                        </p>
                      </div>
                      <span
                        className={`badge ${
                          field.status === 'high-risk'
                            ? 'badge-high-risk'
                            : field.status === 'watch'
                            ? 'badge-watch'
                            : 'badge-healthy'
                        }`}
                      >
                        {translateRiskStatus(field.status, language)}
                      </span>
                    </div>

                    <div className="mt-3 space-y-1 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Sprout className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {fm.stageLabel}: <strong>{translateGrowthStage(field.growth_stage, language)}</strong>
                        </span>
                      </div>
                      {field.location && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{field.location}</span>
                        </div>
                      )}
                      {field.planting_date && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {fm.plantedLabel}: {field.planting_date}
                          </span>
                        </div>
                      )}
                    </div>

                    {field.notes && (
                      <p className="mt-2.5 text-xs text-slate-500 line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        {field.notes}
                      </p>
                    )}

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          setSelectedField(field)
                        }}
                        className="text-xs font-semibold text-[#14532d] hover:underline inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> {fm.inspectBtn}
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            openEditModal(field)
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                          title={fm.editBtn}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            setConfirmDeleteId(field.id)
                          }}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                          title="Delete field"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Selected Field Details & History */}
        <div className="surface-card p-5 space-y-4 h-fit">
          {!selectedField ? (
            <div className="py-12 text-center text-xs text-slate-500 space-y-2">
              <Eye className="w-7 h-7 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700">{fm.selectFieldPrompt}</p>
              <p>{fm.selectFieldPromptDesc}</p>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#14532d]">
                    {fm.detailViewBadge}
                  </span>
                  <h4 className="text-lg font-bold text-slate-900">{selectedField.name}</h4>
                  <p className="text-xs text-slate-500">
                    {selectedField.crop_type} · {selectedField.area_value} {selectedField.area_unit}
                  </p>
                </div>
                <button
                  onClick={() => openEditModal(selectedField)}
                  className="btn-secondary text-xs py-1.5 px-2.5"
                >
                  <Edit3 className="w-3.5 h-3.5" /> {fm.editBtn}
                </button>
              </div>

              <SpeakButton
                textEn={`Field ${selectedField.name}, Crop ${selectedField.crop_type}, Area ${selectedField.area_value} ${selectedField.area_unit}, Stage ${selectedField.growth_stage}, Risk level ${selectedField.risk_level}. ${selectedField.notes || ''}`}
                textHi={`खेत का नाम ${selectedField.name}, फसल ${selectedField.crop_type}, क्षेत्रफल ${selectedField.area_value} ${selectedField.area_unit}, अवस्था ${translateGrowthStage(selectedField.growth_stage, 'hi')}, जोखिम स्तर ${translateRiskStatus(selectedField.risk_level, 'hi')}। ${selectedField.notes || ''}`}
                labelEn={fm.listenFieldSummary}
                labelHi={fm.listenFieldSummary}
                size="sm"
              />

              <div className="grid grid-cols-2 gap-2.5 text-xs bg-[#f7f9f6] p-3.5 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-slate-400 block">{fm.growthStage}</span>
                  <strong className="text-slate-800">
                    {translateGrowthStage(selectedField.growth_stage, language)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block">{fm.riskLevel}</span>
                  <strong className="text-slate-800">
                    {translateRiskStatus(selectedField.risk_level, language)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block">{fm.plantingDate}</span>
                  <strong className="text-slate-800">{selectedField.planting_date || fm.notRecorded}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">{fm.location}</span>
                  <strong className="text-slate-800">{selectedField.location || fm.notRecorded}</strong>
                </div>
              </div>

              {selectedField.notes && (
                <div>
                  <span className="label-text">{fm.fieldNotes}</span>
                  <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    {selectedField.notes}
                  </p>
                </div>
              )}

              {/* Quick Actions for this Field */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  onClick={() => navigate(`/simulator?field_id=${selectedField.id}`)}
                  className="btn-primary text-xs py-2 bg-emerald-700 hover:bg-emerald-800 flex items-center justify-center gap-1 shadow-sm"
                >
                  <Compass className="w-3.5 h-3.5" /> {language === 'hi' ? 'डिसीजन लैब' : 'Decision Lab'}
                </button>
                <button
                  onClick={() => navigate(`/detection?field_id=${selectedField.id}`)}
                  className="btn-secondary text-xs py-2 flex items-center justify-center gap-1"
                >
                  <ScanSearch className="w-3.5 h-3.5" /> {fm.analyzeImageBtn}
                </button>
                <button
                  onClick={() => navigate(`/planner?field_id=${selectedField.id}`)}
                  className="btn-secondary text-xs py-2 flex items-center justify-center gap-1"
                >
                  <ClipboardCheck className="w-3.5 h-3.5" /> {fm.rescuePlanBtn}
                </button>
              </div>

              {/* Butterfly Effect Combined Risk Alerts */}
              {butterflyQuery.data && butterflyQuery.data.compounding_alerts.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-950 flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                      {language === 'hi' ? 'बटरफ्लाई कंबाइंड रिस्क इंजन' : 'Butterfly Combined Risk Alert'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md font-bold uppercase text-[9px] ${
                        butterflyQuery.data.overall_status === 'critical'
                          ? 'bg-red-200 text-red-900'
                          : 'bg-amber-200 text-amber-900'
                      }`}
                    >
                      {butterflyQuery.data.overall_status}
                    </span>
                  </div>
                  {butterflyQuery.data.compounding_alerts.slice(0, 2).map((a, i) => (
                    <div key={i} className="bg-white/90 p-2.5 rounded-xl border border-amber-200/60">
                      <p className="font-bold text-stone-900 text-xs">{a.title}</p>
                      <p className="text-[11px] text-stone-600 mt-0.5 leading-snug">{a.explanation}</p>
                      <p className="text-[10px] text-amber-800 font-semibold mt-1">
                        👉 {a.recommended_action}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Stress Trend Monitoring (Days to Threshold) */}
              {trendsQuery.data && trendsQuery.data.trends.length > 0 && (
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-2">
                  <span className="font-bold text-stone-800 block text-[10px] uppercase tracking-wider flex items-center gap-1">
                    <TrendingDown className="w-3.5 h-3.5 text-stone-600" />
                    {language === 'hi' ? 'तनाव सीमा प्रारंभिक चेतावनी' : 'Stress Threshold Early Warning'}
                  </span>
                  <div className="space-y-1.5">
                    {trendsQuery.data.trends.slice(0, 2).map((tr, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px]">
                        <span className="text-stone-600 truncate max-w-[160px]">{tr.metric}:</span>
                        <span className="font-bold text-stone-900">
                          {tr.current_value} {tr.unit}
                          {tr.projected_days_to_threshold !== null && (
                            <span className="text-amber-700 ml-1 font-semibold">
                              (~{tr.projected_days_to_threshold}d buffer)
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Field Zones Grid View (Microclimates) */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-[#14532d]" />
                    {language === 'hi' ? 'खेत उप-क्षेत्र (माइक्रोक्लाइमेट जोन)' : 'Sub-Field Microclimate Zones'}
                  </h5>
                  <span className="text-[10px] text-stone-500 font-semibold">
                    {zonesQuery.data?.length ?? 0} Zones
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {(zonesQuery.data ?? []).map(z => (
                    <div
                      key={z.id}
                      className="p-2.5 rounded-xl border border-stone-200 bg-white hover:border-[#14532d] transition-all text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-stone-900">{z.zone_name}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            z.risk_level === 'high'
                              ? 'bg-red-100 text-red-800'
                              : z.risk_level === 'watch'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {z.risk_level}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-stone-600">
                        <span className="flex items-center gap-1">
                          <Droplets className="w-3 h-3 text-sky-600" />
                          {z.soil_moisture_pct ? `${z.soil_moisture_pct}% moisture` : 'N/A'}
                        </span>
                        <span>pH {z.soil_ph ?? '6.8'}</span>
                        <span>Drainage: {z.drainage_quality}</span>
                      </div>
                      {z.microclimate_note && (
                        <p className="text-[10px] text-stone-500 mt-1 italic">
                          {z.microclimate_note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Field Assessment History */}
              <div className="pt-3 border-t border-slate-100">
                <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5">
                  {fm.assessmentHistory} ({fieldHistoryQuery.data?.length ?? 0})
                </h5>
                {fieldHistoryQuery.isLoading ? (
                  <p className="text-xs text-slate-400">Loading…</p>
                ) : (fieldHistoryQuery.data ?? []).length === 0 ? (
                  <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {fm.noAssessmentsForField}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {(fieldHistoryQuery.data ?? []).map(a => (
                      <div key={a.id} className="p-2.5 rounded-xl border border-slate-200 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">
                            {a.predicted_condition || `Status: ${a.analysis_status}`}
                          </span>
                          <span
                            className={`badge ${
                              a.risk_category === 'high-risk'
                                ? 'badge-high-risk'
                                : a.risk_category === 'watch'
                                ? 'badge-watch'
                                : 'badge-healthy'
                            }`}
                          >
                            {translateRiskStatus(a.risk_category, language)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {new Date(a.created_at).toLocaleString()}
                        </p>
                        {a.recommended_next_steps?.[0] && (
                          <p className="text-[11px] text-slate-700 mt-1 line-clamp-2">
                            • {a.recommended_next_steps[0]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add / Edit Field Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {editingField ? `${fm.modalEditTitle} ${editingField.name}` : fm.modalAddTitle}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-text">{fm.fieldNameLabel}</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. North Canal Block A"
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="label-text">{fm.cropTypeLabel}</label>
                  <select
                    value={form.crop_type}
                    onChange={e => setForm({ ...form, crop_type: e.target.value })}
                    className="input-field"
                  >
                    {SUGGESTED_CROPS.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <label className="label-text">{fm.areaLabel}</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={form.area_value}
                    onChange={e => setForm({ ...form, area_value: parseFloat(e.target.value) || 0 })}
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="label-text">{fm.areaUnitLabel}</label>
                  <select
                    value={form.area_unit}
                    onChange={e => setForm({ ...form, area_unit: e.target.value })}
                    className="input-field"
                  >
                    <option value="hectares">Hectares (ha)</option>
                    <option value="acres">Acres (ac)</option>
                  </select>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="label-text">{fm.growthStage}</label>
                  <select
                    value={form.growth_stage}
                    onChange={e => setForm({ ...form, growth_stage: e.target.value })}
                    className="input-field"
                  >
                    {GROWTH_STAGES.map(st => (
                      <option key={st} value={st}>
                        {translateGrowthStage(st, language)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-text">{fm.locationVillageLabel}</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={e => setForm({ ...form, location: e.target.value })}
                    placeholder="e.g. Plot 14, East Canal"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="label-text">{fm.plantingDate}</label>
                  <input
                    type="date"
                    value={form.planting_date ?? ''}
                    onChange={e => setForm({ ...form, planting_date: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="label-text">{fm.notesLabel}</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Soil type, irrigation source, prior crop history, or observed symptoms…"
                  className="input-field"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
                  {fm.cancelBtn}
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="btn-primary"
                >
                  {editingField ? fm.saveChangesBtn : fm.createFieldBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
            <h4 className="font-bold text-slate-900 text-base">{fm.confirmDeleteTitle}</h4>
            <p className="text-xs text-slate-600">{fm.confirmDeleteDesc}</p>
            <div className="flex items-center justify-end gap-2.5">
              <button onClick={() => setConfirmDeleteId(null)} className="btn-secondary">
                {fm.cancelBtn}
              </button>
              <button
                onClick={() => deleteMutation.mutate(confirmDeleteId)}
                disabled={deleteMutation.isPending}
                className="btn-danger"
              >
                {fm.deletePermanentlyBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
