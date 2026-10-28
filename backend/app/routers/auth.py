import re
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import User, FarmerProfile, CropRecord
from app.schemas import (
    UserSignupRequest,
    UserLoginRequest,
    UserLanguageUpdate,
    UserOut,
    FarmerProfileOut,
    CropRecordOut,
    AuthSessionResponse,
)
from app.services.auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)

router = APIRouter(prefix="/auth", tags=["auth"])

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MOBILE_REGEX = re.compile(r"^\+?[0-9\s\-]{10,15}$")


async def _build_session_response(user: User, db: AsyncSession) -> AuthSessionResponse:
    prof_res = await db.execute(
        select(FarmerProfile).where(FarmerProfile.user_id == user.id)
    )
    farmer_profile = prof_res.scalar_one_or_none()

    crop_res = await db.execute(
        select(CropRecord)
        .where(CropRecord.user_id == user.id)
        .order_by(CropRecord.updated_at.desc(), CropRecord.id.desc())
        .limit(1)
    )
    latest_crop = crop_res.scalar_one_or_none()

    token = create_access_token(user.id, user.email)
    return AuthSessionResponse(
        token=token,
        user=UserOut.model_validate(user),
        has_farmer_profile=farmer_profile is not None,
        has_crop_record=latest_crop is not None,
        farmer_profile=FarmerProfileOut.model_validate(farmer_profile) if farmer_profile else None,
        latest_crop=CropRecordOut.model_validate(latest_crop) if latest_crop else None,
    )


@router.post("/signup", response_model=AuthSessionResponse, status_code=201)
async def signup(payload: UserSignupRequest, db: AsyncSession = Depends(get_db)):
    full_name = payload.full_name.strip()
    email = payload.email.strip().lower()
    mobile_number = payload.mobile_number.strip()
    lang = payload.preferred_language if payload.preferred_language in ("en", "hi") else "en"

    if len(full_name) < 2:
        raise HTTPException(status_code=400, detail="Full Name must be at least 2 characters.")
    if not EMAIL_REGEX.match(email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    digits_only = re.sub(r"\D", "", mobile_number)
    if len(digits_only) < 10 or len(digits_only) > 15:
        raise HTTPException(status_code=400, detail="Please enter a valid 10-digit mobile number.")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")

    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="An account with this email address already exists. Please log in instead.",
        )

    user = User(
        full_name=full_name,
        email=email,
        mobile_number=mobile_number,
        password_hash=hash_password(payload.password),
        preferred_language=lang,
        created_at=datetime.utcnow(),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return await _build_session_response(user, db)


@router.post("/login", response_model=AuthSessionResponse)
async def login(payload: UserLoginRequest, db: AsyncSession = Depends(get_db)):
    email = payload.email.strip().lower()
    res = await db.execute(select(User).where(User.email == email))
    user = res.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Invalid email address or password. Please check your credentials and try again.",
        )
    return await _build_session_response(user, db)


@router.get("/me", response_model=AuthSessionResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _build_session_response(current_user, db)


@router.put("/language", response_model=UserOut)
async def update_language(
    payload: UserLanguageUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.preferred_language = payload.preferred_language
    prof_res = await db.execute(
        select(FarmerProfile).where(FarmerProfile.user_id == current_user.id)
    )
    prof = prof_res.scalar_one_or_none()
    if prof:
        prof.preferred_language = payload.preferred_language
    await db.commit()
    await db.refresh(current_user)
    return current_user
