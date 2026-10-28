import re
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import User, FarmerProfile, Field, BudgetItem
from app.schemas import FarmerProfileUpsert, FarmerProfileOut
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/farmer", tags=["farmer"])


def _clean_str(val: Optional[str], default: str = "") -> str:
    if val is None:
        return default
    cleaned = str(val).strip()
    if cleaned.lower() in ("undefined", "null", "none"):
        return default
    return cleaned


@router.get("/profile", response_model=Optional[FarmerProfileOut])
async def get_farmer_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(FarmerProfile).where(FarmerProfile.user_id == current_user.id)
    )
    return res.scalar_one_or_none()


@router.post("/profile", response_model=FarmerProfileOut)
@router.put("/profile", response_model=FarmerProfileOut)
async def upsert_farmer_profile(
    payload: FarmerProfileUpsert,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    farmer_name = _clean_str(payload.farmer_name)
    mobile_number = _clean_str(payload.mobile_number)
    state = _clean_str(payload.state)
    district = _clean_str(payload.district)
    village_town = _clean_str(payload.village_town)
    soil_type = _clean_str(payload.soil_type)
    irrigation_source = _clean_str(payload.irrigation_source)
    main_crop = _clean_str(payload.main_crop)
    growing_season = _clean_str(payload.growing_season)
    pref_lang = payload.preferred_language if payload.preferred_language in ("en", "hi") else "en"

    if len(farmer_name) < 2:
        raise HTTPException(status_code=400, detail="Farmer's Name is required.")
    digits_only = re.sub(r"\D", "", mobile_number)
    if len(digits_only) < 10 or len(digits_only) > 15:
        raise HTTPException(status_code=400, detail="Please enter a valid 10-digit mobile number.")
    if not state or not district:
        raise HTTPException(status_code=400, detail="State and District are required.")
    if payload.total_land_acres <= 0:
        raise HTTPException(status_code=400, detail="Total Land (acres) must be greater than 0.")
    if payload.budget_per_acre < 0:
        raise HTTPException(status_code=400, detail="Budget per acre cannot be negative.")

    res = await db.execute(
        select(FarmerProfile).where(FarmerProfile.user_id == current_user.id)
    )
    profile = res.scalar_one_or_none()
    now = datetime.utcnow()

    if profile:
        profile.farmer_name = farmer_name
        profile.mobile_number = mobile_number
        profile.state = state
        profile.district = district
        profile.village_town = village_town
        profile.total_land_acres = payload.total_land_acres
        profile.soil_type = soil_type
        profile.irrigation_source = irrigation_source
        profile.main_crop = main_crop
        profile.growing_season = growing_season
        profile.budget_per_acre = payload.budget_per_acre
        profile.preferred_language = pref_lang
        profile.updated_at = now
    else:
        profile = FarmerProfile(
            user_id=current_user.id,
            farmer_name=farmer_name,
            mobile_number=mobile_number,
            state=state,
            district=district,
            village_town=village_town,
            total_land_acres=payload.total_land_acres,
            soil_type=soil_type,
            irrigation_source=irrigation_source,
            main_crop=main_crop,
            growing_season=growing_season,
            budget_per_acre=payload.budget_per_acre,
            preferred_language=pref_lang,
            created_at=now,
            updated_at=now,
        )
        db.add(profile)

    # Keep user table in sync
    current_user.full_name = farmer_name
    current_user.mobile_number = mobile_number
    current_user.preferred_language = pref_lang

    # Ensure primary field exists or stays synced for this farmer
    location_label = ", ".join([p for p in [village_town, district, state] if p])
    field_res = await db.execute(
        select(Field).where(Field.user_id == current_user.id).order_by(Field.id.asc()).limit(1)
    )
    primary_field = field_res.scalar_one_or_none()
    notes_summary = f"Soil: {soil_type} | Irrigation: {irrigation_source} | Season: {growing_season}"
    if not primary_field:
        primary_field = Field(
            user_id=current_user.id,
            name=f"{farmer_name}'s {main_crop} Plot",
            crop_type=main_crop,
            area_value=payload.total_land_acres,
            area_unit="acres",
            location=location_label,
            growth_stage="Vegetative",
            status="healthy",
            risk_level="low",
            ndvi=0.74,
            notes=notes_summary,
            created_at=now,
        )
        db.add(primary_field)
        await db.flush()
    else:
        primary_field.area_value = payload.total_land_acres
        primary_field.area_unit = "acres"
        primary_field.location = location_label
        if not primary_field.crop_type:
            primary_field.crop_type = main_crop

    # If farmer specified a budget per acre and has no budget entries yet, create seasonal planned budget
    if payload.budget_per_acre > 0:
        b_res = await db.execute(
            select(BudgetItem).where(BudgetItem.field_id == primary_field.id).limit(1)
        )
        if not b_res.scalar_one_or_none():
            total_seasonal_budget = round(payload.budget_per_acre * payload.total_land_acres, 2)
            db.add(
                BudgetItem(
                    field_id=primary_field.id,
                    category="Seeds",
                    item_name=f"{growing_season} Season Planned Farm Budget ({main_crop})",
                    planned_cost=total_seasonal_budget,
                    actual_cost=0.0,
                    notes=f"Calculated from ₹{payload.budget_per_acre}/acre × {payload.total_land_acres} acres",
                    expense_date=now.strftime("%Y-%m-%d"),
                    created_at=now,
                )
            )

    await db.commit()
    await db.refresh(profile)
    return profile
