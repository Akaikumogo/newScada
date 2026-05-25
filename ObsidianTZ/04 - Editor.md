# Editor — Admin Panel

## Sahifalar

### 1. Filiallar (`/branches`)
- Filiallar ro'yxati (jadval)
- "Yangi filial" tugmasi → modal
- Har bir qatorda: tahrirlash, o'chirish, "Podstansiyalar" havolasi

### 2. Podstansiyalar (`/branches/:id/substations`)
- Filial nomi sarlavhada
- Podstansiyalar ro'yxati
- "Yangi podstansiya" → modal
- Har bir qatorda: tahrirlash, o'chirish, "Qurilmalar" havolasi

### 3. Qurilmalar (`/substations/:id/devices`)
- Podstansiya nomi sarlavhada
- Qurilmalar jadval: nomi, modeli, protokol
- "Yangi qurilma" → modal
  - Nomi
  - Model → **select** (device_model dan)
  - Protokol → **select** (hozircha faqat IEC104)
- Qurilmani ochganda → Signal konfiguratsiya sahifasi

### 4. Signal konfiguratsiya (`/devices/:id/signals`)
- Qurilma nomi sarlavhada
- Signallar jadval: register_code, signal_name, unit
- "Signal qo'shish" → modal
  - register_code (IOA raqami)
  - signal_name (masalan: ia, ib, ic)
  - signal_title
  - unit
  - value_type: float | status

### 5. Model katalogi (`/models`)
- Modellar ro'yxati
- "Yangi model" → modal
  - Nomi (masalan: BMRZ-153)
  - Ishlab chiqaruvchi
  - Tavsif

---

## UI Komponentlar

| Komponent | Maqsad |
|-----------|--------|
| `BranchTree` | Chap panel — ierarxiya daraxti |
| `DataTable` | Universal jadval |
| `FormModal` | Yaratish/tahrirlash modali |
| `ProtocolSelect` | IEC104 va boshqalar uchun select |
| `ModelSelect` | Device model tanlash select |
