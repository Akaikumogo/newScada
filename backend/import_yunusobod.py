"""
Yunusobod PS 110/35/10 kV — to'liq SCADA sxemasi seed skripti.

Self-contained. CSV yoki tashqi manba'ga bog'liq emas.

Yaratadi:
  - branch:     Toshkent filiali
  - substation: PS 110/35/10 kV "Yunusobod"
  - model:      BMRZ IEC104 Yunusobod
  - 21 ta BMRZ qurilma (PRD bo'yicha)
  - Analog signallar (P, Q, S, Cos, Freq) — 15 ta P/Q-li BMRZ
  - Discrete signallar (RPV, RPO, MTZ, APV, UROV, BMRZ_Fault) — barchasi
  - To'liq canvas_json (ref SLD layoutiga 1:1 mos)

Ishga tushirish:
    python import_yunusobod.py
"""
from __future__ import annotations

import asyncio
from sqlalchemy import delete, select

from app.infrastructure.db.database import AsyncSessionFactory, create_tables
from app.infrastructure.db.models import (
    Branch, Device, DeviceModel, DeviceSignal,
    Substation, SubstationSchema,
)


BRANCH_NAME = "Toshkent filiali"
SUBSTATION_NAME = 'PS 110/35/10 kV "Yunusobod"'
MODEL_NAME = "BMRZ IEC104 Yunusobod"

# ══════════════════════════════════════════════════════════════════
#  21 ta BMRZ ro'yxati — PRD Section 3
# ══════════════════════════════════════════════════════════════════
DEVICES = [
    # 35 kV chiqish (1, 2, 3 shkaflar)
    ("1",  "A1", "192.168.199.10", "L-Savdo-35", "L-Savdo 35 kV",        "power",   "chiqish"),
    ("1",  "A2", "192.168.199.11", "W2H-35",     "W2H 35 kV chiqish",    "power",   "chiqish"),
    ("2",  "A1", "192.168.199.12", "W3H-35",     "W3H 35 kV chiqish",    "power",   "chiqish"),
    ("2",  "A2", "192.168.199.13", "W4H-35",     "W4H 35 kV chiqish",    "power",   "chiqish"),
    ("3",  "A1", "192.168.199.14", "W5H-35",     "W5H 35 kV chiqish",    "power",   "chiqish"),
    ("3",  "A2", "192.168.199.15", "W6H-35",     "W6H 35 kV chiqish",    "power",   "chiqish"),
    # T-2 BMRZ (10-shkaf) — tok/kuchlanish/differensial, P/Q yo'q
    ("10", "A2", "192.168.199.18", "T-2 A2",     "T-2 frequency/U/I",    "freq_ui", None),
    ("10", "A1", "192.168.199.19", "T-2 A1",     "T-2 differensial",     "diff",    None),
    # 35 kV TN / mimika (9-shkaf) — kuchlanish o'lchov, P/Q yo'q
    ("9",  "A2", "192.168.199.20", "TN-35 A2",   "35 kV TN/mimika",      "tn35",    None),
    ("9",  "A1", "192.168.199.21", "TN-35 A1",   "35 kV TN/mimika",      "tn35",    None),
    # T-1 BMRZ (7-shkaf) — tok/kuchlanish/differensial, P/Q yo'q
    ("7",  "A1", "192.168.199.22", "T-1 A1",     "T-1 differensial",     "diff",    None),
    ("7",  "A2", "192.168.199.23", "T-1 A2",     "T-1 frequency/U/I",    "freq_ui", None),
    # 35 kV vvod / section (13-shkaf)
    ("13", "A1", "192.168.199.24", "V-T1-35",    "V-T-1-35 kV kirish",   "power",   "kirish"),
    ("13", "A2", "192.168.199.25", "SV-35",      "SV-35 kV seksiya",     "power",   "section"),
    ("13", "A3", "192.168.199.26", "V-T2-35",    "V-T-2-35 kV kirish",   "power",   "kirish"),
    # 10 kV A seksiya (14-shkaf)
    ("14", "A1", "192.168.199.27", "V-T1-A",     "V-T-1-A-10 kV kirish", "power",   "kirish"),
    ("14", "A2", "192.168.199.28", "SV-A",       "SV-A-10 kV seksiya",   "power",   "section"),
    ("14", "A3", "192.168.199.29", "V-T2-A",     "V-T-2-A-10 kV kirish", "power",   "kirish"),
    # 10 kV B seksiya (15-shkaf)
    ("15", "A1", "192.168.199.30", "V-T1-B",     "V-T-1-B-10 kV kirish", "power",   "kirish"),
    ("15", "A2", "192.168.199.31", "SV-B",       "SV-B-10 kV seksiya",   "power",   "section"),
    ("15", "A3", "192.168.199.32", "V-T2-B",     "V-T-2-B-10 kV kirish", "power",   "kirish"),
]

SIGNAL_GROUPS: dict[str, list] = {
    # P/Q/S/Cos/Freq — feeder va vvod qurilmalari (IOA 644=P to'g'ri)
    "power": [
        (644, "P",    "Faol quvvat (P)",      "MW",   "float"),
        (645, "Q",    "Reaktiv quvvat (Q)",   "MVAr", "float"),
        (646, "S",    "To'liq quvvat (S)",    "MVA",  "float"),
        (647, "Cos",  "Quvvat koeffitsienti", "",     "float"),
        (648, "Freq", "Chastota (f)",         "Hz",   "float"),
    ],
    # .18 (T-2 A2), .23 (T-1 A2) — chastota/tok/kuchlanish relay
    # IOA 643=F, 644=I ЭВ (tok), 647=I1, 648=I2 — P yo'q
    "freq_ui": [
        (643, "Freq", "Chastota (f)",    "Hz", "float"),
        (644, "IEV",  "I EV tok",        "A",  "float"),
        (647, "I1",   "I1 tok",          "A",  "float"),
        (648, "I2",   "I2 tok",          "A",  "float"),
        (650, "IA",   "IA faza toki",    "A",  "float"),
        (652, "IB",   "IB faza toki",    "A",  "float"),
        (654, "IC",   "IC faza toki",    "A",  "float"),
        (663, "UAB1", "UAB1 kuchlanish", "V",  "float"),
        (666, "UBC1", "UBC1 kuchlanish", "V",  "float"),
    ],
    # .19 (T-2 A1), .22 (T-1 A1) — transformator differensial himoyasi
    # IOA 649=F, 666/668/670=IA 1-2-3-o'ram, 682/684=IB, 698/700=IC
    "diff": [
        (649, "Freq", "Chastota (f)",       "Hz", "float"),
        (666, "IA1",  "IA 1-o'ram toki",    "A",  "float"),
        (668, "IA2",  "IA 2-o'ram toki",    "A",  "float"),
        (670, "IA3",  "IA 3-o'ram toki",    "A",  "float"),
        (682, "IB1",  "IB 1-o'ram toki",    "A",  "float"),
        (684, "IB2",  "IB 2-o'ram toki",    "A",  "float"),
        (698, "IC1",  "IC 1-o'ram toki",    "A",  "float"),
        (700, "IC2",  "IC 2-o'ram toki",    "A",  "float"),
        (710, "InT",  "InT nöytral toki",   "A",  "float"),
    ],
    # .20 (TN-35 A2), .21 (TN-35 A1) — kuchlanish transformatori/mimika
    # IOA 641=3U0, 644=3U0р (kuchlanish — P emas!), 645=F, 648/651/654=UA/UB/UC
    "tn35": [
        (641, "3U0",  "3U0 simmetriyasiz",  "V",  "float"),
        (644, "3U0r", "3U0r qoldiq",        "V",  "float"),
        (645, "Freq", "Chastota (f)",        "Hz", "float"),
        (648, "UA",   "UA faza kuchlanishi", "V",  "float"),
        (651, "UB",   "UB faza kuchlanishi", "V",  "float"),
        (654, "UC",   "UC faza kuchlanishi", "V",  "float"),
        (656, "UAB",  "UAB liniya",          "V",  "float"),
        (657, "UBC",  "UBC liniya",          "V",  "float"),
        (659, "UCA",  "UCA liniya",          "V",  "float"),
    ],
}

DISCRETE_SIGNALS = [
    (1,  "RPV",        "O'chirgich yopiq (RPV)",   "", "status"),
    (2,  "RPO",        "O'chirgich ochiq (RPO)",   "", "status"),
    (17, "MTZ",        "MTZ ishladi",              "", "status"),
    (18, "APV",        "APV ishladi",              "", "status"),
    (19, "CHAPV",      "CHAPV ishladi",            "", "status"),
    (20, "UROV",       "UROV ishladi",             "", "status"),
    (21, "LZSH",       "LZSH ishladi",             "", "status"),
    (25, "BMRZ_Fault", "BMRZ nosozligi",           "", "status"),
    (28, "Local",      "Local/Remote rejim",       "", "status"),
]

# Voltage rail colors (ref palette)
COLOR_110  = "#FF4D7A"
COLOR_35   = "#F5A623"
COLOR_10   = "#2DD4BF"
COLOR_LINE = "#9BB0D3"
COLOR_TEXT = "#94A3B8"
COLOR_TEXT_HI = "#DBEAFE"


# ══════════════════════════════════════════════════════════════════
#  Database operations
# ══════════════════════════════════════════════════════════════════
async def _get_or_create(session, model, **lookup):
    item = (await session.execute(select(model).filter_by(**lookup))).scalars().first()
    if item:
        return item, False
    item = model(**lookup)
    session.add(item)
    await session.flush()
    return item, True


async def _wipe_substation(session, substation_id: int) -> None:
    await session.execute(
        delete(SubstationSchema).where(SubstationSchema.substation_id == substation_id)
    )
    device_ids = (await session.execute(
        select(Device.id).where(Device.substation_id == substation_id)
    )).scalars().all()
    if device_ids:
        await session.execute(delete(DeviceSignal).where(DeviceSignal.device_id.in_(device_ids)))
        await session.execute(delete(Device).where(Device.id.in_(device_ids)))
    await session.flush()


async def import_yunusobod() -> None:
    await create_tables()

    async with AsyncSessionFactory() as session:
        branch, _ = await _get_or_create(session, Branch, name=BRANCH_NAME)

        sub = (await session.execute(
            select(Substation).where(Substation.name == SUBSTATION_NAME)
        )).scalars().first()
        if sub is None:
            sub = Substation(branch_id=branch.id, name=SUBSTATION_NAME)
            session.add(sub)
            await session.flush()
        else:
            sub.branch_id = branch.id

        await _wipe_substation(session, sub.id)

        model, _ = await _get_or_create(session, DeviceModel, name=MODEL_NAME)
        model.manufacturer = "BMRZ / Konfigurator-MT"
        await session.flush()

        created_devices = 0
        created_signals = 0
        ip_to_device: dict[str, Device] = {}

        for shkaf, bmrz, ip, label, obj_name, signal_group, _role in DEVICES:
            full_name = f"{shkaf}-shkaf {bmrz} — {obj_name}"
            device = Device(
                substation_id=sub.id, model_id=model.id, name=full_name,
                protocol="iec104", iec104_host=ip, iec104_port=2404,
                iec104_common_address=3, active=True,
            )
            session.add(device)
            await session.flush()
            ip_to_device[ip] = device
            created_devices += 1

            if signal_group:
                for ioa, sname, title, unit, vt in SIGNAL_GROUPS[signal_group]:
                    session.add(DeviceSignal(
                        device_id=device.id, register_code=ioa, signal_name=sname,
                        signal_title=f"{title} | IOA {ioa} | {obj_name}",
                        unit=unit, value_type=vt, active=True, only_realtime=False,
                    ))
                    created_signals += 1

            for ioa, sname, title, unit, vt in DISCRETE_SIGNALS:
                session.add(DeviceSignal(
                    device_id=device.id, register_code=ioa, signal_name=sname,
                    signal_title=f"{title} | IOA {ioa} | {obj_name}",
                    unit=unit, value_type=vt, active=True, only_realtime=False,
                ))
                created_signals += 1

        canvas = _build_canvas(ip_to_device)
        schema = SubstationSchema(substation_id=sub.id, canvas_json=canvas)
        session.add(schema)

        await session.commit()
        print(f"[OK] Substation: id={sub.id}, name={sub.name!r}")
        print(f"[OK] Devices created: {created_devices}")
        print(f"[OK] Signals created: {created_signals}")
        print(f"[OK] Canvas nodes:    {len(canvas['nodes'])}")
        print(f"[OK] Canvas edges:    {len(canvas['edges'])}")


# ══════════════════════════════════════════════════════════════════
#  Canvas builder — referensga 1:1 mos to'liq SLD
# ══════════════════════════════════════════════════════════════════
def _build_canvas(ip_to_device: dict[str, Device]) -> dict:
    """
    Coordinate layout:
        x: 0 .. 2200 (left -> right)
        y: -100 .. 1350 (top -> bottom)

        y =  -90  : Title
        y =  -50  : 110 kV incoming voltage labels
        y =    0  : phase indicators C/B/A
        y =   20  : phase disconnectors
        y =   70  : vertical lines
        y =  110  : 110 kV incoming breakers
        y =  180  : 110 kV bus halves + СВ-110
        y =  220-300 : T-1/T-2 disconnectors+breakers
        y =  330  : T-1, T-2 transformers
        y =  410  : 110/35/10 kV ratings text
        y =  440-560 : 35 kV drops
        y =  580  : 35 kV bus
        y =  610-780 : 35 kV feeder drops + devices + signal cards
        y =  880-960 : 10 kV drops + section tops
        y = 1080  : 10 kV bus (4 sections)
        y = 1120-1280 : 10 kV feeder drops + labels
    """
    nodes: list[dict] = []
    edges: list[dict] = []

    def n(node_id: str, ntype: str, x: int, y: int, **data) -> None:
        nodes.append({"id": node_id, "type": ntype,
                      "position": {"x": x, "y": y}, "data": dict(data)})

    def e(eid: str, source: str, target: str,
          dashed: bool = False, color: str = COLOR_LINE) -> None:
        style = {"stroke": color, "strokeWidth": 1.6}
        if dashed:
            style["strokeDasharray"] = "6,4"
        edges.append({"id": eid, "source": source, "target": target,
                      "type": "step", "style": style})

    # ────────────────── Title ──────────────────
    n("title", "text", 30, -100,
      text='PS 110/35/10 kV "Yunusobod"', size=18, bold=True, color=COLOR_TEXT_HI)

    # ════════════════════ 110 kV section ═══════════════════════════
    # T-1 centered at x=640 (centers section I-II below)
    # T-2 centered at x=1920 (centers section III-IV below)
    incoming_110 = [
        ("KL 110 kV «L-DOK-1»",   300,  "left"),
        ("VL 110 kV «L-Sokin-1»", 700,  "left"),
        ("VL 110 kV «L-Sokin-2»", 1820, "right"),
        ("KL 110 kV «L-DOK-2»",   2220, "right"),
    ]
    for i, (label, x, side) in enumerate(incoming_110):
        # Top KL/VL label
        n(f"in110-lbl-{i}", "voltage-label", x - 80, -55,
          text=label, size=11, color=COLOR_110)
        # Phase indicators C / B / A — spaced wider (50 px apart)
        n(f"in110-c-{i}", "voltage-label", x - 50, -15, text="C", size=13, color="#FF4D7A")
        n(f"in110-b-{i}", "voltage-label", x,      -15, text="B", size=13, color="#F5A623")
        n(f"in110-a-{i}", "voltage-label", x + 50, -15, text="A", size=13, color="#10B981")
        # Three-phase disconnectors — also 50 px apart, no overlapping labels
        n(f"in110-dis-{i}-c", "disconnector", x - 58, 25, label="", state="closed")
        n(f"in110-dis-{i}-b", "disconnector", x - 8,  25, label="", state="closed")
        n(f"in110-dis-{i}-a", "disconnector", x + 42, 25, label="", state="closed")
        # Vertical line (single phase representation going down)
        n(f"in110-ln-{i}", "line", x - 2, 80,
          orientation="vertical", length=35, color=COLOR_110)
        # Incoming breaker
        n(f"in110-brk-{i}", "breaker", x - 16, 120,
          label="Q-110", state="closed")
        # Bus-mounted disconnector (between breaker and bus)
        n(f"in110-busdis-{i}", "disconnector", x - 18, 165,
          label="", state="closed")
        bus_target = "bus110l" if side == "left" else "bus110r"
        e(f"e-in110-brk-busdis-{i}", f"in110-brk-{i}", f"in110-busdis-{i}", color=COLOR_110)
        e(f"e-in110-busdis-bus-{i}", f"in110-busdis-{i}", bus_target, color=COLOR_110)

    # 110 kV bus halves + СВ-110 coupler
    n("bus110l", "bus", 40,   180,
      voltage="110 kV", orientation="horizontal", length=1180, color=COLOR_110)
    n("bus110r", "bus", 1340, 180,
      voltage="110 kV", orientation="horizontal", length=1180, color=COLOR_110)
    n("sv110-brk", "breaker", 1260, 162, label="СВ-110", state="closed")
    e("e-bus110l-sv", "bus110l", "sv110-brk", color=COLOR_110)
    e("e-sv-bus110r", "sv110-brk", "bus110r", color=COLOR_110)

    # ════════════════════ Transformers T-1, T-2 ════════════════════
    # T-1 chain (x=640, centered above 10 kV I+II sections)
    n("t1-dis1", "disconnector", 632, 230, label="QS-T1-1", state="closed")
    n("t1-brk",  "breaker",       627, 280, label="Q-T1",   state="closed")
    n("t1",      "transformer",   582, 340, label="T-1",    rating="110/35/10 kV", windings=3)
    e("e-bus110l-t1dis1", "bus110l", "t1-dis1", color=COLOR_110)
    e("e-t1dis1-brk",     "t1-dis1", "t1-brk",  color=COLOR_110)
    e("e-t1brk-t1",       "t1-brk",  "t1",      color=COLOR_110)

    # T-1 BMRZ devices (right of T-1)
    if d := ip_to_device.get("192.168.199.22"):
        n("dev-t1-a1", "device", 720, 310,
          device_id=d.id, label="T-1 A1", device_name=d.name,
          common_address=d.iec104_common_address, online=True, compact=True)
    if d := ip_to_device.get("192.168.199.23"):
        n("dev-t1-a2", "device", 720, 345,
          device_id=d.id, label="T-1 A2", device_name=d.name,
          common_address=d.iec104_common_address, online=True, compact=True)

    # T-2 chain (x=1920, centered above 10 kV III+IV sections)
    n("t2-dis1", "disconnector", 1912, 230, label="QS-T2-1", state="closed")
    n("t2-brk",  "breaker",       1907, 280, label="Q-T2",   state="closed")
    n("t2",      "transformer",   1862, 340, label="T-2",    rating="110/35/10 kV", windings=3)
    e("e-bus110r-t2dis1", "bus110r", "t2-dis1", color=COLOR_110)
    e("e-t2dis1-brk",     "t2-dis1", "t2-brk",  color=COLOR_110)
    e("e-t2brk-t2",       "t2-brk",  "t2",      color=COLOR_110)

    if d := ip_to_device.get("192.168.199.18"):
        n("dev-t2-a2", "device", 1690, 310,
          device_id=d.id, label="T-2 A2", device_name=d.name,
          common_address=d.iec104_common_address, online=True, compact=True)
    if d := ip_to_device.get("192.168.199.19"):
        n("dev-t2-a1", "device", 1690, 345,
          device_id=d.id, label="T-2 A1", device_name=d.name,
          common_address=d.iec104_common_address, online=True, compact=True)

    # ════════════════════ 35 kV section ════════════════════════════
    # 35 kV bus spans between T-1 (x=640) and T-2 (x=1920) — centered around x=1280
    # Drops from T-1 / T-2 down to 35 kV bus (dashed orange)
    n("t1-35-ln", "line", 632, 460,
      orientation="vertical", length=130, color=COLOR_35, dashed=True)
    n("t2-35-ln", "line", 1912, 460,
      orientation="vertical", length=130, color=COLOR_35, dashed=True)
    e("e-t1-35ln", "t1", "t1-35-ln", dashed=True, color=COLOR_35)
    e("e-t2-35ln", "t2", "t2-35-ln", dashed=True, color=COLOR_35)

    # Vvod-35-1, СВ-35, Vvod-35-2 labels and devices
    n("vvod35-1-lbl", "text", 850,  525, text="Ввод-35-1", size=10, color=COLOR_TEXT)
    n("sv35-lbl",     "text", 1265, 525, text="СВ-35",    size=10, color=COLOR_TEXT)
    n("vvod35-2-lbl", "text", 1680, 525, text="Ввод-35-2", size=10, color=COLOR_TEXT)

    if d := ip_to_device.get("192.168.199.24"):
        n("dev-vt1-35", "device", 830,  550,
          device_id=d.id, label="V-T1-35", device_name=d.name,
          common_address=d.iec104_common_address, online=True, compact=True)
    if d := ip_to_device.get("192.168.199.25"):
        n("dev-sv-35", "device", 1245, 550,
          device_id=d.id, label="SV-35", device_name=d.name,
          common_address=d.iec104_common_address, online=True, compact=True)
    if d := ip_to_device.get("192.168.199.26"):
        n("dev-vt2-35", "device", 1660, 550,
          device_id=d.id, label="V-T2-35", device_name=d.name,
          common_address=d.iec104_common_address, online=True, compact=True)

    # 35 kV bus split in half with СВ-35 coupler in middle
    n("bus35l", "bus", 750, 605,
      voltage="35 kV", orientation="horizontal", length=500, color=COLOR_35)
    n("bus35r", "bus", 1330, 605,
      voltage="35 kV", orientation="horizontal", length=720, color=COLOR_35)
    # СВ-35 coupler breaker (bound to SV-35 BMRZ)
    sv35_dev = ip_to_device.get("192.168.199.25")
    sv35_brk_data = {"label": "СВ-35", "state": "closed"}
    if sv35_dev:
        sv35_brk_data["device_id"] = sv35_dev.id
        sv35_brk_data["signal_name"] = "RPV"
    n("sv35-brk", "breaker", 1265, 588, **sv35_brk_data)
    e("e-bus35l-sv", "bus35l", "sv35-brk", color=COLOR_35)
    e("e-sv-bus35r", "sv35-brk", "bus35r", color=COLOR_35)
    e("e-t1-35ln-bus", "t1-35-ln", "bus35l", color=COLOR_35)
    e("e-t2-35ln-bus", "t2-35-ln", "bus35r", color=COLOR_35)

    # 35 kV chiqish feeders (6 ta, kengroq joylashtirilgan)
    # Real feeder nomlari (referens model PDF dan)
    feeders_35 = [
        ("192.168.199.10", "L-Savdo", 970,  "Л-Савдо-1"),
        ("192.168.199.11", "W2H",     1100, "Резерв"),
        ("192.168.199.12", "W3H",     1230, "Резерв"),
        ("192.168.199.13", "W4H",     1430, "Л-ОДО-2"),
        ("192.168.199.14", "W5H",     1560, "Резерв"),
        ("192.168.199.15", "W6H",     1690, "Резерв"),
    ]
    for ip, label, x, full_label in feeders_35:
        bus_id = "bus35l" if x < 1290 else "bus35r"
        n(f"f35-{label}-dis1", "disconnector", x - 8, 640, label=f"QS1-{label}", state="closed")
        n(f"f35-{label}-brk", "breaker",       x - 8, 685, label=f"Q-{label}", state="closed")
        n(f"f35-{label}-dis2", "disconnector", x - 8, 730, label=f"QS2-{label}", state="closed")
        n(f"f35-{label}-tt",  "current-transformer", x - 8, 775, label="TT", color=COLOR_LINE)
        n(f"f35-{label}-name", "text", x - 30, 825,
          text=full_label, size=10, color=COLOR_TEXT_HI, bold=True)
        n(f"f35-{label}-ip", "text", x - 30, 845,
          text=ip, size=8, color=COLOR_TEXT)
        e(f"e-bus35-{label}", bus_id, f"f35-{label}-dis1", color=COLOR_35)
        e(f"e-{label}-dis1-brk", f"f35-{label}-dis1", f"f35-{label}-brk", color=COLOR_35)
        e(f"e-{label}-brk-dis2", f"f35-{label}-brk", f"f35-{label}-dis2", color=COLOR_35)
        e(f"e-{label}-dis2-tt",  f"f35-{label}-dis2", f"f35-{label}-tt", color=COLOR_35)
        if d := ip_to_device.get(ip):
            n(f"dev-f35-{label}", "device", x - 38, 875,
              device_id=d.id, label=label, device_name=d.name,
              common_address=d.iec104_common_address, online=True, compact=True)
            n(f"sig-f35-{label}", "signal-value", x - 38, 910,
              device_id=d.id, signal_name="P", label="P", unit="MW")

    # 35 kV TN/mimika devices (right of 35 kV bus)
    if d := ip_to_device.get("192.168.199.20"):
        n("dev-tn35-a2", "device", 1880, 640,
          device_id=d.id, label="TN-35 A2", device_name=d.name,
          common_address=d.iec104_common_address, online=True, compact=True)
    if d := ip_to_device.get("192.168.199.21"):
        n("dev-tn35-a1", "device", 1880, 675,
          device_id=d.id, label="TN-35 A1", device_name=d.name,
          common_address=d.iec104_common_address, online=True, compact=True)

    # TН-35 (Эш) voltage transformer at right end of bus35r
    n("tn35", "voltage-transformer", 2020, 720, label="TН-35 (Эш)", color=COLOR_35)
    e("e-bus35-tn35", "bus35r", "tn35", color=COLOR_35)

    # ════════════════════ 10 kV section ════════════════════════════
    # T-1 -> 10 kV drop (x=640), T-2 -> 10 kV drop (x=1920)
    n("t1-10-ln", "line", 632, 920,
      orientation="vertical", length=100, color=COLOR_10, dashed=True)
    n("t2-10-ln", "line", 1912, 920,
      orientation="vertical", length=100, color=COLOR_10, dashed=True)
    e("e-t1-10ln", "t1", "t1-10-ln", dashed=True, color=COLOR_10)
    e("e-t2-10ln", "t2", "t2-10-ln", dashed=True, color=COLOR_10)

    # 4 sections of 10 kV
    # Section I (T-1 side) - bound to V-T1-A (.27)
    # Section II (T-1 side, second) - bound to V-T2-A (.29) — actually re-using as section II
    # Section III (T-2 side) - bound to V-T1-B (.30)
    # Section IV (T-2 side) - bound to V-T2-B (.32)
    # Seksiyalar kengroq + real Yunusobod feeder nomlari (model PDF dan)
    sections_10 = [
        # (sec_name, bus_id, x_start, bus_length, vvod_label, vvod_ip, sv_ip, tn_label, feeder_names)
        ("I",   "bus10-1",   40,  560, "Ввод №1", "192.168.199.27", "192.168.199.28", "TH-1-10",
         ["ф.Прогресс-1", "ф.Универсам-1", "ф.Бухара-1", "ф.Алмаз-1", "ф.Колхозный-3", "ф.Парковый-1", "ф.Фарогат-1"]),
        ("II",  "bus10-2",  680,  560, "Ввод №2", "192.168.199.29", None,             "TH-2-10",
         ["ф.Тюльпан-1", "ф.Обод-1", "ф.Колхозный-1", "ф.Мега-1", "ф.Алмаз-2", "ф.Обод-2", "ТСН-1-10"]),
        ("III", "bus10-3", 1320,  560, "Ввод №3", "192.168.199.30", "192.168.199.31", "TH-3-10",
         ["ф.Чимган-1", "ф.Даниш-1", "ф.Ромашка-1", "ф.Юнус-Абад", "ф.Дюкер-1", "ф.Сурхон-1", "ф.Виноградный-1"]),
        ("IV",  "bus10-4", 1960,  560, "Ввод №4", "192.168.199.32", None,             "TH-4-10",
         ["ф.Яблочный", "ф.Дюкер-2", "ф.Бухара-2", "ф.Ромашка-2", "ф.Даниш-2", "ф.Чимган-2", "ТСН-2-10"]),
    ]

    for sec_name, bus_id, x0, bus_len, vvod_label, vvod_ip, sv_ip, tn_label, feeder_names in sections_10:
        x_end = x0 + bus_len
        # Top: vvod label + device card
        n(f"{bus_id}-vvod-lbl", "text", x0 + 20, 980,
          text=vvod_label, size=10, color=COLOR_TEXT_HI, bold=True)
        if d := ip_to_device.get(vvod_ip):
            n(f"{bus_id}-dev", "device", x0 + 20, 1005,
              device_id=d.id, label=f"{vvod_label}", device_name=d.name,
              common_address=d.iec104_common_address, online=True, compact=True)
            n(f"{bus_id}-sig", "signal-value", x0 + 20, 1035,
              device_id=d.id, signal_name="P", label="P", unit="MW")
        # Bus
        n(bus_id, "bus", x0, 1080,
          voltage=f"10 kV — {sec_name} С.Ш.", orientation="horizontal",
          length=bus_len, color=COLOR_10)
        # Vertical drop from device down to bus
        n(f"{bus_id}-vbrk", "breaker", x0 + 25, 1060,
          label=f"Q-{vvod_label[-1] if vvod_label[-1].isdigit() else 'V'}", state="closed")
        e(f"e-{bus_id}-vbrk", f"{bus_id}-vbrk", bus_id, color=COLOR_10)

        # SV section coupler device on the right side of the section bus
        if sv_ip and (d := ip_to_device.get(sv_ip)):
            sv_x = x_end - 80
            n(f"{bus_id}-sv-brk", "breaker", sv_x, 1060,
              label=f"СВ-{sec_name}", state="closed",
              device_id=d.id, signal_name="RPV")
            n(f"{bus_id}-sv-dev", "device", sv_x - 5, 1020,
              device_id=d.id, label=f"SV-{sec_name}", device_name=d.name,
              common_address=d.iec104_common_address, online=True, compact=True)
            e(f"e-{bus_id}-sv-brk", f"{bus_id}-sv-brk", bus_id, color=COLOR_10)

        # TН voltage transformer at right end
        n(f"{bus_id}-tn", "voltage-transformer", x_end - 30, 1130,
          label=tn_label, color=COLOR_LINE)
        e(f"e-{bus_id}-tn", bus_id, f"{bus_id}-tn", color=COLOR_10)

        # Real Yunusobod feeder nomlari (7 ta per seksiya)
        feeder_count = len(feeder_names)
        margin = 60
        usable = bus_len - margin * 2
        step = usable // (feeder_count - 1) if feeder_count > 1 else 0
        for fi, fname in enumerate(feeder_names):
            fx = x0 + margin + fi * step
            f_prefix = f"{bus_id}-fd-{fi}"
            n(f"{f_prefix}-dis", "disconnector", fx - 8, 1130,
              label=f"QS{fi+1}", state="closed")
            n(f"{f_prefix}-brk", "breaker", fx - 8, 1175,
              label=f"Q{fi+1}", state="closed")
            n(f"{f_prefix}-tt", "current-transformer", fx - 8, 1225,
              label="TT", color=COLOR_LINE)
            n(f"{f_prefix}-lbl", "text", fx - 38, 1275,
              text=fname, size=9, color=COLOR_TEXT_HI, bold=True)
            e(f"e-{bus_id}-fd-{fi}-bus", bus_id, f"{f_prefix}-dis", color=COLOR_10)
            e(f"e-{f_prefix}-dis-brk", f"{f_prefix}-dis", f"{f_prefix}-brk", color=COLOR_10)
            e(f"e-{f_prefix}-brk-tt",  f"{f_prefix}-brk", f"{f_prefix}-tt", color=COLOR_10)

    # Connect T-1 / T-2 drops to corresponding 10 kV section buses
    e("e-t1-10ln-bus1", "t1-10-ln", "bus10-1", color=COLOR_10)
    e("e-t2-10ln-bus3", "t2-10-ln", "bus10-3", color=COLOR_10)

    # Section couplers СВ-1-СР-1 (between I-II) and СВ-2-СР-2 (between III-IV)
    # bus10-1 ends at x=600, bus10-2 starts at x=680 → coupler at x=625
    n("sv1-cr1-brk", "breaker", 625, 1060, label="СВ-1", state="closed")
    n("sv1-cr1-lbl", "text", 600, 1100, text="СВ-1-СР-1", size=9, color=COLOR_TEXT)
    e("e-bus10-1-sv1", "bus10-1", "sv1-cr1-brk", color=COLOR_10)
    e("e-sv1-bus10-2", "sv1-cr1-brk", "bus10-2", color=COLOR_10)

    # bus10-3 ends at 1880, bus10-4 starts at 1960 → coupler at x=1905
    n("sv2-cr2-brk", "breaker", 1905, 1060, label="СВ-2", state="closed")
    n("sv2-cr2-lbl", "text", 1880, 1100, text="СВ-2-СР-2", size=9, color=COLOR_TEXT)
    e("e-bus10-3-sv2", "bus10-3", "sv2-cr2-brk", color=COLOR_10)
    e("e-sv2-bus10-4", "sv2-cr2-brk", "bus10-4", color=COLOR_10)

    # ТСН-1, ТСН-2 (tap-change transformers, between sections)
    n("tcn1", "transformer", 920, 980,
      label="ТСН-1", rating="10/0.4 kV", windings=2)
    n("tcn1-lbl", "text", 890, 1050,
      text="TCH-1 (10/0.4)", size=9, color=COLOR_TEXT)
    n("tcn2", "transformer", 2200, 980,
      label="ТСН-2", rating="10/0.4 kV", windings=2)
    n("tcn2-lbl", "text", 2170, 1050,
      text="TCH-2 (10/0.4)", size=9, color=COLOR_TEXT)

    # ════════════════════ Right-side: Balance + Legend ═════════════
    bal_x = 2650
    n("balance_in", "block", bal_x, 50,
      label="P kirish",
      formula="a + b + c + d + e + f",
      variables=_build_balance_vars(ip_to_device, [
          "192.168.199.24", "192.168.199.26",
          "192.168.199.27", "192.168.199.29",
          "192.168.199.30", "192.168.199.32",
      ], "a"),
      unit="MW", decimals=2, color=COLOR_110)

    n("balance_out35", "block", bal_x, 200,
      label="P35 chiqish",
      formula="g + h + i + j + k + l",
      variables=_build_balance_vars(ip_to_device, [
          "192.168.199.10", "192.168.199.11", "192.168.199.12",
          "192.168.199.13", "192.168.199.14", "192.168.199.15",
      ], "g"),
      unit="MW", decimals=2, color=COLOR_35)

    n("balance_out10", "block", bal_x, 350,
      label="P10 chiqish",
      formula="m + n + o + p",
      variables=_build_balance_vars(ip_to_device, [
          "192.168.199.27", "192.168.199.29",
          "192.168.199.30", "192.168.199.32",
      ], "m"),
      unit="MW", decimals=2, color=COLOR_10)

    n("balance_loss", "block", bal_x, 500,
      label="Yo'qotish",
      formula="(a + b + c + d + e + f) - (g + h + i + j + k + l) - (m + n + o + p)",
      variables={
          **_build_balance_vars(ip_to_device, [
              "192.168.199.24", "192.168.199.26",
              "192.168.199.27", "192.168.199.29",
              "192.168.199.30", "192.168.199.32",
          ], "a"),
          **_build_balance_vars(ip_to_device, [
              "192.168.199.10", "192.168.199.11", "192.168.199.12",
              "192.168.199.13", "192.168.199.14", "192.168.199.15",
          ], "g"),
          **_build_balance_vars(ip_to_device, [
              "192.168.199.27", "192.168.199.29",
              "192.168.199.30", "192.168.199.32",
          ], "m"),
      },
      unit="MW", decimals=2, color="#FF3D71")

    n("legend", "legend", bal_x, 700, title="Legenda / Uslovnie")

    return {"nodes": nodes, "edges": edges}


def _build_balance_vars(ip_to_device: dict[str, Device], ips: list[str], start_letter: str) -> dict:
    out: dict[str, dict] = {}
    for idx, ip in enumerate(ips):
        key = chr(ord(start_letter) + idx)
        device = ip_to_device.get(ip)
        if device:
            out[key] = {"device_id": device.id, "signal_name": "P", "scale": 1, "offset": 0}
    return out


if __name__ == "__main__":
    asyncio.run(import_yunusobod())
