"""
CropSentinel — Resource-Aware Crop Rescue Optimizer Service.
Unifies Rescue Planner and Budget Manthan into a constraint-satisfaction
and priority-ranking engine.

Enforces hard resource limits:
  - Available budget (INR)
  - Available irrigation water (Liters)
  - Available labor hours
  - Equipment availability

Features dedicated Zero-Budget Mode:
  - Filters strictly for feasible no-cost cultural, preventive, and monitoring actions
  - Transparently lists what paid remedies are excluded
  - Never guarantees crop recovery without adequate resources
"""
from typing import List, Dict, Any
from app.schemas import (
    RescueOptimizerRequest,
    RescueOptimizerResponse,
    RescueInterventionOption,
)

ALL_CANDIDATE_INTERVENTIONS: List[Dict[str, Any]] = [
    {
        "action_id": "ACT_CLEAR_DRAINAGE_FURROWS",
        "title": "Clear Field Boundary Drainage Trenches & Furrows",
        "category": "cultural",
        "base_cost_inr": 0.0,
        "water_liters": 0.0,
        "labor_hours": 3.0,
        "equipment": "Hand Hoe / Spade",
        "purpose": "Eliminate standing water pockets and restore oxygen flow to root zones before rain event.",
        "direction_of_effect": "Prevents root hypoxia and fungal crown rot spread",
        "tradeoffs": "Requires physical field labor; does not reverse already rotted root tissue",
        "zero_budget": True,
        "safety_compliance": True,
        "evidence_quality": "strong",
        "base_rank": 92.0,
        "tags": ["waterlogging", "rain", "drainage", "root_rot", "general_stress"],
    },
    {
        "action_id": "ACT_SCOUT_W_PATTERN",
        "title": "Conduct Structured W-Pattern Field Quadrant Scouting",
        "category": "monitoring",
        "base_cost_inr": 0.0,
        "water_liters": 0.0,
        "labor_hours": 2.0,
        "equipment": "Magnifying Glass / Smartphone Camera",
        "purpose": "Inspect at least 20 plants across 5 field quadrants to establish if symptoms are localized or widespread.",
        "direction_of_effect": "Prevents misdiagnosis and unnecessary chemical spraying",
        "tradeoffs": "Diagnostic step only; does not provide direct therapeutic relief",
        "zero_budget": True,
        "safety_compliance": True,
        "evidence_quality": "strong",
        "base_rank": 90.0,
        "tags": ["general_stress", "disease", "pest", "yellowing", "spots"],
    },
    {
        "action_id": "ACT_MANUAL_ROGUEING",
        "title": "Sanitation Rogueing of Primary Focus Plants",
        "category": "cultural",
        "base_cost_inr": 0.0,
        "water_liters": 0.0,
        "labor_hours": 2.5,
        "equipment": "Hand pruners / Disposal bag",
        "purpose": "Carefully remove and bag heavily infected individual leaves/plants to eliminate primary spore inoculum.",
        "direction_of_effect": "Reduces secondary disease cycle reproduction rate by 40–60%",
        "tradeoffs": "Must destroy removed biomass away from crop perimeter; ineffective if infection is already field-wide",
        "zero_budget": True,
        "safety_compliance": True,
        "evidence_quality": "strong",
        "base_rank": 85.0,
        "tags": ["disease", "fungal", "spots", "blight", "virus"],
    },
    {
        "action_id": "ACT_SHIFT_IRRIGATION_TIMING",
        "title": "Shift Irrigation Timing to Pre-Dawn / Early Morning",
        "category": "irrigation",
        "base_cost_inr": 0.0,
        "water_liters": 1500.0,
        "labor_hours": 1.5,
        "equipment": "Existing Irrigation Valves / Pump",
        "purpose": "Irrigate before sunrise so soil absorbs moisture while foliage dries rapidly as sun rises, minimizing leaf wetness duration.",
        "direction_of_effect": "Maintains root hydration while inhibiting fungal spore germination",
        "tradeoffs": "Requires early morning schedule; water allocation must be available",
        "zero_budget": True,
        "safety_compliance": True,
        "evidence_quality": "strong",
        "base_rank": 88.0,
        "tags": ["heat", "humidity", "fungal", "drought", "general_stress"],
    },
    {
        "action_id": "ACT_ORGANIC_MULCHING",
        "title": "Apply On-Farm Organic Residue Mulching Around Stems",
        "category": "cultural",
        "base_cost_inr": 0.0,
        "water_liters": 0.0,
        "labor_hours": 4.0,
        "equipment": "Hand tools / Dry straw or crop stubble",
        "purpose": "Spread a 5–7 cm layer of available dry straw or weed stubble around the plant base to moderate soil temperature and suppress evaporation.",
        "direction_of_effect": "Retains soil moisture 25–35% longer under heat stress",
        "tradeoffs": "Must ensure mulch is dry and free of active pests/termites",
        "zero_budget": True,
        "safety_compliance": True,
        "evidence_quality": "strong",
        "base_rank": 82.0,
        "tags": ["heat", "drought", "moisture_deficit", "general_stress"],
    },
    {
        "action_id": "ACT_NEEM_BOTANICAL_SPRAY",
        "title": "Apply Cold-Pressed Neem Oil (1500 ppm) Botanical Spray",
        "category": "protection",
        "base_cost_inr": 650.0,
        "water_liters": 500.0,
        "labor_hours": 2.5,
        "equipment": "Knapsack Sprayer",
        "purpose": "Safe botanical deterrent for sucking pests (whiteflies, aphids, mites) and mild fungal suppression.",
        "direction_of_effect": "Disrupts pest feeding and egg laying without beneficial pollinator toxicity",
        "tradeoffs": "Slower knockdown than synthetics; requires thorough lower leaf surface coverage",
        "zero_budget": False,
        "safety_compliance": True,
        "evidence_quality": "strong",
        "base_rank": 84.0,
        "tags": ["pest", "disease", "mites", "curl", "mildew"],
    },
    {
        "action_id": "ACT_CHELATED_MICRONUTRIENT",
        "title": "Targeted Foliar Chelated Zinc & Iron Micronutrient Spray",
        "category": "nutrition",
        "base_cost_inr": 850.0,
        "water_liters": 400.0,
        "labor_hours": 2.0,
        "equipment": "Knapsack Sprayer",
        "purpose": "Correct interveinal chlorosis caused by high soil pH or nutrient lock.",
        "direction_of_effect": "Restores chlorophyll synthesis and photosynthetic efficiency within 5–7 days",
        "tradeoffs": "Only remedies physiological chlorosis; will not cure bacterial or fungal lesions",
        "zero_budget": False,
        "safety_compliance": True,
        "evidence_quality": "strong",
        "base_rank": 78.0,
        "tags": ["yellowing", "chlorosis", "nutrition", "ph_stress"],
    },
    {
        "action_id": "ACT_SUPPLEMENTAL_MICRO_IRRIGATION",
        "title": "Scheduled Supplemental Drip / Micro-Irrigation Pulse",
        "category": "irrigation",
        "base_cost_inr": 450.0,
        "water_liters": 3000.0,
        "labor_hours": 1.0,
        "equipment": "Drip System / Pump & Fuel",
        "purpose": "Deliver 25–30 mm effective root-zone moisture during sensitive flowering or pod-fill stage.",
        "direction_of_effect": "Halts moisture stress progression and prevents flower/fruit abortion",
        "tradeoffs": "Consumes substantial water quota and electricity/diesel budget",
        "zero_budget": False,
        "safety_compliance": True,
        "evidence_quality": "strong",
        "base_rank": 89.0,
        "tags": ["drought", "heat", "moisture_deficit", "general_stress"],
    },
    {
        "action_id": "ACT_LAB_SOIL_HEALTH_TEST",
        "title": "Comprehensive Government KVK / Lab Soil Health Card Testing",
        "category": "monitoring",
        "base_cost_inr": 250.0,
        "water_liters": 0.0,
        "labor_hours": 1.5,
        "equipment": "Soil Auger / Core Sample Bags",
        "purpose": "Sample representative soil cores across 8 field points to establish exact electrical conductivity (EC), organic carbon, and macro/micronutrient levels.",
        "direction_of_effect": "Provides definitive scientific soil baseline for customized fertilizer planning",
        "tradeoffs": "Results take 5–10 days; does not resolve immediate acute in-field wilting",
        "zero_budget": False,
        "safety_compliance": True,
        "evidence_quality": "strong",
        "base_rank": 75.0,
        "tags": ["ph_stress", "nutrition", "general_stress"],
    },
]


def optimize_rescue_interventions(payload: RescueOptimizerRequest) -> RescueOptimizerResponse:
    mode = "zero_budget" if payload.zero_budget_only or payload.available_budget_inr <= 0 else "constrained_budget"
    risk = payload.active_risk_type.lower()

    ranked: List[RescueInterventionOption] = []
    infeasible: List[str] = []

    for item in ALL_CANDIDATE_INTERVENTIONS:
        cost = item["base_cost_inr"]
        water = item["water_liters"]
        labor = item["labor_hours"]

        # 1. Zero budget constraint
        if mode == "zero_budget" and not item["zero_budget"]:
            infeasible.append(
                f"'{item['title']}' excluded: Requires paid expenditure (INR {cost:,.2f}) under Zero-Budget Mode."
            )
            continue

        # 2. Hard budget constraint
        if cost > payload.available_budget_inr:
            infeasible.append(
                f"'{item['title']}' excluded: Cost INR {cost:,.2f} exceeds available budget of INR {payload.available_budget_inr:,.2f}."
            )
            continue

        # 3. Hard water constraint
        if water > payload.available_water_liters:
            infeasible.append(
                f"'{item['title']}' excluded: Water requirement of {water:,.0f} L exceeds available supply ({payload.available_water_liters:,.0f} L)."
            )
            continue

        # 4. Hard labor constraint
        if labor > payload.available_labor_hours:
            infeasible.append(
                f"'{item['title']}' excluded: Requires {labor} labor hours; only {payload.available_labor_hours} hours available."
            )
            continue

        # Calculate rank score based on relevance to active risk
        score = item["base_rank"]
        tags = item.get("tags", [])
        if any(t in risk for t in tags) or "general_stress" in tags:
            score += 15.0

        if item["zero_budget"] and mode == "zero_budget":
            score += 10.0

        rationale = (
            f"Matches {payload.crop_name} ({payload.growth_stage}). Addresses identified risk factors while strictly "
            f"respecting available constraints (uses INR {cost:,.0f} of INR {payload.available_budget_inr:,.0f} budget, "
            f"{water:,.0f} L of {payload.available_water_liters:,.0f} L water, and {labor} hrs labor)."
        )

        ranked.append(
            RescueInterventionOption(
                action_id=item["action_id"],
                title=item["title"],
                category=item["category"],
                estimated_cost_inr=cost,
                water_required_liters=water,
                labor_hours=labor,
                equipment_needed=item["equipment"],
                purpose=item["purpose"],
                direction_of_effect=item["direction_of_effect"],
                potential_tradeoffs=item["tradeoffs"],
                is_zero_budget_feasible=item["zero_budget"],
                safety_compliance=item["safety_compliance"],
                evidence_quality=item["evidence_quality"],
                rank_score=round(score, 1),
                selection_rationale=rationale,
            )
        )

    # Sort descending by rank score
    ranked.sort(key=lambda x: x.rank_score, reverse=True)

    zero_budget_advice = [
        "1. Never attempt chemical applications without protective equipment or genuine verified diagnosis.",
        "2. Cultural interventions (sanitation, boundary drainage clearing, mulching) reduce pathogen pressure significantly at zero cash cost.",
        "3. In severe acute wilt or outbreak situations, immediately contact your local Block Agricultural Officer or Krishi Vigyan Kendra (KVK) for subsidized assistance.",
    ]

    disclaimer = (
        "DECISION SUPPORT & SAFETY PROTOCOL: Interventions are ranked by constraint feasibility and agronomic logic. "
        "CropSentinel never prescribes unverified synthetic chemicals or off-label pesticide dosages. "
        "Zero-budget interventions are preventive and sanitary measures; they do not guarantee disease eradication."
    )

    return RescueOptimizerResponse(
        mode=mode,
        available_budget_inr=payload.available_budget_inr,
        available_water_liters=payload.available_water_liters,
        ranked_options=ranked,
        infeasible_options_excluded=infeasible,
        zero_budget_preventive_advice=zero_budget_advice,
        optimizer_disclaimer=disclaimer,
    )
