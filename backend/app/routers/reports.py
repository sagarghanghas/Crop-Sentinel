"""
Reports & Overview Summary Router.
- Serves real database records when available.
- When no user assessments exist yet, provides clearly-labeled DEMO preview series
  with `is_demo: True` so the user is never misled about fabricated sensor or AI outputs.
"""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Field, Assessment, RescueTask, BudgetItem, SimulationScenario, EvidenceEntry

router = APIRouter(tags=["reports"])


@router.get("/reports/summary")
async def get_reports_summary(
    field_id: Optional[int] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    fields_res = await db.execute(select(Field).order_by(Field.created_at.desc()))
    fields = fields_res.scalars().all()
    field_map = {f.id: f.name for f in fields}

    assess_stmt = select(Assessment).order_by(Assessment.created_at.desc())
    task_stmt = select(RescueTask).order_by(RescueTask.created_at.desc())
    budget_stmt = select(BudgetItem).order_by(BudgetItem.created_at.desc())
    evidence_stmt = select(EvidenceEntry).order_by(EvidenceEntry.created_at.desc())
    sim_stmt = select(SimulationScenario).order_by(SimulationScenario.created_at.desc())

    if field_id is not None:
        assess_stmt = assess_stmt.where(Assessment.field_id == field_id)
        task_stmt = task_stmt.where(RescueTask.field_id == field_id)
        budget_stmt = budget_stmt.where(BudgetItem.field_id == field_id)
        evidence_stmt = evidence_stmt.where(EvidenceEntry.field_id == field_id)
        sim_stmt = sim_stmt.where(SimulationScenario.field_id == field_id)

    assessments = (await db.execute(assess_stmt)).scalars().all()
    tasks = (await db.execute(task_stmt)).scalars().all()
    budgets = (await db.execute(budget_stmt)).scalars().all()
    evidences = (await db.execute(evidence_stmt)).scalars().all()
    scenarios = (await db.execute(sim_stmt)).scalars().all()

    has_real_data = len(fields) > 0 or len(assessments) > 0

    # Risk distribution
    healthy_count = sum(1 for f in fields if f.status == "healthy")
    watch_count = sum(1 for f in fields if f.status == "watch")
    high_risk_count = sum(1 for f in fields if f.status == "high-risk")

    assess_healthy = sum(1 for a in assessments if a.risk_category == "healthy")
    assess_watch = sum(1 for a in assessments if a.risk_category == "watch")
    assess_high = sum(1 for a in assessments if a.risk_category == "high-risk")

    # Trend series: use real assessments if available, else clearly flagged DEMO preview
    if assessments:
        by_day: dict[str, list[float]] = {}
        for a in reversed(assessments):
            day_str = a.created_at.strftime("%Y-%m-%d")
            health_idx = max(0.0, 100.0 - (a.risk_score if a.risk_score is not None else 25.0))
            by_day.setdefault(day_str, []).append(health_idx)
        health_trend = [
            {
                "date": d,
                "health_index": round(sum(vals) / len(vals), 1),
                "assessments_count": len(vals),
                "is_demo": False,
            }
            for d, vals in sorted(by_day.items())[-14:]
        ]
    else:
        today = datetime.utcnow().date()
        demo_scores = [78.0, 76.5, 79.0, 74.0, 71.5, 73.0, 77.5]
        health_trend = [
            {
                "date": (today - timedelta(days=6 - i)).isoformat(),
                "health_index": demo_scores[i],
                "assessments_count": 0,
                "is_demo": True,
            }
            for i in range(7)
        ]

    # Estimated potential loss from latest saved scenario if available
    latest_potential_loss = scenarios[0].potential_loss_amount if scenarios else None

    # Task status counts
    pending_tasks = sum(1 for t in tasks if t.status == "pending")
    in_progress_tasks = sum(1 for t in tasks if t.status == "in_progress")
    completed_tasks = sum(1 for t in tasks if t.status == "completed")

    # Budget totals
    total_planned = round(sum(b.planned_cost for b in budgets), 2)
    total_actual = round(sum(b.actual_cost for b in budgets), 2)

    # Prioritized recommended actions (from pending rescue tasks + recent evidence)
    recommended_actions = []
    for t in tasks[:6]:
        if t.status != "completed":
            recommended_actions.append({
                "id": f"task-{t.id}",
                "title": t.title,
                "reason": t.reason,
                "urgency": t.urgency,
                "status": t.status,
                "field_id": t.field_id,
                "field_name": field_map.get(t.field_id, "All Fields") if t.field_id else "General",
                "source": t.evidence_source,
                "is_demo": False,
            })

    if not recommended_actions and not has_real_data:
        recommended_actions = [
            {
                "id": "demo-rec-1",
                "title": "[DEMO] Register your first field in Field Monitor",
                "reason": "Adding field boundaries, crop type, and planting date enables tailored risk scoring and rescue plans.",
                "urgency": "high",
                "status": "pending",
                "field_id": None,
                "field_name": "Demo Preview",
                "source": "Onboarding Guide",
                "is_demo": True,
            },
            {
                "id": "demo-rec-2",
                "title": "[DEMO] Select your farm location in Weather Intelligence",
                "reason": "Connecting real Open-Meteo coordinates activates live rainfall, heat, and humidity risk alerts.",
                "urgency": "medium",
                "status": "pending",
                "field_id": None,
                "field_name": "Demo Preview",
                "source": "Onboarding Guide",
                "is_demo": True,
            },
        ]

    # Recent activity feed
    recent_activity = []
    for a in assessments[:5]:
        recent_activity.append({
            "id": f"assess-{a.id}",
            "type": "assessment",
            "title": f"Crop Assessment ({a.crop_type}) — {a.predicted_condition or a.analysis_status.upper()}",
            "detail": f"Risk category: {a.risk_category.upper()} | Completeness: {int(a.data_completeness_pct)}%",
            "field_name": field_map.get(a.field_id) if a.field_id else None,
            "timestamp": a.created_at,
            "is_demo": a.is_demo,
        })
    for t in tasks[:5]:
        recent_activity.append({
            "id": f"task-{t.id}",
            "type": "task",
            "title": f"Rescue Task ({t.status.replace('_', ' ')}): {t.title}",
            "detail": t.reason[:120],
            "field_name": field_map.get(t.field_id) if t.field_id else None,
            "timestamp": t.updated_at or t.created_at,
            "is_demo": False,
        })
    recent_activity.sort(key=lambda x: x["timestamp"], reverse=True)

    return {
        "is_demo": not has_real_data,
        "summary_cards": {
            "total_fields": len(fields),
            "total_assessments": len(assessments),
            "elevated_risk_fields": watch_count + high_risk_count,
            "high_risk_fields": high_risk_count,
            "active_recommendations": pending_tasks + in_progress_tasks,
            "estimated_potential_loss": latest_potential_loss,
            "has_loss_estimate": latest_potential_loss is not None,
        },
        "risk_distribution": [
            {"category": "Healthy", "fields": healthy_count, "assessments": assess_healthy, "color": "#15803d"},
            {"category": "Watch", "fields": watch_count, "assessments": assess_watch, "color": "#d97706"},
            {"category": "High-Risk", "fields": high_risk_count, "assessments": assess_high, "color": "#dc2626"},
        ],
        "health_trend": health_trend,
        "task_summary": {
            "pending": pending_tasks,
            "in_progress": in_progress_tasks,
            "completed": completed_tasks,
            "total": len(tasks),
        },
        "budget_summary": {
            "total_planned": total_planned,
            "total_actual": total_actual,
            "variance": round(total_planned - total_actual, 2),
            "items_count": len(budgets),
        },
        "recommended_actions": recommended_actions,
        "recent_activity": recent_activity[:8],
        "evidence_count": len(evidences),
    }
