from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import BudgetItem, Field
from app.schemas import BudgetItemCreate, BudgetItemUpdate, BudgetItemOut, BudgetSummaryOut

router = APIRouter(prefix="/budget", tags=["budget"])


def _to_out(item: BudgetItem, field_map: dict[int, str]) -> BudgetItemOut:
    variance = round(item.planned_cost - item.actual_cost, 2)
    return BudgetItemOut(
        id=item.id,
        field_id=item.field_id,
        field_name=field_map.get(item.field_id) if item.field_id else None,
        category=item.category,
        item_name=item.item_name,
        planned_cost=round(item.planned_cost, 2),
        actual_cost=round(item.actual_cost, 2),
        variance=variance,
        notes=item.notes or "",
        expense_date=item.expense_date,
        created_at=item.created_at,
    )


@router.get("", response_model=BudgetSummaryOut)
async def get_budget_summary(
    field_id: Optional[int] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    fields_res = await db.execute(select(Field))
    field_map = {f.id: f.name for f in fields_res.scalars().all()}

    stmt = select(BudgetItem).order_by(BudgetItem.created_at.desc())
    if field_id is not None:
        stmt = stmt.where(BudgetItem.field_id == field_id)

    res = await db.execute(stmt)
    records = res.scalars().all()

    items_out = [_to_out(r, field_map) for r in records]
    total_planned = round(sum(r.planned_cost for r in records), 2)
    total_actual = round(sum(r.actual_cost for r in records), 2)
    remaining_budget = round(total_planned - total_actual, 2)
    variance = remaining_budget

    cat_map: dict[str, dict[str, float]] = {}
    for r in records:
        bucket = cat_map.setdefault(r.category, {"planned": 0.0, "actual": 0.0})
        bucket["planned"] = round(bucket["planned"] + r.planned_cost, 2)
        bucket["actual"] = round(bucket["actual"] + r.actual_cost, 2)

    by_category = [
        {
            "category": cat,
            "planned": vals["planned"],
            "actual": vals["actual"],
            "variance": round(vals["planned"] - vals["actual"], 2),
        }
        for cat, vals in cat_map.items()
    ]

    return BudgetSummaryOut(
        total_planned=total_planned,
        total_actual=total_actual,
        remaining_budget=remaining_budget,
        variance=variance,
        items=items_out,
        by_category=by_category,
        profitability_note=(
            "Budget Manthan tracks user-entered planned and actual input expenses only. "
            "Net seasonal profit requires verified harvest yield and market sale price — "
            "use the What-If Simulator to model revenue scenarios."
        ),
    )


@router.post("", response_model=BudgetItemOut, status_code=201)
async def create_budget_item(payload: BudgetItemCreate, db: AsyncSession = Depends(get_db)):
    item = BudgetItem(
        field_id=payload.field_id,
        category=payload.category.strip(),
        item_name=payload.item_name.strip(),
        planned_cost=payload.planned_cost,
        actual_cost=payload.actual_cost,
        notes=payload.notes.strip(),
        expense_date=payload.expense_date or datetime.utcnow().strftime("%Y-%m-%d"),
        created_at=datetime.utcnow(),
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)

    field_map = {}
    if item.field_id:
        f = await db.get(Field, item.field_id)
        if f:
            field_map[f.id] = f.name
    return _to_out(item, field_map)


@router.put("/{item_id}", response_model=BudgetItemOut)
async def update_budget_item(item_id: int, payload: BudgetItemUpdate, db: AsyncSession = Depends(get_db)):
    item = await db.get(BudgetItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Budget item #{item_id} not found")

    updates = payload.model_dump(exclude_unset=True)
    for k, v in updates.items():
        if isinstance(v, str):
            v = v.strip()
        setattr(item, k, v)

    await db.commit()
    await db.refresh(item)

    field_map = {}
    if item.field_id:
        f = await db.get(Field, item.field_id)
        if f:
            field_map[f.id] = f.name
    return _to_out(item, field_map)


@router.delete("/{item_id}", status_code=204)
async def delete_budget_item(item_id: int, db: AsyncSession = Depends(get_db)):
    item = await db.get(BudgetItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Budget item #{item_id} not found")
    await db.delete(item)
    await db.commit()
