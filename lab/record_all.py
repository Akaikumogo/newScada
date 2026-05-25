import argparse
import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone

from db import ActiveSignal, Device, connect, insert_records, list_all_active_signals, list_devices
from iec104 import Iec104Config, SignalValue, read_live_values


@dataclass(frozen=True)
class DeviceReadResult:
    device: Device
    records: list[tuple[int, str, float, int, datetime]]
    read_count: int
    error: str | None = None


def build_record_rows(
    device: Device,
    signals: list[ActiveSignal],
    values: list[SignalValue],
    captured_at: datetime,
) -> list[tuple[int, str, float, int, datetime]]:
    by_ioa = {signal.register_code: signal for signal in signals}
    rows: list[tuple[int, str, float, int, datetime]] = []
    for value in values:
        signal = by_ioa.get(value.ioa)
        if signal is None:
            continue
        rows.append(
            (
                device.id,
                signal.signal_name,
                float(value.value),
                int(value.quality),
                captured_at,
            )
        )
    return rows


async def read_device(
    device: Device,
    signals: list[ActiveSignal],
    semaphore: asyncio.Semaphore,
    connect_timeout: float,
    read_timeout: float,
) -> DeviceReadResult:
    if not signals:
        return DeviceReadResult(device=device, records=[], read_count=0)

    wanted_ioas = {signal.register_code for signal in signals}
    captured_at = datetime.now(timezone.utc)
    cfg = Iec104Config(
        host=device.host,
        port=device.port,
        common_address=device.common_address,
        connect_timeout=connect_timeout,
        read_timeout=read_timeout,
        max_read_seconds=max(1.0, connect_timeout + read_timeout),
        idle_after_data_seconds=0.4,
    )

    async with semaphore:
        try:
            values = await asyncio.to_thread(read_live_values, cfg, wanted_ioas)
        except Exception as exc:
            return DeviceReadResult(device=device, records=[], read_count=0, error=str(exc))

    return DeviceReadResult(
        device=device,
        records=build_record_rows(device, signals, values, captured_at),
        read_count=len(values),
    )


async def load_config(conn) -> tuple[list[Device], dict[int, list[ActiveSignal]]]:
    devices = await list_devices(conn)
    active_by_device = await list_all_active_signals(conn)
    return devices, active_by_device


async def run_recorder(args: argparse.Namespace) -> None:
    conn = await connect()
    try:
        devices, active_by_device = await load_config(conn)
        if not devices:
            print("DB da protocol='iec104' device topilmadi.")
            return

        print(
            f"IEC104 record_all started: devices={len(devices)}, "
            f"active_signals={sum(len(v) for v in active_by_device.values())}, "
            f"interval={args.interval}s"
        )
        print("Stop: Ctrl+C")

        cycle = 0
        while True:
            cycle += 1
            started = asyncio.get_running_loop().time()

            if cycle == 1 or (args.refresh_config_seconds and cycle % args.refresh_config_seconds == 0):
                devices, active_by_device = await load_config(conn)

            semaphore = asyncio.Semaphore(args.concurrency)
            results = await asyncio.gather(
                *[
                    read_device(
                        device=device,
                        signals=active_by_device.get(device.id, []),
                        semaphore=semaphore,
                        connect_timeout=args.connect_timeout,
                        read_timeout=args.read_timeout,
                    )
                    for device in devices
                ]
            )

            rows = [row for result in results for row in result.records]
            await insert_records(conn, rows)

            errors = [result for result in results if result.error]
            read_values = sum(result.read_count for result in results)
            elapsed = asyncio.get_running_loop().time() - started
            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            print(
                f"{now} cycle={cycle} read={read_values} inserted={len(rows)} "
                f"errors={len(errors)} elapsed={elapsed:.2f}s"
            )
            for result in errors[:5]:
                print(f"  device_id={result.device.id} {result.device.host}:{result.device.port} error={result.error}")
            if len(errors) > 5:
                print(f"  ... {len(errors) - 5} ta boshqa xato")

            if args.once:
                return

            sleep_for = max(0.0, args.interval - elapsed)
            await asyncio.sleep(sleep_for)
    finally:
        await conn.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Read all active IEC104 IOA values and insert them into record.")
    parser.add_argument("--interval", type=float, default=1.0, help="Read/write interval in seconds.")
    parser.add_argument("--concurrency", type=int, default=10, help="How many devices to read in parallel.")
    parser.add_argument("--connect-timeout", type=float, default=1.0, help="IEC104 TCP connect timeout.")
    parser.add_argument("--read-timeout", type=float, default=1.0, help="IEC104 socket read timeout.")
    parser.add_argument("--refresh-config-seconds", type=int, default=30, help="Reload devices/signals every N cycles.")
    parser.add_argument("--once", action="store_true", help="Run one cycle and exit.")
    return parser.parse_args()


if __name__ == "__main__":
    try:
        asyncio.run(run_recorder(parse_args()))
    except KeyboardInterrupt:
        print("\nStopped.")
