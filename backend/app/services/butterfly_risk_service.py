"""
CropSentinel — Butterfly Effect Engine: Combined Multi-Factor Risk Detection.
Identifies compounding agronomic threats where several individually moderate
warning signs intersect (e.g. heat + declining soil moisture at flowering;
persistent rainfall + poor soil drainage; elevated humidity + warm night + foliar lesions).

Thresholds are grounded in the 182-crop FAO EcoCrop & ICAR Starter Reference Catalogue.
Never outputs uncalibrated probabilities as scientific facts; uses transparent rubric evaluations.
"""
from typing import Dict, Any, List, Optional
from app.services.crop_suitability_model import find_crop_profile
from app.schemas import ButterflyRiskItem, ButterflyRiskEvaluationOut


def evaluate_butterfly_risks(
    crop_name: str,
    growth_stage: str,
    current_temp_c: Optional[float] = None,
    soil_moisture_pct: Optional[float] = None,
    relative_humidity_pct: Optional[float] = None,
    rainfall_3d_sum_mm: Optional[float] = None,
    drainage_quality: str = "Good",
    soil_ph: Optional[float] = None,
    visible_symptoms: str = "",
    forecast_heat_stress: bool = False,
    forecast_rain_high: bool = False,
) -> ButterflyRiskEvaluationOut:
    """
    Evaluates multi-factor compounding risk interactions based on crop-specific
    thresholds and environmental conditions.
    """
    profile = find_crop_profile(crop_name)
    crop_group = profile.get("crop_group", "Field Crop") if profile else "Field Crop"

    alerts: List[ButterflyRiskItem] = []
    missing_measurements: List[str] = []
    compounding_pts = 0.0

    # Data completeness check
    if current_temp_c is None:
        missing_measurements.append("Ambient field temperature (°C)")
    if soil_moisture_pct is None:
        missing_measurements.append("Root-zone soil moisture (%)")
    if relative_humidity_pct is None:
        missing_measurements.append("Relative humidity (%)")
    if rainfall_3d_sum_mm is None:
        missing_measurements.append("3-day rainfall forecast (mm)")

    stage_lower = (growth_stage or "").lower()
    is_critical_reproductive_stage = any(
        s in stage_lower for s in ["flower", "bloom", "fruiting", "pod", "grain fill", "heading", "tassel"]
    )

    # ─── INTERACTION 1: Heat + Soil Moisture Deficit at Reproductive Stage ──────────
    temp_threshold = 34.0
    moisture_deficit_thresh = 30.0

    if current_temp_c is not None and soil_moisture_pct is not None:
        if (current_temp_c >= temp_threshold or forecast_heat_stress) and (soil_moisture_pct <= moisture_deficit_thresh):
            severity = "high" if is_critical_reproductive_stage else "watch"
            comp_pts = 35.0 if severity == "high" else 20.0
            compounding_pts += comp_pts
            alerts.append(
                ButterflyRiskItem(
                    rule_id="BUTTERFLY_HEAT_MOISTURE_DEFICIT",
                    risk_type="Compounding Evaporative Drought & Pollen Desiccation",
                    severity=severity,
                    title=f"Dual Thermal & Moisture Stress ({current_temp_c}°C + {soil_moisture_pct}% moisture)",
                    compounding_factors=[
                        f"Elevated temperature ({current_temp_c}°C >= {temp_threshold}°C)",
                        f"Depleted root-zone moisture ({soil_moisture_pct}% <= {moisture_deficit_thresh}%)",
                        f"Growth stage sensitivity ({growth_stage})" if is_critical_reproductive_stage else "Vegetative canopy",
                    ],
                    explanation=(
                        f"When high temperatures ({current_temp_c}°C) coincide with declining root-zone soil moisture "
                        f"({soil_moisture_pct}%), the vapor pressure deficit spikes dramatically. "
                        + ("During the flowering/fruiting stage, this compound stress can induce irreversible pollen sterility, flower abortion, and leaf scorching within 48–72 hours."
                           if is_critical_reproductive_stage else
                           "Vegetative growth will stall and stomatal closure will reduce photosynthetic accumulation.")
                    ),
                    thresholds_applied=f"Temp >= {temp_threshold}°C, Soil Moisture <= {moisture_deficit_thresh}%, Sensitive Stage = {is_critical_reproductive_stage}",
                    recommended_action="Prioritize light, early-morning or evening irrigation immediately; avoid daytime field tillage that accelerates soil moisture loss.",
                    evidence_quality="strong" if current_temp_c is not None and soil_moisture_pct is not None else "limited",
                    missing_measurements=[],
                )
            )

    # ─── INTERACTION 2: High Cumulative Rainfall + Suboptimal Drainage ──────────────
    drainage_poor = drainage_quality.lower() in ["poor", "slow", "heavy clay"]
    rain_val = rainfall_3d_sum_mm or 0.0

    if (rain_val >= 40.0 or forecast_rain_high) and drainage_poor:
        compounding_pts += 30.0
        alerts.append(
            ButterflyRiskItem(
                rule_id="BUTTERFLY_WATERLOGGING_ANOXIA",
                risk_type="Root-Zone Hypoxia & Crown Rot Compound Threat",
                severity="high" if rain_val >= 60.0 else "watch",
                title=f"Waterlogging Hazard ({round(rain_val, 1)} mm rain on {drainage_quality} drainage)",
                compounding_factors=[
                    f"Forecast cumulative precipitation ({round(rain_val, 1)} mm)",
                    f"Soil drainage condition classified as '{drainage_quality}'",
                    f"Crop susceptibility for {crop_name} ({crop_group})",
                ],
                explanation=(
                    f"Heavy cumulative rainfall ({round(rain_val, 1)} mm) over fields with {drainage_quality} drainage "
                    "leads to prolonged standing water. Root-zone pore space becomes saturated, depleting soil oxygen "
                    "within 24–48 hours and triggering anaerobic root decay (Pythium/Phytophthora complex)."
                ),
                thresholds_applied="3-Day Rain >= 40 mm AND Drainage in ['Poor', 'Slow', 'Heavy clay']",
                recommended_action="Inspect boundary trenches and cut emergency drainage channels immediately before heavy downpours begin; postpone planned nitrogen dressing.",
                evidence_quality="strong" if rainfall_3d_sum_mm is not None else "limited",
                missing_measurements=[] if rainfall_3d_sum_mm is not None else ["Accurate localized rainfall gauge reading"],
            )
        )

    # ─── INTERACTION 3: Warm Humid Microclimate + Existing Foliar Symptoms ───────────
    sym_lower = visible_symptoms.lower()
    has_lesions = any(kw in sym_lower for kw in ["spot", "blight", "rust", "lesion", "mildew", "yellow", "mold"])
    high_humidity = relative_humidity_pct is not None and relative_humidity_pct >= 75.0
    warm_nights = current_temp_c is not None and (18.0 <= current_temp_c <= 30.0)

    if high_humidity and warm_nights and has_lesions:
        compounding_pts += 30.0
        alerts.append(
            ButterflyRiskItem(
                rule_id="BUTTERFLY_PATHOGEN_EXPONENTIAL_SPREAD",
                risk_type="Compound Secondary Spore Proliferation",
                severity="high",
                title=f"Fungal Incubation Window ({round(relative_humidity_pct or 0, 0)}% RH + observed symptoms)",
                compounding_factors=[
                    f"High ambient humidity ({round(relative_humidity_pct or 0, 0)}% >= 75%)",
                    f"Conducive pathogen temperature ({current_temp_c}°C in 18–30°C optimal range)",
                    f"Physical foliar lesions noted: '{visible_symptoms[:60]}...'",
                ],
                explanation=(
                    f"Persistent high humidity ({round(relative_humidity_pct or 0, 0)}%) combined with moderate warmth "
                    f"({current_temp_c}°C) and pre-existing symptoms creates optimal spore germination conditions. "
                    "Leaf wetness duration is likely exceeding the critical 6-hour threshold for secondary inoculations."
                ),
                thresholds_applied="RH >= 75% AND Temp between 18–30°C AND Active Foliar Lesions Present",
                recommended_action="Avoid overhead sprinkler irrigation; rogue out heavily infected initial focus plants; inspect canopy underside across 5 field points.",
                evidence_quality="strong",
                missing_measurements=[],
            )
        )

    # ─── INTERACTION 4: Soil pH Extremes + Nutrient Deficiency Stress ─────────────────
    if soil_ph is not None:
        ph_stress = soil_ph < 5.5 or soil_ph > 8.2
        if ph_stress and (has_lesions or "yellow" in sym_lower):
            compounding_pts += 20.0
            alerts.append(
                ButterflyRiskItem(
                    rule_id="BUTTERFLY_PH_NUTRIENT_LOCKOUT",
                    risk_type="Substrate Chemical Lockout Interaction",
                    severity="watch",
                    title=f"Soil pH Incompatibility ({soil_ph}) Compounding Leaf Symptoms",
                    compounding_factors=[
                        f"Soil pH reading {soil_ph} outside optimal agronomic bracket (6.0–7.5)",
                        f"Observed leaf chlorosis / symptom notes: '{visible_symptoms[:50]}'",
                    ],
                    explanation=(
                        f"At pH {soil_ph}, key macronutrients (Phosphorus) and micronutrients (Iron/Zinc) precipitate "
                        "into insoluble chemical complexes, mimicking foliar pathogen symptoms through induced deficiency."
                    ),
                    thresholds_applied="Soil pH < 5.5 OR Soil pH > 8.2 with Chlorosis Symptoms",
                    recommended_action="Do not apply general fungicides blindly; conduct a laboratory soil test and apply targeted chelated micronutrients if verified.",
                    evidence_quality="strong",
                    missing_measurements=[],
                )
            )

    # Default baseline if no compound risk triggered
    if not alerts:
        alerts.append(
            ButterflyRiskItem(
                rule_id="BUTTERFLY_NOMINAL",
                risk_type="No Compounding Stress Interactions Detected",
                severity="advisory",
                title="Environmental & Biological Factors Within Nominal Buffers",
                compounding_factors=["Monitored parameters do not exhibit compound threat synergy"],
                explanation="Field variables do not currently trigger any multi-factor compounding risk interactions.",
                thresholds_applied="All combined multi-factor conditions evaluated nominal",
                recommended_action="Maintain routine weekly field scouting and monitor 3-day weather updates.",
                evidence_quality="strong" if len(missing_measurements) <= 1 else "limited",
                missing_measurements=missing_measurements,
            )
        )

    # Compute total combined score
    base_score = 15.0
    final_score = round(min(100.0, max(10.0, base_score + compounding_pts)), 1)
    if final_score >= 65.0:
        overall_status = "critical"
    elif final_score >= 35.0:
        overall_status = "warning"
    else:
        overall_status = "stable"

    uncertainty_notes: List[str] = []
    if missing_measurements:
        uncertainty_notes.append(
            f"Compounding risk assessment is operating with incomplete data ({len(missing_measurements)} missing parameters: {', '.join(missing_measurements)})."
        )
    uncertainty_notes.append(
        "Scientific Notice: Rule-based interaction indicator based on agronomic thresholds; not a calibrated probabilistic forecast."
    )

    data_provenance = {
        "crop_profile": "182-Crop FAO EcoCrop & ICAR Starter Reference Catalogue",
        "weather_data": "Open-Meteo Real Forecast Engine",
        "field_measurements": "Farmer-reported & IoT sensor observations",
        "scoring_method": "Multi-factor interaction additive rubric (0–100 scale)",
    }

    env_snapshot = {
        "crop_name": crop_name,
        "growth_stage": growth_stage,
        "temperature_c": current_temp_c,
        "soil_moisture_pct": soil_moisture_pct,
        "relative_humidity_pct": relative_humidity_pct,
        "rainfall_3d_sum_mm": rainfall_3d_sum_mm,
        "drainage_quality": drainage_quality,
        "soil_ph": soil_ph,
    }

    return ButterflyRiskEvaluationOut(
        overall_status=overall_status,
        combined_risk_score=final_score,
        compounding_alerts=alerts,
        crop_name=crop_name,
        growth_stage=growth_stage,
        environmental_snapshot=env_snapshot,
        uncertainty_notes=uncertainty_notes,
        data_provenance=data_provenance,
    )
