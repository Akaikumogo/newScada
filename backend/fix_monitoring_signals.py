"""
10-shkaf, 9-shkaf, 7-shkaf qurilmalari (.18-.23) uchun
to'g'ri IOA raqamlar bilan signallarni yangilaydi.
Qurilmalarni O'CHIRMAYDI — xavfsiz ishga tushirish mumkin.
"""
from __future__ import annotations

import asyncio
from sqlalchemy import select, delete

from app.infrastructure.db.database import AsyncSessionFactory, create_tables
from app.infrastructure.db.models import Device, DeviceSignal
from import_yunusobod import SIGNAL_GROUPS, DISCRETE_SIGNALS

# Qaysi IP — qaysi signal guruhi
MONITORING_IPS: dict[str, str] = {
    "192.168.199.18": "freq_ui",   # 10-shkaf A2 — T-2 chastota/tok/U relay
    "192.168.199.19": "diff",      # 10-shkaf A1 — T-2 differensial himoya
    "192.168.199.20": "tn35",      # 9-shkaf  A2 — TN-35 kuchlanish transformatori
    "192.168.199.21": "tn35",      # 9-shkaf  A1 — TN-35 kuchlanish transformatori
    "192.168.199.22": "diff",      # 7-shkaf  A1 — T-1 differensial himoya
    "192.168.199.23": "freq_ui",   # 7-shkaf  A2 — T-1 chastota/tok/U relay
}


async def fix_signals() -> None:
    await create_tables()
    async with AsyncSessionFactory() as session:
        total_analog = 0
        total_discrete = 0

        for ip, group in MONITORING_IPS.items():
            device = (await session.execute(
                select(Device).where(Device.iec104_host == ip)
            )).scalars().first()
            if not device:
                print(f"[WARN] Qurilma topilmadi: {ip}")
                continue

            # Mavjud signallarni o'chir
            await session.execute(
                delete(DeviceSignal).where(DeviceSignal.device_id == device.id)
            )

            obj_name = device.name
            analog_sigs = SIGNAL_GROUPS[group]

            for ioa, sname, title, unit, vt in analog_sigs:
                session.add(DeviceSignal(
                    device_id=device.id,
                    register_code=ioa,
                    signal_name=sname,
                    signal_title=f"{title} | IOA {ioa} | {obj_name}",
                    unit=unit,
                    value_type=vt,
                    active=True,
                    only_realtime=False,
                ))
                total_analog += 1

            for ioa, sname, title, unit, vt in DISCRETE_SIGNALS:
                session.add(DeviceSignal(
                    device_id=device.id,
                    register_code=ioa,
                    signal_name=sname,
                    signal_title=f"{title} | IOA {ioa} | {obj_name}",
                    unit=unit,
                    value_type=vt,
                    active=True,
                    only_realtime=False,
                ))
                total_discrete += 1

            print(
                f"[OK] {ip} ({group:8s}) id={device.id} | "
                f"{len(analog_sigs)} analog + {len(DISCRETE_SIGNALS)} discrete signal"
            )

        await session.commit()
        print(f"\n[OK] Jami: {total_analog} analog + {total_discrete} diskret signal yangilandi.")


if __name__ == "__main__":
    asyncio.run(fix_signals())
