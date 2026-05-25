import asyncio
import os
import queue
import threading
from datetime import datetime

from db import ActiveSignal, Device, connect, list_active_signals, list_devices
from iec104 import Iec104Config, SignalValue, read_live_values


CommandQueue = queue.Queue[str]


def start_input_reader(commands: CommandQueue) -> None:
    def read_loop() -> None:
        while True:
            try:
                commands.put(input().strip())
            except EOFError:
                commands.put("quit")
                return

    thread = threading.Thread(target=read_loop, daemon=True)
    thread.start()


def clear_screen() -> None:
    os.system("cls" if os.name == "nt" else "clear")


def print_devices(devices: list[Device]) -> None:
    clear_screen()
    print("IEC104 LAB - device list")
    print("=" * 86)
    print(f"{'Index':<7} {'ID':<5} {'Name':<28} {'Host':<18} {'Port':<6} {'CASDU':<6} {'Poll':<6}")
    print("-" * 86)
    for index, device in enumerate(devices, 1):
        print(
            f"{index:<7} {device.id:<5} {device.name[:27]:<28} "
            f"{device.host:<18} {device.port:<6} {device.common_address:<6} "
            f"{device.poll_interval_seconds:<6.1f}"
        )
    print()
    print("Device indexini kiriting. Masalan: 1")


def read_device_index(devices: list[Device]) -> int:
    while True:
        raw = input("> ").strip()
        try:
            index = int(raw)
        except ValueError:
            print("Raqam kiriting.")
            continue
        if 1 <= index <= len(devices):
            return index - 1
        print(f"Index 1..{len(devices)} oraligida bolishi kerak.")


def format_value(value: SignalValue | None, signal: ActiveSignal) -> tuple[str, str, str, str]:
    if value is None:
        return "-", "-", "-", "-"

    unit = signal.unit or ""
    rendered = f"{value.value:g}"
    if unit:
        rendered = f"{rendered} {unit}"
    return rendered, str(value.quality), value.short, value.timestamp or "-"


def render_live(
    device: Device,
    signals: list[ActiveSignal],
    values: dict[int, SignalValue],
    error: str | None,
    selected_index: int,
    status: str = "",
) -> None:
    clear_screen()
    print("IEC104 LAB - active IOA monitor")
    print("=" * 100)
    print(
        f"Selected [{selected_index + 1}] {device.name} | "
        f"{device.host}:{device.port} | CASDU={device.common_address} | "
        f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    )
    print("Commands: change index | change <index> | list | quit")
    if status:
        print(f"Status: {status}")
    if error:
        print(f"Last error: {error}")
    print("-" * 100)

    if not signals:
        print("Bu device uchun active=true signal topilmadi.")
        return

    print(f"{'IOA':<8} {'Signal':<18} {'Title':<30} {'Value':<18} {'Q':<4} {'Type':<9} {'Time'}")
    print("-" * 100)
    for signal in signals:
        value, quality, short, ts = format_value(values.get(signal.register_code), signal)
        title = signal.signal_title or ""
        print(
            f"{signal.register_code:<8} {signal.signal_name[:17]:<18} "
            f"{title[:29]:<30} {value:<18} {quality:<4} {short:<9} {ts}"
        )


async def choose_device(devices: list[Device], commands: CommandQueue | None = None) -> int:
    print_devices(devices)
    if commands is None:
        return read_device_index(devices)

    while True:
        try:
            raw = commands.get_nowait()
        except queue.Empty:
            await asyncio.sleep(0.1)
            continue
        if raw.lower() in {"q", "quit", "exit"}:
            raise KeyboardInterrupt
        try:
            index = int(raw)
        except ValueError:
            print("Raqam kiriting.")
            continue
        if 1 <= index <= len(devices):
            return index - 1
        print(f"Index 1..{len(devices)} oraligida bolishi kerak.")


def parse_change_command(raw: str, devices_count: int) -> int | None:
    lowered = raw.lower()
    if lowered == "change index":
        return -1
    if lowered.startswith("change "):
        try:
            index = int(lowered.split(maxsplit=1)[1])
        except ValueError:
            return -1
        if 1 <= index <= devices_count:
            return index - 1
        return -1
    return None


async def monitor() -> None:
    conn = await connect()
    try:
        devices = await list_devices(conn)
        if not devices:
            print("DB da protocol='iec104' device topilmadi.")
            return

        selected_index = read_device_index_after_print(devices)
        commands: CommandQueue = queue.Queue()
        start_input_reader(commands)

        values: dict[int, SignalValue] = {}
        error: str | None = None

        while True:
            device = devices[selected_index]
            signals = await list_active_signals(conn, device.id)
            wanted_ioas = {signal.register_code for signal in signals}
            render_live(device, signals, values, None, selected_index, "connecting...")

            while True:
                while not commands.empty():
                    raw = commands.get().strip()
                    lowered = raw.lower()
                    if lowered in {"q", "quit", "exit"}:
                        return
                    if lowered == "list":
                        selected_index = await choose_device(devices, commands)
                        values = {}
                        error = None
                        break
                    change = parse_change_command(raw, len(devices))
                    if change is not None:
                        if change == -1:
                            selected_index = await choose_device(devices, commands)
                        else:
                            selected_index = change
                        values = {}
                        error = None
                        break
                else:
                    if not wanted_ioas:
                        render_live(device, signals, values, None, selected_index, "active IOA topilmadi")
                        await asyncio.sleep(max(0.5, device.poll_interval_seconds))
                        continue

                    try:
                        render_live(device, signals, values, error, selected_index, "IEC104 reading...")
                        cfg = Iec104Config(
                            host=device.host,
                            port=device.port,
                            common_address=device.common_address,
                            connect_timeout=2.0,
                            read_timeout=1.0,
                            max_read_seconds=max(2.0, device.poll_interval_seconds + 1.0),
                            idle_after_data_seconds=0.6,
                        )
                        rows = await asyncio.to_thread(read_live_values, cfg, wanted_ioas)
                        values.update({row.ioa: row for row in rows})
                        error = None
                    except Exception as exc:
                        error = str(exc)

                    render_live(device, signals, values, error, selected_index, "waiting...")
                    await asyncio.sleep(max(0.5, device.poll_interval_seconds))
                    continue

                break
    finally:
        await conn.close()


def read_device_index_after_print(devices: list[Device]) -> int:
    print_devices(devices)
    return read_device_index(devices)


if __name__ == "__main__":
    try:
        asyncio.run(monitor())
    except KeyboardInterrupt:
        print("\nStopped.")
