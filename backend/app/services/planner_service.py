"""
Crop Rescue Planner Service.
Generates actionable, safe, non-prescriptive field tasks grounded in
available assessments, crop growth stage, and missing data gaps.
Never prescribes chemical dosages or unverified pesticide treatments.
"""
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from app.models import Field, Assessment


def generate_rescue_tasks_for_field(
    field: Field,
    latest_assessment: Optional[Assessment] = None,
) -> List[Dict[str, Any]]:
    tasks: List[Dict[str, Any]] = []
    today = datetime.utcnow().date()

    crop = field.crop_type
    stage = field.growth_stage or "Vegetative"

    if not latest_assessment:
        tasks.append({
            "title": f"Conduct baseline visual scouting in {field.name} ({crop})",
            "reason": (
                f"No recent health assessment is stored for {field.name}. Walk a W-shaped transect "
                f"and inspect at least 20 plants at the {stage} stage."
            ),
            "evidence_source": "Missing Data Gap",
            "urgency": "high",
            "due_date": (today + timedelta(days=1)).isoformat(),
        })
        tasks.append({
            "title": f"Check soil moisture at root zone (10–15 cm depth) for {crop}",
            "reason": (
                f"Rule-based agronomic check for {crop} during {stage} stage to prevent moisture stress."
            ),
            "evidence_source": "Rule Engine",
            "urgency": "medium",
            "due_date": (today + timedelta(days=2)).isoformat(),
        })
        return tasks

    # Tasks based on latest assessment
    pred = latest_assessment.predicted_condition or "Unclassified condition"
    risk_cat = latest_assessment.risk_category

    if latest_assessment.analysis_status == "completed" and "healthy" not in pred.lower():
        tasks.append({
            "title": f"Verify preliminary '{pred}' signal across {field.name}",
            "reason": (
                f"AI classification flagged '{pred}' on {latest_assessment.created_at.strftime('%Y-%m-%d')}. "
                "Inspect upper and lower canopy leaves across 5 field quadrants to confirm whether symptoms are localized or spreading."
            ),
            "evidence_source": f"AI Model ({latest_assessment.model_id or 'Classifier'})",
            "urgency": "immediate" if risk_cat == "high-risk" else "high",
            "due_date": (today + timedelta(days=1)).isoformat(),
        })
        tasks.append({
            "title": "Consult local agricultural extension officer with physical leaf samples",
            "reason": (
                "Image-based classification is preliminary. Before applying any crop protection product, "
                "obtain region-specific, crop-safe guidance from a certified agronomist."
            ),
            "evidence_source": "Safety & Verification Protocol",
            "urgency": "high",
            "due_date": (today + timedelta(days=2)).isoformat(),
        })

    if latest_assessment.user_notes:
        tasks.append({
            "title": f"Follow up on recorded field observation in {field.name}",
            "reason": f"User observation noted: '{latest_assessment.user_notes[:140]}'. Photograph marked plants after 48 hours to track progression.",
            "evidence_source": "User Observation",
            "urgency": "medium",
            "due_date": (today + timedelta(days=2)).isoformat(),
        })

    tasks.append({
        "title": f"Review microclimate & drainage for {crop} ({stage} stage)",
        "reason": (
            f"Ensure irrigation scheduling and field drainage match {crop} water requirements at {stage} stage "
            "without prolonging canopy leaf wetness."
        ),
        "evidence_source": "Rule Engine",
        "urgency": "routine",
        "due_date": (today + timedelta(days=4)).isoformat(),
    })

    return tasks
