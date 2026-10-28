// ─── Health & System Status ──────────────────────────────────────────────────
export interface HealthStatus {
  status: string
  version: string
  database_connected: boolean
  ai_provider: string
  ai_model_id: string
  ai_configured: boolean
  weather_api_url: string
  weather_thresholds: Record<string, number>
  timestamp: string
}

// ─── Field Management ────────────────────────────────────────────────────────
export interface FieldRecord {
  id: number
  name: string
  crop_type: string
  area_value: number
  area_unit: 'hectares' | 'acres' | string
  location: string
  latitude?: number | null
  longitude?: number | null
  planting_date?: string | null
  growth_stage: string
  status: 'healthy' | 'watch' | 'high-risk' | string
  risk_level: 'low' | 'moderate' | 'high' | string
  ndvi: number
  notes: string
  last_assessment?: string | null
  created_at: string
}

export interface FieldCreatePayload {
  name: string
  crop_type: string
  area_value: number
  area_unit: string
  location: string
  latitude?: number | null
  longitude?: number | null
  planting_date?: string | null
  growth_stage: string
  notes: string
}

export type FieldUpdatePayload = Partial<FieldCreatePayload> & {
  status?: string
  risk_level?: string
}

// ─── Risk Assessment & Evidence Ledger ───────────────────────────────────────
export interface RiskFactorItem {
  factor: string
  source: string
  impact: 'low' | 'moderate' | 'high' | 'uncertainty' | string
  detail: string
}

export interface EvidenceItem {
  id: number
  field_id?: number | null
  field_name?: string | null
  assessment_id?: number | null
  recommendation_text: string
  supporting_evidence: string
  evidence_source: string
  confidence_label?: string | null
  data_gaps: string
  verification_steps: string
  created_at: string
}

// ─── Disease Analysis & Crop Memory (Assessments) ────────────────────────────
export interface ModelPredictionItem {
  label: string
  confidence: number
}

export interface AssessmentRecord {
  id: number
  field_id?: number | null
  field_name?: string | null
  crop_type: string
  growth_stage: string
  image_filename?: string | null
  analysis_status: 'completed' | 'unavailable' | 'observation_only' | 'error' | string
  predicted_condition?: string | null
  model_confidence?: number | null
  raw_predictions: ModelPredictionItem[]
  visual_symptoms: string[]
  severity: string
  risk_category: 'healthy' | 'watch' | 'high-risk' | string
  risk_score?: number | null
  scoring_method_note: string
  risk_factors: RiskFactorItem[]
  recommended_next_steps: string[]
  preventive_measures: string[]
  expert_confirmation_needed: boolean
  model_provider?: string | null
  model_id?: string | null
  disclaimer: string
  troubleshooting_hint?: string | null
  user_notes: string
  data_completeness_pct: number
  missing_data: string[]
  is_demo: boolean
  created_at: string
}

// ─── Weather Intelligence ────────────────────────────────────────────────────
export interface GeoLocationResult {
  id: number
  name: string
  latitude: number
  longitude: number
  country: string
  admin1?: string | null
  timezone?: string | null
}

export interface CurrentWeatherBlock {
  temperature_c?: number | null
  relative_humidity_pct?: number | null
  apparent_temperature_c?: number | null
  precipitation_mm?: number | null
  wind_speed_kmh?: number | null
  weather_code?: number | null
  weather_label: string
  time?: string | null
}

export interface DailyForecastItem {
  date: string
  temp_max_c?: number | null
  temp_min_c?: number | null
  precipitation_sum_mm?: number | null
  precipitation_probability_max_pct?: number | null
  wind_speed_max_kmh?: number | null
  weather_code?: number | null
  weather_label: string
}

export interface HourlyForecastItem {
  time: string
  temperature_c?: number | null
  precipitation_probability_pct?: number | null
  relative_humidity_pct?: number | null
}

export interface WeatherRiskRuleAlert {
  rule_id: string
  risk_type: string
  severity: 'info' | 'watch' | 'high' | string
  title: string
  explanation: string
  threshold_used: string
  assumption_note: string
}

export interface WeatherForecastResponse {
  location_name: string
  latitude: number
  longitude: number
  timezone: string
  fetched_at: string
  current: CurrentWeatherBlock
  daily: DailyForecastItem[]
  hourly: HourlyForecastItem[]
  weather_risks: WeatherRiskRuleAlert[]
  thresholds_config: Record<string, number>
}

// ─── Rescue Planner ──────────────────────────────────────────────────────────
export interface RescueTask {
  id: number
  field_id?: number | null
  field_name?: string | null
  assessment_id?: number | null
  title: string
  reason: string
  evidence_source: string
  urgency: 'immediate' | 'high' | 'medium' | 'routine' | string
  status: 'pending' | 'in_progress' | 'completed' | string
  completion_notes: string
  due_date?: string | null
  created_at: string
  updated_at: string
}

export interface RescueTaskCreatePayload {
  field_id?: number | null
  assessment_id?: number | null
  title: string
  reason: string
  evidence_source?: string
  urgency: string
  due_date?: string | null
}

export interface RescueTaskUpdatePayload {
  title?: string
  reason?: string
  urgency?: string
  status?: string
  completion_notes?: string
  due_date?: string | null
}

// ─── Budget Manthan ──────────────────────────────────────────────────────────
export interface BudgetItem {
  id: number
  field_id?: number | null
  field_name?: string | null
  category: string
  item_name: string
  planned_cost: number
  actual_cost: number
  variance: number
  notes: string
  expense_date?: string | null
  created_at: string
}

export interface BudgetSummary {
  total_planned: number
  total_actual: number
  remaining_budget: number
  variance: number
  items: BudgetItem[]
  by_category: Array<{
    category: string
    planned: number
    actual: number
    variance: number
  }>
  profitability_note: string
}

export interface BudgetItemCreatePayload {
  field_id?: number | null
  category: string
  item_name: string
  planned_cost: number
  actual_cost: number
  notes?: string
  expense_date?: string | null
}

// ─── What-If Simulator ───────────────────────────────────────────────────────
export interface SimulatorRunPayload {
  name: string
  field_id?: number | null
  crop_type: string
  expected_rainfall_mm: number
  temp_assumption_c: number
  irrigation_available: boolean
  estimated_loss_pct: number
  input_cost: number
  expected_yield_units: number
  yield_unit: string
  sale_price_per_unit: number
  save_scenario?: boolean
}

export interface SensitivityPoint {
  loss_pct: number
  adjusted_yield: number
  estimated_revenue: number
  estimated_profit: number
}

export interface SimulatorRunResult {
  id?: number | null
  name: string
  field_id?: number | null
  crop_type: string
  assumptions: Record<string, any>
  formulas_used: string[]
  baseline_revenue: number
  adjusted_yield: number
  estimated_revenue: number
  estimated_cost: number
  estimated_profit: number
  potential_loss_amount: number
  weather_stress_modifier_note: string
  sensitivity_curve: SensitivityPoint[]
  disclaimer: string
  created_at: string
}

// ─── Overview & Reports Summary ──────────────────────────────────────────────
export interface ReportsSummary {
  is_demo: boolean
  summary_cards: {
    total_fields: number
    total_assessments: number
    elevated_risk_fields: number
    high_risk_fields: number
    active_recommendations: number
    estimated_potential_loss?: number | null
    has_loss_estimate: boolean
  }
  risk_distribution: Array<{
    category: string
    fields: number
    assessments: number
    color: string
  }>
  health_trend: Array<{
    date: string
    health_index: number
    assessments_count: number
    is_demo: boolean
  }>
  task_summary: {
    pending: number
    in_progress: number
    completed: number
    total: number
  }
  budget_summary: {
    total_planned: number
    total_actual: number
    variance: number
    items_count: number
  }
  recommended_actions: Array<{
    id: string
    title: string
    reason: string
    urgency: string
    status: string
    field_id?: number | null
    field_name: string
    source: string
    is_demo: boolean
  }>
  recent_activity: Array<{
    id: string
    type: string
    title: string
    detail: string
    field_name?: string | null
    timestamp: string
    is_demo: boolean
  }>
  evidence_count: number
}

// ─── Authentication & Farmer Onboarding Types ────────────────────────────────
export interface UserAccount {
  id: number
  full_name: string
  email: string
  mobile_number: string
  preferred_language: 'en' | 'hi' | string
  created_at: string
}

export interface FarmerProfileRecord {
  id: number
  user_id: number
  farmer_name: string
  mobile_number: string
  state: string
  district: string
  village_town: string
  total_land_acres: number
  soil_type: string
  irrigation_source: string
  main_crop: string
  growing_season: string
  budget_per_acre: number
  preferred_language: 'en' | 'hi' | string
  created_at: string
  updated_at: string
}

export interface FarmerProfilePayload {
  farmer_name: string
  mobile_number: string
  state: string
  district: string
  village_town: string
  total_land_acres: number
  soil_type: string
  irrigation_source: string
  main_crop: string
  growing_season: string
  budget_per_acre: number
  preferred_language: 'en' | 'hi'
}

export interface CropDetailsRecord {
  id: number
  user_id: number
  field_id?: number | null
  crop_name: string
  crop_variety: string
  field_location: string
  sowing_date: string
  growth_stage: string
  growth_progress_pct: number
  irrigation_method: string
  recent_rainfall_mm?: number | null
  soil_moisture_pct?: number | null
  field_temperature_c?: number | null
  humidity_pct?: number | null
  fertilizer_used: string
  pesticide_used: string
  image_filename?: string | null
  image_url?: string | null
  visible_symptoms: string
  latest_assessment_id?: number | null
  created_at: string
  updated_at: string
}

export interface AuthSessionResponse {
  token: string
  user: UserAccount
  has_farmer_profile: boolean
  has_crop_record: boolean
  farmer_profile?: FarmerProfileRecord | null
  latest_crop?: CropDetailsRecord | null
}

// ─── Field Zone Types ────────────────────────────────────────────────────────
export interface FieldZoneRecord {
  id: number
  field_id: number
  zone_name: string
  area_acres: number
  crop_stage: string
  soil_moisture_pct?: number | null
  soil_ph?: number | null
  drainage_quality: string
  microclimate_note: string
  risk_level: string
  last_inspected: string
  created_at: string
}

// ─── Butterfly Effect Combined Risk Types ────────────────────────────────────
export interface ButterflyRiskItem {
  rule_id: string
  risk_type: string
  severity: 'high' | 'watch' | 'advisory' | string
  title: string
  compounding_factors: string[]
  explanation: string
  thresholds_applied: string
  recommended_action: string
  evidence_quality: string
  missing_measurements: string[]
}

export interface ButterflyRiskEvaluation {
  overall_status: 'critical' | 'warning' | 'stable' | string
  combined_risk_score: number
  compounding_alerts: ButterflyRiskItem[]
  crop_name: string
  growth_stage: string
  environmental_snapshot: Record<string, any>
  uncertainty_notes: string[]
  data_provenance: Record<string, string>
}

// ─── Decision Lab & Parallel Universe Farming Types ──────────────────────────
export interface ScenarioDetail {
  scenario_id: string
  title: string
  description: string
  projected_risk_score: number
  risk_category: 'low' | 'watch' | 'high-risk' | string
  estimated_yield_loss_pct: number
  adjusted_yield: number
  estimated_revenue: number
  estimated_profit: number
  intervention_cost: number
  water_required_liters: number
  top_contributing_factors: string[]
  evidence_quality: string
  key_assumptions: string[]
  missing_data_warnings: string[]
}

export interface DecisionLabPayload {
  field_id?: number | null
  zone_id?: number | null
  crop_name: string
  crop_variety: string
  growth_stage: string
  total_area_acres: number
  expected_yield_per_acre: number
  yield_unit: string
  sale_price_per_unit: number
  baseline_input_cost: number
  current_soil_moisture_pct?: number | null
  current_temp_c?: number | null
  forecast_rainfall_3d_mm?: number | null
  available_water_liters: number
  available_budget: number
  hypothetical_temp_delta_c: number
  hypothetical_rain_multiplier: number
}

export interface DecisionLabResult {
  crop_name: string
  growth_stage: string
  baseline_revenue: number
  scenario_a_current: ScenarioDetail
  scenario_b_recommended: ScenarioDetail
  scenario_c_adverse: ScenarioDetail
  comparison_summary: string
  what_changed_explanation: string
  recommended_decision_rationale: string
  data_provenance: Record<string, string>
  created_at: string
}

// ─── Resource-Aware Rescue Optimizer Types ───────────────────────────────────
export interface RescueInterventionOption {
  action_id: string
  title: string
  category: 'cultural' | 'irrigation' | 'monitoring' | 'nutrition' | 'protection' | string
  estimated_cost_inr: number
  water_required_liters: number
  labor_hours: number
  equipment_needed: string
  purpose: string
  direction_of_effect: string
  potential_tradeoffs: string
  is_zero_budget_feasible: boolean
  safety_compliance: boolean
  evidence_quality: string
  rank_score: number
  selection_rationale: string
}

export interface RescueOptimizerPayload {
  field_id?: number | null
  crop_name: string
  growth_stage: string
  active_risk_type: string
  available_budget_inr: number
  available_water_liters: number
  available_labor_hours: number
  zero_budget_only: boolean
  existing_supplies?: string[]
}

export interface RescueOptimizerResult {
  mode: 'constrained_budget' | 'zero_budget' | string
  available_budget_inr: number
  available_water_liters: number
  ranked_options: RescueInterventionOption[]
  infeasible_options_excluded: string[]
  zero_budget_preventive_advice: string[]
  optimizer_disclaimer: string
}

// ─── Root-Cause Diagnostic Reasoning Types ───────────────────────────────────
export interface DiagnosticHypothesisItem {
  cause_name: string
  cause_category: string
  probability_rank: number
  confidence_level: 'high_suspicion' | 'moderate_suspicion' | 'unlikely' | string
  supporting_evidence: string[]
  contradicting_evidence: string[]
  missing_critical_data: string[]
  suggested_field_verification: string
  safer_agronomic_step: string
}

export interface DiagnosticQuestionItem {
  question_id: string
  question_text: string
  options: string[]
  reasoning_purpose: string
}

export interface DiagnosticEvaluatePayload {
  field_id?: number | null
  crop_name: string
  growth_stage: string
  visible_symptoms: string
  distribution_pattern: string
  recent_rainfall_or_irrigation: string
  soil_texture?: string
  foliar_color_pattern?: string
  answered_questions?: Record<string, string>
}

export interface DiagnosticEvaluateResult {
  crop_name: string
  growth_stage: string
  hypotheses: DiagnosticHypothesisItem[]
  next_follow_up_questions: DiagnosticQuestionItem[]
  uncertainty_level: 'adequate_preliminary' | 'high_uncertainty' | string
  guidance_note: string
  safety_protocol_note: string
}

// ─── Farmer Decision Memory & Autopsy Types ──────────────────────────────────
export interface FarmerDecisionLogRecord {
  id: number
  user_id?: number | null
  field_id?: number | null
  zone_id?: number | null
  crop_name: string
  growth_stage: string
  decision_title: string
  scenario_type: string
  action_category: string
  budget_spent: number
  water_used_liters: number
  initial_risk_score?: number | null
  subsequent_risk_score?: number | null
  predicted_outcome: string
  observed_outcome: string
  outcome_rating: 'pending' | 'improved' | 'unchanged' | 'deteriorated' | string
  created_at: string
  follow_up_date?: string | null
}

export interface DecisionLogCreatePayload {
  field_id?: number | null
  zone_id?: number | null
  crop_name: string
  growth_stage: string
  decision_title: string
  scenario_type?: string
  action_category?: string
  budget_spent?: number
  water_used_liters?: number
  initial_risk_score?: number | null
  predicted_outcome?: string
  follow_up_date?: string | null
}

export interface AutopsyEventItem {
  timestamp: string
  event_type: string
  title: string
  details: string
  severity: 'info' | 'watch' | 'high' | 'healthy' | string
  provenance: string
}

export interface AutopsyTimelineResponse {
  field_id: number
  field_name: string
  crop_type: string
  growth_stage: string
  total_events: number
  timeline: AutopsyEventItem[]
  autopsy_summary: string
}

// ─── Crop Variety & Stress Trend Types ───────────────────────────────────────
export interface VarietyComparisonItem {
  crop_name: string
  crop_group: string
  category: string
  indicative_temperature_c: string
  indicative_soil_ph: string
  indicative_annual_rainfall_mm: string
  stress_watchouts: string
  confidence_note: string
  visual_ideal_leaf_colour: string
  field_compatibility_score: number
  compatibility_reasons: string[]
  compatibility_drawbacks: string[]
}

export interface VarietyComparisonResult {
  target_crop: string
  field_conditions: Record<string, any>
  comparison_list: VarietyComparisonItem[]
  disclaimer: string
}

export interface TrendAnomalyItem {
  metric: string
  current_value: number
  unit: string
  historical_rate_of_change: number
  warning_threshold: number
  projected_days_to_threshold?: number | null
  is_anomaly: boolean
  confidence_level: string
  verification_advice: string
}

export interface StressTrendResponse {
  field_id?: number | null
  crop_name: string
  trends: TrendAnomalyItem[]
  data_quality_note: string
}

