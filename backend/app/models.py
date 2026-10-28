from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id                 = Column(Integer, primary_key=True, index=True)
    full_name          = Column(String(120), nullable=False)
    email              = Column(String(180), unique=True, index=True, nullable=False)
    mobile_number      = Column(String(30), nullable=False)
    password_hash      = Column(String(256), nullable=False)
    preferred_language = Column(String(10), default="en", nullable=False)
    created_at         = Column(DateTime, default=datetime.utcnow)

    farmer_profile     = relationship("FarmerProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    crop_records       = relationship("CropRecord", back_populates="user", cascade="all, delete-orphan")


class FarmerProfile(Base):
    __tablename__ = "farmer_profiles"

    id                 = Column(Integer, primary_key=True, index=True)
    user_id            = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    farmer_name        = Column(String(120), nullable=False)
    mobile_number      = Column(String(30), nullable=False)
    state              = Column(String(100), nullable=False)
    district           = Column(String(100), nullable=False)
    village_town       = Column(String(120), default="")
    total_land_acres   = Column(Float, nullable=False, default=1.0)
    soil_type          = Column(String(80), nullable=False)
    irrigation_source  = Column(String(80), nullable=False)
    main_crop          = Column(String(80), nullable=False)
    growing_season     = Column(String(60), nullable=False)
    budget_per_acre    = Column(Float, default=0.0)
    preferred_language = Column(String(10), default="en", nullable=False)
    created_at         = Column(DateTime, default=datetime.utcnow)
    updated_at         = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user               = relationship("User", back_populates="farmer_profile")


class CropRecord(Base):
    __tablename__ = "crop_records"

    id                   = Column(Integer, primary_key=True, index=True)
    user_id              = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    field_id             = Column(Integer, ForeignKey("fields.id"), nullable=True)

    # Section 1: Crop Information
    crop_name            = Column(String(100), nullable=False)
    crop_variety         = Column(String(120), default="")
    field_location       = Column(String(200), nullable=False)
    sowing_date          = Column(String(30), default="")

    # Section 2: Growth and Irrigation
    growth_stage         = Column(String(60), default="Vegetative")
    growth_progress_pct  = Column(Float, default=25.0)
    irrigation_method    = Column(String(80), default="Drip Irrigation")
    recent_rainfall_mm   = Column(Float, nullable=True)

    # Section 3: Field Conditions
    soil_moisture_pct    = Column(Float, nullable=True)
    field_temperature_c  = Column(Float, nullable=True)
    humidity_pct         = Column(Float, nullable=True)

    # Section 4: Fertilizer and Pesticide
    fertilizer_used      = Column(String(200), default="")
    pesticide_used       = Column(String(200), default="")

    # Section 5: Crop Photograph and Symptoms
    image_filename       = Column(String(255), nullable=True)
    image_url            = Column(String(300), nullable=True)
    visible_symptoms     = Column(Text, default="")
    latest_assessment_id = Column(Integer, ForeignKey("assessments.id"), nullable=True)

    created_at           = Column(DateTime, default=datetime.utcnow)
    updated_at           = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user                 = relationship("User", back_populates="crop_records")


class Field(Base):
    __tablename__ = "fields"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    name            = Column(String(120), nullable=False)
    crop_type       = Column(String(80), nullable=False)
    area_value      = Column(Float, default=1.0, nullable=False)
    area_unit       = Column(String(20), default="hectares", nullable=False)  # hectares | acres
    location        = Column(String(200), default="")
    latitude        = Column(Float, nullable=True)
    longitude       = Column(Float, nullable=True)
    planting_date   = Column(String(30), nullable=True)
    growth_stage    = Column(String(60), default="Vegetative")  # Seedling | Vegetative | Flowering | Fruiting/Grain Fill | Maturity
    status          = Column(String(30), default="healthy")     # healthy | watch | high-risk
    risk_level      = Column(String(30), default="low")         # low | moderate | high
    ndvi            = Column(Float, default=0.72)
    notes           = Column(Text, default="")
    last_assessment = Column(DateTime, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)

    assessments     = relationship("Assessment", back_populates="field", cascade="all, delete-orphan")
    rescue_tasks    = relationship("RescueTask", back_populates="field", cascade="all, delete-orphan")
    budget_items    = relationship("BudgetItem", back_populates="field", cascade="all, delete-orphan")
    evidence_items  = relationship("EvidenceEntry", back_populates="field", cascade="all, delete-orphan")
    zones           = relationship("FieldZone", back_populates="field", cascade="all, delete-orphan")


class Assessment(Base):
    __tablename__ = "assessments"

    id                          = Column(Integer, primary_key=True, index=True)
    field_id                    = Column(Integer, ForeignKey("fields.id"), nullable=True)
    crop_type                   = Column(String(80), nullable=False)
    growth_stage                = Column(String(60), default="Vegetative")
    image_filename              = Column(String(255), nullable=True)
    analysis_status             = Column(String(40), nullable=False)  # completed | unavailable | observation_only | error
    predicted_condition         = Column(String(200), nullable=True)
    model_confidence            = Column(Float, nullable=True)        # None if unavailable
    visual_symptoms_json        = Column(Text, default="[]")
    severity                    = Column(String(40), default="unknown")  # none | mild | moderate | severe | unknown
    risk_category               = Column(String(40), default="watch")    # healthy | watch | high-risk
    risk_score                  = Column(Float, nullable=True)           # 0-100 documented rubric score
    risk_factors_json           = Column(Text, default="[]")
    recommended_next_steps_json = Column(Text, default="[]")
    preventive_measures_json    = Column(Text, default="[]")
    expert_confirmation_needed  = Column(Boolean, default=True)
    model_provider              = Column(String(100), nullable=True)
    model_id                    = Column(String(200), nullable=True)
    disclaimer                  = Column(Text, default="")
    user_notes                  = Column(Text, default="")
    weather_snapshot_json       = Column(Text, default="{}")
    data_completeness_pct       = Column(Float, default=50.0)
    missing_data_json           = Column(Text, default="[]")
    is_demo                     = Column(Boolean, default=False)
    created_at                  = Column(DateTime, default=datetime.utcnow)

    field                       = relationship("Field", back_populates="assessments")


class EvidenceEntry(Base):
    __tablename__ = "evidence_ledger"

    id                   = Column(Integer, primary_key=True, index=True)
    field_id             = Column(Integer, ForeignKey("fields.id"), nullable=True)
    assessment_id        = Column(Integer, ForeignKey("assessments.id"), nullable=True)
    recommendation_text  = Column(Text, nullable=False)
    supporting_evidence  = Column(Text, nullable=False)
    evidence_source      = Column(String(80), nullable=False)  # AI Model | Live Weather API | User Observation | Historical Record | Rule Engine
    confidence_label     = Column(String(60), nullable=True)
    data_gaps            = Column(Text, default="")
    verification_steps   = Column(Text, default="")
    created_at           = Column(DateTime, default=datetime.utcnow)

    field                = relationship("Field", back_populates="evidence_items")


class RescueTask(Base):
    __tablename__ = "rescue_tasks"

    id               = Column(Integer, primary_key=True, index=True)
    field_id         = Column(Integer, ForeignKey("fields.id"), nullable=True)
    assessment_id    = Column(Integer, ForeignKey("assessments.id"), nullable=True)
    title            = Column(String(250), nullable=False)
    reason           = Column(Text, nullable=False)
    evidence_source  = Column(String(100), default="Rule Engine")
    urgency          = Column(String(30), default="medium")   # immediate | high | medium | routine
    status           = Column(String(30), default="pending")  # pending | in_progress | completed
    completion_notes = Column(Text, default="")
    due_date         = Column(String(30), nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    field            = relationship("Field", back_populates="rescue_tasks")


class BudgetItem(Base):
    __tablename__ = "budget_items"

    id           = Column(Integer, primary_key=True, index=True)
    field_id     = Column(Integer, ForeignKey("fields.id"), nullable=True)
    category     = Column(String(60), nullable=False)  # Seeds | Fertilizer | Irrigation | Labor | Equipment | Crop Protection | Other
    item_name    = Column(String(180), nullable=False)
    planned_cost = Column(Float, nullable=False, default=0.0)
    actual_cost  = Column(Float, nullable=False, default=0.0)
    notes        = Column(Text, default="")
    expense_date = Column(String(30), nullable=True)
    created_at   = Column(DateTime, default=datetime.utcnow)

    field        = relationship("Field", back_populates="budget_items")


class SimulationScenario(Base):
    __tablename__ = "simulation_scenarios"

    id                    = Column(Integer, primary_key=True, index=True)
    name                  = Column(String(150), nullable=False)
    field_id              = Column(Integer, ForeignKey("fields.id"), nullable=True)
    crop_type             = Column(String(80), default="Wheat")
    expected_rainfall_mm  = Column(Float, default=120.0)
    temp_assumption_c     = Column(Float, default=26.0)
    irrigation_available  = Column(Boolean, default=True)
    estimated_loss_pct    = Column(Float, default=10.0)
    input_cost            = Column(Float, nullable=False)
    expected_yield_units  = Column(Float, nullable=False)
    yield_unit            = Column(String(30), default="quintals")
    sale_price_per_unit   = Column(Float, nullable=False)
    baseline_revenue      = Column(Float, nullable=False)
    adjusted_yield        = Column(Float, nullable=False)
    estimated_revenue     = Column(Float, nullable=False)
    estimated_profit      = Column(Float, nullable=False)
    potential_loss_amount = Column(Float, nullable=False)
    created_at            = Column(DateTime, default=datetime.utcnow)


class FieldZone(Base):
    __tablename__ = "field_zones"

    id               = Column(Integer, primary_key=True, index=True)
    field_id         = Column(Integer, ForeignKey("fields.id"), nullable=False, index=True)
    zone_name        = Column(String(100), nullable=False)
    area_acres       = Column(Float, default=0.5, nullable=False)
    crop_stage       = Column(String(60), default="Vegetative")
    soil_moisture_pct= Column(Float, nullable=True)
    soil_ph          = Column(Float, nullable=True)
    drainage_quality = Column(String(40), default="Good")  # Good | Moderate | Poor
    microclimate_note= Column(String(200), default="")
    risk_level       = Column(String(30), default="low")   # low | watch | high
    last_inspected   = Column(DateTime, default=datetime.utcnow)
    created_at       = Column(DateTime, default=datetime.utcnow)

    field            = relationship("Field", back_populates="zones")


class FarmerDecisionLog(Base):
    __tablename__ = "farmer_decision_logs"

    id                   = Column(Integer, primary_key=True, index=True)
    user_id              = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    field_id             = Column(Integer, ForeignKey("fields.id"), nullable=True, index=True)
    zone_id              = Column(Integer, ForeignKey("field_zones.id"), nullable=True)
    crop_name            = Column(String(100), default="")
    growth_stage         = Column(String(60), default="")
    decision_title       = Column(String(200), nullable=False)
    scenario_type        = Column(String(50), default="recommended")  # current | recommended | adverse | custom
    action_category      = Column(String(80), default="monitoring")
    budget_spent         = Column(Float, default=0.0)
    water_used_liters    = Column(Float, default=0.0)
    initial_risk_score   = Column(Float, nullable=True)
    subsequent_risk_score= Column(Float, nullable=True)
    predicted_outcome    = Column(Text, default="")
    observed_outcome     = Column(Text, default="")
    outcome_rating       = Column(String(30), default="pending")  # pending | improved | unchanged | deteriorated
    created_at           = Column(DateTime, default=datetime.utcnow)
    follow_up_date       = Column(String(30), nullable=True)


class DiagnosticCase(Base):
    __tablename__ = "diagnostic_cases"

    id                         = Column(Integer, primary_key=True, index=True)
    field_id                   = Column(Integer, ForeignKey("fields.id"), nullable=True, index=True)
    crop_name                  = Column(String(100), nullable=False)
    growth_stage               = Column(String(60), default="Vegetative")
    symptoms_text              = Column(Text, default="")
    differential_hypotheses_json = Column(Text, default="[]")
    follow_up_qas_json         = Column(Text, default="[]")
    primary_diagnosis          = Column(String(180), default="")
    confidence_category        = Column(String(50), default="insufficient_evidence")  # strong | limited | conflicting | insufficient_evidence
    recommended_actions_json   = Column(Text, default="[]")
    created_at                 = Column(DateTime, default=datetime.utcnow)

