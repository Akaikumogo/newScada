import socket
import struct
from dataclasses import dataclass
from datetime import datetime


STARTDT_ACT = bytes.fromhex("68 04 07 00 00 00")

TYPE_NAMES = {
    1: "M_SP_NA_1",
    3: "M_DP_NA_1",
    9: "M_ME_NA_1",
    11: "M_ME_NB_1",
    13: "M_ME_NC_1",
    30: "M_SP_TB_1",
    31: "M_DP_TB_1",
    34: "M_ME_TD_1",
    35: "M_ME_TE_1",
    36: "M_ME_TF_1",
    70: "M_EI_NA_1",
    100: "C_IC_NA_1",
}

TYPE_SHORT = {
    1: "SP",
    3: "DP",
    9: "NVA",
    11: "SVA",
    13: "IEEE_F",
    30: "SP+T",
    31: "DP+T",
    34: "NVA+T",
    35: "SVA+T",
    36: "IEEE_F+T",
}

CATEGORY = {
    "SP": "status",
    "DP": "status",
    "SP+T": "status",
    "DP+T": "status",
    "NVA": "analog",
    "SVA": "analog",
    "IEEE_F": "analog",
    "NVA+T": "analog",
    "SVA+T": "analog",
    "IEEE_F+T": "analog",
}


@dataclass(frozen=True)
class Iec104Config:
    host: str
    port: int = 2404
    common_address: int = 3
    connect_timeout: float = 5.0
    read_timeout: float = 8.0
    max_read_seconds: float = 12.0
    idle_after_data_seconds: float = 1.5
    ack_window: int = 8


@dataclass
class Iec104State:
    send_seq: int = 0
    recv_seq: int = 0
    unconfirmed: int = 0


@dataclass(frozen=True)
class SignalValue:
    ioa: int
    value: float
    quality: int
    type_id: int
    type_name: str
    short: str
    category: str
    casdu: int
    timestamp: str | None = None


def read_live_values(cfg: Iec104Config, wanted_ioas: set[int] | None = None) -> list[SignalValue]:
    state = Iec104State()
    rows: list[SignalValue] = []
    started_at = datetime.now()
    last_data_at: datetime | None = None

    with socket.create_connection((cfg.host, cfg.port), timeout=cfg.connect_timeout) as sock:
        sock.settimeout(cfg.read_timeout)
        sock.sendall(STARTDT_ACT)
        _recv_apdu(sock)

        rows.extend(_drain(sock, state, seconds=0.3))

        sock.sendall(_make_gi(state, cfg.common_address))
        while True:
            if (datetime.now() - started_at).total_seconds() >= cfg.max_read_seconds:
                break
            if last_data_at and (datetime.now() - last_data_at).total_seconds() >= cfg.idle_after_data_seconds:
                break

            try:
                apdu = _recv_apdu(sock)
            except socket.timeout:
                break

            parsed, _info = _parse_apdu(apdu, state)
            if parsed:
                last_data_at = datetime.now()
                if wanted_ioas:
                    parsed = [row for row in parsed if row.ioa in wanted_ioas]
                rows.extend(parsed)

            if state.unconfirmed >= cfg.ack_window:
                sock.sendall(_make_s_frame(state.recv_seq))
                state.unconfirmed = 0

    latest: dict[int, SignalValue] = {}
    for row in rows:
        latest[row.ioa] = row
    return [latest[ioa] for ioa in sorted(latest)]


def _drain(sock: socket.socket, state: Iec104State, seconds: float) -> list[SignalValue]:
    rows: list[SignalValue] = []
    old_timeout = sock.gettimeout()
    sock.settimeout(seconds)
    try:
        while True:
            try:
                parsed, _info = _parse_apdu(_recv_apdu(sock), state)
                rows.extend(parsed)
            except socket.timeout:
                return rows
    finally:
        sock.settimeout(old_timeout)


def _recv_exact(sock: socket.socket, n: int) -> bytes:
    buf = bytearray()
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            raise ConnectionError("connection closed")
        buf.extend(chunk)
    return bytes(buf)


def _recv_apdu(sock: socket.socket) -> bytes:
    start = _recv_exact(sock, 1)
    if start != b"\x68":
        raise RuntimeError(f"bad IEC104 start byte: {start.hex()}")
    length = _recv_exact(sock, 1)[0]
    return start + bytes([length]) + _recv_exact(sock, length)


def _make_gi(state: Iec104State, casdu: int) -> bytes:
    asdu = bytes([100, 1, 6, 0, casdu & 0xFF, (casdu >> 8) & 0xFF, 0, 0, 0, 20])
    ctrl = struct.pack("<HH", state.send_seq << 1, state.recv_seq << 1)
    state.send_seq += 1
    return bytes([0x68, len(ctrl) + len(asdu)]) + ctrl + asdu


def _make_s_frame(recv_seq: int) -> bytes:
    ack = recv_seq << 1
    return bytes([0x68, 0x04, 0x01, 0x00, ack & 0xFF, (ack >> 8) & 0xFF])


def _parse_apdu(apdu: bytes, state: Iec104State) -> tuple[list[SignalValue], dict | None]:
    body = apdu[2 : 2 + apdu[1]]
    if len(body) < 4:
        return [], None

    if body[0] & 1:
        return [], None

    state.recv_seq = max(state.recv_seq, (struct.unpack("<H", body[:2])[0] >> 1) + 1)
    state.unconfirmed += 1

    asdu = body[4:]
    if len(asdu) < 6:
        return [], None

    type_id = asdu[0]
    count = asdu[1] & 0x7F
    sequential = bool(asdu[1] & 0x80)
    cot = asdu[2] & 0x3F
    pn = (asdu[2] >> 6) & 1
    casdu = asdu[4] | (asdu[5] << 8)
    offset = 6

    if type_id == 100:
        status = "actcon" if cot == 7 else ("actterm" if cot == 10 else f"cot={cot}")
        return [], {"type": "GI", "status": status, "negative": bool(pn), "casdu": casdu}
    if type_id == 70:
        return [], {"type": "M_EI_NA_1", "status": "initialized", "casdu": casdu}

    rows: list[SignalValue] = []
    ioa = 0

    for i in range(count):
        if sequential and i > 0:
            ioa += 1
        else:
            if offset + 3 > len(asdu):
                break
            ioa = asdu[offset] | (asdu[offset + 1] << 8) | (asdu[offset + 2] << 16)
            offset += 3

        value: float | None = None
        quality = 0
        timestamp = None
        short = TYPE_SHORT.get(type_id, str(type_id))

        if type_id in (13, 36):
            if offset + 5 > len(asdu):
                break
            value = struct.unpack("<f", asdu[offset : offset + 4])[0]
            quality = asdu[offset + 4]
            offset += 5
            if type_id == 36 and offset + 7 <= len(asdu):
                timestamp = _parse_cp56(asdu[offset : offset + 7])
                offset += 7
        elif type_id in (11, 35):
            if offset + 3 > len(asdu):
                break
            value = float(struct.unpack("<h", asdu[offset : offset + 2])[0])
            quality = asdu[offset + 2]
            offset += 3
            if type_id == 35 and offset + 7 <= len(asdu):
                timestamp = _parse_cp56(asdu[offset : offset + 7])
                offset += 7
        elif type_id in (9, 34):
            if offset + 3 > len(asdu):
                break
            value = struct.unpack("<h", asdu[offset : offset + 2])[0] / 32768.0
            quality = asdu[offset + 2]
            offset += 3
            if type_id == 34 and offset + 7 <= len(asdu):
                timestamp = _parse_cp56(asdu[offset : offset + 7])
                offset += 7
        elif type_id in (1, 30):
            if offset + 1 > len(asdu):
                break
            quality = asdu[offset]
            value = float(quality & 0x01)
            offset += 1
            if type_id == 30 and offset + 7 <= len(asdu):
                timestamp = _parse_cp56(asdu[offset : offset + 7])
                offset += 7
        elif type_id in (3, 31):
            if offset + 1 > len(asdu):
                break
            quality = asdu[offset]
            value = float(quality & 0x03)
            offset += 1
            if type_id == 31 and offset + 7 <= len(asdu):
                timestamp = _parse_cp56(asdu[offset : offset + 7])
                offset += 7
        else:
            break

        rows.append(
            SignalValue(
                ioa=ioa,
                value=round(value, 6),
                quality=quality,
                type_id=type_id,
                type_name=TYPE_NAMES.get(type_id, f"type_{type_id}"),
                short=short,
                category=CATEGORY.get(short, "unknown"),
                casdu=casdu,
                timestamp=timestamp,
            )
        )

    return rows, None


def _parse_cp56(raw: bytes) -> str | None:
    if len(raw) < 7:
        return None
    ms = raw[0] | (raw[1] << 8)
    minute = raw[2] & 0x3F
    hour = raw[3] & 0x1F
    day = raw[4] & 0x1F
    month = raw[5] & 0x0F
    year = (raw[6] & 0x7F) + 2000
    try:
        return f"{year:04d}-{month:02d}-{day:02d} {hour:02d}:{minute:02d}:{ms // 1000:02d}.{ms % 1000:03d}"
    except ValueError:
        return None
