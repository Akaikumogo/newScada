"""
7-shkaf A1 (.22) va A2 (.23) uchun Excel faylidan 1:1 signallar.
Qurilmalarni O'CHIRMAYDI — faqat signallarni yangilaydi.
"""
from __future__ import annotations

import asyncio
import re
from sqlalchemy import select, delete

from app.infrastructure.db.database import AsyncSessionFactory, create_tables
from app.infrastructure.db.models import Device, DeviceSignal


# ─── XLS o'qish ──────────────────────────────────────────────────────────────

def read_xls(path: str) -> list[list[str]]:
    with open(path, "rb") as f:
        raw = f.read()
    text = raw[2:].decode("utf-16-le")
    return [line.split("\t") for line in text.splitlines() if line.strip()]


def parse_analog_signals(rows: list[list[str]]) -> list[tuple[int, str, str]]:
    """
    Faqat M_ME_TF_1 va M_ME_NC_1 tipidagi signallarni oladi.
    Qaytaradi: [(ioa, excel_name, type_str), ...]
    """
    results = []
    for row in rows:
        if len(row) < 3:
            continue
        first = row[0].strip()
        if not first.isdigit():
            continue
        ioa = int(first)
        name = row[1].strip() if len(row) > 1 else ""
        typ  = row[2].strip() if len(row) > 2 else ""
        if typ in ("M_ME_TF_1", "M_ME_NC_1") and name:
            results.append((ioa, name, typ))
    return results


def make_signal_name(ioa: int, excel_name: str) -> str:
    """
    Excel nomidan qisqa signal_name yasaydi.
    Agar nom lotin harflaridan boshlanmasa yoki bo'sh bo'lsa — ioa_NNNN ishlatiladi.
    """
    # Lotin harflari/raqamlardan iborat so'zlarni olish
    tokens = re.findall(r"[A-Za-z][A-Za-z0-9/_]*|[0-9]+[A-Za-z][A-Za-z0-9/_]*", excel_name)
    if tokens:
        # Birinchi 2-3 tokenni birlashtirish, max 20 harf
        name = "_".join(tokens[:3])[:20]
    else:
        name = f"ioa_{ioa}"
    # Havfsiz belgilar
    name = re.sub(r"[^A-Za-z0-9_]", "_", name)
    return name.strip("_") or f"ioa_{ioa}"


def unit_from_name(excel_name: str) -> str:
    """Nomi ichidagi birlikni topadi."""
    m = re.search(r",\s*([A-Za-zА-Яа-яёЁ%/]+)\s*$", excel_name)
    if m:
        u = m.group(1)
        if u in ("A", "А"):
            return "A"
        if u in ("B", "В", "B"):
            return "V"
        if "Гц" in excel_name or "Hz" in excel_name:
            return "Hz"
        if u == "%":
            return "%"
    if "Гц" in excel_name or ", Гц" in excel_name:
        return "Hz"
    if ", A" in excel_name or ",A" in excel_name:
        return "A"
    if ", В" in excel_name or ", V" in excel_name:
        return "V"
    return ""


# ─── 7-A1 (.22) Differential relay ──────────────────────────────────────────

PATH_22 = r"C:\Users\User\Desktop\analitika\7-shkaf\A1 BMRZ 192.168.199.22.xls"
PATH_23 = r"C:\Users\User\Desktop\analitika\7-shkaf\A2 BMRZ  192.168.199.23.xls"

IP_TO_PATH = {
    "192.168.199.22": PATH_22,
    "192.168.199.23": PATH_23,
}


async def fix_7shkaf() -> None:
    await create_tables()

    async with AsyncSessionFactory() as session:
        for ip, xls_path in IP_TO_PATH.items():
            device = (await session.execute(
                select(Device).where(Device.iec104_host == ip)
            )).scalars().first()
            if not device:
                print(f"[WARN] Qurilma topilmadi: {ip}")
                continue

            rows = read_xls(xls_path)
            analogs = parse_analog_signals(rows)
            print(f"\n[INFO] {ip} -> {len(analogs)} analog signal topildi")

            # Mavjud signallarni o'chir
            await session.execute(
                delete(DeviceSignal).where(DeviceSignal.device_id == device.id)
            )

            used_names: dict[str, int] = {}
            added = 0
            for ioa, excel_name, typ in analogs:
                base_name = make_signal_name(ioa, excel_name)
                # Takrorlanishni oldini olish
                if base_name in used_names:
                    used_names[base_name] += 1
                    signal_name = f"{base_name}_{used_names[base_name]}"
                else:
                    used_names[base_name] = 0
                    signal_name = base_name

                unit = unit_from_name(excel_name)

                session.add(DeviceSignal(
                    device_id=device.id,
                    register_code=ioa,
                    signal_name=signal_name,
                    signal_title=f"IOA {ioa} | {excel_name} | {device.name}",
                    unit=unit,
                    value_type="float",
                    active=True,
                    only_realtime=False,
                ))
                added += 1

            print(f"[OK]  {ip} ({device.name}) -> {added} signal yozildi")

        await session.commit()
        print("\n[OK] Commit amalga oshirildi.")


if __name__ == "__main__":
    asyncio.run(fix_7shkaf())
