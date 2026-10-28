import io
import json
import os
import re
import time
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from PIL import Image, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.database import get_db
from app.models import User, CropRecord, Field, Assessment, EvidenceEntry, FarmerProfile
from app.schemas import CropRecordOut, VarietyComparisonResponse
from app.services.auth_service import get_current_user
from app.services.disease_service import analyze_crop_image
from app.services.risk_service import compute_transparent_risk
from app.services.variety_intelligence_service import compare_crop_varieties
from app.services.crop_suitability_model import (
    get_trained_model,
    find_crop_profile,
    evaluate_crop_conditions,
    recommend_crops_for_conditions,
    train_and_save_model,
)

router = APIRouter(tags=["crops"])

UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}


def _clean_str(val: Optional[str], default: str = "") -> str:
    if val is None:
        return default
    s = str(val).strip()
    if s.lower() in ("undefined", "null", "none", "nan"):
        return default
    return s


def _parse_optional_float(
    raw: Optional[str],
    field_label: str,
    min_val: Optional[float] = None,
    max_val: Optional[float] = None,
) -> Optional[float]:
    cleaned = _clean_str(raw, "")
    if cleaned == "":
        return None
    try:
        num = float(cleaned)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"{field_label} must be a valid number.")
    if min_val is not None and num < min_val:
        raise HTTPException(status_code=400, detail=f"{field_label} must be at least {min_val}.")
    if max_val is not None and num > max_val:
        raise HTTPException(status_code=400, detail=f"{field_label} must be at most {max_val}.")
    return round(num, 2)


async def _process_and_store_photo(
    photo: UploadFile,
    user_id: int,
) -> tuple[bytes, str, str]:
    content_type = (photo.content_type or "").lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image type '{content_type}'. Allowed formats: JPEG, PNG, WEBP.",
        )
    raw_bytes = await photo.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Uploaded crop photograph is empty.")
    if len(raw_bytes) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Image exceeds maximum allowed size ({settings.max_upload_bytes // (1024 * 1024)} MB).",
        )
    try:
        with Image.open(io.BytesIO(raw_bytes)) as img:
            img.verify()
    except (UnidentifiedImageError, Exception):
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid image.")

    orig_name = re.sub(r"[^a-zA-Z0-9._-]", "_", os.path.basename(photo.filename or "crop.jpg"))[:80]
    stored_name = f"crop_{user_id}_{int(time.time() * 1000)}_{orig_name}"
    dest_path = UPLOADS_DIR / stored_name
    dest_path.write_bytes(raw_bytes)
    image_url = f"/api/uploads/{stored_name}"
    return raw_bytes, stored_name, image_url


@router.get("/uploads/{filename}")
async def serve_uploaded_photo(filename: str):
    safe_name = os.path.basename(filename)
    file_path = UPLOADS_DIR / safe_name
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Uploaded photograph not found.")
    return FileResponse(file_path)


def _sanitize_crop_record(rec: Optional[CropRecord]) -> Optional[CropRecord]:
    if not rec:
        return None
    rec.crop_name = _clean_str(rec.crop_name)
    rec.crop_variety = _clean_str(rec.crop_variety)
    rec.field_location = _clean_str(rec.field_location)
    rec.sowing_date = _clean_str(rec.sowing_date)
    rec.growth_stage = _clean_str(rec.growth_stage, "Vegetative")
    rec.irrigation_method = _clean_str(rec.irrigation_method, "Drip Irrigation")
    rec.fertilizer_used = _clean_str(rec.fertilizer_used)
    rec.pesticide_used = _clean_str(rec.pesticide_used)
    rec.visible_symptoms = _clean_str(rec.visible_symptoms)
    rec.image_filename = _clean_str(rec.image_filename) or None
    rec.image_url = _clean_str(rec.image_url) or None
    return rec


@router.get("/crops", response_model=List[CropRecordOut])
async def list_crop_records(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(CropRecord)
        .where(CropRecord.user_id == current_user.id)
        .order_by(CropRecord.updated_at.desc(), CropRecord.id.desc())
    )
    rows = res.scalars().all()
    return [_sanitize_crop_record(r) for r in rows if r]


@router.get("/crops/latest", response_model=Optional[CropRecordOut])
async def get_latest_crop_record(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(CropRecord)
        .where(CropRecord.user_id == current_user.id)
        .order_by(CropRecord.updated_at.desc(), CropRecord.id.desc())
        .limit(1)
    )
    return _sanitize_crop_record(res.scalar_one_or_none())


class CropModelEvalRequest(BaseModel):
    crop_name: str
    field_temperature_c: Optional[float] = None
    recent_rainfall_mm: Optional[float] = None
    soil_moisture_pct: Optional[float] = None
    humidity_pct: Optional[float] = None
    soil_ph: Optional[float] = None
    soil_type: Optional[str] = None
    growth_stage: Optional[str] = None
    growth_progress_pct: Optional[float] = None
    visible_symptoms: Optional[str] = None
    image_filename: Optional[str] = None


class CropModelRecommendRequest(BaseModel):
    temperature_c: Optional[float] = None
    annual_rainfall_mm: Optional[float] = None
    soil_ph: Optional[float] = None
    soil_type: Optional[str] = None
    season: Optional[str] = None
    crop_group: Optional[str] = None
    top_k: int = 8


@router.get("/crops/catalogue")
async def get_crop_reference_catalogue(
    q: Optional[str] = Query(default=None, description="Search by crop name or alias"),
    crop_group: Optional[str] = Query(default=None, description="Filter by crop group"),
) -> Dict[str, Any]:
    model = get_trained_model()
    profiles = model.get("profiles", [])
    filtered = profiles
    if q and q.strip():
        ql = q.strip().lower()
        filtered = [
            p
            for p in filtered
            if ql in p["crop"].lower()
            or ql in p["crop_group"].lower()
            or any(ql in al for al in p.get("aliases", []))
        ]
    if crop_group and crop_group.strip():
        gl = crop_group.strip().lower()
        filtered = [p for p in filtered if gl in p["crop_group"].lower()]

    return {
        "model_name": model.get("model_name"),
        "model_version": model.get("model_version"),
        "trained_at": model.get("trained_at"),
        "metrics": model.get("metrics"),
        "crop_groups": model.get("crop_groups", []),
        "metadata": model.get("dataset_metadata", []),
        "total": len(filtered),
        "items": filtered,
    }


@router.get("/crops/catalogue/lookup")
async def lookup_crop_in_catalogue(
    crop: str = Query(..., description="Crop name to lookup in the 182-crop reference catalogue"),
) -> Dict[str, Any]:
    prof = find_crop_profile(crop)
    if not prof:
        return {"matched": False, "queried_crop": crop}
    return {"matched": True, "profile": prof}


@router.post("/crops/model/evaluate")
async def evaluate_crop_with_trained_model(payload: CropModelEvalRequest) -> Dict[str, Any]:
    return evaluate_crop_conditions(
        crop_name=payload.crop_name,
        field_temperature_c=payload.field_temperature_c,
        recent_rainfall_mm=payload.recent_rainfall_mm,
        soil_moisture_pct=payload.soil_moisture_pct,
        humidity_pct=payload.humidity_pct,
        soil_ph=payload.soil_ph,
        soil_type=payload.soil_type,
        growth_stage=payload.growth_stage,
        growth_progress_pct=payload.growth_progress_pct,
        visible_symptoms=payload.visible_symptoms,
        image_filename=payload.image_filename,
    )


@router.post("/crops/model/recommend")
async def recommend_crops_with_trained_model(payload: CropModelRecommendRequest) -> Dict[str, Any]:
    recs = recommend_crops_for_conditions(
        temperature_c=payload.temperature_c,
        annual_rainfall_mm=payload.annual_rainfall_mm,
        soil_ph=payload.soil_ph,
        soil_type=payload.soil_type,
        season=payload.season,
        crop_group=payload.crop_group,
        top_k=payload.top_k,
    )
    model = get_trained_model()
    return {
        "model_version": model.get("model_version"),
        "count": len(recs),
        "recommendations": recs,
    }


@router.post("/crops/model/retrain")
async def retrain_crop_suitability_model() -> Dict[str, Any]:
    artifact = train_and_save_model()
    return {
        "status": "trained",
        "model_name": artifact.get("model_name"),
        "model_version": artifact.get("model_version"),
        "trained_at": artifact.get("trained_at"),
        "metrics": artifact.get("metrics"),
    }


@router.post("/crops", response_model=CropRecordOut, status_code=201)
async def create_or_save_crop_record(
    crop_name: str = Form(...),
    crop_variety: str = Form(default=""),
    field_location: str = Form(...),
    sowing_date: str = Form(default=""),
    growth_stage: str = Form(default="Vegetative"),
    growth_progress_pct: str = Form(default="25"),
    irrigation_method: str = Form(default="Drip Irrigation"),
    recent_rainfall_mm: Optional[str] = Form(default=None),
    soil_moisture_pct: Optional[str] = Form(default=None),
    field_temperature_c: Optional[str] = Form(default=None),
    humidity_pct: Optional[str] = Form(default=None),
    fertilizer_used: str = Form(default=""),
    pesticide_used: str = Form(default=""),
    visible_symptoms: str = Form(default=""),
    crop_id: Optional[str] = Form(default=None),
    photo: Optional[UploadFile] = File(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    c_name = _clean_str(crop_name)
    c_variety = _clean_str(crop_variety)
    f_loc = _clean_str(field_location)
    s_date = _clean_str(sowing_date)
    g_stage = _clean_str(growth_stage, "Vegetative")
    irr_method = _clean_str(irrigation_method, "Drip Irrigation")
    fert = _clean_str(fertilizer_used)
    pest = _clean_str(pesticide_used)
    symptoms = _clean_str(visible_symptoms)

    if not c_name:
        raise HTTPException(status_code=400, detail="Crop Name is required.")
    if not f_loc:
        raise HTTPException(status_code=400, detail="Field Location is required.")

    g_progress = _parse_optional_float(growth_progress_pct, "Estimated Growth Progress (%)", 0.0, 100.0)
    if g_progress is None:
        g_progress = 25.0
    rain_mm = _parse_optional_float(recent_rainfall_mm, "Recent Rainfall (mm)", 0.0, 5000.0)
    moisture_pct = _parse_optional_float(soil_moisture_pct, "Soil Moisture (%)", 0.0, 100.0)
    temp_c = _parse_optional_float(field_temperature_c, "Field Temperature (°C)", -20.0, 65.0)
    hum_pct = _parse_optional_float(humidity_pct, "Humidity (%)", 0.0, 100.0)

    now = datetime.utcnow()

    # Check if updating existing record
    existing_crop: Optional[CropRecord] = None
    cleaned_crop_id = _clean_str(crop_id)
    if cleaned_crop_id.isdigit():
        existing_crop = await db.get(CropRecord, int(cleaned_crop_id))
        if existing_crop and existing_crop.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to modify this crop record.")

    # Find or create associated Field for this farmer
    prof_res = await db.execute(
        select(FarmerProfile).where(FarmerProfile.user_id == current_user.id)
    )
    farmer_prof = prof_res.scalar_one_or_none()
    land_area = farmer_prof.total_land_acres if farmer_prof else 2.0

    field_obj: Optional[Field] = None
    if existing_crop and existing_crop.field_id:
        field_obj = await db.get(Field, existing_crop.field_id)
    if not field_obj:
        f_res = await db.execute(
            select(Field).where(Field.user_id == current_user.id).order_by(Field.id.asc()).limit(1)
        )
        field_obj = f_res.scalar_one_or_none()

    notes_parts = []
    if c_variety:
        notes_parts.append(f"Variety: {c_variety}")
    if irr_method:
        notes_parts.append(f"Irrigation: {irr_method}")
    if moisture_pct is not None:
        notes_parts.append(f"Soil Moisture: {moisture_pct}%")
    if fert:
        notes_parts.append(f"Fertilizer: {fert}")
    if pest:
        notes_parts.append(f"Pesticide: {pest}")
    if symptoms:
        notes_parts.append(f"Symptoms: {symptoms}")
    compiled_notes = " | ".join(notes_parts)

    if not field_obj:
        field_obj = Field(
            user_id=current_user.id,
            name=f"{c_name} ({f_loc})"[:120],
            crop_type=c_name,
            area_value=land_area,
            area_unit="acres",
            location=f_loc,
            planting_date=s_date or None,
            growth_stage=g_stage,
            status="watch" if symptoms else "healthy",
            risk_level="moderate" if symptoms else "low",
            ndvi=0.68 if symptoms else 0.78,
            notes=compiled_notes,
            created_at=now,
        )
        db.add(field_obj)
        await db.flush()
    else:
        field_obj.name = f"{c_name} ({f_loc})"[:120]
        field_obj.crop_type = c_name
        field_obj.location = f_loc
        field_obj.planting_date = s_date or field_obj.planting_date
        field_obj.growth_stage = g_stage
        field_obj.notes = compiled_notes

    # Handle optional photo upload
    stored_filename = existing_crop.image_filename if existing_crop else None
    stored_url = existing_crop.image_url if existing_crop else None
    assessment_id = existing_crop.latest_assessment_id if existing_crop else None

    if photo and photo.filename:
        raw_bytes, stored_filename, stored_url = await _process_and_store_photo(photo, current_user.id)
        ai_output = await analyze_crop_image(
            image_bytes=raw_bytes,
            filename=stored_filename,
            crop_type=c_name,
        )
        risk_eval = compute_transparent_risk(
            crop_type=c_name,
            growth_stage=g_stage,
            ai_result=ai_output,
            user_notes=symptoms,
            weather_summary=None,
            field_linked=True,
        )
        assessment = Assessment(
            field_id=field_obj.id,
            crop_type=c_name,
            growth_stage=g_stage,
            image_filename=stored_filename,
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
            user_notes=symptoms,
            data_completeness_pct=risk_eval["data_completeness_pct"],
            missing_data_json=json.dumps(risk_eval["missing_data"]),
            is_demo=False,
            created_at=now,
        )
        db.add(assessment)
        await db.flush()
        assessment_id = assessment.id
        field_obj.last_assessment = now
        field_obj.status = risk_eval["risk_category"]
        field_obj.risk_level = (
            "high" if risk_eval["risk_category"] == "high-risk"
            else "moderate" if risk_eval["risk_category"] == "watch"
            else "low"
        )
    elif symptoms and not assessment_id:
        # Record symptom observation in Evidence Ledger
        db.add(
            EvidenceEntry(
                field_id=field_obj.id,
                assessment_id=None,
                recommendation_text=f"Inspect {c_name} foliage for reported symptoms: {symptoms[:120]}",
                supporting_evidence=f"Farmer reported visible symptoms on {c_name} ({g_stage}): '{symptoms[:180]}'",
                evidence_source="User Observation",
                confidence_label="Farmer Field Report",
                data_gaps="Leaf photograph not yet uploaded for AI classification" if not stored_filename else "None",
                verification_steps="Upload a close-up leaf photograph in Disease Detection or consult local KVK.",
                created_at=now,
            )
        )

    # Evaluate observed field readings against the trained 182-crop reference model
    # and record traceable alert reasons in the Evidence Ledger as recommended by the dataset metadata
    model_eval = evaluate_crop_conditions(
        crop_name=c_name,
        field_temperature_c=temp_c,
        recent_rainfall_mm=rain_mm,
        soil_moisture_pct=moisture_pct,
        humidity_pct=hum_pct,
        soil_type=farmer_prof.soil_type if farmer_prof else None,
        growth_stage=g_stage,
    )
    if model_eval.get("matched") and model_eval.get("alerts"):
        for alert_item in model_eval["alerts"][:2]:
            db.add(
                EvidenceEntry(
                    field_id=field_obj.id,
                    assessment_id=assessment_id,
                    recommendation_text=(
                        f"[{alert_item['code']}] Verify field irrigation/microclimate for {model_eval['crop']} ({g_stage})"
                    ),
                    supporting_evidence=alert_item["reason_en"],
                    evidence_source=f"Trained Crop Model ({alert_item.get('source', 'FAO EcoCrop; ICAR/SAU')})",
                    confidence_label="Broad Screening Range",
                    data_gaps="Verify cultivar, region, and local extension guidance before automated diagnosis",
                    verification_steps=model_eval.get("confidence_note", ""),
                    created_at=now,
                )
            )
            if alert_item.get("severity") == "high" and field_obj.status == "healthy":
                field_obj.status = "watch"
                field_obj.risk_level = "moderate"

    if existing_crop:
        existing_crop.field_id = field_obj.id
        existing_crop.crop_name = c_name
        existing_crop.crop_variety = c_variety
        existing_crop.field_location = f_loc
        existing_crop.sowing_date = s_date
        existing_crop.growth_stage = g_stage
        existing_crop.growth_progress_pct = g_progress
        existing_crop.irrigation_method = irr_method
        existing_crop.recent_rainfall_mm = rain_mm
        existing_crop.soil_moisture_pct = moisture_pct
        existing_crop.field_temperature_c = temp_c
        existing_crop.humidity_pct = hum_pct
        existing_crop.fertilizer_used = fert
        existing_crop.pesticide_used = pest
        existing_crop.image_filename = stored_filename
        existing_crop.image_url = stored_url
        existing_crop.visible_symptoms = symptoms
        existing_crop.latest_assessment_id = assessment_id
        existing_crop.updated_at = now
        crop_record = existing_crop
    else:
        crop_record = CropRecord(
            user_id=current_user.id,
            field_id=field_obj.id,
            crop_name=c_name,
            crop_variety=c_variety,
            field_location=f_loc,
            sowing_date=s_date,
            growth_stage=g_stage,
            growth_progress_pct=g_progress,
            irrigation_method=irr_method,
            recent_rainfall_mm=rain_mm,
            soil_moisture_pct=moisture_pct,
            field_temperature_c=temp_c,
            humidity_pct=hum_pct,
            fertilizer_used=fert,
            pesticide_used=pest,
            image_filename=stored_filename,
            image_url=stored_url,
            visible_symptoms=symptoms,
            latest_assessment_id=assessment_id,
            created_at=now,
            updated_at=now,
        )
        db.add(crop_record)

    await db.commit()
    await db.refresh(crop_record)
    return crop_record


class VarietyComparisonRequest(BaseModel):
    target_crop: str = "Wheat"
    field_temperature_c: float = 28.0
    field_soil_ph: float = 6.8
    annual_rainfall_mm: float = 850.0
    soil_texture: str = "Loam"


@router.post("/crops/variety-comparison", response_model=VarietyComparisonResponse)
async def variety_comparison_endpoint(payload: VarietyComparisonRequest):
    """
    Crop Variety & Agronomic Matching: Evaluates crop varieties against field soil, pH,
    temperature, and rainfall using the 182-crop FAO EcoCrop & ICAR national starter catalogue.
    """
    return compare_crop_varieties(
        target_crop=payload.target_crop,
        field_temperature_c=payload.field_temperature_c,
        field_soil_ph=payload.field_soil_ph,
        annual_rainfall_mm=payload.annual_rainfall_mm,
        soil_texture=payload.soil_texture,
    )
