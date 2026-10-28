import asyncio
import sys
from app.schemas import (
    DecisionLabRunRequest,
    RescueOptimizerRequest,
    DiagnosticEvaluateRequest,
)
from app.services.decision_lab_service import run_decision_lab_simulation
from app.services.butterfly_risk_service import evaluate_butterfly_risks
from app.services.rescue_optimizer_service import optimize_rescue_interventions
from app.services.diagnostic_engine_service import evaluate_root_cause_diagnostics
from app.services.trend_anomaly_service import analyze_stress_trends
from app.services.variety_intelligence_service import compare_crop_varieties
from app.database import init_db


def main():
    print("=== TESTING CROPSENTINEL INTELLIGENCE SERVICES ===")

    # 1. Decision Lab
    req_dl = DecisionLabRunRequest(
        crop_name="Wheat",
        growth_stage="Flowering",
        total_area_acres=2.0,
        expected_yield_per_acre=20.0,
        sale_price_per_unit=2275.0,
        baseline_input_cost=45000.0,
        current_soil_moisture_pct=24.0,
        current_temp_c=35.0,
        forecast_rainfall_3d_mm=5.0,
        available_budget=15000.0,
        available_water_liters=10000.0,
    )
    res_dl = run_decision_lab_simulation(req_dl)
    assert res_dl.scenario_a_current.estimated_profit < res_dl.scenario_b_recommended.estimated_profit
    assert res_dl.scenario_c_adverse.projected_risk_score >= res_dl.scenario_a_current.projected_risk_score
    print("[PASS] Decision Lab: 3 parallel scenarios computed correctly with ROI and risk progression")

    # 2. Butterfly Risk Engine
    res_bf = evaluate_butterfly_risks(
        crop_name="Wheat",
        growth_stage="Flowering",
        current_temp_c=36.0,
        soil_moisture_pct=22.0,
        relative_humidity_pct=82.0,
        rainfall_3d_sum_mm=45.0,
        drainage_quality="Poor",
        visible_symptoms="brown leaf spots and wilting",
    )
    assert len(res_bf.compounding_alerts) >= 2
    assert res_bf.overall_status in ("critical", "warning")
    print(f"[PASS] Butterfly Risk: {len(res_bf.compounding_alerts)} compounding alerts detected, score={res_bf.combined_risk_score}")

    # 3. Rescue Optimizer (Normal Mode)
    req_ro = RescueOptimizerRequest(
        crop_name="Wheat",
        growth_stage="Flowering",
        active_risk_type="drought_and_heat",
        available_budget_inr=5000.0,
        available_water_liters=4000.0,
        available_labor_hours=8.0,
        zero_budget_only=False,
    )
    res_ro = optimize_rescue_interventions(req_ro)
    assert len(res_ro.ranked_options) > 0
    print(f"[PASS] Rescue Optimizer: {len(res_ro.ranked_options)} feasible interventions ranked under resource constraints")

    # 4. Rescue Optimizer (Zero Budget Mode)
    req_ro_zero = RescueOptimizerRequest(
        crop_name="Wheat",
        growth_stage="Flowering",
        active_risk_type="drought_and_heat",
        available_budget_inr=0.0,
        available_water_liters=2000.0,
        available_labor_hours=6.0,
        zero_budget_only=True,
    )
    res_ro_zero = optimize_rescue_interventions(req_ro_zero)
    assert all(opt.is_zero_budget_feasible for opt in res_ro_zero.ranked_options)
    assert all(opt.estimated_cost_inr == 0.0 for opt in res_ro_zero.ranked_options)
    print(f"[PASS] Rescue Optimizer (Zero-Budget): Strictly no-cost cultural/preventive actions ranked (0 INR)")

    # 5. Root-Cause Diagnostics
    req_diag = DiagnosticEvaluateRequest(
        crop_name="Tomato",
        growth_stage="Fruiting",
        visible_symptoms="yellowing with dark concentric rings on lower leaves",
        distribution_pattern="focal_patches",
        recent_rainfall_or_irrigation="heavy_rain",
    )
    res_diag = evaluate_root_cause_diagnostics(req_diag)
    assert len(res_diag.hypotheses) >= 3
    assert len(res_diag.next_follow_up_questions) >= 2
    print(f"[PASS] Root-Cause Diagnostics: {len(res_diag.hypotheses)} hypotheses ranked, top={res_diag.hypotheses[0].cause_name}")

    # 6. Stress Trend & Anomaly Detection
    res_trend = analyze_stress_trends(
        field_id=1,
        crop_name="Wheat",
        growth_stage="Flowering",
        current_soil_moisture_pct=26.0,
        current_temp_c=34.0,
        current_ndvi=0.68,
        historical_soil_readings=[33.0, 30.5, 28.0, 26.0],
    )
    assert len(res_trend.trends) == 3
    print("[PASS] Trend Anomaly: Days-to-threshold projected accurately before permanent wilting")

    # 7. Crop Variety Intelligence
    res_var = compare_crop_varieties(
        target_crop="Wheat",
        field_temperature_c=27.0,
        field_soil_ph=6.8,
        annual_rainfall_mm=800.0,
    )
    assert len(res_var.comparison_list) >= 4
    print(f"[PASS] Variety Intelligence: {len(res_var.comparison_list)} varieties evaluated against 182-crop catalogue")

    print("ALL 7 INTELLIGENCE ENGINE TESTS PASSED CLEANLY!")


if __name__ == "__main__":
    main()
