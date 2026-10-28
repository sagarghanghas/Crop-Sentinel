"""
POST /api/analysis — Multipart crop leaf image upload & risk assessment endpoint.
- Validates MIME type, non-empty content, image header via Pillow, and max size.
- Runs real AI classification when configured, or returns honest 'unavailable' status.
- Computes transparent risk assessment and persists assessment + traceable evidence ledger entries in SQLite.
"""
import io
import json
import os
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException
from PIL import Image, UnidentifiedImageError
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.database import get_db
from app.models import Field, Assessment, EvidenceEntry
from app.schemas import (
    AssessmentOut,
    ModelPredictionItem,
    RiskFactorItem,
    ButterflyRiskEvaluationOut,
    DiagnosticEvaluateRequest,
    DiagnosticEvaluateResponse,
)
from app.services.disease_service import analyze_crop_image, get_model_specification
from app.services.risk_service import compute_transparent_risk
from app.services.butterfly_risk_service import evaluate_butterfly_risks
from app.services.diagnostic_engine_service import evaluate_root_cause_diagnostics

router = APIRouter(prefix="/analysis", tags=["analysis"])

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}


@router.get("/model-info")
async def get_disease_model_info():
    """
    Returns verified metadata for the configured Hugging Face plant-disease classification model,
    including supported crops, 38 PlantVillage class labels, expected response format, and
    confidence calibration explanation (never exposes HUGGINGFACE_API_KEY).
    """
    return get_model_specification()


@router.post("", response_model=AssessmentOut)
async def analyze_image_endpoint(
    file: UploadFile = File(...),
    crop_type: str = Form(default="Wheat"),
    growth_stage: str = Form(default="Vegetative"),
    field_id: Optional[int] = Form(default=None),
    user_notes: str = Form(default=""),
    db: AsyncSession = Depends(get_db),
):
    # 1. Validate MIME type
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{content_type}'. Allowed formats: JPEG, PNG, WEBP."
        )

    # 2. Read and validate file size
    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image file is empty.")
    if len(raw_bytes) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Image exceeds maximum allowed size ({settings.max_upload_bytes // (1024 * 1024)} MB)."
        )

    # 3. Verify image integrity safely via Pillow without executing content
    try:
        with Image.open(io.BytesIO(raw_bytes)) as img:
            img.verify()
    except (UnidentifiedImageError, Exception):
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is not a valid or intact image."
        )

    safe_filename = os.path.basename(file.filename or "leaf_sample.jpg")[:200]

    # 4. Verify optional field association
    field_obj: Optional[Field] = None
    if field_id is not None:
        field_obj = await db.get(Field, field_id)
        if not field_obj:
            raise HTTPException(status_code=404, detail=f"Selected Field #{field_id} does not exist.")

    # 5. Call real AI inference service
    ai_output = await analyze_crop_image(
        image_bytes=raw_bytes,
        filename=safe_filename,
        crop_type=crop_type,
    )

    # 6. Run transparent risk assessment engine
    risk_eval = compute_transparent_risk(
        crop_type=crop_type,
        growth_stage=growth_stage,
        ai_result=ai_output,
        user_notes=user_notes,
        weather_summary=None,
        field_linked=field_obj is not None,
    )

    # 7. Persist Assessment in SQLite
    record = Assessment(
        field_id=field_obj.id if field_obj else None,
        crop_type=crop_type.strip(),
        growth_stage=growth_stage.strip(),
        image_filename=safe_filename,
        analysis_status=ai_output["analysis_status"],
        predicted_condition=ai_output["predicted_condition"],
        model_confidence=ai_output["model_confidence"],
        visual_symptoms_json=json.dumps(ai_output["visual_symptoms"]),
        severity=ai_output["severity"],
        risk_category=risk_eval["risk_category"],
        risk_score=risk_eval["risk_score"],
        risk_factors_json=json.dumps([f.model_dump() for f in risk_eval["risk_factors"]]),
        recommended_next_steps_json=json.dumps(ai_output["recommended_next_steps"]),
        preventive_measures_json=json.dumps(ai_output["preventive_measures"]),
        expert_confirmation_needed=ai_output["expert_confirmation_needed"],
        model_provider=ai_output["model_provider"],
        model_id=ai_output["model_id"],
        disclaimer=ai_output["disclaimer"],
        user_notes=user_notes.strip(),
        data_completeness_pct=risk_eval["data_completeness_pct"],
        missing_data_json=json.dumps(risk_eval["missing_data"]),
        is_demo=False,
        created_at=datetime.utcnow(),
    )
    db.add(record)
    await db.flush()

    # 8. Update associated field status if linked
    if field_obj:
        field_obj.last_assessment = record.created_at
        field_obj.status = risk_eval["risk_category"]
        field_obj.risk_level = (
            "high" if risk_eval["risk_category"] == "high-risk"
            else "moderate" if risk_eval["risk_category"] == "watch"
            else "low"
        )

    # 9. Record traceable Evidence Ledger entries
    gaps_str = "; ".join(risk_eval["missing_data"]) if risk_eval["missing_data"] else "None"
    if ai_output["analysis_status"] == "completed" and ai_output["predicted_condition"]:
        conf_pct = f"{round((ai_output['model_confidence'] or 0) * 100, 1)}%"
        db.add(
            EvidenceEntry(
                field_id=field_obj.id if field_obj else None,
                assessment_id=record.id,
                recommendation_text=(
                    ai_output["recommended_next_steps"][0]
                    if ai_output["recommended_next_steps"]
                    else f"Verify '{ai_output['predicted_condition']}' in field."
                ),
                supporting_evidence=(
                    f"AI classifier ({ai_output['model_id']}) predicted '{ai_output['predicted_condition']}' "
                    f"with {conf_pct} confidence on image '{safe_filename}'."
                ),
                evidence_source="AI Model",
                confidence_label=f"Model Confidence: {conf_pct}",
                data_gaps=gaps_str,
                verification_steps="Inspect 10–15 plants across field zones and confirm with a local agronomist.",
                created_at=datetime.utcnow(),
            )
        )
    elif user_notes.strip():
        db.add(
            EvidenceEntry(
                field_id=field_obj.id if field_obj else None,
                assessment_id=record.id,
                recommendation_text="Follow up on manual field observation and monitor symptom progression over 48–72h.",
                supporting_evidence=f"User-entered field observation: '{user_notes.strip()[:160]}'",
                evidence_source="User Observation",
                confidence_label="Manual Observation (AI unconfigured/unavailable)",
                data_gaps=gaps_str,
                verification_steps="Compare affected foliage against healthy reference plants and consult extension services.",
                created_at=datetime.utcnow(),
            )
        )

    await db.commit()
    await db.refresh(record)

    return AssessmentOut(
        id=record.id,
        field_id=record.field_id,
        field_name=field_obj.name if field_obj else None,
        crop_type=record.crop_type,
        growth_stage=record.growth_stage,
        image_filename=record.image_filename,
        analysis_status=record.analysis_status,
        predicted_condition=record.predicted_condition,
        model_confidence=record.model_confidence,
        raw_predictions=[ModelPredictionItem(**p) for p in ai_output.get("raw_predictions", [])],
        visual_symptoms=json.loads(record.visual_symptoms_json),
        severity=record.severity,
        risk_category=record.risk_category,
        risk_score=record.risk_score,
        scoring_method_note=risk_eval["scoring_method_note"],
        risk_factors=risk_eval["risk_factors"],
        recommended_next_steps=json.loads(record.recommended_next_steps_json),
        preventive_measures=json.loads(record.preventive_measures_json),
        expert_confirmation_needed=record.expert_confirmation_needed,
        model_provider=record.model_provider,
        model_id=record.model_id,
        disclaimer=record.disclaimer,
        troubleshooting_hint=ai_output.get("troubleshooting_hint"),
        user_notes=record.user_notes,
        data_completeness_pct=record.data_completeness_pct,
        missing_data=json.loads(record.missing_data_json),
        is_demo=record.is_demo,
        created_at=record.created_at,
    )


@router.post("/butterfly-risk", response_model=ButterflyRiskEvaluationOut)
async def evaluate_butterfly_risk_endpoint(
    crop_name: str = Form(default="Wheat"),
    growth_stage: str = Form(default="Vegetative"),
    current_temp_c: Optional[float] = Form(default=None),
    soil_moisture_pct: Optional[float] = Form(default=None),
    relative_humidity_pct: Optional[float] = Form(default=None),
    rainfall_3d_sum_mm: Optional[float] = Form(default=None),
    drainage_quality: str = Form(default="Good"),
    soil_ph: Optional[float] = Form(default=None),
    visible_symptoms: str = Form(default=""),
    forecast_heat_stress: bool = Form(default=False),
    forecast_rain_high: bool = Form(default=False),
):
    """
    Butterfly Effect Engine: Evaluates compounding multi-factor risk interactions
    (e.g., heat + soil moisture deficit at flowering; persistent rainfall + poor drainage;
    humidity + lesions) based on the 182-crop catalogue thresholds.
    """
    return evaluate_butterfly_risks(
        crop_name=crop_name,
        growth_stage=growth_stage,
        current_temp_c=current_temp_c,
        soil_moisture_pct=soil_moisture_pct,
        relative_humidity_pct=relative_humidity_pct,
        rainfall_3d_sum_mm=rainfall_3d_sum_mm,
        drainage_quality=drainage_quality,
        soil_ph=soil_ph,
        visible_symptoms=visible_symptoms,
        forecast_heat_stress=forecast_heat_stress,
        forecast_rain_high=forecast_rain_high,
    )


@router.post("/diagnostics", response_model=DiagnosticEvaluateResponse)
async def evaluate_diagnostics_endpoint(payload: DiagnosticEvaluateRequest):
    """
    Root-Cause Diagnostic Engine: Evaluates competing hypotheses across fungal, bacterial,
    viral, nutrient, and physiological stress causes, providing targeted follow-up questions
    and explicit uncertainty handling.
    """
    return evaluate_root_cause_diagnostics(payload)
