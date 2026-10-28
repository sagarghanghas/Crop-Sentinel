from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime
from app.database import get_db
from app.config import settings
from app.schemas import HealthStatusOut

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", response_model=HealthStatusOut)
async def get_health(db: AsyncSession = Depends(get_db)):
    db_ok = False
    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    return HealthStatusOut(
        status="ok" if db_ok else "degraded",
        version=settings.app_version,
        database_connected=db_ok,
        ai_provider=settings.ai_provider,
        ai_model_id=settings.effective_model_id,
        ai_configured=bool(settings.effective_hf_key),
        weather_api_url=settings.open_meteo_forecast_url,
        weather_thresholds={
            "high_rain_mm_day": settings.weather_rain_high_mm,
            "heat_stress_c": settings.weather_temp_heat_stress_c,
            "cold_stress_c": settings.weather_temp_cold_stress_c,
            "high_humidity_pct": settings.weather_humidity_fungal_risk_pct,
        },
        timestamp=datetime.utcnow(),
    )
