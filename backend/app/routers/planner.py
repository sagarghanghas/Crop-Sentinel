from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import RescueTask, Field, Assessment
from app.schemas import (
    RescueTaskCreate,
    RescueTaskUpdate,
    RescueTaskOut,
    RescueOptimizerRequest,
    RescueOptimizerResponse,
)
from app.services.planner_service import generate_rescue_tasks_for_field
from app.services.rescue_optimizer_service import optimize_rescue_interventions

router = APIRouter(prefix="/planner", tags=["planner"])


def _to_out(task: RescueTask, field_map: dict[int, str]) -> RescueTaskOut:
    return RescueTaskOut(
        id=task.id,
        field_id=task.field_id,
        field_name=field_map.get(task.field_id) if task.field_id else None,
        assessment_id=task.assessment_id,
        title=task.title,
        reason=task.reason,
        evidence_source=task.evidence_source,
        urgency=task.urgency,
        status=task.status,
        completion_notes=task.completion_notes or "",
        due_date=task.due_date,
        created_at=task.created_at,
        updated_at=task.updated_at or task.created_at,
    )


@router.get("/tasks", response_model=List[RescueTaskOut])
async def list_tasks(
    field_id: Optional[int] = Query(default=None),
    status: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    fields_res = await db.execute(select(Field))
    field_map = {f.id: f.name for f in fields_res.scalars().all()}

    stmt = select(RescueTask).order_by(RescueTask.created_at.desc())
    if field_id is not None:
        stmt = stmt.where(RescueTask.field_id == field_id)
    if status:
        stmt = stmt.where(RescueTask.status == status)

    res = await db.execute(stmt)
    return [_to_out(t, field_map) for t in res.scalars().all()]


@router.post("/tasks", response_model=RescueTaskOut, status_code=201)
async def create_task(payload: RescueTaskCreate, db: AsyncSession = Depends(get_db)):
    now = datetime.utcnow()
    task = RescueTask(
        field_id=payload.field_id,
        assessment_id=payload.assessment_id,
        title=payload.title.strip(),
        reason=payload.reason.strip(),
        evidence_source=payload.evidence_source.strip(),
        urgency=payload.urgency,
        status="pending",
        completion_notes="",
        due_date=payload.due_date,
        created_at=now,
        updated_at=now,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    field_map = {}
    if task.field_id:
        f = await db.get(Field, task.field_id)
        if f:
            field_map[f.id] = f.name
    return _to_out(task, field_map)


@router.post("/generate/{field_id}", response_model=List[RescueTaskOut], status_code=201)
async def generate_plan_for_field(field_id: int, db: AsyncSession = Depends(get_db)):
    field = await db.get(Field, field_id)
    if not field:
        raise HTTPException(status_code=404, detail=f"Field #{field_id} not found")

    stmt = (
        select(Assessment)
        .where(Assessment.field_id == field_id)
        .order_by(Assessment.created_at.desc())
        .limit(1)
    )
    latest_res = await db.execute(stmt)
    latest_assessment = latest_res.scalar_one_or_none()

    generated = generate_rescue_tasks_for_field(field, latest_assessment)
    now = datetime.utcnow()
    created_tasks: List[RescueTask] = []

    for item in generated:
        t = RescueTask(
            field_id=field.id,
            assessment_id=latest_assessment.id if latest_assessment else None,
            title=item["title"],
            reason=item["reason"],
            evidence_source=item["evidence_source"],
            urgency=item["urgency"],
            status="pending",
            completion_notes="",
            due_date=item["due_date"],
            created_at=now,
            updated_at=now,
        )
        db.add(t)
        created_tasks.append(t)

    await db.commit()
    for t in created_tasks:
        await db.refresh(t)

    field_map = {field.id: field.name}
    return [_to_out(t, field_map) for t in created_tasks]


@router.put("/tasks/{task_id}", response_model=RescueTaskOut)
async def update_task(task_id: int, payload: RescueTaskUpdate, db: AsyncSession = Depends(get_db)):
    task = await db.get(RescueTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Rescue task #{task_id} not found")

    updates = payload.model_dump(exclude_unset=True)
    for k, v in updates.items():
        if isinstance(v, str):
            v = v.strip()
        setattr(task, k, v)
    task.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(task)

    field_map = {}
    if task.field_id:
        f = await db.get(Field, task.field_id)
        if f:
            field_map[f.id] = f.name
    return _to_out(task, field_map)


@router.delete("/tasks/{task_id}", status_code=204)
async def delete_task(task_id: int, db: AsyncSession = Depends(get_db)):
    task = await db.get(RescueTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Rescue task #{task_id} not found")
    await db.delete(task)
    await db.commit()


@router.post("/optimize", response_model=RescueOptimizerResponse)
async def optimize_interventions_endpoint(payload: RescueOptimizerRequest):
    """
    Resource-Aware Crop Rescue Optimizer: Constraint-based priority ranking across
    candidate interventions under hard budget, water, and labor constraints,
    including strict Zero-Budget Mode.
    """
    return optimize_rescue_interventions(payload)
