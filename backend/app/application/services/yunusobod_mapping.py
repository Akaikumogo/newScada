from __future__ import annotations

import csv
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


ANALITIKA_DIR = Path(r"C:\Users\User\Desktop\analitika")
NEEDED_POINTS_CSV = ANALITIKA_DIR / "iec104_analysis" / "traffic_safe_needed_points.csv"
FINAL_MAPPING_CSV = ANALITIKA_DIR / "iec104_analysis" / "traffic_safe_final_mapping.csv"
PRD_PATH = ANALITIKA_DIR / "Yunusobod_SCADA_IEC104_PRD.md"
SLD_HTML_PATH = ANALITIKA_DIR / "Yunusobod_SLD.html"
SLD_SVG_PATH = ANALITIKA_DIR / "Yunusobod_SLD.svg"
SLD_PDF_PATH = ANALITIKA_DIR / "Yunusobod_SLD.pdf"
MODEL_PDF_PATH = ANALITIKA_DIR / "9_Юнусабад-Model.pdf"

BALANCE_INCLUDED_RULES = {"P_kirish", "P35_out"}
BALANCE_EXCLUDED_RULES = {"exclude_total", "monitoring_only"}


@dataclass(frozen=True)
class YunusobodPoint:
    shkaf: str
    bmrz: str
    ip: str
    object: str
    role: str
    balance_rule: str
    point: str
    ioa: int
    param: str
    asdu: str
    group: str
    source_file: str

    @property
    def device_name(self) -> str:
        return f"{self.shkaf}-shkaf {self.bmrz} - {self.object}"

    @property
    def signal_name(self) -> str:
        code = self.point.strip().lower().replace("-", "_").replace(" ", "_")
        return code[:64]

    @property
    def unit(self) -> str:
        if "," not in self.param:
            return ""
        return self.param.rsplit(",", 1)[1].strip()[:24]

    @property
    def value_type(self) -> str:
        if self.asdu.startswith("M_SP") or self.asdu.startswith("M_DP"):
            return "status"
        if self.asdu.startswith("M_IT"):
            return "counter"
        return "float"

    @property
    def evidence(self) -> dict:
        return {
            "ip": self.ip,
            "port": 2404,
            "asdu_address": 3,
            "ioa": self.ioa,
            "iec104_type": self.asdu,
            "source_file": self.source_file,
            "prd": str(PRD_PATH),
            "sld_html": str(SLD_HTML_PATH),
            "sld_svg": str(SLD_SVG_PATH),
            "sld_pdf": str(SLD_PDF_PATH),
            "model_pdf": str(MODEL_PDF_PATH),
            "param": self.param,
            "group": self.group,
        }


def _read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as fh:
        return list(csv.DictReader(fh))


@lru_cache(maxsize=1)
def load_needed_points() -> list[YunusobodPoint]:
    points: list[YunusobodPoint] = []
    for row in _read_csv(NEEDED_POINTS_CSV):
        try:
            ioa = int(str(row.get("ioa", "")).strip())
        except ValueError:
            continue
        points.append(YunusobodPoint(
            shkaf=row.get("shkaf", "").strip(),
            bmrz=row.get("bmrz", "").strip(),
            ip=row.get("ip", "").strip(),
            object=row.get("object", "").strip(),
            role=row.get("role", "").strip(),
            balance_rule=row.get("balance_rule", "").strip(),
            point=row.get("point", "").strip(),
            ioa=ioa,
            param=row.get("param", "").strip(),
            asdu=row.get("asdu", "").strip(),
            group=row.get("group", "").strip(),
            source_file=row.get("source_file", "").strip(),
        ))
    return points


@lru_cache(maxsize=1)
def load_device_rows() -> list[dict[str, str]]:
    return _read_csv(FINAL_MAPPING_CSV)


def source_manifest() -> dict:
    files = {
        "prd": PRD_PATH,
        "sld_html": SLD_HTML_PATH,
        "sld_svg": SLD_SVG_PATH,
        "sld_pdf": SLD_PDF_PATH,
        "model_pdf": MODEL_PDF_PATH,
        "needed_points_csv": NEEDED_POINTS_CSV,
        "final_mapping_csv": FINAL_MAPPING_CSV,
    }
    return {
        key: {
            "path": str(path),
            "exists": path.exists(),
            "last_modified": path.stat().st_mtime if path.exists() else None,
            "size": path.stat().st_size if path.exists() else None,
        }
        for key, path in files.items()
    }
