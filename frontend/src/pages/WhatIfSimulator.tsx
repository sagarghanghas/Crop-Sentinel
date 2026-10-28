import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Sliders,
  Play,
  Trash2,
  AlertTriangle,
  Calculator,
  Compass,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Droplets,
  Coins,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { simulatorApi, fieldsApi, historyApi } from '@/services/cropsentinel'
import { useWeatherStore } from '@/store/weatherStore'
import { useI18n } from '@/i18n/translations'
import SpeakButton from '@/components/common/SpeakButton'
import type {
  SimulatorRunPayload,
  SimulatorRunResult,
  DecisionLabPayload,
  DecisionLabResult,
} from '@/types'

export default function WhatIfSimulator() {
  const queryClient = useQueryClient()
  const { currencySymbol } = useWeatherStore()
  const { language, t } = useI18n()
  const isHi = language === 'hi'
  const sm = t.simulator

  const [activeTab, setActiveTab] = useState<'decision_lab' | 'sensitivity'>('decision_lab')

  // ─── Decision Lab State ───────────────────────────────────────────────────
  const [labInputs, setLabInputs] = useState<DecisionLabPayload>({
    field_id: null,
    zone_id: null,
    crop_name: 'Wheat',
    crop_variety: 'HD-2967',
    growth_stage: 'Flowering',
    total_area_acres: 2.0,
    expected_yield_per_acre: 20.0,
    yield_unit: 'quintals',
    sale_price_per_unit: 2275,
    baseline_input_cost: 45000,
    current_soil_moisture_pct: 26.0,
    current_temp_c: 32.0,
    forecast_rainfall_3d_mm: 8.0,
    available_water_liters: 8000,
    available_budget: 12000,
    hypothetical_temp_delta_c: 4.0,
    hypothetical_rain_multiplier: 0.5,
  })

  const [decisionFeedback, setDecisionFeedback] = useState<string | null>(null)

  // ─── Legacy Sensitivity Simulator State ───────────────────────────────────
  const [legacyInputs, setLegacyInputs] = useState<SimulatorRunPayload>({
    name: 'Baseline Harvest Scenario',
    field_id: null,
    crop_type: 'Wheat',
    expected_rainfall_mm: 120,
    temp_assumption_c: 26,
    irrigation_available: true,
    estimated_loss_pct: 10,
    input_cost: 45000,
    expected_yield_units: 40,
    yield_unit: 'quintals',
    sale_price_per_unit: 2275,
    save_scenario: true,
  })
  const [legacyResult, setLegacyResult] = useState<SimulatorRunResult | null>(null)

  // ─── Queries ──────────────────────────────────────────────────────────────
  const fieldsQuery = useQuery({ queryKey: ['fields'], queryFn: fieldsApi.list })
  const scenariosQuery = useQuery({
    queryKey: ['simulator-scenarios'],
    queryFn: simulatorApi.listScenarios,
  })

  // Sync field selection into labInputs
  useEffect(() => {
    if (fieldsQuery.data && fieldsQuery.data.length > 0 && !labInputs.field_id) {
      const f = fieldsQuery.data[0]
      setLabInputs(prev => ({
        ...prev,
        field_id: f.id,
        crop_name: f.crop_type,
        growth_stage: f.growth_stage,
        total_area_acres: f.area_value,
      }))
    }
  }, [fieldsQuery.data, labInputs.field_id])

  // Decision Lab Mutation
  const decisionLabMutation = useMutation({
    mutationFn: simulatorApi.runDecisionLab,
  })

  // Run initial Decision Lab simulation on mount
  useEffect(() => {
    decisionLabMutation.mutate(labInputs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Commit Decision to Memory
  const commitDecisionMutation = useMutation({
    mutationFn: historyApi.recordDecision,
    onSuccess: () => {
      setDecisionFeedback(
        isHi
          ? 'निर्णय सफलतापूर्वक मेमोरी में सहेजा गया! आगामी परिणाम रिपोर्ट्स में ट्रैक किए जाएंगे।'
          : 'Decision committed to Farmer Memory! Track subsequent observations in Reports & History.'
      )
      queryClient.invalidateQueries({ queryKey: ['farmer-decisions'] })
      setTimeout(() => setDecisionFeedback(null), 6000)
    },
  })

  // Legacy Simulator Mutation
  const legacyRunMutation = useMutation({
    mutationFn: simulatorApi.run,
    onSuccess: data => {
      setLegacyResult(data)
      queryClient.invalidateQueries({ queryKey: ['simulator-scenarios'] })
      queryClient.invalidateQueries({ queryKey: ['reports-summary'] })
    },
  })

  const legacyDeleteMutation = useMutation({
    mutationFn: simulatorApi.deleteScenario,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['simulator-scenarios'] })
    },
  })

  const labData = decisionLabMutation.data

  // Comparative chart data
  const comparisonChartData = labData
    ? [
        {
          name: isHi ? 'परिदृश्य A (यथास्थिति)' : 'Scenario A (Current)',
          loss_pct: labData.scenario_a_current.estimated_yield_loss_pct,
          risk_score: labData.scenario_a_current.projected_risk_score,
          profit: labData.scenario_a_current.estimated_profit,
          water_l: labData.scenario_a_current.water_required_liters,
        },
        {
          name: isHi ? 'परिदृश्य B (अनुशंसित)' : 'Scenario B (Recommended)',
          loss_pct: labData.scenario_b_recommended.estimated_yield_loss_pct,
          risk_score: labData.scenario_b_recommended.projected_risk_score,
          profit: labData.scenario_b_recommended.estimated_profit,
          water_l: labData.scenario_b_recommended.water_required_liters,
        },
        {
          name: isHi ? 'परिदृश्य C (जलवायु झटका)' : 'Scenario C (Adverse Shock)',
          loss_pct: labData.scenario_c_adverse.estimated_yield_loss_pct,
          risk_score: labData.scenario_c_adverse.projected_risk_score,
          profit: labData.scenario_c_adverse.estimated_profit,
          water_l: labData.scenario_c_adverse.water_required_liters,
        },
      ]
    : []

  const labSpeechEn = labData
    ? `Decision Lab evaluation for ${labData.crop_name}. Scenario B recommended intervention increases net profit to ${Math.round(labData.scenario_b_recommended.estimated_profit)} compared to ${Math.round(labData.scenario_a_current.estimated_profit)} under status quo. Yield loss is reduced from ${labData.scenario_a_current.estimated_yield_loss_pct} percent to ${labData.scenario_b_recommended.estimated_yield_loss_pct} percent.`
    : 'Decision Lab simulating three parallel agronomic futures under resource constraints.'

  const labSpeechHi = labData
    ? `डिसीजन लैब विश्लेषण: ${labData.crop_name} के लिए परिदृश्य B अनुशंसित उपाय करने पर शुद्ध लाभ बढ़कर ${Math.round(labData.scenario_b_recommended.estimated_profit)} रुपये होगा जबकि यथास्थिति में यह ${Math.round(labData.scenario_a_current.estimated_profit)} रुपये रहेगा। फसल नुकसान ${labData.scenario_a_current.estimated_yield_loss_pct}% से घटकर ${labData.scenario_b_recommended.estimated_yield_loss_pct}% रह जाएगा।`
    : 'डिसीजन लैब समानांतर कृषि परिदृश्यों का वास्तविक संसाधनों के तहत सिमुलेशन।'

  return (
    <div className="space-y-6">
      {/* Top Header & Mode Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
              {isHi ? 'केंद्रीय सिमुलेशन केंद्र' : 'Central Simulation Hub'}
            </span>
            <span className="text-xs text-stone-600 font-medium">
              {isHi ? 'समानांतर कृषि निर्णय' : 'Parallel Universe Farming'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-stone-900 mt-1">
            {isHi ? 'क्रॉपसेंटिनल डिसीजन लैब' : 'CropSentinel Decision Lab'}
          </h1>
          <p className="text-xs text-stone-700 mt-0.5">
            {isHi
              ? 'यदि किसान आज अलग निर्णय लेता है, तो परिणाम कैसे बदल सकता है?'
              : 'How might the outcome change if the farmer makes a different decision today?'}
          </p>
        </div>

        {/* Tab Switcher & Voice */}
        <div className="flex items-center gap-3">
          <div className="bg-stone-200/80 p-1 rounded-xl flex items-center gap-1 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('decision_lab')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'decision_lab'
                  ? 'bg-white text-emerald-900 shadow-sm font-bold'
                  : 'text-stone-700 hover:text-stone-900'
              }`}
            >
              <Compass className="w-3.5 h-3.5 inline mr-1 text-emerald-700" />
              {isHi ? '3-परिदृश्य तुलना' : '3-Scenario Parallel Lab'}
            </button>
            <button
              onClick={() => setActiveTab('sensitivity')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'sensitivity'
                  ? 'bg-white text-emerald-900 shadow-sm font-bold'
                  : 'text-stone-700 hover:text-stone-900'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 inline mr-1 text-emerald-700" />
              {isHi ? 'संवेदनशीलता मॉडल' : 'Sensitivity Model'}
            </button>
          </div>
          <SpeakButton
            textEn={labSpeechEn}
            textHi={labSpeechHi}
            labelEn="Listen"
            labelHi="सुनें"
          />
        </div>
      </div>

      {decisionFeedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
          <span>{decisionFeedback}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: DECISION LAB (PARALLEL UNIVERSE FARMING)                     */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'decision_lab' && (
        <div className="space-y-6">
          {/* Main Grid: Left Controls, Right Parallel Futures */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Input Controls Card */}
            <div className="surface-card p-5 lg:col-span-4 space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-700" />
                  <h3 className="font-bold text-sm text-stone-900">
                    {isHi ? 'प्रारंभिक स्थितियां और संसाधन' : 'Initial Conditions & Constraints'}
                  </h3>
                </div>
                <span className="text-[10px] text-stone-500 uppercase font-semibold">
                  {isHi ? 'समान आधार' : 'Shared Baseline'}
                </span>
              </div>

              {/* Field Preloader */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  {isHi ? 'खेत का चयन करें (डेटा स्वतः भरें)' : 'Select Field (Auto-Populate)'}
                </label>
                <select
                  value={labInputs.field_id ?? ''}
                  onChange={e => {
                    const fId = Number(e.target.value)
                    const f = fieldsQuery.data?.find(x => x.id === fId)
                    if (f) {
                      setLabInputs(prev => ({
                        ...prev,
                        field_id: f.id,
                        crop_name: f.crop_type,
                        growth_stage: f.growth_stage,
                        total_area_acres: f.area_value,
                      }))
                    }
                  }}
                  className="w-full text-xs rounded-xl border border-stone-300 bg-white p-2.5 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">{isHi ? '-- कोई खेत चुनें --' : '-- Select a Field --'}</option>
                  {fieldsQuery.data?.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.crop_type} • {f.area_value} {f.area_unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                    {isHi ? 'फसल का नाम' : 'Crop'}
                  </label>
                  <input
                    type="text"
                    value={labInputs.crop_name}
                    onChange={e => setLabInputs({ ...labInputs, crop_name: e.target.value })}
                    className="w-full text-xs rounded-xl border border-stone-300 p-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                    {isHi ? 'वृद्धि अवस्था' : 'Stage'}
                  </label>
                  <input
                    type="text"
                    value={labInputs.growth_stage}
                    onChange={e => setLabInputs({ ...labInputs, growth_stage: e.target.value })}
                    className="w-full text-xs rounded-xl border border-stone-300 p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                    {isHi ? 'क्षेत्रफल (एकड़)' : 'Area (Acres)'}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={labInputs.total_area_acres}
                    onChange={e =>
                      setLabInputs({ ...labInputs, total_area_acres: Number(e.target.value) || 1 })
                    }
                    className="w-full text-xs rounded-xl border border-stone-300 p-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                    {isHi ? 'अपेक्षित उपज (क्विंटल/एकड़)' : 'Yield / Acre'}
                  </label>
                  <input
                    type="number"
                    value={labInputs.expected_yield_per_acre}
                    onChange={e =>
                      setLabInputs({ ...labInputs, expected_yield_per_acre: Number(e.target.value) || 1 })
                    }
                    className="w-full text-xs rounded-xl border border-stone-300 p-2"
                  />
                </div>
              </div>

              {/* Resource Constraints Sliders */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-3 text-xs">
                <span className="font-bold text-stone-900 block text-[11px] uppercase tracking-wider">
                  {isHi ? 'उपलब्ध संसाधन सीमाएं' : 'Resource Constraints'}
                </span>

                <div>
                  <div className="flex justify-between text-[11px] font-medium text-stone-700 mb-1">
                    <span>{isHi ? 'उपलब्ध बजट (INR)' : 'Available Budget'}</span>
                    <span className="font-bold text-emerald-800">
                      {currencySymbol} {labInputs.available_budget.toLocaleString()}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50000"
                    step="500"
                    value={labInputs.available_budget}
                    onChange={e =>
                      setLabInputs({ ...labInputs, available_budget: Number(e.target.value) })
                    }
                    className="w-full accent-emerald-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-medium text-stone-700 mb-1">
                    <span>{isHi ? 'उपलब्ध सिंचाई जल' : 'Available Water'}</span>
                    <span className="font-bold text-sky-800">
                      {labInputs.available_water_liters.toLocaleString()} L
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="30000"
                    step="500"
                    value={labInputs.available_water_liters}
                    onChange={e =>
                      setLabInputs({ ...labInputs, available_water_liters: Number(e.target.value) })
                    }
                    className="w-full accent-sky-600"
                  />
                </div>
              </div>

              {/* Adverse Shock Sliders */}
              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 space-y-2 text-xs">
                <span className="font-bold text-amber-950 block text-[11px] uppercase tracking-wider">
                  {isHi ? 'जलवायु झटका टेस्ट (परिदृश्य C)' : 'Adverse Climate Shock (Scenario C)'}
                </span>

                <div>
                  <div className="flex justify-between text-[11px] font-medium text-stone-700 mb-1">
                    <span>{isHi ? 'तापमान वृद्धि' : 'Temp Increase'}</span>
                    <span className="font-bold text-amber-800">
                      +{labInputs.hypothetical_temp_delta_c} °C
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    step="0.5"
                    value={labInputs.hypothetical_temp_delta_c}
                    onChange={e =>
                      setLabInputs({ ...labInputs, hypothetical_temp_delta_c: Number(e.target.value) })
                    }
                    className="w-full accent-amber-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-medium text-stone-700 mb-1">
                    <span>{isHi ? 'वर्षा कटौती' : 'Rain Multiplier'}</span>
                    <span className="font-bold text-amber-800">
                      {Math.round(labInputs.hypothetical_rain_multiplier * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.5"
                    step="0.1"
                    value={labInputs.hypothetical_rain_multiplier}
                    onChange={e =>
                      setLabInputs({
                        ...labInputs,
                        hypothetical_rain_multiplier: Number(e.target.value),
                      })
                    }
                    className="w-full accent-amber-600"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => decisionLabMutation.mutate(labInputs)}
                disabled={decisionLabMutation.isPending}
                className="w-full btn-primary py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
              >
                <Play className="w-4 h-4" />
                {decisionLabMutation.isPending
                  ? isHi
                    ? 'समानांतर गणना चल रही है...'
                    : 'Simulating Parallel Futures...'
                  : isHi
                  ? 'समानांतर भविष्य सिमुलेट करें'
                  : 'Simulate Parallel Futures'}
              </button>
            </div>

            {/* Results: 3 Parallel Scenarios Comparison */}
            <div className="lg:col-span-8 space-y-5">
              {labData && (
                <>
                  {/* Top 3 Scenario Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Scenario A: Current Status Quo */}
                    <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-stone-100 text-stone-700">
                            Scenario A
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                              labData.scenario_a_current.risk_category === 'high-risk'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            Risk {labData.scenario_a_current.projected_risk_score}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-stone-900 leading-tight">
                          {isHi ? 'यथास्थिति प्रबंधन' : 'Current Management'}
                        </h4>
                        <p className="text-[11px] text-stone-500 mt-1 line-clamp-2">
                          {labData.scenario_a_current.description}
                        </p>

                        <div className="mt-3 pt-3 border-t border-stone-100 space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-stone-500">{isHi ? 'अनुमानित उपज हानि' : 'Yield Loss'}:</span>
                            <span className="font-semibold text-stone-800">
                              {labData.scenario_a_current.estimated_yield_loss_pct}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-stone-500">{isHi ? 'अनुमानित आय' : 'Revenue'}:</span>
                            <span className="font-semibold text-stone-800">
                              {currencySymbol} {labData.scenario_a_current.estimated_revenue.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between font-bold text-stone-900">
                            <span>{isHi ? 'शुद्ध लाभ' : 'Net Profit'}:</span>
                            <span>{currencySymbol} {labData.scenario_a_current.estimated_profit.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-2 border-t border-stone-100 text-[10px] text-stone-400">
                        {isHi ? 'कोई अतिरिक्त खर्च नहीं' : '0 INR Intervention Cost'}
                      </div>
                    </div>

                    {/* Scenario B: Recommended Intervention (Highlighted) */}
                    <div className="p-4 rounded-2xl bg-emerald-50/70 border-2 border-emerald-500 shadow-md flex flex-col justify-between relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase">
                        {isHi ? 'सर्वोत्तम आरओआई' : 'Recommended'}
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-200 text-emerald-900">
                            Scenario B
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                            Risk {labData.scenario_b_recommended.projected_risk_score}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-emerald-950 leading-tight">
                          {isHi ? 'अनुशंसित कृषि उपाय' : 'Recommended Action'}
                        </h4>
                        <p className="text-[11px] text-emerald-800 mt-1 line-clamp-2">
                          {labData.scenario_b_recommended.description}
                        </p>

                        <div className="mt-3 pt-3 border-t border-emerald-200 space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-emerald-700">{isHi ? 'अनुमानित उपज हानि' : 'Yield Loss'}:</span>
                            <span className="font-bold text-emerald-900">
                              {labData.scenario_b_recommended.estimated_yield_loss_pct}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-emerald-700">{isHi ? 'उपाय लागत' : 'Action Cost'}:</span>
                            <span className="font-semibold text-emerald-900">
                              {currencySymbol} {labData.scenario_b_recommended.intervention_cost.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between font-bold text-emerald-950 text-sm">
                            <span>{isHi ? 'शुद्ध लाभ' : 'Net Profit'}:</span>
                            <span className="text-emerald-700">
                              {currencySymbol} {labData.scenario_b_recommended.estimated_profit.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-2 border-t border-emerald-200 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-emerald-800 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          +{currencySymbol}
                          {(
                            labData.scenario_b_recommended.estimated_profit -
                            labData.scenario_a_current.estimated_profit
                          ).toLocaleString()}{' '}
                          {isHi ? 'लाभ अंतर' : 'Net Gain'}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            commitDecisionMutation.mutate({
                              field_id: labInputs.field_id,
                              crop_name: labData.crop_name,
                              growth_stage: labData.growth_stage,
                              decision_title: `Executed Scenario B: ${labData.scenario_b_recommended.title}`,
                              scenario_type: 'recommended',
                              action_category: 'irrigation_and_scouting',
                              budget_spent: labData.scenario_b_recommended.intervention_cost,
                              water_used_liters: labData.scenario_b_recommended.water_required_liters,
                              initial_risk_score: labData.scenario_a_current.projected_risk_score,
                              predicted_outcome: `Protect ${labData.scenario_b_recommended.adjusted_yield} quintals, target profit ${currencySymbol} ${labData.scenario_b_recommended.estimated_profit}`,
                            })
                          }
                          disabled={commitDecisionMutation.isPending}
                          className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white text-[10px] font-bold hover:bg-emerald-800 transition-colors shadow-sm"
                        >
                          {isHi ? 'यह निर्णय लें' : 'Commit Action'}
                        </button>
                      </div>
                    </div>

                    {/* Scenario C: Adverse Climate Stress */}
                    <div className="p-4 rounded-2xl bg-red-50/50 border border-red-200 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-red-100 text-red-800">
                            Scenario C
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-red-200 text-red-900 font-extrabold">
                            Risk {labData.scenario_c_adverse.projected_risk_score}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-stone-900 leading-tight">
                          {isHi ? 'जलवायु झटका टेस्ट' : 'Adverse Climate Shock'}
                        </h4>
                        <p className="text-[11px] text-stone-600 mt-1 line-clamp-2">
                          {labData.scenario_c_adverse.description}
                        </p>

                        <div className="mt-3 pt-3 border-t border-red-100 space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-stone-500">{isHi ? 'अनुमानित उपज हानि' : 'Yield Loss'}:</span>
                            <span className="font-bold text-red-700">
                              {labData.scenario_c_adverse.estimated_yield_loss_pct}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-stone-500">{isHi ? 'अनुमानित आय' : 'Revenue'}:</span>
                            <span className="font-semibold text-stone-800">
                              {currencySymbol} {labData.scenario_c_adverse.estimated_revenue.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between font-bold text-stone-900">
                            <span>{isHi ? 'शुद्ध लाभ' : 'Net Profit'}:</span>
                            <span className="text-red-700">
                              {currencySymbol} {labData.scenario_c_adverse.estimated_profit.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-2 border-t border-red-100 text-[10px] text-red-600 flex items-center gap-1 font-semibold">
                        <TrendingDown className="w-3 h-3" />
                        {isHi ? 'गंभीर मौसमी जोखिम' : 'Severe Weather Vulnerability'}
                      </div>
                    </div>
                  </div>

                  {/* Comparative Chart */}
                  <div className="surface-card p-4">
                    <h4 className="font-bold text-xs text-stone-800 mb-3 flex items-center gap-2">
                      <BarChart className="w-4 h-4 text-emerald-700" />
                      {isHi
                        ? 'तीनों परिदृश्यों का शुद्ध लाभ एवं जोखिम तुलना'
                        : 'Parallel Futures Comparison: Net Profit & Risk Score'}
                    </h4>
                    <div className="h-60 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={comparisonChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{
                              fontSize: '12px',
                              borderRadius: '12px',
                              border: '1px solid #e2e8f0',
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                          <Bar
                            yAxisId="left"
                            dataKey="profit"
                            name={isHi ? 'शुद्ध लाभ (INR)' : 'Net Profit (INR)'}
                            fill="#059669"
                            radius={[6, 6, 0, 0]}
                          />
                          <Bar
                            yAxisId="right"
                            dataKey="loss_pct"
                            name={isHi ? 'फसल हानि (%)' : 'Yield Loss (%)'}
                            fill="#e11d48"
                            radius={[6, 6, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Why it Changed & Agricultural Rationale */}
                  <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-xs space-y-2.5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-700" />
                      <h4 className="font-bold text-stone-900">
                        {isHi ? 'निर्णय तर्क एवं कारक विश्लेषण' : 'Agronomic Decision Rationale & Contributing Factors'}
                      </h4>
                    </div>
                    <p className="text-stone-700 leading-relaxed font-medium">
                      {labData.comparison_summary}
                    </p>

                    <div className="pt-2 border-t border-stone-200 text-stone-600 space-y-1">
                      <span className="font-semibold text-stone-900 block text-[11px]">
                        {isHi ? 'क्या बदला और क्यों:' : 'What Changed & Why:'}
                      </span>
                      <pre className="font-sans whitespace-pre-line text-stone-600 text-xs">
                        {labData.what_changed_explanation}
                      </pre>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: FINANCIAL SENSITIVITY SIMULATOR (LEGACY MODEL PRESERVED)     */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'sensitivity' && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs text-amber-950">
            <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">{sm.bannerTitle}</p>
              <p className="mt-0.5">{sm.bannerDesc}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Form */}
            <form
              onSubmit={e => {
                e.preventDefault()
                legacyRunMutation.mutate(legacyInputs)
              }}
              className="surface-card p-5 lg:col-span-5 space-y-4"
            >
              <div className="flex items-center gap-2 border-b border-stone-200 pb-3">
                <Calculator className="w-5 h-5 text-emerald-700" />
                <h3 className="font-bold text-sm text-stone-900">
                  {isHi ? 'संवेदनशीलता परिदृश्य कॉन्फ़िगरेशन' : 'Sensitivity Scenario Configuration'}
                </h3>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  {isHi ? 'परिदृश्य का नाम' : 'Scenario Name'}
                </label>
                <input
                  type="text"
                  value={legacyInputs.name}
                  onChange={e => setLegacyInputs({ ...legacyInputs, name: e.target.value })}
                  className="w-full text-xs rounded-xl border border-stone-300 p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    {isHi ? 'फसल का प्रकार' : 'Crop Type'}
                  </label>
                  <input
                    type="text"
                    value={legacyInputs.crop_type}
                    onChange={e => setLegacyInputs({ ...legacyInputs, crop_type: e.target.value })}
                    className="w-full text-xs rounded-xl border border-stone-300 p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    {isHi ? 'अनुमानित फसल हानि (%)' : 'Estimated Loss (%)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={legacyInputs.estimated_loss_pct}
                    onChange={e =>
                      setLegacyInputs({ ...legacyInputs, estimated_loss_pct: Number(e.target.value) || 0 })
                    }
                    className="w-full text-xs rounded-xl border border-stone-300 p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    {isHi ? 'कुल इनपुट लागत' : 'Input Cost'} ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    value={legacyInputs.input_cost}
                    onChange={e =>
                      setLegacyInputs({ ...legacyInputs, input_cost: Number(e.target.value) || 0 })
                    }
                    className="w-full text-xs rounded-xl border border-stone-300 p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    {isHi ? 'बिक्री मूल्य प्रति इकाई' : 'Sale Price Per Unit'} ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    value={legacyInputs.sale_price_per_unit}
                    onChange={e =>
                      setLegacyInputs({
                        ...legacyInputs,
                        sale_price_per_unit: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full text-xs rounded-xl border border-stone-300 p-2"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={legacyRunMutation.isPending}
                className="w-full btn-primary py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                {legacyRunMutation.isPending
                  ? (isHi ? 'सिमुलेशन जारी...' : 'Simulating...')
                  : (isHi ? 'सिमुलेशन चलाएं' : 'Run Simulation')}
              </button>
            </form>

            {/* Legacy Results */}
            <div className="surface-card p-5 lg:col-span-7 space-y-4">
              <h3 className="font-bold text-sm text-stone-900 border-b border-stone-200 pb-3">
                {isHi ? 'सिमुलेशन परिणाम और संवेदनशीलता' : 'Simulation Results & Sensitivity'}
              </h3>
              {legacyResult ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="p-3 bg-stone-50 rounded-xl">
                      <span className="text-[10px] text-stone-500 uppercase">
                        {isHi ? 'आधार आय' : 'Baseline Revenue'}
                      </span>
                      <p className="font-bold text-stone-900 text-sm mt-0.5">
                        {currencySymbol} {legacyResult.baseline_revenue.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 bg-stone-50 rounded-xl">
                      <span className="text-[10px] text-stone-500 uppercase">
                        {isHi ? 'अनुमानित आय' : 'Estimated Revenue'}
                      </span>
                      <p className="font-bold text-stone-900 text-sm mt-0.5">
                        {currencySymbol} {legacyResult.estimated_revenue.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-xl">
                      <span className="text-[10px] text-emerald-700 uppercase font-bold">
                        {isHi ? 'अनुमानित लाभ' : 'Estimated Profit'}
                      </span>
                      <p className="font-bold text-emerald-800 text-sm mt-0.5">
                        {currencySymbol} {legacyResult.estimated_profit.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-xl">
                      <span className="text-[10px] text-red-700 uppercase font-bold">
                        {isHi ? 'संभावित नुकसान' : 'Potential Loss'}
                      </span>
                      <p className="font-bold text-red-800 text-sm mt-0.5">
                        {currencySymbol} {legacyResult.potential_loss_amount.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Sensitivity Line Chart */}
                  <div className="h-56 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={legacyResult.sensitivity_curve}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis
                          dataKey="loss_pct"
                          unit="%"
                          tick={{ fontSize: 11 }}
                          label={{
                            value: isHi ? 'फसल हानि (%)' : 'Yield Loss (%)',
                            position: 'insideBottom',
                            offset: -4,
                          }}
                        />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="estimated_profit"
                          name={isHi ? 'अनुमानित लाभ' : 'Estimated Profit'}
                          stroke="#059669"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-stone-500 text-xs">
                  {isHi
                    ? 'कोई संवेदनशीलता सिमुलेशन नहीं चलाया गया है। ऊपर फॉर्म भरकर "सिमुलेशन चलाएं" दबाएं।'
                    : 'No simulation run yet. Fill the inputs and click Run Simulation.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
