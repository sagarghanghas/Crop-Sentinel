"""
Transparent Risk Assessment Engine.
Combines available inputs:
  1. Genuine AI analysis results (when available)
  2. Crop type & growth stage
  3. User-entered field observations / symptoms
  4. Weather forecast summary (when provided)
Explicitly tracks missing data and reduces certainty when inputs are incomplete.
"""
from typing import List, Dict, Any, Optional
from app.schemas import RiskFactorItem
from app.services.crop_suitability_model import find_crop_profile

SCORING_METHOD_DOCUMENTATION = (
    "Documented Additive Risk Rubric (0–100 scale): "
    "Base risk = 15 pts. "
    "AI classification contribution = 0–45 pts (weighted by genuine model confidence; 0 if healthy or unavailable). "
    "User-observed symptoms contribution = 0–25 pts. "
    "Growth-stage sensitivity (Flowering / Fruiting) = +10 pts if stress/symptoms present. "
    "Weather stress alerts = 0–15 pts. "
    "Categories: 0–34 Low/Healthy, 35–64 Watch/Moderate, 65–100 High-Risk."
)


def compute_transparent_risk(
    crop_type: str,
    growth_stage: str,
    ai_result: Dict[str, Any],
    user_notes: str = "",
    weather_summary: Optional[Dict[str, Any]] = None,
    field_linked: bool = False,
) -> Dict[str, Any]:
    factors: List[RiskFactorItem] = []
    missing_data: List[str] = []
    available_inputs = 0
    total_expected_inputs = 5  # Field link, Growth stage, AI result, User observation, Weather context

    score = 15.0  # Baseline operational risk

    # 1. Field context check
    if field_linked:
        available_inputs += 1
    else:
        missing_data.append("No specific field record linked (location & historical trend unavailable)")

    # 2. Growth stage check
    if growth_stage and growth_stage.strip():
        available_inputs += 1
    else:
        missing_data.append("Crop growth stage not specified")

    # 3. AI Model Output evaluation
    status = ai_result.get("analysis_status", "unavailable")
    pred = ai_result.get("predicted_condition")
    conf = ai_result.get("model_confidence")

    if status == "completed" and pred:
        available_inputs += 1
        is_healthy = "healthy" in pred.lower()
        if is_healthy:
            score = max(10.0, score - 5.0)
            factors.append(
                RiskFactorItem(
                    factor=f"AI Classification: {pred}",
                    source="AI Model",
                    impact="low",
                    detail=f"Model predicted healthy foliage (confidence: {round((conf or 0)*100, 1)}%).",
                )
            )
        else:
            conf_val = conf if conf is not None else 0.5
            ai_points = round(min(45.0, 20.0 + conf_val * 25.0), 1)
            score += ai_points
            factors.append(
                RiskFactorItem(
                    factor=f"AI Classification: {pred}",
                    source="AI Model",
                    impact="high" if conf_val >= 0.65 else "moderate",
                    detail=(
                        f"Model predicted '{pred}' with {round(conf_val * 100, 1)}% confidence "
                        f"(+{ai_points} rubric pts). Preliminary image signal requiring field verification."
                    ),
                )
            )
    else:
        missing_data.append("Live AI image classification unavailable (unconfigured key or provider unreachable)")
        factors.append(
            RiskFactorItem(
                factor="AI Image Inference Unavailable",
                source="Missing Data",
                impact="uncertainty",
                detail="Risk score relies only on user observations, growth stage, and rule-based checks.",
            )
        )

    # 4. User-entered symptoms / observations
    notes_clean = (user_notes or "").strip()
    if notes_clean:
        available_inputs += 1
        lower_notes = notes_clean.lower()
        stress_keywords = ["yellow", "spot", "wilt", "curl", "rot", "rust", "blight", "lesion", "dry", "pest", "mold"]
        matched = [kw for kw in stress_keywords if kw in lower_notes]
        if matched:
            obs_pts = min(25.0, 12.0 + len(matched) * 4.0)
            score += obs_pts
            factors.append(
                RiskFactorItem(
                    factor=f"User-Observed Symptoms ({', '.join(matched[:4])})",
                    source="User Observation",
                    impact="high" if len(matched) >= 2 else "moderate",
                    detail=f"Field notes report visible stress indicators (+{obs_pts} rubric pts): '{notes_clean[:120]}'",
                )
            )
        else:
            factors.append(
                RiskFactorItem(
                    factor="User Field Notes Recorded",
                    source="User Observation",
                    impact="low",
                    detail=f"Notes logged without high-risk symptom keywords: '{notes_clean[:120]}'",
                )
            )
    else:
        missing_data.append("No manual field observations or physical symptom notes entered")

    # 5. Growth Stage sensitivity rule
    sensitive_stages = {"flowering", "fruiting", "grain fill", "fruiting/grain fill", "seedling"}
    if growth_stage.lower() in sensitive_stages and score > 20.0:
        score += 10.0
        factors.append(
            RiskFactorItem(
                factor=f"Sensitive Growth Stage ({growth_stage})",
                source="Rule Engine",
                impact="moderate",
                detail=f"{crop_type} at '{growth_stage}' stage has heightened sensitivity to foliar or moisture stress (+10 rubric pts).",
            )
        )

    # 5b. Trained 182-Crop Reference Catalogue (FAO EcoCrop / ICAR) screening
    crop_ref = find_crop_profile(crop_type)
    if crop_ref:
        factors.append(
            RiskFactorItem(
                factor=f"Crop Reference Profile: {crop_ref['crop']} ({crop_ref['crop_group']})",
                source=crop_ref["reference_basis"],
                impact="low",
                detail=(
                    f"Indicative Temp: {crop_ref['indicative_temperature_c']}°C | "
                    f"Soil pH: {crop_ref['indicative_soil_ph']} | "
                    f"Rainfall: {crop_ref['indicative_annual_rainfall_mm']} mm | "
                    f"Watchouts: {crop_ref['stress_watchouts']}. "
                    f"Note: {crop_ref['confidence_note']}"
                ),
            )
        )

    # 6. Weather context check
    if weather_summary and weather_summary.get("alerts"):
        available_inputs += 1
        w_alerts = weather_summary.get("alerts", [])
        high_w = [a for a in w_alerts if a.get("severity") in ("high", "watch")]
        if high_w:
            w_pts = 15.0 if any(a.get("severity") == "high" for a in high_w) else 8.0
            score += w_pts
            factors.append(
                RiskFactorItem(
                    factor="Adverse Weather Forecast Alert",
                    source="Live Weather API",
                    impact="moderate",
                    detail=f"Active Open-Meteo rule alert ({high_w[0].get('title', 'Weather watch')}) (+{w_pts} rubric pts).",
                )
            )
    else:
        missing_data.append("Live local weather forecast not attached to this assessment")

    final_score = round(min(100.0, max(0.0, score)), 1)
    if final_score >= 65.0:
        category = "high-risk"
    elif final_score >= 35.0:
        category = "watch"
    else:
        category = "healthy"

    completeness_pct = round((available_inputs / total_expected_inputs) * 100.0, 0)

    return {
        "risk_category": category,
        "risk_score": final_score,
        "scoring_method_note": SCORING_METHOD_DOCUMENTATION,
        "risk_factors": factors,
        "data_completeness_pct": completeness_pct,
        "missing_data": missing_data,
    }
