from pydantic import BaseModel, Field as PydField, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime


# ─── Health & System Status ──────────────────────────────────────────────────
class HealthStatusOut(BaseModel):
    status: str
    version: str
    database_connected: bool
    ai_provider: str
    ai_model_id: str
    ai_configured: bool
    weather_api_url: str
    weather_thresholds: Dict[str, float]
    timestamp: datetime


# ─── Field Schemas ───────────────────────────────────────────────────────────
class FieldBase(BaseModel):
    name: str = PydField(..., min_length=1, max_length=120)
    crop_type: str = PydField(..., min_length=1, max_length=80)
    area_value: float = PydField(default=1.0, gt=0)
    area_unit: str = PydField(default="hectares")
    location: str = PydField(default="", max_length=200)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    planting_date: Optional[str] = None
    growth_stage: str = PydField(default="Vegetative")
    notes: str = PydField(default="")


class FieldCreate(FieldBase):
    pass


class FieldUpdate(BaseModel):
    name: Optional[str] = None
    crop_type: Optional[str] = None
    area_value: Optional[float] = None
    area_unit: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    planting_date: Optional[str] = None
    growth_stage: Optional[str] = None
    status: Optional[str] = None
    risk_level: Optional[str] = None
    notes: Optional[str] = None


class FieldOut(BaseModel):
    id: int
    name: str
    crop_type: str
    area_value: float
    area_unit: str
    location: str
    latitude: Optional[float]
    longitude: Optional[float]
    planting_date: Optional[str]
    growth_stage: str
    status: str
    risk_level: str
    ndvi: float
    notes: str
    last_assessment: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Risk Factor & Evidence Schemas ──────────────────────────────────────────
class RiskFactorItem(BaseModel):
    factor: str
    source: str  # "AI Model" | "Rule Engine" | "Live Weather API" | "User Observation" | "Missing Data"
    impact: str  # "low" | "moderate" | "high" | "uncertainty"
    detail: str


class EvidenceOut(BaseModel):
    id: int
    field_id: Optional[int]
    field_name: Optional[str] = None
    assessment_id: Optional[int]
    recommendation_text: str
    supporting_evidence: str
    evidence_source: str
    confidence_label: Optional[str]
    data_gaps: str
    verification_steps: str
    created_at: datetime


# ─── Assessment & Disease Analysis Schemas ───────────────────────────────────
class ModelPredictionItem(BaseModel):
    label: str
    confidence: float


class AssessmentOut(BaseModel):
    id: int
    field_id: Optional[int]
    field_name: Optional[str] = None
    crop_type: str
    growth_stage: str
    image_filename: Optional[str]
    analysis_status: str  # "completed" | "unavailable" | "observation_only" | "error"
    predicted_condition: Optional[str]
    model_confidence: Optional[float]
    raw_predictions: List[ModelPredictionItem] = []
    visual_symptoms: List[str]
    severity: str
    risk_category: str
    risk_score: Optional[float]
    scoring_method_note: str
    risk_factors: List[RiskFactorItem]
    recommended_next_steps: List[str]
    preventive_measures: List[str]
    expert_confirmation_needed: bool
    model_provider: Optional[str]
    model_id: Optional[str]
    disclaimer: str
    troubleshooting_hint: Optional[str] = None
    user_notes: str
    data_completeness_pct: float
    missing_data: List[str]
    is_demo: bool
    created_at: datetime


# ─── Weather Schemas ─────────────────────────────────────────────────────────
class GeoLocationResult(BaseModel):
    id: int
    name: str
    latitude: float
    longitude: float
    country: str
    admin1: Optional[str] = None
    timezone: Optional[str] = None


class CurrentWeatherBlock(BaseModel):
    temperature_c: Optional[float] = None
    relative_humidity_pct: Optional[float] = None
    apparent_temperature_c: Optional[float] = None
    precipitation_mm: Optional[float] = None
    wind_speed_kmh: Optional[float] = None
    weather_code: Optional[int] = None
    weather_label: str = "Unknown"
    time: Optional[str] = None


class DailyForecastItem(BaseModel):
    date: str
    temp_max_c: Optional[float] = None
    temp_min_c: Optional[float] = None
    precipitation_sum_mm: Optional[float] = None
    precipitation_probability_max_pct: Optional[float] = None
    wind_speed_max_kmh: Optional[float] = None
    weather_code: Optional[int] = None
    weather_label: str = "Unknown"


class HourlyForecastItem(BaseModel):
    time: str
    temperature_c: Optional[float] = None
    precipitation_probability_pct: Optional[float] = None
    relative_humidity_pct: Optional[float] = None


class WeatherRiskRuleAlert(BaseModel):
    rule_id: str
    risk_type: str
    severity: str  # "info" | "watch" | "high"
    title: str
    explanation: str
    threshold_used: str
    assumption_note: str


class WeatherForecastResponse(BaseModel):
    location_name: str
    latitude: float
    longitude: float
    timezone: str
    fetched_at: datetime
    current: CurrentWeatherBlock
    daily: List[DailyForecastItem]
    hourly: List[HourlyForecastItem]
    weather_risks: List[WeatherRiskRuleAlert]
    thresholds_config: Dict[str, float]


# ─── Rescue Planner Schemas ──────────────────────────────────────────────────
class RescueTaskCreate(BaseModel):
    field_id: Optional[int] = None
    assessment_id: Optional[int] = None
    title: str = PydField(..., min_length=1, max_length=250)
    reason: str = PydField(..., min_length=1)
    evidence_source: str = "User / Agronomist"
    urgency: str = "medium"
    due_date: Optional[str] = None


class RescueTaskUpdate(BaseModel):
    title: Optional[str] = None
    reason: Optional[str] = None
    urgency: Optional[str] = None
    status: Optional[str] = None
    completion_notes: Optional[str] = None
    due_date: Optional[str] = None


class RescueTaskOut(BaseModel):
    id: int
    field_id: Optional[int]
    field_name: Optional[str] = None
    assessment_id: Optional[int]
    title: str
    reason: str
    evidence_source: str
    urgency: str
    status: str
    completion_notes: str
    due_date: Optional[str]
    created_at: datetime
    updated_at: datetime


# ─── Budget Manthan Schemas ──────────────────────────────────────────────────
class BudgetItemCreate(BaseModel):
    field_id: Optional[int] = None
    category: str = PydField(..., min_length=1, max_length=60)
    item_name: str = PydField(..., min_length=1, max_length=180)
    planned_cost: float = PydField(..., ge=0)
    actual_cost: float = PydField(default=0.0, ge=0)
    notes: str = ""
    expense_date: Optional[str] = None


class BudgetItemUpdate(BaseModel):
    field_id: Optional[int] = None
    category: Optional[str] = None
    item_name: Optional[str] = None
    planned_cost: Optional[float] = PydField(default=None, ge=0)
    actual_cost: Optional[float] = PydField(default=None, ge=0)
    notes: Optional[str] = None
    expense_date: Optional[str] = None


class BudgetItemOut(BaseModel):
    id: int
    field_id: Optional[int]
    field_name: Optional[str] = None
    category: str
    item_name: str
    planned_cost: float
    actual_cost: float
    variance: float
    notes: str
    expense_date: Optional[str]
    created_at: datetime


class BudgetSummaryOut(BaseModel):
    total_planned: float
    total_actual: float
    remaining_budget: float
    variance: float
    items: List[BudgetItemOut]
    by_category: List[Dict[str, Any]]
    profitability_note: str


# ─── What-If Simulator Schemas ───────────────────────────────────────────────
class SimulatorRunRequest(BaseModel):
    name: str = "Scenario Analysis"
    field_id: Optional[int] = None
    crop_type: str = "Wheat"
    expected_rainfall_mm: float = PydField(default=120.0, ge=0)
    temp_assumption_c: float = PydField(default=26.0, ge=-20, le=60)
    irrigation_available: bool = True
    estimated_loss_pct: float = PydField(default=10.0, ge=0, le=100)
    input_cost: float = PydField(..., ge=0)
    expected_yield_units: float = PydField(..., ge=0)
    yield_unit: str = "quintals"
    sale_price_per_unit: float = PydField(..., ge=0)
    save_scenario: bool = True


class SensitivityPoint(BaseModel):
    loss_pct: float
    adjusted_yield: float
    estimated_revenue: float
    estimated_profit: float


class SimulatorRunResponse(BaseModel):
    id: Optional[int] = None
    name: str
    field_id: Optional[int]
    crop_type: str
    assumptions: Dict[str, Any]
    formulas_used: List[str]
    baseline_revenue: float
    adjusted_yield: float
    estimated_revenue: float
    estimated_cost: float
    estimated_profit: float
    potential_loss_amount: float
    weather_stress_modifier_note: str
    sensitivity_curve: List[SensitivityPoint]
    disclaimer: str
    created_at: datetime


# ─── Authentication & Farmer Onboarding Schemas ──────────────────────────────
class UserSignupRequest(BaseModel):
    full_name: str = PydField(..., min_length=2, max_length=120)
    email: str = PydField(..., min_length=5, max_length=180)
    mobile_number: str = PydField(..., min_length=10, max_length=20)
    password: str = PydField(..., min_length=6, max_length=128)
    preferred_language: str = PydField(default="en")


class UserLoginRequest(BaseModel):
    email: str = PydField(..., min_length=3, max_length=180)
    password: str = PydField(..., min_length=1, max_length=128)


class UserLanguageUpdate(BaseModel):
    preferred_language: str = PydField(..., pattern="^(en|hi)$")


class UserOut(BaseModel):
    id: int
    full_name: str
    email: str
    mobile_number: str
    preferred_language: str
    created_at: datetime

    model_config = {"from_attributes": True}


class FarmerProfileUpsert(BaseModel):
    farmer_name: str = PydField(..., min_length=2, max_length=120)
    mobile_number: str = PydField(..., min_length=10, max_length=20)
    state: str = PydField(..., min_length=2, max_length=100)
    district: str = PydField(..., min_length=2, max_length=100)
    village_town: str = PydField(default="", max_length=120)
    total_land_acres: float = PydField(..., gt=0, le=50000)
    soil_type: str = PydField(..., min_length=2, max_length=80)
    irrigation_source: str = PydField(..., min_length=2, max_length=80)
    main_crop: str = PydField(..., min_length=2, max_length=80)
    growing_season: str = PydField(..., min_length=2, max_length=60)
    budget_per_acre: float = PydField(default=0.0, ge=0)
    preferred_language: str = PydField(default="en")


class FarmerProfileOut(BaseModel):
    id: int
    user_id: int
    farmer_name: str
    mobile_number: str
    state: str
    district: str
    village_town: str
    total_land_acres: float
    soil_type: str
    irrigation_source: str
    main_crop: str
    growing_season: str
    budget_per_acre: float
    preferred_language: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CropRecordOut(BaseModel):
    id: int
    user_id: int
    field_id: Optional[int] = None
    crop_name: str
    crop_variety: str
    field_location: str
    sowing_date: str
    growth_stage: str
    growth_progress_pct: float
    irrigation_method: str
    recent_rainfall_mm: Optional[float] = None
    soil_moisture_pct: Optional[float] = None
    field_temperature_c: Optional[float] = None
    humidity_pct: Optional[float] = None
    fertilizer_used: str
    pesticide_used: str
    image_filename: Optional[str] = None
    image_url: Optional[str] = None
    visible_symptoms: str
    latest_assessment_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AuthSessionResponse(BaseModel):
    token: str
    user: UserOut
    has_farmer_profile: bool
    has_crop_record: bool
    farmer_profile: Optional[FarmerProfileOut] = None
    latest_crop: Optional[CropRecordOut] = None


# ─── Field Zone Schemas ──────────────────────────────────────────────────────
class FieldZoneBase(BaseModel):
    zone_name: str = PydField(..., min_length=1, max_length=100)
    area_acres: float = PydField(default=0.5, gt=0)
    crop_stage: str = PydField(default="Vegetative")
    soil_moisture_pct: Optional[float] = None
    soil_ph: Optional[float] = None
    drainage_quality: str = PydField(default="Good")
    microclimate_note: str = PydField(default="")
    risk_level: str = PydField(default="low")


class FieldZoneCreate(FieldZoneBase):
    field_id: int


class FieldZoneUpdate(BaseModel):
    zone_name: Optional[str] = None
    area_acres: Optional[float] = None
    crop_stage: Optional[str] = None
    soil_moisture_pct: Optional[float] = None
    soil_ph: Optional[float] = None
    drainage_quality: Optional[str] = None
    microclimate_note: Optional[str] = None
    risk_level: Optional[str] = None


class FieldZoneOut(FieldZoneBase):
    id: int
    field_id: int
    last_inspected: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Butterfly Effect Combined Risk Schemas ──────────────────────────────────
class ButterflyRiskItem(BaseModel):
    rule_id: str
    risk_type: str
    severity: str  # "high" | "watch" | "advisory"
    title: str
    compounding_factors: List[str]
    explanation: str
    thresholds_applied: str
    recommended_action: str
    evidence_quality: str  # "strong" | "limited" | "conflicting" | "insufficient"
    missing_measurements: List[str] = []


class ButterflyRiskEvaluationOut(BaseModel):
    overall_status: str  # "critical" | "warning" | "stable"
    combined_risk_score: float  # 0-100 rubric
    compounding_alerts: List[ButterflyRiskItem]
    crop_name: str
    growth_stage: str
    environmental_snapshot: Dict[str, Any]
    uncertainty_notes: List[str]
    data_provenance: Dict[str, str]


# ─── Decision Lab & Parallel Universe Schemas ────────────────────────────────
class ScenarioDetail(BaseModel):
    scenario_id: str  # "A_CURRENT", "B_RECOMMENDED", "C_ADVERSE"
    title: str
    description: str
    projected_risk_score: float
    risk_category: str  # "low" | "watch" | "high-risk"
    estimated_yield_loss_pct: float
    adjusted_yield: float
    estimated_revenue: float
    estimated_profit: float
    intervention_cost: float
    water_required_liters: float
    top_contributing_factors: List[str]
    evidence_quality: str
    key_assumptions: List[str]
    missing_data_warnings: List[str]


class DecisionLabRunRequest(BaseModel):
    field_id: Optional[int] = None
    zone_id: Optional[int] = None
    crop_name: str = "Wheat"
    crop_variety: str = ""
    growth_stage: str = "Vegetative"
    total_area_acres: float = 1.0
    expected_yield_per_acre: float = 20.0
    yield_unit: str = "quintals"
    sale_price_per_unit: float = 2275.0
    baseline_input_cost: float = 25000.0
    current_soil_moisture_pct: Optional[float] = 32.0
    current_temp_c: Optional[float] = 28.0
    forecast_rainfall_3d_mm: Optional[float] = 10.0
    available_water_liters: float = 10000.0
    available_budget: float = 15000.0
    hypothetical_temp_delta_c: float = 4.0
    hypothetical_rain_multiplier: float = 0.5


class DecisionLabRunResponse(BaseModel):
    crop_name: str
    growth_stage: str
    baseline_revenue: float
    scenario_a_current: ScenarioDetail
    scenario_b_recommended: ScenarioDetail
    scenario_c_adverse: ScenarioDetail
    comparison_summary: str
    what_changed_explanation: str
    recommended_decision_rationale: str
    data_provenance: Dict[str, str]
    created_at: datetime


# ─── Resource-Aware Rescue Optimizer Schemas ─────────────────────────────────
class RescueInterventionOption(BaseModel):
    action_id: str
    title: str
    category: str  # "cultural" | "irrigation" | "monitoring" | "nutrition" | "protection"
    estimated_cost_inr: float
    water_required_liters: float
    labor_hours: float
    equipment_needed: str
    purpose: str
    direction_of_effect: str
    potential_tradeoffs: str
    is_zero_budget_feasible: bool
    safety_compliance: bool
    evidence_quality: str
    rank_score: float
    selection_rationale: str


class RescueOptimizerRequest(BaseModel):
    field_id: Optional[int] = None
    crop_name: str = "Wheat"
    growth_stage: str = "Vegetative"
    active_risk_type: str = "general_stress"
    available_budget_inr: float = 10000.0
    available_water_liters: float = 5000.0
    available_labor_hours: float = 8.0
    zero_budget_only: bool = False
    existing_supplies: List[str] = []


class RescueOptimizerResponse(BaseModel):
    mode: str  # "constrained_budget" | "zero_budget"
    available_budget_inr: float
    available_water_liters: float
    ranked_options: List[RescueInterventionOption]
    infeasible_options_excluded: List[str]
    zero_budget_preventive_advice: List[str]
    optimizer_disclaimer: str


# ─── Root-Cause Diagnostic Reasoning Schemas ─────────────────────────────────
class DiagnosticHypothesisItem(BaseModel):
    cause_name: str
    cause_category: str  # "fungal_pathogen" | "bacterial_pathogen" | "viral_vector" | "nutrient_deficiency" | "water_stress" | "thermal_injury"
    probability_rank: int
    confidence_level: str  # "high_suspicion" | "moderate_suspicion" | "unlikely"
    supporting_evidence: List[str]
    contradicting_evidence: List[str]
    missing_critical_data: List[str]
    suggested_field_verification: str
    safer_agronomic_step: str


class DiagnosticFollowUpQuestion(BaseModel):
    question_id: str
    question_text: str
    options: List[str]
    reasoning_purpose: str


class DiagnosticEvaluateRequest(BaseModel):
    field_id: Optional[int] = None
    crop_name: str = "Tomato"
    growth_stage: str = "Vegetative"
    visible_symptoms: str
    distribution_pattern: str = "focal_patches"  # "uniform_whole_field" | "focal_patches" | "lower_canopy_only" | "new_leaves_only"
    recent_rainfall_or_irrigation: str = "normal"  # "heavy_rain" | "prolonged_drought" | "normal" | "waterlogged"
    soil_texture: str = "Loam"
    foliar_color_pattern: str = "yellowing_with_spots"
    answered_questions: Dict[str, str] = {}


class DiagnosticEvaluateResponse(BaseModel):
    crop_name: str
    growth_stage: str
    hypotheses: List[DiagnosticHypothesisItem]
    next_follow_up_questions: List[DiagnosticFollowUpQuestion]
    uncertainty_level: str  # "adequate_preliminary" | "high_uncertainty"
    guidance_note: str
    safety_protocol_note: str


# ─── Farmer Decision Memory Schemas ──────────────────────────────────────────
class DecisionLogCreate(BaseModel):
    field_id: Optional[int] = None
    zone_id: Optional[int] = None
    crop_name: str
    growth_stage: str
    decision_title: str
    scenario_type: str = "recommended"
    action_category: str = "monitoring"
    budget_spent: float = 0.0
    water_used_liters: float = 0.0
    initial_risk_score: Optional[float] = None
    predicted_outcome: str = ""
    follow_up_date: Optional[str] = None


class DecisionLogOut(BaseModel):
    id: int
    user_id: Optional[int]
    field_id: Optional[int]
    zone_id: Optional[int]
    crop_name: str
    growth_stage: str
    decision_title: str
    scenario_type: str
    action_category: str
    budget_spent: float
    water_used_liters: float
    initial_risk_score: Optional[float]
    subsequent_risk_score: Optional[float]
    predicted_outcome: str
    observed_outcome: str
    outcome_rating: str
    created_at: datetime
    follow_up_date: Optional[str]

    model_config = {"from_attributes": True}


class DecisionOutcomeUpdateRequest(BaseModel):
    observed_outcome: str
    outcome_rating: str  # "improved" | "unchanged" | "deteriorated"
    subsequent_risk_score: Optional[float] = None


# ─── Crop Variety Intelligence Schemas ───────────────────────────────────────
class VarietyComparisonItem(BaseModel):
    crop_name: str
    crop_group: str
    category: str
    indicative_temperature_c: str
    indicative_soil_ph: str
    indicative_annual_rainfall_mm: str
    stress_watchouts: str
    confidence_note: str
    visual_ideal_leaf_colour: str
    field_compatibility_score: float  # 0-100
    compatibility_reasons: List[str]
    compatibility_drawbacks: List[str]


class VarietyComparisonResponse(BaseModel):
    target_crop: str
    field_conditions: Dict[str, Any]
    comparison_list: List[VarietyComparisonItem]
    disclaimer: str


# ─── Stress Trend & Anomaly Schemas ──────────────────────────────────────────
class TrendAnomalyItem(BaseModel):
    metric: str
    current_value: float
    unit: str
    historical_rate_of_change: float  # e.g. -2.5% per day
    warning_threshold: float
    projected_days_to_threshold: Optional[float]
    is_anomaly: bool
    confidence_level: str
    verification_advice: str


class StressTrendResponse(BaseModel):
    field_id: Optional[int]
    crop_name: str
    trends: List[TrendAnomalyItem]
    data_quality_note: str

