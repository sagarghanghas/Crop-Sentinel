"""
Weather Intelligence Service using real Open-Meteo Geocoding and Forecast APIs.
Includes transparent, configurable weather-risk rules and never fabricates live weather data.
"""
import httpx
import logging
from datetime import datetime
from typing import List, Dict, Any
from fastapi import HTTPException
from app.config import settings
from app.schemas import (
    GeoLocationResult,
    WeatherForecastResponse,
    CurrentWeatherBlock,
    DailyForecastItem,
    HourlyForecastItem,
    WeatherRiskRuleAlert,
)

logger = logging.getLogger(__name__)

# Documented WMO Weather Interpretation Codes (WW)
WMO_CODE_MAP: Dict[int, str] = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snowfall",
    73: "Moderate snowfall",
    75: "Heavy snowfall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
}


def decode_wmo_code(code: int | None) -> str:
    if code is None:
        return "Unknown"
    return WMO_CODE_MAP.get(code, f"Weather code {code}")


async def search_locations(query: str, count: int = 8) -> List[GeoLocationResult]:
    cleaned = query.strip()
    if len(cleaned) < 2:
        return []

    params = {
        "name": cleaned,
        "count": count,
        "language": "en",
        "format": "json",
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(settings.open_meteo_geocoding_url, params=params)
            if resp.status_code == 429:
                raise HTTPException(
                    status_code=429,
                    detail="Open-Meteo geocoding rate limit reached. Please wait a moment and retry."
                )
            resp.raise_for_status()
            payload = resp.json()
    except httpx.TimeoutException:
        logger.warning("Open-Meteo geocoding timed out for query=%s", cleaned)
        raise HTTPException(
            status_code=504,
            detail="Location search timed out while contacting Open-Meteo. Please check your network and retry."
        )
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        logger.error("Open-Meteo geocoding HTTP error: %s", exc)
        raise HTTPException(
            status_code=502,
            detail=f"Unable to reach Open-Meteo geocoding service ({exc.__class__.__name__})."
        )

    results = payload.get("results") or []
    output: List[GeoLocationResult] = []
    for item in results:
        if "latitude" not in item or "longitude" not in item:
            continue
        output.append(
            GeoLocationResult(
                id=item.get("id", 0),
                name=item.get("name", "Unknown"),
                latitude=float(item["latitude"]),
                longitude=float(item["longitude"]),
                country=item.get("country", ""),
                admin1=item.get("admin1"),
                timezone=item.get("timezone"),
            )
        )
    return output


def evaluate_weather_risks(
    current: CurrentWeatherBlock,
    daily: List[DailyForecastItem],
) -> List[WeatherRiskRuleAlert]:
    """
    Transparent rule-based agricultural weather risk checks.
    Thresholds are configurable via backend settings.
    """
    alerts: List[WeatherRiskRuleAlert] = []
    rain_thresh = settings.weather_rain_high_mm
    heat_thresh = settings.weather_temp_heat_stress_c
    cold_thresh = settings.weather_temp_cold_stress_c
    humid_thresh = settings.weather_humidity_fungal_risk_pct

    # Check 3-day cumulative or single-day heavy rain
    upcoming_3d = daily[:3]
    max_daily_rain = max((d.precipitation_sum_mm or 0.0 for d in upcoming_3d), default=0.0)
    sum_3d_rain = sum((d.precipitation_sum_mm or 0.0 for d in upcoming_3d))

    if max_daily_rain >= rain_thresh or sum_3d_rain >= rain_thresh * 1.6:
        alerts.append(
            WeatherRiskRuleAlert(
                rule_id="RULE_WATERLOGGING_RAIN",
                risk_type="Waterlogging & Foliar Wash-off Risk",
                severity="high" if max_daily_rain >= rain_thresh * 1.5 else "watch",
                title=f"Elevated Forecast Rainfall ({round(sum_3d_rain, 1)} mm over 3 days)",
                explanation=(
                    f"Peak daily rainfall of {round(max_daily_rain, 1)} mm exceeds or approaches the "
                    f"configured threshold ({rain_thresh} mm/day). Heavy precipitation can cause root-zone "
                    "waterlogging in poorly drained plots and wash off foliar applications."
                ),
                threshold_used=f"Daily rain >= {rain_thresh} mm or 3-day total >= {round(rain_thresh * 1.6, 1)} mm",
                assumption_note="Preliminary weather rule; actual impact depends on soil drainage, slope, and crop stage.",
            )
        )

    # Heat stress check
    max_temp_7d = max((d.temp_max_c for d in daily if d.temp_max_c is not None), default=None)
    if max_temp_7d is not None and max_temp_7d >= heat_thresh:
        alerts.append(
            WeatherRiskRuleAlert(
                rule_id="RULE_HEAT_STRESS",
                risk_type="Heat & Evapotranspiration Stress Risk",
                severity="high" if max_temp_7d >= heat_thresh + 4 else "watch",
                title=f"High Temperature Forecast (up to {round(max_temp_7d, 1)} °C)",
                explanation=(
                    f"Forecast maximum temperature ({round(max_temp_7d, 1)} °C) reaches or exceeds the "
                    f"heat stress threshold ({heat_thresh} °C). High heat during flowering or grain filling "
                    "can accelerate soil moisture depletion and cause flower drop or leaf curling."
                ),
                threshold_used=f"Max temperature >= {heat_thresh} °C",
                assumption_note="Preliminary thermal rule; heat tolerance varies significantly by crop variety and soil moisture.",
            )
        )

    # Cold stress check
    min_temp_7d = min((d.temp_min_c for d in daily if d.temp_min_c is not None), default=None)
    if min_temp_7d is not None and min_temp_7d <= cold_thresh:
        alerts.append(
            WeatherRiskRuleAlert(
                rule_id="RULE_COLD_STRESS",
                risk_type="Chilling / Cold Stress Risk",
                severity="high" if min_temp_7d <= 2.0 else "watch",
                title=f"Low Minimum Temperature Forecast (down to {round(min_temp_7d, 1)} °C)",
                explanation=(
                    f"Forecast minimum temperature ({round(min_temp_7d, 1)} °C) drops to or below the "
                    f"configured cold threshold ({cold_thresh} °C), which may slow seedling growth or injure tender foliage."
                ),
                threshold_used=f"Min temperature <= {cold_thresh} °C",
                assumption_note="Preliminary cold-stress rule; frost sensitivity depends on crop species and microclimate.",
            )
        )

    # High humidity fungal pressure check
    if (
        current.relative_humidity_pct is not None
        and current.relative_humidity_pct >= humid_thresh
        and (current.temperature_c is None or 15.0 <= current.temperature_c <= 32.0)
    ):
        alerts.append(
            WeatherRiskRuleAlert(
                rule_id="RULE_HUMIDITY_FUNGAL",
                risk_type="Humid Microclimate / Fungal Spore Favorability",
                severity="watch",
                title=f"High Relative Humidity ({round(current.relative_humidity_pct, 0)}%)",
                explanation=(
                    f"Current relative humidity ({round(current.relative_humidity_pct, 0)}%) combined with moderate "
                    "temperatures can prolong leaf wetness duration, which favors fungal or bacterial leaf pathogens."
                ),
                threshold_used=f"Relative humidity >= {humid_thresh}% with temp between 15–32 °C",
                assumption_note="Rule-based microclimate indicator, not a confirmed disease diagnosis. Inspect lower canopy leaves.",
            )
        )

    if not alerts:
        alerts.append(
            WeatherRiskRuleAlert(
                rule_id="RULE_NOMINAL",
                risk_type="No Threshold Exceedances",
                severity="info",
                title="Weather Within Configured Baseline Thresholds",
                explanation="Forecast temperature, humidity, and rainfall do not exceed configured stress thresholds.",
                threshold_used=(
                    f"Rain < {rain_thresh} mm/d, Max Temp < {heat_thresh} °C, "
                    f"Min Temp > {cold_thresh} °C, RH < {humid_thresh}%"
                ),
                assumption_note="Continue routine field scouting; localized microclimates may differ from gridded forecasts.",
            )
        )

    return alerts


async def fetch_weather_forecast(
    latitude: float,
    longitude: float,
    location_name: str = "Selected Location",
) -> WeatherForecastResponse:
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
        "hourly": "temperature_2m,precipitation_probability,relative_humidity_2m",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max",
        "timezone": "auto",
        "forecast_days": 7,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(settings.open_meteo_forecast_url, params=params)
            if resp.status_code == 429:
                raise HTTPException(
                    status_code=429,
                    detail="Open-Meteo forecast rate limit reached. Please wait and retry."
                )
            resp.raise_for_status()
            data = resp.json()
    except httpx.TimeoutException:
        logger.warning("Open-Meteo forecast timed out for lat=%s lon=%s", latitude, longitude)
        raise HTTPException(
            status_code=504,
            detail="Live weather forecast request timed out. Weather data is temporarily unavailable."
        )
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        logger.error("Open-Meteo forecast error: %s", exc)
        raise HTTPException(
            status_code=502,
            detail=f"Live weather service unavailable ({exc.__class__.__name__}). No fabricated weather data is shown."
        )

    if not data or "current" not in data or "daily" not in data:
        raise HTTPException(
            status_code=502,
            detail="Open-Meteo returned an incomplete forecast payload."
        )

    cur_raw = data.get("current", {})
    wcode = cur_raw.get("weather_code")
    current_block = CurrentWeatherBlock(
        temperature_c=cur_raw.get("temperature_2m"),
        relative_humidity_pct=cur_raw.get("relative_humidity_2m"),
        apparent_temperature_c=cur_raw.get("apparent_temperature"),
        precipitation_mm=cur_raw.get("precipitation"),
        wind_speed_kmh=cur_raw.get("wind_speed_10m"),
        weather_code=wcode,
        weather_label=decode_wmo_code(wcode),
        time=cur_raw.get("time"),
    )

    daily_raw = data.get("daily", {})
    d_times = daily_raw.get("time") or []
    d_tmax = daily_raw.get("temperature_2m_max") or []
    d_tmin = daily_raw.get("temperature_2m_min") or []
    d_psum = daily_raw.get("precipitation_sum") or []
    d_pprob = daily_raw.get("precipitation_probability_max") or []
    d_wind = daily_raw.get("wind_speed_10m_max") or []
    d_code = daily_raw.get("weather_code") or []

    daily_items: List[DailyForecastItem] = []
    for idx, dt in enumerate(d_times):
        code_val = d_code[idx] if idx < len(d_code) else None
        daily_items.append(
            DailyForecastItem(
                date=dt,
                temp_max_c=d_tmax[idx] if idx < len(d_tmax) else None,
                temp_min_c=d_tmin[idx] if idx < len(d_tmin) else None,
                precipitation_sum_mm=d_psum[idx] if idx < len(d_psum) else None,
                precipitation_probability_max_pct=d_pprob[idx] if idx < len(d_pprob) else None,
                wind_speed_max_kmh=d_wind[idx] if idx < len(d_wind) else None,
                weather_code=code_val,
                weather_label=decode_wmo_code(code_val),
            )
        )

    hourly_raw = data.get("hourly", {})
    h_times = (hourly_raw.get("time") or [])[:24]
    h_temp = hourly_raw.get("temperature_2m") or []
    h_pprob = hourly_raw.get("precipitation_probability") or []
    h_rh = hourly_raw.get("relative_humidity_2m") or []

    hourly_items: List[HourlyForecastItem] = []
    for idx, ht in enumerate(h_times):
        hourly_items.append(
            HourlyForecastItem(
                time=ht,
                temperature_c=h_temp[idx] if idx < len(h_temp) else None,
                precipitation_probability_pct=h_pprob[idx] if idx < len(h_pprob) else None,
                relative_humidity_pct=h_rh[idx] if idx < len(h_rh) else None,
            )
        )

    risks = evaluate_weather_risks(current_block, daily_items)

    return WeatherForecastResponse(
        location_name=location_name,
        latitude=float(data.get("latitude", latitude)),
        longitude=float(data.get("longitude", longitude)),
        timezone=data.get("timezone", "UTC"),
        fetched_at=datetime.utcnow(),
        current=current_block,
        daily=daily_items,
        hourly=hourly_items,
        weather_risks=risks,
        thresholds_config={
            "high_rain_mm_day": settings.weather_rain_high_mm,
            "heat_stress_c": settings.weather_temp_heat_stress_c,
            "cold_stress_c": settings.weather_temp_cold_stress_c,
            "high_humidity_pct": settings.weather_humidity_fungal_risk_pct,
        },
    )
