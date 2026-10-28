import os
from pathlib import Path
from typing import List
from dotenv import dotenv_values
from pydantic_settings import BaseSettings

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_ENV_FILE = _BACKEND_DIR / ".env"


class Settings(BaseSettings):
    app_name: str = "CropSentinel API"
    app_version: str = "2.0.0"

    # AI Configuration
    ai_provider: str = "huggingface"
    hf_token: str = ""  # preferred variable name: HF_TOKEN
    huggingface_api_key: str = ""  # legacy alias
    hf_api_token: str = ""  # fallback alias
    ai_model_id: str = "linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification"
    hf_model_id: str = ""   # fallback alias

    # Database
    database_url: str = "sqlite+aiosqlite:///./cropsentinel.db"

    # CORS
    frontend_origin: str = "http://localhost:5173,http://localhost:3000"
    cors_origins: str = ""

    # Open-Meteo URLs
    open_meteo_forecast_url: str = "https://api.open-meteo.com/v1/forecast"
    open_meteo_geocoding_url: str = "https://geocoding-api.open-meteo.com/v1/search"

    # Configurable Weather Risk Thresholds
    weather_rain_high_mm: float = 25.0
    weather_temp_heat_stress_c: float = 36.0
    weather_temp_cold_stress_c: float = 6.0
    weather_humidity_fungal_risk_pct: float = 80.0

    # Upload limits
    max_upload_bytes: int = 10 * 1024 * 1024  # 10 MB

    @property
    def effective_hf_key(self) -> str:
        # Check environment / pydantic settings first, then dynamically check backend/.env
        # Never log or expose the returned secret string.
        # HF_TOKEN is the preferred name; HUGGINGFACE_API_KEY / HF_API_TOKEN remain supported.
        val = (
            os.environ.get("HF_TOKEN")
            or os.environ.get("HUGGINGFACE_API_KEY")
            or os.environ.get("HF_API_TOKEN")
            or self.hf_token
            or self.huggingface_api_key
            or self.hf_api_token
            or ""
        ).strip()
        if not val and _ENV_FILE.is_file():
            env_map = dotenv_values(_ENV_FILE)
            val = (
                (
                    env_map.get("HF_TOKEN")
                    or env_map.get("HUGGINGFACE_API_KEY")
                    or env_map.get("HF_API_TOKEN")
                    or ""
                )
                .strip()
                .strip('"')
                .strip("'")
            )
        # Reject placeholder values
        if val.lower() in (
            "your_token_here",
            "hf_your_token_here",
            "your_huggingface_api_key",
            "hf_xxx",
            "none",
            "null",
        ):
            return ""
        return val

    @property
    def effective_model_id(self) -> str:
        val = (
            os.environ.get("AI_MODEL_ID")
            or os.environ.get("HF_MODEL_ID")
            or self.ai_model_id
            or self.hf_model_id
            or ""
        ).strip()
        if not val and _ENV_FILE.is_file():
            env_map = dotenv_values(_ENV_FILE)
            val = (env_map.get("AI_MODEL_ID") or env_map.get("HF_MODEL_ID") or "").strip()
        return val or "linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification"

    @property
    def cors_origins_list(self) -> List[str]:
        raw = self.frontend_origin or self.cors_origins or "http://localhost:5173,http://localhost:3000"
        return [o.strip() for o in raw.split(",") if o.strip()]

    model_config = {"env_file": str(_ENV_FILE), "extra": "ignore"}


settings = Settings()
