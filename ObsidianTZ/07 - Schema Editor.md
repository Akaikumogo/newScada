# Schema Editor — Podstansiya sxema muharriri

> Batafsil texnik spesifikatsiya: [[features/F06 - Schema Editor]]

## Qisqacha

Har bir podstansiya uchun interaktiv drag-and-drop elektr sxema muharriri.  
Sxema `substation_schema` jadvalida JSON formatida saqlanadi.

---

## 3 qatlam

```
1. Elektr komponentlar  — shinalar, uzgichlar, transformatorlar...
2. Qurilma bloklari     — podstansiya qurilmalari (drag & drop)
3. Signal displaylar    — real-vaqt qiymat ko'rsatuvchi widgetlar
```

---

## Qurilma qo'shish xulqi

```
Qurilmani DRAG → canvas    →  Device Block (barcha signallar kompakt)
Ustida USHLAB TURISH       →  Expand (signallar ro'yxati + drag handle)
Signal ni DRAG → boshqa joy →  Signal Display widget (yakka qiymat)
```

---

## Rang + stillar

Har bir element uchun:
- Fill rangi, border rangi, border qalinligi
- Matn rangi, o'lchami
- Opacity, border radius
- Z-index (oldinga/orqaga)

---

## Texnologiya

**React Flow** (node + edge asosli canvas)  
Custom node turlari: `bus_bar`, `transformer`, `circuit_breaker`, `device_block`, `signal_display`, ...

---

## Dispatcher da

Sxema read-only ko'rinishda chiqadi.  
Signal Display widgetlari real-vaqt yangilanadi.  
Operator o'zgartira olmaydi.

→ Batafsil: [[features/F06 - Schema Editor]]
