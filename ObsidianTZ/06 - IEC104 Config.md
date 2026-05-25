# IEC104 Konfiguratsiya

## Protokol haqida

IEC 60870-5-104 — elektr energetika tizimlarida real-vaqt telemetriya uchun standart protokol.

---

## Asosiy tushunchalar

| Termin                               | Ma'nosi                      |
| ------------------------------------ | ---------------------------- |
| IOA (Information Object Address)     | Signal manzili, masalan: 641 |
| ASDU (Application Service Data Unit) | Ma'lumot bloki               |
| COT (Cause of Transmission)          | Uzatish sababi               |
| TI (Type Identification)             | Ma'lumot turi                |
| CASDU (Common ASDU Address)          | Qurilma manzili, masalan: 3  |

---

## TI turlari (hozir qo'llab-quvvatlanganlar)

| TI | Nomi | Ma'lumot turi |
|----|------|---------------|
| 1  | M_SP_NA_1 | Single-point (holat) |
| 3  | M_DP_NA_1 | Double-point (holat) |
| 9  | M_ME_NA_1 | O'lchov (normalized) |
| 11 | M_ME_NB_1 | O'lchov (scaled) |
| 13 | M_ME_NC_1 | O'lchov (float) |
| 30 | M_SP_TB_1 | Single-point + vaqt |
| 36 | M_ME_TF_1 | Float + vaqt |

---

## DB da signal konfiguratsiya

```
device_signal jadvali:
  device_id      → qaysi qurilma
  register_code  → IOA manzili (641, 642, 643...)
  signal_name    → kodi (ia, ib, ic...)
  signal_title   → nomi (I(a) B-B-A-2)
  unit           → birlik (A, kV, MW...)
  value_type     → float | status
```

---

## Collector mantiq'i

```python
# Har poll_interval sekundda:
1. IEC104 socket ulanish
2. General Interrogation (C_IC_NA_1, TI=100) yuborish
3. Javob APDUlarni o'qish
4. Har bir IOA uchun device_signal dan qurilma topish
5. Qiymat o'zgandimi → record ga yozish
6. Cache ni yangilash
```

---

## Hozirgi TZ loyihasidan farq

| TZ (eski) | newScada (yangi) |
|-----------|-----------------|
| `signal_catalog.py` hardcode | DB da `device_signal` |
| Faqat 3 IOA | Cheksiz, qurilma bo'yicha |
| Har poll yozadi | Faqat o'zganda yozadi |
| 1 ta qurilma | Ko'p qurilma, ko'p filial |
