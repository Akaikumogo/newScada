from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import HTMLResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_db
from app.application.services.yunusobod_mapping import (
    BALANCE_INCLUDED_RULES,
    SLD_HTML_PATH,
    SLD_SVG_PATH,
    load_needed_points,
    source_manifest,
)
from app.infrastructure.cache.redis_cache import get_many_signal_values
from app.infrastructure.db.models import Device, DeviceSignal

router = APIRouter(prefix="/yunusobod", tags=["yunusobod"])


def _inject_live_sld_runtime(html: str, substation_id: int) -> str:
    html = html.replace("setInterval(bal,2400);", "")
    html = html.replace(
        ">21 / 21</text>",
        ' id="bmrzOnline">21 / 21</text>',
        1,
    )
    html = html.replace(
        ">21 online В· 0 offline</text>",
        ' id="iecOnline">21 online / 0 offline</text>',
        1,
    )
    html = html.replace(
        ">21 online · 0 offline</text>",
        ' id="iecOnline">21 online / 0 offline</text>',
        1,
    )

    runtime = f"""
<script>
(function () {{
  const SUBSTATION_ID = {substation_id};
  const fmt = (value, digits = 1) => {{
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(digits) : '--';
  }};
  const setText = (id, value) => {{
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }};
  async function refreshLiveSld() {{
    try {{
      const [balance, live] = await Promise.all([
        fetch(`/api/yunusobod/balance?substation_id=${{SUBSTATION_ID}}`).then(r => r.json()),
        fetch(`/api/telemetry/live?substation_id=${{SUBSTATION_ID}}`).then(r => r.json()),
      ]);
      const totals = balance.totals || {{}};
      const devices = Array.isArray(live) ? live : [];
      const online = devices.filter(device => device.online).length;
      const offline = Math.max(devices.length - online, 0);

      setText('bIn', fmt(totals.P_kirish_mw));
      setText('bOut', fmt(totals.P35_out_mw));
      setText('bLoss', fmt(totals.P_yoqotish_mw));
      setText('bPct', fmt(totals.loss_percent));
      setText('bmrzOnline', `${{online}} / ${{devices.length || 21}}`);
      setText('iecOnline', `${{online}} online / ${{offline}} offline`);
    }} catch (error) {{
      console.warn('Yunusobod live SLD update failed', error);
    }}
  }}
  refreshLiveSld();
  setInterval(refreshLiveSld, 2500);
}})();
</script>
"""
    if "</body>" in html:
        return html.replace("</body>", f"{runtime}\n</body>")
    return f"{html}\n{runtime}"


def _scale_power_to_mw(value: float | None, unit: str) -> float | None:
    if value is None:
        return None
    unit_l = (unit or "").lower()
    if "квт" in unit_l or "kw" in unit_l:
        return value / 1000.0
    if "вт" in unit_l and "к" not in unit_l:
        return value / 1_000_000.0
    return value


@router.get("/sources")
async def get_sources():
    return source_manifest()


@router.get("/sld")
async def get_live_sld(substation_id: int = Query(5)):
    if not SLD_HTML_PATH.exists():
        return HTMLResponse(
            "<html><body style='background:#060a14;color:#eaf1ff'>Yunusobod SLD HTML topilmadi.</body></html>",
            status_code=404,
        )
    html = SLD_HTML_PATH.read_text(encoding="utf-8")
    return HTMLResponse(_inject_live_sld_runtime(html, substation_id))


@router.get("/sld.svg")
async def get_sld_svg():
    if not SLD_SVG_PATH.exists():
        return Response("Yunusobod SLD SVG topilmadi.", status_code=404, media_type="text/plain")
    return Response(SLD_SVG_PATH.read_text(encoding="utf-8"), media_type="image/svg+xml")


@router.get("/mapping")
async def get_mapping(
    point: str | None = Query(None, description="Masalan: P, Q, IA"),
    balance_rule: str | None = Query(None),
):
    rows = load_needed_points()
    if point:
        rows = [r for r in rows if r.point.upper() == point.upper()]
    if balance_rule:
        rows = [r for r in rows if r.balance_rule == balance_rule]
    return {
        "total": len(rows),
        "items": [
            {
                "shkaf": r.shkaf,
                "bmrz": r.bmrz,
                "ip": r.ip,
                "object": r.object,
                "role": r.role,
                "balance_rule": r.balance_rule,
                "point": r.point,
                "ioa": r.ioa,
                "param": r.param,
                "asdu": r.asdu,
                "group": r.group,
                "source_file": r.source_file,
                "evidence": r.evidence,
            }
            for r in rows
        ],
    }


@router.get("/balance")
async def get_balance(
    substation_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    device_q = select(Device)
    if substation_id is not None:
        device_q = device_q.where(Device.substation_id == substation_id)
    devices = (await db.execute(device_q)).scalars().all()
    devices_by_ip = {d.iec104_host: d for d in devices}

    p_points = [p for p in load_needed_points() if p.point.upper() == "P"]
    device_ids = [d.id for d in devices]
    signal_rows = []
    if device_ids:
        signal_rows = (await db.execute(
            select(DeviceSignal).where(
                DeviceSignal.device_id.in_(device_ids),
                DeviceSignal.register_code.in_([p.ioa for p in p_points]),
            )
        )).scalars().all()
    sig_by_device_ioa = {(s.device_id, s.register_code): s for s in signal_rows}
    cache_keys = [
        (sig.device_id, sig.signal_name)
        for sig in signal_rows
    ]
    live = await get_many_signal_values(cache_keys)

    totals = {
        "P_kirish_mw": 0.0,
        "P35_out_mw": 0.0,
        "P_yoqotish_mw": None,
        "loss_percent": None,
    }
    evidence_rows: list[dict] = []
    missing = 0
    bad_quality = 0

    for point in p_points:
        device = devices_by_ip.get(point.ip)
        sig = sig_by_device_ioa.get((device.id, point.ioa)) if device else None
        entry = live.get((sig.device_id, sig.signal_name)) if sig else None
        raw_value = entry.get("value") if entry else None
        value_mw = _scale_power_to_mw(raw_value, point.unit)
        quality = entry.get("quality", 0) if entry else None
        if point.balance_rule in BALANCE_INCLUDED_RULES:
            if value_mw is None:
                missing += 1
            else:
                totals[f"{point.balance_rule}_mw"] += value_mw
            if quality not in (None, 0):
                bad_quality += 1

        evidence_rows.append({
            "device_id": device.id if device else None,
            "device_name": device.name if device else point.device_name,
            "signal_id": sig.id if sig else None,
            "signal_name": sig.signal_name if sig else point.signal_name,
            "raw_value": raw_value,
            "value_mw": value_mw,
            "quality": quality,
            "ts": entry.get("ts") if entry else None,
            "included_in_balance": point.balance_rule in BALANCE_INCLUDED_RULES,
            "balance_rule": point.balance_rule,
            "object": point.object,
            "role": point.role,
            "evidence": point.evidence,
        })

    totals["P_yoqotish_mw"] = totals["P_kirish_mw"] - totals["P35_out_mw"]
    if abs(totals["P_kirish_mw"]) > 0.000001:
        totals["loss_percent"] = totals["P_yoqotish_mw"] / totals["P_kirish_mw"] * 100.0

    complete_sources = False
    if bad_quality:
        quality = "Bad"
    elif missing:
        quality = "MissingRealtime"
    else:
        quality = "Partial"

    return {
        "substation_id": substation_id,
        "calculated_at": datetime.now(timezone.utc).isoformat(),
        "quality": quality,
        "complete_sources": complete_sources,
        "status_note": (
            "Partial/Incomplete: PRD bo'yicha 110 kV kirish va barcha 10 kV iste'molchi "
            "feeder P/Q nuqtalari hali alohida manba sifatida talab qilinadi."
        ),
        "totals": totals,
        "missing_realtime_points": missing,
        "bad_quality_points": bad_quality,
        "evidence": evidence_rows,
        "sources": source_manifest(),
    }
