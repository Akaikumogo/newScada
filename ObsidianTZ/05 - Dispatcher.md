# Dispatcher — Operator paneli

## Maqsad

Operatorlar uchun **faqat o'qish** rejimidagi monitoring paneli.

---

## Sahifalar

### 1. Asosiy ko'rinish (`/`)
- Barcha filiallar kartochkasi
- Har bir filialda podstansiyalar soni va online/offline holat

### 2. Podstansiya (`/substation/:id`)
- Barcha qurilmalar
- Har bir qurilma uchun oxirgi signallar qiymati
- Online / offline indikator

### 3. Qurilma (`/device/:id`)
- Barcha signallar real-vaqt qiymatlari (MetricCard)
- Trend grafiklar (TrendChart)
- Xronologiya jadval (virtual scroll)

---

## Xususiyatlar

- **Read-only** — hech qanday tahrirlash yo'q
- Auto-refresh: har 2 soniyada `/api/telemetry/latest` so'rovi
- IEC104 ulanish holati ko'rsatiladi
- Ranglar: yashil = ok, sariq = ogohlantirish, qizil = xato

---

## TZ loyihasidan olinadigan narsalar

| Narsa | Fayl |
|-------|------|
| MetricCard komponenti | `frontend/src/components/MetricCard.tsx` |
| TrendChart komponenti | `frontend/src/components/TrendChart.tsx` |
| Virtual jadval | `DashboardPage.tsx` → `VirtualTable` |
| useTelemetry hook | `frontend/src/hooks/useTelemetry.ts` |
