from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    """Create all tables on startup, ensure backward-compatible columns exist, and heal any literal 'undefined' strings."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        try:
            await conn.execute(text("ALTER TABLE fields ADD COLUMN user_id INTEGER"))
        except Exception:
            pass
        # Sanitize any legacy literal 'undefined' or 'null' strings in crop_records
        for col in (
            "crop_variety",
            "field_location",
            "sowing_date",
            "fertilizer_used",
            "pesticide_used",
            "visible_symptoms",
        ):
            try:
                await conn.execute(
                    text(
                        f"UPDATE crop_records SET {col} = '' "
                        f"WHERE LOWER(TRIM(COALESCE({col}, ''))) IN ('undefined', 'null', 'none')"
                    )
                )
            except Exception:
                pass
