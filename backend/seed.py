"""
Quick seed script — populates newscada DB with demo data.
Run: python seed.py
"""
import asyncio
from sqlalchemy import select, text
from app.infrastructure.db.database import AsyncSessionFactory, create_tables
from app.infrastructure.db.models import Branch, Substation, DeviceModel, Device, DeviceSignal


BRANCHES = [
    {"name": "Toshkent filiali"},
    {"name": "Samarqand filiali"},
]

DEVICE_MODELS = [
    {"name": "SEL-751", "manufacturer": "Schweitzer Engineering"},
    {"name": "REF615", "manufacturer": "ABB"},
    {"name": "SIPROTEC 5", "manufacturer": "Siemens"},
]

SUBSTATIONS = [
    {"branch_idx": 0, "name": "110 kV Sergeli PS"},
    {"branch_idx": 0, "name": "220 kV Yunusobod PS"},
    {"branch_idx": 0, "name": "110 kV Mirzo Ulug'bek PS"},
    {"branch_idx": 1, "name": "110 kV Samarqand-1 PS"},
    {"branch_idx": 1, "name": "35 kV Urgut PS"},
]

DEVICES_TEMPLATE = [
    {"name": "Qo'riqlovchi #{n}", "model_idx": 0, "host_suffix": 10},
    {"name": "Transformator #{n}", "model_idx": 1, "host_suffix": 11},
    {"name": "Shinalar #{n}", "model_idx": 2, "host_suffix": 12},
]

SIGNALS_TEMPLATE = [
    {"register_code": 101, "signal_name": "U_A", "signal_title": "Faza A kuchlanish", "unit": "kV", "value_type": "float"},
    {"register_code": 102, "signal_name": "U_B", "signal_title": "Faza B kuchlanish", "unit": "kV", "value_type": "float"},
    {"register_code": 103, "signal_name": "U_C", "signal_title": "Faza C kuchlanish", "unit": "kV", "value_type": "float"},
    {"register_code": 201, "signal_name": "I_A", "signal_title": "Faza A tok", "unit": "A", "value_type": "float"},
    {"register_code": 202, "signal_name": "I_B", "signal_title": "Faza B tok", "unit": "A", "value_type": "float"},
    {"register_code": 203, "signal_name": "I_C", "signal_title": "Faza C tok", "unit": "A", "value_type": "float"},
    {"register_code": 301, "signal_name": "P", "signal_title": "Faol quvvat", "unit": "MW", "value_type": "float"},
    {"register_code": 302, "signal_name": "Q", "signal_title": "Reaktiv quvvat", "unit": "MVAr", "value_type": "float"},
    {"register_code": 401, "signal_name": "CB_STATUS", "signal_title": "Kommutator holati", "unit": "", "value_type": "status"},
    {"register_code": 402, "signal_name": "TRIP", "signal_title": "Rele ishga tushishi", "unit": "", "value_type": "status"},
]


async def seed():
    print("Creating tables...")
    await create_tables()

    async with AsyncSessionFactory() as session:
        # Check if already seeded
        existing = (await session.execute(select(Branch))).scalars().first()
        if existing:
            print("DB already has data — skipping seed.")
            return

        print("Seeding branches...")
        branch_objs = []
        for b in BRANCHES:
            obj = Branch(name=b["name"])
            session.add(obj)
            branch_objs.append(obj)
        await session.flush()

        print("Seeding device models...")
        model_objs = []
        for m in DEVICE_MODELS:
            obj = DeviceModel(name=m["name"], manufacturer=m["manufacturer"])
            session.add(obj)
            model_objs.append(obj)
        await session.flush()

        print("Seeding substations and devices...")
        device_counter = 1
        for sub_data in SUBSTATIONS:
            sub = Substation(
                branch_id=branch_objs[sub_data["branch_idx"]].id,
                name=sub_data["name"],
            )
            session.add(sub)
            await session.flush()

            for i, dev_tmpl in enumerate(DEVICES_TEMPLATE):
                device = Device(
                    substation_id=sub.id,
                    model_id=model_objs[dev_tmpl["model_idx"]].id,
                    name=dev_tmpl["name"].replace("{n}", str(device_counter)),
                    iec104_host=f"192.168.{sub.id}.{dev_tmpl['host_suffix']}",
                    iec104_port=2404,
                    iec104_common_address=device_counter,
                    poll_interval_seconds=2.0,
                )
                session.add(device)
                await session.flush()

                for sig in SIGNALS_TEMPLATE:
                    session.add(DeviceSignal(
                        device_id=device.id,
                        register_code=sig["register_code"],
                        signal_name=sig["signal_name"],
                        signal_title=sig["signal_title"],
                        unit=sig["unit"],
                        value_type=sig["value_type"],
                    ))
                device_counter += 1

        await session.commit()

    print(f"✓ Seeded {len(BRANCHES)} branches, {len(SUBSTATIONS)} substations, "
          f"{len(SUBSTATIONS) * len(DEVICES_TEMPLATE)} devices, "
          f"{len(SUBSTATIONS) * len(DEVICES_TEMPLATE) * len(SIGNALS_TEMPLATE)} signals")


if __name__ == "__main__":
    asyncio.run(seed())
