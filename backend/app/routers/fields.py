from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from typing import List, Optional
from app.database import get_db
from app.models import Field, User, FieldZone
from app.schemas import (
    FieldCreate,
    FieldUpdate,
    FieldOut,
    FieldZoneCreate,
    FieldZoneUpdate,
    FieldZoneOut,
    StressTrendResponse,
)
from app.services.auth_service import get_optional_user
from app.services.trend_anomaly_service import analyze_stress_trends

router = APIRouter(prefix="/fields", tags=["fields"])


@router.get("", response_model=List[FieldOut])
async def list_fields(
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Field).order_by(Field.created_at.desc())
    if current_user:
        stmt = stmt.where(Field.user_id == current_user.id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=FieldOut, status_code=201)
async def create_field(
    payload: FieldCreate,
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    field = Field(
        user_id=current_user.id if current_user else None,
        name=payload.name.strip(),
        crop_type=payload.crop_type.strip(),
        area_value=payload.area_value,
        area_unit=payload.area_unit,
        location=payload.location.strip(),
        latitude=payload.latitude,
        longitude=payload.longitude,
        planting_date=payload.planting_date,
        growth_stage=payload.growth_stage,
        status="healthy",
        risk_level="low",
        ndvi=0.72,
        notes=payload.notes.strip(),
        created_at=datetime.utcnow(),
    )
    db.add(field)
    await db.commit()
    await db.refresh(field)
    return field


@router.get("/{field_id}", response_model=FieldOut)
async def get_field(field_id: int, db: AsyncSession = Depends(get_db)):
    field = await db.get(Field, field_id)
    if not field:
        raise HTTPException(status_code=404, detail=f"Field #{field_id} not found")
    return field


@router.put("/{field_id}", response_model=FieldOut)
async def update_field(field_id: int, payload: FieldUpdate, db: AsyncSession = Depends(get_db)):
    field = await db.get(Field, field_id)
    if not field:
        raise HTTPException(status_code=404, detail=f"Field #{field_id} not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        if isinstance(val, str):
            val = val.strip()
        setattr(field, key, val)

    await db.commit()
    await db.refresh(field)
    return field


@router.delete("/{field_id}", status_code=204)
async def delete_field(field_id: int, db: AsyncSession = Depends(get_db)):
    field = await db.get(Field, field_id)
    if not field:
        raise HTTPException(status_code=404, detail=f"Field #{field_id} not found")
    await db.delete(field)
    await db.commit()


# ─── Field Zone Endpoints ───────────────────────────────────────────────────
@router.get("/{field_id}/zones", response_model=List[FieldZoneOut])
async def list_field_zones(field_id: int, db: AsyncSession = Depends(get_db)):
    field = await db.get(Field, field_id)
    if not field:
        raise HTTPException(status_code=404, detail=f"Field #{field_id} not found")

    res = await db.execute(
        select(FieldZone).where(FieldZone.field_id == field_id).order_by(FieldZone.zone_name.asc())
    )
    zones = res.scalars().all()
    # If no zones exist yet, create default 3 spatial zones so farmers have microclimate views
    if not zones:
        default_zones = [
            FieldZone(
                field_id=field_id,
                zone_name="Zone A (North Slope)",
                area_acres=round(field.area_value * 0.35, 2),
                crop_stage=field.growth_stage,
                soil_moisture_pct=34.0,
                soil_ph=6.7,
                drainage_quality="Good",
                microclimate_note="Elevated quadrant; excellent sun exposure and rapid drainage.",
                risk_level="low",
                created_at=datetime.utcnow(),
            ),
            FieldZone(
                field_id=field_id,
                zone_name="Zone B (Central Basin)",
                area_acres=round(field.area_value * 0.40, 2),
                crop_stage=field.growth_stage,
                soil_moisture_pct=26.0,
                soil_ph=6.9,
                drainage_quality="Moderate",
                microclimate_note="Deep loam layer; optimal soil moisture retention buffer.",
                risk_level="watch" if field.risk_level == "high" else "low",
                created_at=datetime.utcnow(),
            ),
            FieldZone(
                field_id=field_id,
                zone_name="Zone C (Low-Lying Edge)",
                area_acres=round(field.area_value * 0.25, 2),
                crop_stage=field.growth_stage,
                soil_moisture_pct=21.0,
                soil_ph=7.2,
                drainage_quality="Poor",
                microclimate_note="Heavy clay boundary; prone to pooling in heavy rain or drying into crust.",
                risk_level="watch",
                created_at=datetime.utcnow(),
            ),
        ]
        for z in default_zones:
            db.add(z)
        await db.commit()
        res = await db.execute(
            select(FieldZone).where(FieldZone.field_id == field_id).order_by(FieldZone.zone_name.asc())
        )
        zones = res.scalars().all()

    return zones


@router.post("/{field_id}/zones", response_model=FieldZoneOut, status_code=201)
async def create_field_zone(
    field_id: int, payload: FieldZoneCreate, db: AsyncSession = Depends(get_db)
):
    field = await db.get(Field, field_id)
    if not field:
        raise HTTPException(status_code=404, detail=f"Field #{field_id} not found")

    zone = FieldZone(
        field_id=field_id,
        zone_name=payload.zone_name.strip(),
        area_acres=payload.area_acres,
        crop_stage=payload.crop_stage,
        soil_moisture_pct=payload.soil_moisture_pct,
        soil_ph=payload.soil_ph,
        drainage_quality=payload.drainage_quality,
        microclimate_note=payload.microclimate_note.strip(),
        risk_level=payload.risk_level,
        created_at=datetime.utcnow(),
    )
    db.add(zone)
    await db.commit()
    await db.refresh(zone)
    return zone


@router.put("/{field_id}/zones/{zone_id}", response_model=FieldZoneOut)
async def update_field_zone(
    field_id: int, zone_id: int, payload: FieldZoneUpdate, db: AsyncSession = Depends(get_db)
):
    zone = await db.get(FieldZone, zone_id)
    if not zone or zone.field_id != field_id:
        raise HTTPException(status_code=404, detail=f"Zone #{zone_id} not found in Field #{field_id}")

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        if isinstance(v, str):
            v = v.strip()
        setattr(zone, k, v)
    zone.last_inspected = datetime.utcnow()

    await db.commit()
    await db.refresh(zone)
    return zone


@router.delete("/{field_id}/zones/{zone_id}", status_code=204)
async def delete_field_zone(field_id: int, zone_id: int, db: AsyncSession = Depends(get_db)):
    zone = await db.get(FieldZone, zone_id)
    if not zone or zone.field_id != field_id:
        raise HTTPException(status_code=404, detail=f"Zone #{zone_id} not found in Field #{field_id}")
    await db.delete(zone)
    await db.commit()


# ─── Field Stress Trends & Anomaly Endpoint ──────────────────────────────────
@router.get("/{field_id}/trends", response_model=StressTrendResponse)
async def get_field_stress_trends(field_id: int, db: AsyncSession = Depends(get_db)):
    field = await db.get(Field, field_id)
    if not field:
        raise HTTPException(status_code=404, detail=f"Field #{field_id} not found")

    # Fetch zones to check average soil moisture or use field baseline
    res = await db.execute(select(FieldZone).where(FieldZone.field_id == field_id))
    zones = res.scalars().all()
    avg_moisture = (
        sum(z.soil_moisture_pct for z in zones if z.soil_moisture_pct is not None) / max(1, len(zones))
        if zones else 27.5
    )

    return analyze_stress_trends(
        field_id=field_id,
        crop_name=field.crop_type,
        growth_stage=field.growth_stage,
        current_soil_moisture_pct=round(avg_moisture, 1),
        current_temp_c=31.5,
        current_ndvi=field.ndvi,
        historical_soil_readings=[36.0, 33.2, 30.5, round(avg_moisture, 1)],
        historical_temp_readings=[28.0, 29.5, 30.8, 31.5],
    )

