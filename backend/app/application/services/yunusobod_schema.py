from __future__ import annotations

from collections.abc import Iterable

from app.application.services.yunusobod_mapping import load_needed_points
from app.infrastructure.db.models import Device


KV_110 = "#FF4D7A"
KV_35 = "#FFB13B"
KV_10 = "#2DDBB3"
KV_LOW = "#9BB0D3"


def _node(node_id: str, kind: str, x: int, y: int, data: dict) -> dict:
    return {"id": node_id, "type": kind, "position": {"x": x, "y": y}, "data": data}


def _edge(source: str, target: str, color: str = KV_LOW, edge_id: str | None = None) -> dict:
    return {
        "id": edge_id or f"e-{source}-{target}",
        "source": source,
        "target": target,
        "type": "step",
        "style": {"stroke": color, "strokeWidth": 2},
    }


def _signal_name_by_ioa(device: Device | None, ioa: int) -> str | None:
    signal = _signal_by_ioa(device, ioa)
    return signal.signal_name if signal else None


def _signal_by_ioa(device: Device | None, ioa: int):
    if device is None:
        return None
    for signal in device.signals:
        if signal.register_code == ioa:
            return signal
    return None


def _unit_by_ioa(device: Device | None, ioa: int, fallback: str) -> str:
    signal = _signal_by_ioa(device, ioa)
    return signal.unit if signal and signal.unit else fallback


def _scale_to_mw(device: Device | None, ioa: int) -> float:
    unit = _unit_by_ioa(device, ioa, "").lower()
    if "mw" in unit or "мвт" in unit:
        return 1.0
    if "kw" in unit or "квт" in unit or "рєрІс‚" in unit:
        return 0.001
    if "w" in unit or "вт" in unit or "рІс‚" in unit:
        return 0.000001
    return 1.0


def _device_payload(device: Device | None, label: str) -> dict:
    if device is None:
        return {"label": label, "compact": True}
    return {
        "device_id": device.id,
        "label": label,
        "device_name": device.name,
        "common_address": device.iec104_common_address,
        "signal_count": len(device.signals),
        "compact": True,
    }


def _signal_value_payload(device: Device | None, ioa: int, label: str, unit: str) -> dict:
    signal_name = _signal_name_by_ioa(device, ioa)
    payload = {"label": label, "unit": _unit_by_ioa(device, ioa, unit)}
    if device is not None and signal_name:
        payload.update({"device_id": device.id, "signal_name": signal_name})
    return payload


def _formula_variables(devices: Iterable[Device], ips: set[str], ioa: int) -> dict[str, dict]:
    variables: dict[str, dict] = {}
    idx = 1
    for device in devices:
        if device.iec104_host not in ips:
            continue
        signal_name = _signal_name_by_ioa(device, ioa)
        if not signal_name:
            continue
        variables[f"p{idx}"] = {"device_id": device.id, "signal_name": signal_name, "scale": _scale_to_mw(device, ioa), "offset": 0}
        idx += 1
    return variables


def build_yunusobod_schema(devices: list[Device]) -> dict:
    """Build an editable ReactFlow SLD canvas for PS 110/35/10 kV Yunusobod."""
    by_ip = {device.iec104_host: device for device in devices}
    mapping = {point.ip: point for point in load_needed_points() if point.point.upper() == "P"}
    nodes: list[dict] = []
    edges: list[dict] = []

    # Titles and voltage labels
    nodes.extend([
        _node("title", "text", 150, -80, {"text": 'PS 110/35/10 kV "YUNUSOBOD" - real IEC-104 canvas', "size": 18, "bold": True, "color": "#EAF1FF"}),
        _node("note", "text", 150, -48, {"text": "PRD asosida: 21 BMRZ, IOA 644/645/648, SV totalga kiritilmaydi", "size": 12, "color": "#9BB0D3"}),
        _node("bus110a", "bus", 160, 20, {"label": "110 kV I shina", "voltage": "110 kV", "orientation": "horizontal", "length": 420, "color": KV_110}),
        _node("bus110b", "bus", 650, 20, {"label": "110 kV II shina", "voltage": "110 kV", "orientation": "horizontal", "length": 420, "color": KV_110}),
        _node("bus35", "bus", 340, 260, {"label": "35 kV shina", "voltage": "35 kV", "orientation": "horizontal", "length": 520, "color": KV_35}),
        _node("bus10a1", "bus", 40, 520, {"label": "10 kV I sek.", "voltage": "10 kV", "orientation": "horizontal", "length": 350, "color": KV_10}),
        _node("bus10a2", "bus", 440, 520, {"label": "10 kV II sek.", "voltage": "10 kV", "orientation": "horizontal", "length": 350, "color": KV_10}),
        _node("bus10b1", "bus", 840, 520, {"label": "10 kV III sek.", "voltage": "10 kV", "orientation": "horizontal", "length": 350, "color": KV_10}),
        _node("bus10b2", "bus", 1240, 520, {"label": "10 kV IV sek.", "voltage": "10 kV", "orientation": "horizontal", "length": 350, "color": KV_10}),
    ])

    # Transformers
    for prefix, x, y, label in [
        ("t1", 410, 130, "T-1"),
        ("t2", 830, 130, "T-2"),
    ]:
        nodes.extend([
            _node(f"{prefix}-line110", "line", x + 18, 84, {"orientation": "vertical", "length": 72, "color": KV_110, "dashed": True}),
            _node(f"{prefix}-trafo", "transformer", x, y, {"label": label, "rating": "110/35/10 kV", "windings": 3}),
            _node(f"{prefix}-line10", "line", x + 18, 305, {"orientation": "vertical", "length": 190, "color": KV_10, "dashed": True}),
        ])
        edges.extend([
            _edge("bus110a" if prefix == "t1" else "bus110b", f"{prefix}-line110", KV_110),
            _edge(f"{prefix}-line110", f"{prefix}-trafo", KV_110),
            _edge(f"{prefix}-trafo", f"{prefix}-line10", KV_10),
        ])

    # 35 kV outgoing P/Q devices
    feeders35 = [
        ("192.168.199.10", "L-Savdo", 100),
        ("192.168.199.11", "W2H", 180),
        ("192.168.199.12", "W3H", 260),
        ("192.168.199.13", "W4H", 340),
        ("192.168.199.14", "W5H", 420),
        ("192.168.199.15", "W6H", 500),
    ]
    for ip, label, x in feeders35:
        device = by_ip.get(ip)
        nid = f"f35-{ip.rsplit('.', 1)[1]}"
        nodes.extend([
            _node(nid, "feeder", x, 330, {"label": label, "length": 150, "color": KV_35, "breaker": True, "disconnector": True}),
            _node(f"{nid}-dev", "device", x - 18, 300, _device_payload(device, label)),
            _node(f"{nid}-p", "signal-value", x - 32, 470, _signal_value_payload(device, 644, "P", "MW")),
        ])
        edges.extend([_edge("bus35", nid, KV_35), _edge(nid, f"{nid}-p", KV_35)])

    # 35/10 kV vvods and SV devices
    upper_devices = [
        ("192.168.199.24", "V-T1-35", 620, 325, KV_35),
        ("192.168.199.25", "SV-35", 710, 325, KV_35),
        ("192.168.199.26", "V-T2-35", 800, 325, KV_35),
        ("192.168.199.27", "V-T1-A-10", 420, 620, KV_10),
        ("192.168.199.28", "SV-A-10", 520, 620, KV_10),
        ("192.168.199.29", "V-T2-A-10", 620, 620, KV_10),
        ("192.168.199.30", "V-T1-B-10", 900, 620, KV_10),
        ("192.168.199.31", "SV-B-10", 1000, 620, KV_10),
        ("192.168.199.32", "V-T2-B-10", 1100, 620, KV_10),
    ]
    for ip, label, x, y, color in upper_devices:
        device = by_ip.get(ip)
        suffix = ip.rsplit(".", 1)[1]
        nodes.extend([
            _node(f"dev-{suffix}", "device", x, y, _device_payload(device, label)),
            _node(f"p-{suffix}", "signal-value", x, y + 48, _signal_value_payload(device, 644, "P", "MW")),
        ])

    # Monitoring-only BMRZ
    monitors = [
        ("192.168.199.18", "T-2 BMRZ A2", 1190, 160),
        ("192.168.199.19", "T-2 BMRZ A1", 1190, 210),
        ("192.168.199.20", "35 kV TN A2", 1190, 260),
        ("192.168.199.21", "35 kV TN A1", 1190, 310),
        ("192.168.199.22", "T-1 BMRZ A1", 1190, 360),
        ("192.168.199.23", "T-1 BMRZ A2", 1190, 410),
    ]
    for ip, label, x, y in monitors:
        nodes.append(_node(f"mon-{ip.rsplit('.', 1)[1]}", "device", x, y, _device_payload(by_ip.get(ip), label)))

    # Representative 10 kV outgoing feeders. Full P/Q requires additional sources per PRD.
    feeder_labels = ["Q-F1", "Q-F2", "Q-F3", "Q-F4", "Q-F5", "Q-F6", "Q-F7", "Q-F8"]
    for idx, label in enumerate(feeder_labels):
        x = 80 + idx * 85
        bus = "bus10a1" if idx < 4 else "bus10a2"
        nodes.append(_node(f"f10-{idx + 1}", "feeder", x, 600, {"label": label, "length": 155, "color": KV_10, "breaker": True, "disconnector": True}))
        edges.append(_edge(bus, f"f10-{idx + 1}", KV_10))
    for idx, label in enumerate(feeder_labels, start=9):
        x = 880 + (idx - 9) * 85
        bus = "bus10b1" if idx < 13 else "bus10b2"
        nodes.append(_node(f"f10-{idx}", "feeder", x, 600, {"label": label, "length": 155, "color": KV_10, "breaker": True, "disconnector": True}))
        edges.append(_edge(bus, f"f10-{idx}", KV_10))

    # Balance formula blocks bound to real P signals.
    kirish_ips = {"192.168.199.24", "192.168.199.26", "192.168.199.27", "192.168.199.29", "192.168.199.30", "192.168.199.32"}
    chiqish35_ips = {"192.168.199.10", "192.168.199.11", "192.168.199.12", "192.168.199.13", "192.168.199.14", "192.168.199.15"}
    chiqish10_ips = {"192.168.199.27", "192.168.199.29", "192.168.199.30", "192.168.199.32"}
    in_vars = _formula_variables(devices, kirish_ips, 644)
    out35_vars = _formula_variables(devices, chiqish35_ips, 644)
    out10_vars = _formula_variables(devices, chiqish10_ips, 644)
    in_prefixed = {f"i{k[1:]}": v for k, v in in_vars.items()}
    out35_prefixed = {f"a{k[1:]}": v for k, v in out35_vars.items()}
    out10_prefixed = {f"b{k[1:]}": v for k, v in out10_vars.items()}
    all_vars = {**in_prefixed, **out35_prefixed, **out10_prefixed}
    in_formula = " + ".join(in_vars.keys()) or "0"
    out35_formula = " + ".join(out35_vars.keys()) or "0"
    out10_formula = " + ".join(out10_vars.keys()) or "0"
    loss_in = " + ".join(k for k in all_vars if k.startswith("i")) or "0"
    loss_out = " + ".join(k for k in all_vars if k.startswith("a") or k.startswith("b")) or "0"
    loss_formula = f"({loss_in}) - ({loss_out})"
    nodes.extend([
        _node("block-pin",    "block", 1500,  80, {"label": "P kirish",     "formula": in_formula,   "variables": in_vars,     "unit": "MW", "decimals": 2, "color": KV_110}),
        _node("block-p35out", "block", 1500, 200, {"label": "P35 chiqish",  "formula": out35_formula, "variables": out35_vars,  "unit": "MW", "decimals": 2, "color": KV_35}),
        _node("block-p10out", "block", 1500, 320, {"label": "P10 chiqish",  "formula": out10_formula, "variables": out10_vars,  "unit": "MW", "decimals": 2, "color": KV_10}),
        _node("block-loss",   "block", 1500, 440, {"label": "Yo'qotish",    "formula": loss_formula,  "variables": all_vars,    "unit": "MW", "decimals": 2, "color": KV_35}),
        _node("legend", "legend", 1420, 600, {"title": "Legenda / Uslovnie"}),
    ])

    # Keep a little provenance on the JSON for future tooling.
    return {
        "nodes": nodes,
        "edges": edges,
        "meta": {
            "template": "yunusobod-prd-reactflow",
            "source": "Yunusobod_SCADA_IEC104_PRD.md",
            "devices": len(devices),
            "mapped_p_devices": len(mapping),
            "editable": True,
        },
    }
