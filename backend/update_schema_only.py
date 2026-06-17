"""
Update only the canvas schema for Yunusobod substation.
Does NOT wipe devices or signals — safe to run at any time.
"""
from __future__ import annotations

import asyncio
from sqlalchemy import select

from app.infrastructure.db.database import AsyncSessionFactory, create_tables
from app.infrastructure.db.models import Device, Substation, SubstationSchema
from import_yunusobod import SUBSTATION_NAME, _build_canvas


async def update_schema() -> None:
    await create_tables()
    async with AsyncSessionFactory() as session:
        sub = (await session.execute(
            select(Substation).where(Substation.name == SUBSTATION_NAME)
        )).scalars().first()
        if not sub:
            print("[ERROR] Yunusobod substation topilmadi")
            return

        devices = (await session.execute(
            select(Device).where(Device.substation_id == sub.id)
        )).scalars().all()
        ip_to_device = {d.iec104_host: d for d in devices}

        canvas = _build_canvas(ip_to_device)

        schema = (await session.execute(
            select(SubstationSchema).where(SubstationSchema.substation_id == sub.id)
        )).scalars().first()
        if schema:
            schema.canvas_json = canvas
        else:
            schema = SubstationSchema(substation_id=sub.id, canvas_json=canvas)
            session.add(schema)

        await session.commit()
        print(f"[OK] Schema yangilandi: substation id={sub.id}, name={sub.name!r}")
        print(f"[OK] Canvas nodes: {len(canvas['nodes'])}")
        print(f"[OK] Canvas edges: {len(canvas['edges'])}")


if __name__ == "__main__":
    asyncio.run(update_schema())
