import api from './api'
import type {
  HealthStatus,
  FieldRecord,
  FieldCreatePayload,
  FieldUpdatePayload,
  AssessmentRecord,
  EvidenceItem,
  GeoLocationResult,
  WeatherForecastResponse,
  RescueTask,
  RescueTaskCreatePayload,
  RescueTaskUpdatePayload,
  BudgetSummary,
  BudgetItem,
  BudgetItemCreatePayload,
  SimulatorRunPayload,
  SimulatorRunResult,
  ReportsSummary,
  AuthSessionResponse,
  FarmerProfileRecord,
  FarmerProfilePayload,
  CropDetailsRecord,
  UserAccount,
  FieldZoneRecord,
  ButterflyRiskEvaluation,
  DecisionLabPayload,
  DecisionLabResult,
  RescueOptimizerPayload,
  RescueOptimizerResult,
  DiagnosticEvaluatePayload,
  DiagnosticEvaluateResult,
  FarmerDecisionLogRecord,
  DecisionLogCreatePayload,
  AutopsyTimelineResponse,
  VarietyComparisonResult,
  StressTrendResponse,
} from '@/types'

export function safeStr(val: unknown, fallback = ''): string {
  if (val === null || val === undefined) return fallback
  const s = String(val).trim()
  if (s === 'undefined' || s === 'null' || s === 'NaN') return fallback
  return s
}

export const authApi = {
  signup: (payload: {
    full_name: string
    email: string
    mobile_number: string
    password: string
    preferred_language?: 'en' | 'hi'
  }) => api.post<AuthSessionResponse>('/auth/signup', payload).then(r => r.data),

  login: (payload: { email: string; password: string }) =>
    api.post<AuthSessionResponse>('/auth/login', payload).then(r => r.data),

  me: () => api.get<AuthSessionResponse>('/auth/me').then(r => r.data),

  updateLanguage: (preferred_language: 'en' | 'hi') =>
    api.put<UserAccount>('/auth/language', { preferred_language }).then(r => r.data),
}

export const farmerApi = {
  getProfile: () => api.get<FarmerProfileRecord | null>('/farmer/profile').then(r => r.data),
  saveProfile: (payload: FarmerProfilePayload) =>
    api.post<FarmerProfileRecord>('/farmer/profile', payload).then(r => r.data),
}

export interface CropCatalogueItem {
  record_id: number
  crop: string
  crop_group: string
  typical_season_or_region: string
  indicative_temperature_c: string
  indicative_soil_ph: string
  indicative_annual_rainfall_mm: string
  soil_texture_and_drainage: string
  stress_watchouts: string
  reference_basis: string
  humidity_guidance: string
  soil_moisture_threshold: string
  confidence_note: string
  reference_links: string[]
  visual_ideal_leaf_colour_by_stage?: string
  current_photo_colour_comparison?: string
  healthy_rate_percent_method?: string
  visual_health_scoring_weights?: string
  image_comparison_safety_note?: string
}

export interface CropModelEvaluation {
  matched: boolean
  model_version?: string
  record_id?: number
  crop?: string
  crop_group?: string
  typical_season_or_region?: string
  indicative_temperature_c?: string
  indicative_soil_ph?: string
  indicative_annual_rainfall_mm?: string
  soil_texture_and_drainage?: string
  stress_watchouts?: string
  reference_basis?: string
  humidity_guidance?: string
  soil_moisture_threshold?: string
  confidence_note?: string
  reference_links?: string[]
  visual_ideal_leaf_colour_by_stage?: string
  stage_expected_leaf_colour?: string
  current_photo_colour_comparison?: string
  healthy_rate_percent_method?: string
  visual_health_scoring_weights?: string
  image_comparison_safety_note?: string
  leaf_colour_analysis?: {
    colour_match_score: number
    green_foliage_pct: number
    chlorosis_yellowing_pct: number
    browning_necrosis_pct: number
    purple_red_stress_pct: number
    colour_uniformity_score: number
    growth_stage_evaluated: string
    stage_expected_colour: string
    observations: string[]
  } | null
  healthy_rate_evaluation?: {
    healthy_rate_pct: number
    data_confidence_pct: number
    weights_renormalized: boolean
    components: Array<{
      key: string
      label_en: string
      label_hi: string
      base_weight_pct: number
      effective_weight_pct: number
      score: number | null
      available: boolean
      weighted_contribution: number
    }>
    method_note: string
    weights_note: string
    safety_note: string
  }
  suitability_score?: number
  overall_status?: 'optimal' | 'watch' | 'stress_alert'
  parameter_checks?: Array<{
    parameter: string
    observed: string
    indicative_range: string
    status: string
    score: number
    detail_en: string
    detail_hi: string
  }>
  alerts?: Array<{
    code: string
    severity: string
    parameter: string
    reason_en: string
    reason_hi: string
    source: string
  }>
  summary_en?: string
  summary_hi?: string
}

export const cropsApi = {
  list: () => api.get<CropDetailsRecord[]>('/crops').then(r => r.data),
  getLatest: () => api.get<CropDetailsRecord | null>('/crops/latest').then(r => r.data),
  getCatalogue: (params?: { q?: string; crop_group?: string }) =>
    api
      .get<{
        model_name: string
        model_version: string
        trained_at: string
        metrics: Record<string, any>
        crop_groups: string[]
        total: number
        items: CropCatalogueItem[]
      }>('/crops/catalogue', { params })
      .then(r => r.data),
  evaluateModel: (payload: {
    crop_name: string
    field_temperature_c?: number | null
    recent_rainfall_mm?: number | null
    soil_moisture_pct?: number | null
    humidity_pct?: number | null
    soil_ph?: number | null
    soil_type?: string | null
    growth_stage?: string | null
    growth_progress_pct?: number | null
    visible_symptoms?: string | null
    image_filename?: string | null
  }) => api.post<CropModelEvaluation>('/crops/model/evaluate', payload).then(r => r.data),
  retrainModel: () => api.post('/crops/model/retrain').then(r => r.data),
  saveCrop: (params: {
    crop_id?: number | null
    crop_name: string
    crop_variety?: string
    field_location: string
    sowing_date?: string
    growth_stage: string
    growth_progress_pct: number | string
    irrigation_method: string
    recent_rainfall_mm?: number | string | null
    soil_moisture_pct?: number | string | null
    field_temperature_c?: number | string | null
    humidity_pct?: number | string | null
    fertilizer_used?: string
    pesticide_used?: string
    visible_symptoms?: string
    photo?: File | null
  }) => {
    const form = new FormData()
    form.append('crop_name', safeStr(params.crop_name))
    form.append('crop_variety', safeStr(params.crop_variety))
    form.append('field_location', safeStr(params.field_location))
    form.append('sowing_date', safeStr(params.sowing_date))
    form.append('growth_stage', safeStr(params.growth_stage, 'Vegetative'))
    form.append('growth_progress_pct', safeStr(params.growth_progress_pct, '25'))
    form.append('irrigation_method', safeStr(params.irrigation_method, 'Drip Irrigation'))
    if (safeStr(params.recent_rainfall_mm) !== '') {
      form.append('recent_rainfall_mm', safeStr(params.recent_rainfall_mm))
    }
    if (safeStr(params.soil_moisture_pct) !== '') {
      form.append('soil_moisture_pct', safeStr(params.soil_moisture_pct))
    }
    if (safeStr(params.field_temperature_c) !== '') {
      form.append('field_temperature_c', safeStr(params.field_temperature_c))
    }
    if (safeStr(params.humidity_pct) !== '') {
      form.append('humidity_pct', safeStr(params.humidity_pct))
    }
    form.append('fertilizer_used', safeStr(params.fertilizer_used))
    form.append('pesticide_used', safeStr(params.pesticide_used))
    form.append('visible_symptoms', safeStr(params.visible_symptoms))
    if (params.crop_id !== null && params.crop_id !== undefined) {
      form.append('crop_id', String(params.crop_id))
    }
    if (params.photo) {
      form.append('photo', params.photo)
    }
    return api
      .post<CropDetailsRecord>('/crops', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 35000,
      })
      .then(r => r.data)
  },
  compareVarieties: (payload: {
    target_crop: string
    field_temperature_c?: number
    field_soil_ph?: number
    annual_rainfall_mm?: number
    soil_texture?: string
  }) => api.post<VarietyComparisonResult>('/crops/variety-comparison', payload).then(r => r.data),
}

export const healthApi = {
  getStatus: () => api.get<HealthStatus>('/health').then(r => r.data),
}

export const fieldsApi = {
  list: () => api.get<FieldRecord[]>('/fields').then(r => r.data),
  get: (id: number) => api.get<FieldRecord>(`/fields/${id}`).then(r => r.data),
  create: (data: FieldCreatePayload) => api.post<FieldRecord>('/fields', data).then(r => r.data),
  update: (id: number, data: FieldUpdatePayload) => api.put<FieldRecord>(`/fields/${id}`, data).then(r => r.data),
  remove: (id: number) => api.delete(`/fields/${id}`).then(r => r.data),
  listZones: (fieldId: number) => api.get<FieldZoneRecord[]>(`/fields/${fieldId}/zones`).then(r => r.data),
  createZone: (fieldId: number, data: Partial<FieldZoneRecord>) =>
    api.post<FieldZoneRecord>(`/fields/${fieldId}/zones`, data).then(r => r.data),
  updateZone: (fieldId: number, zoneId: number, data: Partial<FieldZoneRecord>) =>
    api.put<FieldZoneRecord>(`/fields/${fieldId}/zones/${zoneId}`, data).then(r => r.data),
  deleteZone: (fieldId: number, zoneId: number) =>
    api.delete(`/fields/${fieldId}/zones/${zoneId}`).then(r => r.data),
  getTrends: (fieldId: number) =>
    api.get<StressTrendResponse>(`/fields/${fieldId}/trends`).then(r => r.data),
}

export const analysisApi = {
  getModelInfo: () =>
    api
      .get<{
        model_id: string
        configured_model_id: string
        architecture: string
        inference_task: string
        input_image_requirements?: string
        expected_response_format: string
        supported_crops: string[]
        healthy_only_crops?: string[]
        unsupported_major_crops_note?: string
        supported_classes: string[]
        plantvillage_limitation_notice?: string
        confidence_calibration_note: string
        ai_provider: string
        ai_configured: boolean
      }>('/analysis/model-info')
      .then(r => r.data),
  analyzeImage: (params: {
    file: File
    crop_type: string
    growth_stage: string
    field_id?: number | null
    user_notes?: string
  }) => {
    const form = new FormData()
    form.append('file', params.file)
    form.append('crop_type', params.crop_type)
    form.append('growth_stage', params.growth_stage)
    if (params.field_id !== undefined && params.field_id !== null) {
      form.append('field_id', String(params.field_id))
    }
    if (params.user_notes) {
      form.append('user_notes', params.user_notes)
    }
    return api
      .post<AssessmentRecord>('/analysis', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 35000,
      })
      .then(r => r.data)
  },
  evaluateButterflyRisk: (params: {
    crop_name: string
    growth_stage: string
    current_temp_c?: number | null
    soil_moisture_pct?: number | null
    relative_humidity_pct?: number | null
    rainfall_3d_sum_mm?: number | null
    drainage_quality?: string
    soil_ph?: number | null
    visible_symptoms?: string
    forecast_heat_stress?: boolean
    forecast_rain_high?: boolean
  }) => {
    const form = new FormData()
    form.append('crop_name', params.crop_name)
    form.append('growth_stage', params.growth_stage)
    if (params.current_temp_c != null) form.append('current_temp_c', String(params.current_temp_c))
    if (params.soil_moisture_pct != null) form.append('soil_moisture_pct', String(params.soil_moisture_pct))
    if (params.relative_humidity_pct != null) form.append('relative_humidity_pct', String(params.relative_humidity_pct))
    if (params.rainfall_3d_sum_mm != null) form.append('rainfall_3d_sum_mm', String(params.rainfall_3d_sum_mm))
    if (params.drainage_quality) form.append('drainage_quality', params.drainage_quality)
    if (params.soil_ph != null) form.append('soil_ph', String(params.soil_ph))
    if (params.visible_symptoms) form.append('visible_symptoms', params.visible_symptoms)
    if (params.forecast_heat_stress) form.append('forecast_heat_stress', 'true')
    if (params.forecast_rain_high) form.append('forecast_rain_high', 'true')

    return api
      .post<ButterflyRiskEvaluation>('/analysis/butterfly-risk', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r => r.data)
  },
  evaluateDiagnostics: (payload: DiagnosticEvaluatePayload) =>
    api.post<DiagnosticEvaluateResult>('/analysis/diagnostics', payload).then(r => r.data),
}

export const historyApi = {
  list: (params?: { field_id?: number; crop_type?: string; risk_category?: string }) =>
    api.get<AssessmentRecord[]>('/history', { params }).then(r => r.data),
  get: (id: number) => api.get<AssessmentRecord>(`/history/${id}`).then(r => r.data),
  remove: (id: number) => api.delete(`/history/${id}`).then(r => r.data),
  listEvidence: (field_id?: number) =>
    api.get<EvidenceItem[]>('/evidence', { params: field_id ? { field_id } : undefined }).then(r => r.data),
  listDecisions: (field_id?: number | null) =>
    api
      .get<FarmerDecisionLogRecord[]>('/history/decisions', {
        params: field_id ? { field_id } : undefined,
      })
      .then(r => r.data),
  recordDecision: (payload: DecisionLogCreatePayload) =>
    api.post<FarmerDecisionLogRecord>('/history/decisions', payload).then(r => r.data),
  updateDecisionOutcome: (id: number, payload: { observed_outcome: string; outcome_rating: string; subsequent_risk_score?: number }) =>
    api.put<FarmerDecisionLogRecord>(`/history/decisions/${id}/outcome`, payload).then(r => r.data),
  getAutopsyTimeline: (field_id: number) =>
    api.get<AutopsyTimelineResponse>(`/history/autopsy-timeline/${field_id}`).then(r => r.data),
}

export const weatherApi = {
  searchLocations: (q: string) =>
    api.get<GeoLocationResult[]>('/weather/search', { params: { q } }).then(r => r.data),
  getForecast: (lat: number, lon: number, location_name: string) =>
    api
      .get<WeatherForecastResponse>('/weather/forecast', {
        params: { lat, lon, location_name },
      })
      .then(r => r.data),
}

export const plannerApi = {
  listTasks: (params?: { field_id?: number; status?: string }) =>
    api.get<RescueTask[]>('/planner/tasks', { params }).then(r => r.data),
  createTask: (data: RescueTaskCreatePayload) =>
    api.post<RescueTask>('/planner/tasks', data).then(r => r.data),
  generateForField: (field_id: number) =>
    api.post<RescueTask[]>(`/planner/generate/${field_id}`).then(r => r.data),
  updateTask: (id: number, data: RescueTaskUpdatePayload) =>
    api.put<RescueTask>(`/planner/tasks/${id}`, data).then(r => r.data),
  deleteTask: (id: number) => api.delete(`/planner/tasks/${id}`).then(r => r.data),
  optimizeInterventions: (payload: RescueOptimizerPayload) =>
    api.post<RescueOptimizerResult>('/planner/optimize', payload).then(r => r.data),
}

export const budgetApi = {
  getSummary: (field_id?: number) =>
    api.get<BudgetSummary>('/budget', { params: field_id ? { field_id } : undefined }).then(r => r.data),
  createItem: (data: BudgetItemCreatePayload) =>
    api.post<BudgetItem>('/budget', data).then(r => r.data),
  updateItem: (id: number, data: Partial<BudgetItemCreatePayload>) =>
    api.put<BudgetItem>(`/budget/${id}`, data).then(r => r.data),
  deleteItem: (id: number) => api.delete(`/budget/${id}`).then(r => r.data),
}

export const simulatorApi = {
  run: (data: SimulatorRunPayload) =>
    api.post<SimulatorRunResult>('/simulator/run', data).then(r => r.data),
  listScenarios: () => api.get<any[]>('/simulator/scenarios').then(r => r.data),
  deleteScenario: (id: number) => api.delete(`/simulator/scenarios/${id}`).then(r => r.data),
  runDecisionLab: (payload: DecisionLabPayload) =>
    api.post<DecisionLabResult>('/simulator/decision-lab', payload).then(r => r.data),
}

export const reportsApi = {
  getSummary: (field_id?: number) =>
    api.get<ReportsSummary>('/reports/summary', { params: field_id ? { field_id } : undefined }).then(r => r.data),
}
