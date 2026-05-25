from __future__ import annotations

import secrets
import time
import uuid


def uuid7() -> uuid.UUID:
    """Generate an RFC 9562-style UUIDv7 without requiring Python 3.14 at runtime."""
    stdlib_uuid7 = getattr(uuid, "uuid7", None)
    if stdlib_uuid7 is not None:
        return stdlib_uuid7()

    unix_ts_ms = time.time_ns() // 1_000_000
    timestamp = unix_ts_ms & ((1 << 48) - 1)
    rand_a = secrets.randbits(12)
    rand_b = secrets.randbits(62)

    value = (
        (timestamp << 80)
        | (0x7 << 76)
        | (rand_a << 64)
        | (0b10 << 62)
        | rand_b
    )
    return uuid.UUID(int=value)


def uuid7_str() -> str:
    return str(uuid7())

