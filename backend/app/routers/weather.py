from fastapi import APIRouter, Query
from typing import List
from app.schemas import GeoLocationResult, WeatherForecastResponse
from app.services.weather_service import search_locations, fetch_weather_forecast

router = APIRouter(prefix="/weather", tags=["weather"])


@router.get("/search", response_model=List[GeoLocationResult])
async def geocode_search(
    q: str = Query(..., min_length=2, description="City, town, or place name to search"),
    count: int = Query(default=8, ge=1, le=20),
):
    return await search_locations(q, count=count)


@router.get("/forecast", response_model=WeatherForecastResponse)
async def get_forecast(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    location_name: str = Query(default="Selected Location"),
):
    return await fetch_weather_forecast(latitude=lat, longitude=lon, location_name=location_name)
