import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db
from app.routers import (
    health,
    auth,
    farmer,
    crops,
    fields,
    weather,
    analysis,
    history,
    planner,
    budget,
    simulator,
    reports,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("cropsentinel")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing CropSentinel SQLite database tables...")
    await init_db()
    logger.info(
        "CropSentinel API started (AI configured=%s, model=%s)",
        bool(settings.effective_hf_key),
        settings.effective_model_id,
    )
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "CropSentinel — AI-Powered Crop Health Monitoring and Decision Support Platform API. "
        "Provides field management, real Open-Meteo weather intelligence, Hugging Face plant disease "
        "classification, transparent risk scoring, traceable evidence ledger, rescue planning, "
        "Budget Manthan expense tracking, and What-If scenario simulation."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all routers under /api
app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(farmer.router, prefix="/api")
app.include_router(crops.router, prefix="/api")
app.include_router(fields.router, prefix="/api")
app.include_router(weather.router, prefix="/api")
app.include_router(analysis.router, prefix="/api")
app.include_router(history.router, prefix="/api")
app.include_router(planner.router, prefix="/api")
app.include_router(budget.router, prefix="/api")
app.include_router(simulator.router, prefix="/api")
app.include_router(reports.router, prefix="/api")


@app.get("/")
async def root():
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "health": "/api/health",
    }
