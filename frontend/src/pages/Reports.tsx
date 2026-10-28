import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FileBarChart2,
  Download,
  Printer,
  Trash2,
  Eye,
  GitCompare,
  BookOpenCheck,
  Search,
  X,
  History,
  Clock,
  Compass,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { reportsApi, historyApi, fieldsApi } from '@/services/cropsentinel'
import { useWeatherStore } from '@/store/weatherStore'
import { useI18n, translateRiskStatus, translateGrowthStage } from '@/i18n/translations'
import SpeakButton from '@/components/common/SpeakButton'
import type { AssessmentRecord } from '@/types'

export default function Reports() {
  const queryClient = useQueryClient()
  const { currencySymbol } = useWeatherStore()
  const { language, t } = useI18n()
  const rp = t.reports

  const [activeTab, setActiveTab] = useState<
    'memory' | 'evidence' | 'decisions' | 'autopsy' | 'compare'
  >('memory')
  const [filterFieldId, setFilterFieldId] = useState<number | ''>('')
  const [filterCrop, setFilterCrop] = useState('')
  const [filterRisk, setFilterRisk] = useState('')
  const [searchText, setSearchText] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [detailItem, setDetailItem] = useState<AssessmentRecord | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [compareIds, setCompareIds] = useState<number[]>([])

  // Outcome update modal/inputs
  const [editingDecisionId, setEditingDecisionId] = useState<number | null>(null)
  const [outcomeText, setOutcomeText] = useState('')
  const [outcomeRating, setOutcomeRating] = useState('improved')

  const fieldsQuery = useQuery({ queryKey: ['fields'], queryFn: fieldsApi.list })
  const summaryQuery = useQuery({
    queryKey: ['reports-summary', filterFieldId],
    queryFn: () => reportsApi.getSummary(filterFieldId === '' ? undefined : Number(filterFieldId)),
  })
  const historyQuery = useQuery({
    queryKey: ['history', filterFieldId, filterCrop, filterRisk],
    queryFn: () =>
      historyApi.list({
        field_id: filterFieldId === '' ? undefined : Number(filterFieldId),
        crop_type: filterCrop || undefined,
        risk_category: filterRisk || undefined,
      }),
  })
  const evidenceQuery = useQuery({
    queryKey: ['evidence-ledger', filterFieldId],
    queryFn: () => historyApi.listEvidence(filterFieldId === '' ? undefined : Number(filterFieldId)),
  })

  const effectiveFieldId = filterFieldId !== '' ? Number(filterFieldId) : fieldsQuery.data?.[0]?.id ?? 1

  const autopsyQuery = useQuery({
    queryKey: ['autopsy-timeline', effectiveFieldId],
    queryFn: () => historyApi.getAutopsyTimeline(effectiveFieldId),
    enabled: !!effectiveFieldId,
  })

  const decisionsQuery = useQuery({
    queryKey: ['farmer-decisions', filterFieldId],
    queryFn: () => historyApi.listDecisions(filterFieldId === '' ? undefined : Number(filterFieldId)),
  })

  const updateOutcomeMutation = useMutation({
    mutationFn: ({
      id,
      observed_outcome,
      outcome_rating,
    }: {
      id: number
      observed_outcome: string
      outcome_rating: string
    }) => historyApi.updateDecisionOutcome(id, { observed_outcome, outcome_rating }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farmer-decisions'] })
      setEditingDecisionId(null)
      setOutcomeText('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: historyApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['history'] })
      queryClient.invalidateQueries({ queryKey: ['reports-summary'] })
      setConfirmDeleteId(null)
    },
  })

  const filteredHistory = useMemo(() => {
    const raw = historyQuery.data ?? []
    return raw.filter(item => {
      if (searchText.trim()) {
        const q = searchText.toLowerCase()
        const match =
          (item.predicted_condition || '').toLowerCase().includes(q) ||
          item.crop_type.toLowerCase().includes(q) ||
          (item.field_name || '').toLowerCase().includes(q) ||
          (item.user_notes || '').toLowerCase().includes(q)
        if (!match) return false
      }
      if (dateFrom) {
        const itemDate = item.created_at.slice(0, 10)
        if (itemDate < dateFrom) return false
      }
      if (dateTo) {
        const itemDate = item.created_at.slice(0, 10)
        if (itemDate > dateTo) return false
      }
      return true
    })
  }, [historyQuery.data, searchText, dateFrom, dateTo])

  const handleExportCsv = () => {
    const headers = [
      'ID',
      'Date',
      'Field',
      'Crop',
      'GrowthStage',
      'Status',
      'PredictedCondition',
      'Confidence',
      'RiskCategory',
      'RiskScore',
      'CompletenessPct',
      'UserNotes',
    ]
    const rows = filteredHistory.map(a => [
      a.id,
      a.created_at,
      `"${(a.field_name || 'Unlinked').replace(/"/g, '""')}"`,
      `"${a.crop_type}"`,
      `"${a.growth_stage}"`,
      a.analysis_status,
      `"${(a.predicted_condition || 'N/A').replace(/"/g, '""')}"`,
      a.model_confidence ?? '',
      a.risk_category,
      a.risk_score ?? '',
      a.data_completeness_pct,
      `"${(a.user_notes || '').replace(/"/g, '""')}"`,
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `cropsentinel-assessments-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const toggleCompare = (id: number) => {
    setCompareIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev.slice(-1), id]))
  }

  const comparedItems = (historyQuery.data ?? []).filter(a => compareIds.includes(a.id))
  const summary = summaryQuery.data

  const reportSpeechEn = `Reports Summary: ${summary?.summary_cards.total_assessments ?? 0} stored assessments, ${
    summary?.evidence_count ?? 0
  } evidence ledger entries, and ${summary?.task_summary.completed ?? 0} of ${
    summary?.task_summary.total ?? 0
  } rescue tasks completed.`

  const reportSpeechHi = `रिपोर्ट सारांश: कुल ${summary?.summary_cards.total_assessments ?? 0} फसल जांच दर्ज हैं, प्रमाण खाते में ${
    summary?.evidence_count ?? 0
  } रिकॉर्ड हैं, और ${summary?.task_summary.total ?? 0} में से ${
    summary?.task_summary.completed ?? 0
  } बचाव कार्य पूरे किए गए हैं।`

  return (
    <div className="space-y-6">
      {/* Header & Export Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        <div>
          <h3 className="text-base font-bold text-slate-900">{rp.title}</h3>
          <p className="text-xs text-slate-500">{rp.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SpeakButton
            textEn={reportSpeechEn}
            textHi={reportSpeechHi}
            labelEn={rp.listenReportBtn}
            labelHi={rp.listenReportBtn}
          />
          <button onClick={() => window.print()} className="btn-secondary text-xs">
            <Printer className="w-3.5 h-3.5" /> {rp.printBtn}
          </button>
          <button onClick={handleExportCsv} className="btn-primary text-xs">
            <Download className="w-3.5 h-3.5" /> {rp.exportCsvBtn} ({filteredHistory.length})
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="metric-card">
          <span className="text-xs font-semibold text-slate-500 uppercase">{rp.storedAssessments}</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {summary?.summary_cards.total_assessments ?? 0}
          </div>
        </div>
        <div className="metric-card">
          <span className="text-xs font-semibold text-slate-500 uppercase">{rp.evidenceEntries}</span>
          <div className="text-2xl font-bold text-[#14532d] mt-1">{summary?.evidence_count ?? 0}</div>
        </div>
        <div className="metric-card">
          <span className="text-xs font-semibold text-slate-500 uppercase">{rp.rescueTasksCompleted}</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {summary?.task_summary.completed ?? 0} / {summary?.task_summary.total ?? 0}
          </div>
        </div>
        <div className="metric-card">
          <span className="text-xs font-semibold text-slate-500 uppercase">{rp.budgetActualPlanned}</span>
          <div className="text-lg font-bold text-slate-900 mt-1">
            {currencySymbol}
            {(summary?.budget_summary.total_actual ?? 0).toLocaleString()} / {currencySymbol}
            {(summary?.budget_summary.total_planned ?? 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Health Trend Chart */}
      <div className="chart-container">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="section-title">{t.dashboard.healthTrendTitle}</h4>
            <p className="text-xs text-slate-500">{t.dashboard.healthTrendSub}</p>
          </div>
          {summary?.health_trend?.[0]?.is_demo && (
            <span className="badge badge-demo">{t.dashboard.demoBadge}</span>
          )}
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={summary?.health_trend ?? []} margin={{ left: -15, right: 10, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 12 }} />
              <Area type="monotone" dataKey="health_index" stroke="#14532d" fill="#dcfce7" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 no-print flex-wrap">
        <button
          onClick={() => setActiveTab('memory')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'memory'
              ? 'bg-[#14532d] text-white'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <FileBarChart2 className="w-3.5 h-3.5 inline mr-1.5" />
          {rp.cropMemoryTab} ({filteredHistory.length})
        </button>
        <button
          onClick={() => setActiveTab('evidence')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'evidence'
              ? 'bg-[#14532d] text-white'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <BookOpenCheck className="w-3.5 h-3.5 inline mr-1.5" />
          {rp.evidenceLedgerTab} ({evidenceQuery.data?.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab('decisions')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'decisions'
              ? 'bg-[#14532d] text-white'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <History className="w-3.5 h-3.5 inline mr-1.5" />
          {language === 'hi' ? 'निर्णय स्मृति' : 'Decision Memory'} ({decisionsQuery.data?.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab('autopsy')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'autopsy'
              ? 'bg-[#14532d] text-white'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Clock className="w-3.5 h-3.5 inline mr-1.5" />
          {language === 'hi' ? 'खेत घटना क्रम' : 'Farm Autopsy'} ({autopsyQuery.data?.total_events ?? 0})
        </button>
        <button
          onClick={() => setActiveTab('compare')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'compare'
              ? 'bg-[#14532d] text-white'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <GitCompare className="w-3.5 h-3.5 inline mr-1.5" />
          {rp.compareTab} ({compareIds.length}/2)
        </button>
      </div>

      {/* Filters Bar */}
      <div className="surface-card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 no-print">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Search…"
            className="input-field pl-8 py-2 text-xs"
          />
        </div>

        <select
          value={filterFieldId}
          onChange={e => setFilterFieldId(e.target.value === '' ? '' : Number(e.target.value))}
          className="input-field py-2 text-xs"
        >
          <option value="">All Fields</option>
          {(fieldsQuery.data ?? []).map(f => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={filterCrop}
          onChange={e => setFilterCrop(e.target.value)}
          placeholder="Crop (e.g. Wheat)…"
          className="input-field py-2 text-xs"
        />

        <select
          value={filterRisk}
          onChange={e => setFilterRisk(e.target.value)}
          className="input-field py-2 text-xs"
        >
          <option value="">All Risk Levels</option>
          <option value="healthy">Healthy</option>
          <option value="watch">Watch</option>
          <option value="high-risk">High-Risk</option>
        </select>

        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="input-field py-2 text-xs"
          />
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="input-field py-2 text-xs"
          />
        </div>
      </div>

      {/* TAB 1: Crop Memory Table */}
      {activeTab === 'memory' && (
        <div className="surface-card p-5 overflow-x-auto">
          {filteredHistory.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              {language === 'hi'
                ? 'कोई फसल जांच रिकॉर्ड नहीं मिला।'
                : 'No assessment records match your current filters.'}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500 uppercase">
                  <th className="pb-2.5">Compare</th>
                  <th className="pb-2.5">Date</th>
                  <th className="pb-2.5">Field</th>
                  <th className="pb-2.5">Crop / Stage</th>
                  <th className="pb-2.5">AI / Observation</th>
                  <th className="pb-2.5">Risk Score</th>
                  <th className="pb-2.5">Completeness</th>
                  <th className="pb-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHistory.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="py-3">
                      <input
                        type="checkbox"
                        checked={compareIds.includes(item.id)}
                        onChange={() => toggleCompare(item.id)}
                      />
                    </td>
                    <td className="py-3 text-slate-600 whitespace-nowrap">
                      {new Date(item.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 font-semibold text-slate-900">
                      {item.field_name || 'Unlinked'}
                    </td>
                    <td className="py-3 text-slate-700">
                      {item.crop_type} ·{' '}
                      <span className="text-slate-500">
                        {translateGrowthStage(item.growth_stage, language)}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="font-semibold text-slate-900">
                        {item.predicted_condition || `AI ${item.analysis_status}`}
                      </span>
                    </td>
                    <td className="py-3">
                      <span
                        className={`badge ${
                          item.risk_category === 'high-risk'
                            ? 'badge-high-risk'
                            : item.risk_category === 'watch'
                            ? 'badge-watch'
                            : 'badge-healthy'
                        }`}
                      >
                        {item.risk_score ?? '—'} ({translateRiskStatus(item.risk_category, language)})
                      </span>
                    </td>
                    <td className="py-3 text-slate-600">{item.data_completeness_pct}%</td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => setDetailItem(item)}
                          className="p-1.5 rounded-lg text-[#14532d] hover:bg-emerald-50"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(item.id)}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB 2: Evidence Ledger */}
      {activeTab === 'evidence' && (
        <div className="surface-card p-5 space-y-4">
          {(evidenceQuery.data ?? []).length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              {language === 'hi'
                ? 'प्रमाण खाते में अभी कोई रिकॉर्ड नहीं है।'
                : 'No evidence ledger records yet.'}
            </div>
          ) : (
            <div className="space-y-3">
              {(evidenceQuery.data ?? []).map(ev => (
                <div key={ev.id} className="p-4 rounded-xl border border-slate-200 bg-[#f7f9f6] space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 text-sm">{ev.recommendation_text}</span>
                    <div className="flex items-center gap-2">
                      <span className="badge badge-info">{ev.evidence_source}</span>
                      {ev.confidence_label && (
                        <span className="badge badge-healthy">{ev.confidence_label}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-slate-700">
                    <strong>Supporting Evidence:</strong> {ev.supporting_evidence}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t border-slate-200/80 text-[11px] text-slate-600">
                    <div>
                      <strong>Data Gaps:</strong> {ev.data_gaps || 'None'}
                    </div>
                    <div>
                      <strong>Verification Steps:</strong> {ev.verification_steps}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2B: Farmer Decision Memory & Outcome Tracking */}
      {activeTab === 'decisions' && (
        <div className="surface-card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-3">
            <div>
              <h4 className="font-bold text-sm text-stone-900">
                {language === 'hi' ? 'किसान निर्णय स्मृति एवं परिणाम ट्रैकिंग' : 'Farmer Decision Memory & Outcome Tracking'}
              </h4>
              <p className="text-xs text-stone-500 mt-0.5">
                {language === 'hi'
                  ? 'लिए गए निर्णयों, संसाधन उपयोग, और बाद में देखे गए परिणामों की सीधी तुलना।'
                  : 'Track decisions committed from Decision Lab & verify predicted vs actual observed outcomes.'}
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              {decisionsQuery.data?.length ?? 0} {language === 'hi' ? 'निर्णय दर्ज' : 'Decisions Logged'}
            </span>
          </div>

          {(decisionsQuery.data ?? []).length === 0 ? (
            <div className="py-12 text-center text-xs text-stone-500 space-y-2">
              <History className="w-8 h-8 text-stone-300 mx-auto" />
              <p className="font-semibold text-stone-700">
                {language === 'hi' ? 'कोई निर्णय अभी तक दर्ज नहीं है।' : 'No decision logs recorded yet.'}
              </p>
              <p>
                {language === 'hi'
                  ? 'डिसीजन लैब में जाकर किसी परिदृश्य पर "Commit Action" बटन दबाएं।'
                  : 'Open Decision Lab and tap "Commit Action" on any scenario to record your first decision.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(decisionsQuery.data ?? []).map(d => (
                <div
                  key={d.id}
                  className="p-4 rounded-2xl border border-stone-200 bg-white hover:border-emerald-500/60 transition-all text-xs space-y-3 shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-stone-100 text-stone-700 mr-2">
                        {d.action_category}
                      </span>
                      <strong className="text-sm text-stone-900">{d.decision_title}</strong>
                      <span className="text-[11px] text-stone-500 block mt-0.5">
                        {d.crop_name} ({d.growth_stage}) · Logged on {new Date(d.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          d.outcome_rating === 'improved'
                            ? 'bg-emerald-100 text-emerald-900'
                            : d.outcome_rating === 'deteriorated'
                            ? 'bg-red-100 text-red-900'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {d.outcome_rating}
                      </span>
                      {editingDecisionId !== d.id && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDecisionId(d.id)
                            setOutcomeText(d.observed_outcome || '')
                            setOutcomeRating(d.outcome_rating === 'pending' ? 'improved' : d.outcome_rating)
                          }}
                          className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-semibold"
                        >
                          {d.observed_outcome ? 'Update' : '+ Log Outcome'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Resource consumption strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 bg-stone-50 rounded-xl text-[11px] text-stone-600">
                    <div>
                      <span>Budget Spent: </span>
                      <strong className="text-stone-900">
                        {currencySymbol} {d.budget_spent.toLocaleString()}
                      </strong>
                    </div>
                    <div>
                      <span>Water Used: </span>
                      <strong className="text-stone-900">{d.water_used_liters.toLocaleString()} L</strong>
                    </div>
                    <div>
                      <span>Initial Risk: </span>
                      <strong className="text-amber-800">{d.initial_risk_score ?? '—'}/100</strong>
                    </div>
                    <div>
                      <span>Subsequent Risk: </span>
                      <strong className="text-emerald-800">{d.subsequent_risk_score ?? '—'}/100</strong>
                    </div>
                  </div>

                  {/* Predicted vs Observed Box */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div className="p-2.5 rounded-xl bg-blue-50/50 border border-blue-200/60 text-[11px]">
                      <strong className="text-blue-900 block mb-0.5">
                        {language === 'hi' ? 'अनुमानित परिणाम (Predicted):' : 'Predicted Outcome:'}
                      </strong>
                      <p className="text-blue-950">{d.predicted_outcome || 'Decision Lab projection'}</p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-200/60 text-[11px]">
                      <strong className="text-emerald-900 block mb-0.5">
                        {language === 'hi' ? 'वास्तविक देखा गया परिणाम (Observed):' : 'Observed Field Outcome:'}
                      </strong>
                      <p className="text-emerald-950">
                        {d.observed_outcome || (
                          <span className="italic text-stone-400">
                            {language === 'hi'
                              ? 'परिणाम अभी दर्ज नहीं किया गया है।'
                              : 'No field outcome recorded yet. Click "Log Outcome" after inspecting.'}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Inline Outcome Editor */}
                  {editingDecisionId === d.id && (
                    <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2 mt-2">
                      <strong className="text-xs text-stone-800 block">
                        {language === 'hi' ? 'खेत में देखा गया परिणाम दर्ज करें:' : 'Record Observed Field Outcome:'}
                      </strong>
                      <textarea
                        rows={2}
                        value={outcomeText}
                        onChange={e => setOutcomeText(e.target.value)}
                        placeholder="e.g. Foliage turgor recovered within 36 hours. Flower abortion halted successfully."
                        className="w-full text-xs rounded-xl border border-stone-300 p-2 bg-white"
                      />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs">
                          <label className="font-semibold text-stone-700">Rating:</label>
                          <select
                            value={outcomeRating}
                            onChange={e => setOutcomeRating(e.target.value)}
                            className="text-xs rounded-lg border border-stone-300 p-1 bg-white"
                          >
                            <option value="improved">Improved (सुधार हुआ)</option>
                            <option value="unchanged">Unchanged (कोई बदलाव नहीं)</option>
                            <option value="deteriorated">Deteriorated (गिरावट आई)</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingDecisionId(null)}
                            className="px-2.5 py-1 text-xs text-stone-600 hover:text-stone-900"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateOutcomeMutation.mutate({
                                id: d.id,
                                observed_outcome: outcomeText,
                                outcome_rating: outcomeRating,
                              })
                            }
                            disabled={updateOutcomeMutation.isPending || !outcomeText.trim()}
                            className="px-3 py-1 rounded-lg bg-emerald-700 text-white text-xs font-bold shadow-sm"
                          >
                            Save Outcome
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2C: Farm Autopsy & Cause Timeline */}
      {activeTab === 'autopsy' && (
        <div className="surface-card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-3">
            <div>
              <h4 className="font-bold text-sm text-stone-900">
                {language === 'hi' ? 'खेत घटना क्रम व कारण रेखांकन (Farm Autopsy)' : 'Farm Autopsy & Root-Cause Event Timeline'}
              </h4>
              <p className="text-xs text-stone-500 mt-0.5">
                {autopsyQuery.data?.autopsy_summary ||
                  'Chronological event sequence reconstructing stress onset, weather signals, and interventions.'}
              </p>
            </div>
            <span className="text-xs font-bold text-stone-700 bg-stone-100 px-2.5 py-1 rounded-lg">
              Field #{effectiveFieldId} · {autopsyQuery.data?.total_events ?? 0} Events
            </span>
          </div>

          {(autopsyQuery.data?.timeline ?? []).length === 0 ? (
            <div className="py-12 text-center text-xs text-stone-500">
              No timeline events recorded for this field.
            </div>
          ) : (
            <div className="relative pl-6 border-l-2 border-emerald-500/40 space-y-6 my-4">
              {autopsyQuery.data?.timeline.map((evt, idx) => (
                <div key={idx} className="relative group">
                  {/* Timeline Dot */}
                  <div
                    className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                      evt.severity === 'high'
                        ? 'bg-red-500 ring-2 ring-red-200'
                        : evt.severity === 'watch'
                        ? 'bg-amber-500 ring-2 ring-amber-200'
                        : 'bg-emerald-600 ring-2 ring-emerald-200'
                    }`}
                  />
                  <div className="p-3.5 rounded-2xl border border-stone-200 bg-white shadow-sm space-y-1.5 text-xs">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <strong className="text-stone-900 font-bold">{evt.title}</strong>
                      <span className="text-[10px] text-stone-500 font-medium">
                        {new Date(evt.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-stone-700 text-[11px] leading-relaxed">{evt.details}</p>
                    <div className="pt-1.5 border-t border-stone-100 flex items-center justify-between text-[10px] text-stone-500">
                      <span>Source: {evt.provenance}</span>
                      <span className="uppercase font-bold tracking-wider">{evt.event_type}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Assessment Comparison */}
      {activeTab === 'compare' && (
        <div className="surface-card p-5 space-y-4">
          {comparedItems.length < 2 ? (
            <p className="text-xs text-slate-500 py-8 text-center">
              {language === 'hi'
                ? 'तुलना करने के लिए फसल जांच इतिहास से किन्हीं 2 जांचों पर टिक लगाएं।'
                : 'Select any 2 assessments using the checkboxes in the Crop Memory tab to compare them side-by-side.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {comparedItems.map(item => (
                <div key={item.id} className="p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <strong className="text-sm text-slate-900">
                      Assessment #{item.id} ({item.crop_type})
                    </strong>
                    <span className="text-slate-500">{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                  <p><strong>Field:</strong> {item.field_name || 'Unlinked'}</p>
                  <p><strong>Stage:</strong> {translateGrowthStage(item.growth_stage, language)}</p>
                  <p><strong>AI Output:</strong> {item.predicted_condition || item.analysis_status}</p>
                  <p><strong>Risk Score:</strong> {item.risk_score ?? '—'} / 100</p>
                  <p><strong>Completeness:</strong> {item.data_completeness_pct}%</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Assessment Detail Modal */}
      {detailItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-xl max-h-[85vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-bold text-slate-900 text-base">
                Assessment #{detailItem.id} — {detailItem.crop_type}
              </h4>
              <button onClick={() => setDetailItem(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl">
              <div><strong>Field:</strong> {detailItem.field_name || 'Unlinked'}</div>
              <div><strong>Stage:</strong> {translateGrowthStage(detailItem.growth_stage, language)}</div>
              <div><strong>Analysis Status:</strong> {detailItem.analysis_status}</div>
              <div><strong>Predicted Condition:</strong> {detailItem.predicted_condition || 'N/A'}</div>
              <div><strong>Risk Score:</strong> {detailItem.risk_score ?? '—'}</div>
              <div><strong>Image File:</strong> {detailItem.image_filename || 'None'}</div>
            </div>
            <div className="text-xs space-y-1">
              <strong>Recommended Next Steps:</strong>
              <ul className="list-disc list-inside text-slate-700 space-y-0.5">
                {detailItem.recommended_next_steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
            <p className="text-[11px] text-slate-500 border-t border-slate-100 pt-2">{detailItem.disclaimer}</p>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {confirmDeleteId !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
            <h4 className="font-bold text-slate-900 text-base">Delete Assessment Record?</h4>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteId(null)} className="btn-secondary">
                {t.fields.cancelBtn}
              </button>
              <button
                onClick={() => deleteMutation.mutate(confirmDeleteId)}
                disabled={deleteMutation.isPending}
                className="btn-danger"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
