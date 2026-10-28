from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import SimulationScenario
from app.schemas import (
    SimulatorRunRequest,
    SimulatorRunResponse,
    SensitivityPoint,
    DecisionLabRunRequest,
    DecisionLabRunResponse,
)
from app.services.decision_lab_service import run_decision_lab_simulation

router = APIRouter(prefix="/simulator", tags=["simulator"])

SIMULATOR_DISCLAIMER = (
    "SCENARIO ESTIMATE ONLY: This What-If Simulator uses explicit arithmetic formulas on user-entered "
    "assumptions. It is a financial decision-support calculator, NOT a scientifically validated biophysical "
    "crop-growth model."
)


@router.post("/run", response_model=SimulatorRunResponse)
async def run_simulation(payload: SimulatorRunRequest, db: AsyncSession = Depends(get_db)):
    # Explicit transparent formulas
    baseline_revenue = round(payload.expected_yield_units * payload.sale_price_per_unit, 2)
    loss_fraction = payload.estimated_loss_pct / 100.0
    adjusted_yield = round(payload.expected_yield_units * (1.0 - loss_fraction), 2)
    estimated_revenue = round(adjusted_yield * payload.sale_price_per_unit, 2)
    estimated_profit = round(estimated_revenue - payload.input_cost, 2)
    potential_loss_amount = round(baseline_revenue - estimated_revenue, 2)

    # Transparent note on weather/irrigation assumptions
    stress_notes = []
    if not payload.irrigation_available and payload.expected_rainfall_mm < 60:
        stress_notes.append(
            "Low assumed rainfall (<60 mm) without supplemental irrigation may increase actual yield loss beyond baseline assumptions."
        )
    if payload.temp_assumption_c >= 36.0:
        stress_notes.append(
            f"High assumed temperature ({payload.temp_assumption_c} °C) exceeds typical heat-stress threshold (36 °C)."
        )
    elif payload.temp_assumption_c <= 6.0:
        stress_notes.append(
            f"Low assumed temperature ({payload.temp_assumption_c} °C) reaches chilling threshold (<=6 °C)."
        )
    if not stress_notes:
        stress_notes.append(
            "Weather and irrigation assumptions are within nominal ranges; calculations directly reflect the user-selected loss percentage."
        )

    # Sensitivity curve across loss percentages (0% to 50%)
    sensitivity_curve: List[SensitivityPoint] = []
    for pct in (0, 5, 10, 15, 20, 25, 30, 40, 50):
        adj_y = round(payload.expected_yield_units * (1.0 - pct / 100.0), 2)
        est_rev = round(adj_y * payload.sale_price_per_unit, 2)
        est_prof = round(est_rev - payload.input_cost, 2)
        sensitivity_curve.append(
            SensitivityPoint(
                loss_pct=float(pct),
                adjusted_yield=adj_y,
                estimated_revenue=est_rev,
                estimated_profit=est_prof,
            )
        )

    now = datetime.utcnow()
    scenario_id = None
    if payload.save_scenario:
        rec = SimulationScenario(
            name=payload.name.strip() or "Scenario Analysis",
            field_id=payload.field_id,
            crop_type=payload.crop_type,
            expected_rainfall_mm=payload.expected_rainfall_mm,
            temp_assumption_c=payload.temp_assumption_c,
            irrigation_available=payload.irrigation_available,
            estimated_loss_pct=payload.estimated_loss_pct,
            input_cost=payload.input_cost,
            expected_yield_units=payload.expected_yield_units,
            yield_unit=payload.yield_unit,
            sale_price_per_unit=payload.sale_price_per_unit,
            baseline_revenue=baseline_revenue,
            adjusted_yield=adjusted_yield,
            estimated_revenue=estimated_revenue,
            estimated_profit=estimated_profit,
            potential_loss_amount=potential_loss_amount,
            created_at=now,
        )
        db.add(rec)
        await db.commit()
        await db.refresh(rec)
        scenario_id = rec.id

    return SimulatorRunResponse(
        id=scenario_id,
        name=payload.name,
        field_id=payload.field_id,
        crop_type=payload.crop_type,
        assumptions={
            "expected_rainfall_mm": payload.expected_rainfall_mm,
            "temp_assumption_c": payload.temp_assumption_c,
            "irrigation_available": payload.irrigation_available,
            "estimated_loss_pct": payload.estimated_loss_pct,
            "input_cost": payload.input_cost,
            "expected_yield_units": payload.expected_yield_units,
            "yield_unit": payload.yield_unit,
            "sale_price_per_unit": payload.sale_price_per_unit,
        },
        formulas_used=[
            "Baseline Revenue = Expected Yield × Sale Price per Unit",
            "Adjusted Yield = Expected Yield × (1 - Estimated Loss % / 100)",
            "Estimated Revenue = Adjusted Yield × Sale Price per Unit",
            "Estimated Profit / Loss = Estimated Revenue - Total Input Cost",
            "Potential Loss Amount = Baseline Revenue - Estimated Revenue",
        ],
        baseline_revenue=baseline_revenue,
        adjusted_yield=adjusted_yield,
        estimated_revenue=estimated_revenue,
        estimated_cost=round(payload.input_cost, 2),
        estimated_profit=estimated_profit,
        potential_loss_amount=potential_loss_amount,
        weather_stress_modifier_note=" ".join(stress_notes),
        sensitivity_curve=sensitivity_curve,
        disclaimer=SIMULATOR_DISCLAIMER,
        created_at=now,
    )


@router.get("/scenarios")
async def list_saved_scenarios(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(SimulationScenario).order_by(SimulationScenario.created_at.desc()).limit(20))
    rows = res.scalars().all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "field_id": r.field_id,
            "crop_type": r.crop_type,
            "expected_rainfall_mm": r.expected_rainfall_mm,
            "temp_assumption_c": r.temp_assumption_c,
            "irrigation_available": r.irrigation_available,
            "estimated_loss_pct": r.estimated_loss_pct,
            "input_cost": r.input_cost,
            "expected_yield_units": r.expected_yield_units,
            "yield_unit": r.yield_unit,
            "sale_price_per_unit": r.sale_price_per_unit,
            "baseline_revenue": r.baseline_revenue,
            "adjusted_yield": r.adjusted_yield,
            "estimated_revenue": r.estimated_revenue,
            "estimated_profit": r.estimated_profit,
            "potential_loss_amount": r.potential_loss_amount,
            "created_at": r.created_at,
        }
        for r in rows
    ]


@router.delete("/scenarios/{scenario_id}", status_code=204)
async def delete_scenario(scenario_id: int, db: AsyncSession = Depends(get_db)):
    rec = await db.get(SimulationScenario, scenario_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Scenario not found")
    await db.delete(rec)
    await db.commit()


@router.post("/decision-lab", response_model=DecisionLabRunResponse)
async def run_decision_lab(payload: DecisionLabRunRequest):
    """
    Decision Lab (Parallel Universe Farming): Evaluates 3 simultaneous scenarios
    (Scenario A: Current, Scenario B: Recommended, Scenario C: Adverse Climate)
    from identical starting conditions.
    """
    return run_decision_lab_simulation(payload)
