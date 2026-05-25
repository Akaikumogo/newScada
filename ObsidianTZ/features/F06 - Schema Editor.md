---
type: feature
feature_id: "F06"
title: "Schema Editor"
status: planned
priority: 1
tags: [feature, frontend, schema-editor, react-flow]
created: 2026-05-24
related: ["[[ADR/ADR-003 React Flow]]", "[[Technical/React Flow Patterns]]", "[[features/F02 - Substation Management]]"]
---

# F06 · Schema Editor — Podstansiya sxema muharriri

## Maqsad
Har bir podstansiya uchun interaktiv elektr sxema chizish va u yerga qurilmalarning real-vaqt ma'lumotlarini joylashtirish.

## Mohiyat
Canvas asosidagi drag-and-drop muharrir. Foydalanuvchi elektr sxema komponentlarini joylashtiradi, qurilmalarni sxemaga tashlaydi, ularning signallarini ko'rsatadi. Sxema DB ga JSON sifatida saqlanadi.

## Nimaga kerak
- Operatorlar uchun podstansiyaning vizual kartasi
- Real ob'ektga o'xshash sxema orqali tezkor holat ko'rish
- Qurilma signallarini sxemaning tegishli joyida ko'rsatish

## Qanday ishlaydi

### Asosiy canvas
```
Chap panel:
  ├── Komponentlar kutubxonasi (drag qilib canvasga tashlash)
  └── Qurilmalar paneli (podstansiyaning qurilmalari ro'yxati)

O'rta — Canvas:
  ├── Joylashtirilgan komponentlar
  ├── Qurilma bloklari
  └── Signal displaylar

O'ng panel (tanlanganda):
  └── Tanlangan element xossalari (rang, o'lcham, z-index...)
```

### Qurilmani sxemaga qo'shish
```
1. Chap paneldagi qurilmani DRAG qilib canvasga tashlash
   → Canvas da "Device Block" paydo bo'ladi
   → Blokda: qurilma nomi + model + signallar soni

2. Qurilma ustida CLICK + USHLAB TURISH (long press / hover)
   → Blok expand bo'ladi
   → Ichida: barcha signallar ro'yxati (drag handle bilan)

3. Alohida signalni DRAG qilib boshqa joyga tashlash
   → Signal Display widget paydo bo'ladi
   → Real-vaqt qiymat ko'rsatadi (ia: 245.3 A)
```

---

## Komponentlar kutubxonasi

### Elektr komponentlar
| Komponent | Tavsif |
|-----------|--------|
| Bus Bar (shina) | Gorizontal/vertikal elektr shina |
| Transformer | Kuchlanish transformatori (T belgi) |
| Circuit Breaker | Avtomatik uzgich (□ belgi) |
| Disconnector | Ajratgich (— belgi) |
| Earth Switch | Zamin ulagich (⏚ belgi) |
| Current Transformer (CT) | Tok o'lchov transformatori |
| Voltage Transformer (VT) | Kuchlanish o'lchov transformatori |
| Capacitor | Kondensator |
| Reactor | Reaktor (induktivlik) |
| Fuse | Sig'im (предохранитель) |
| Cable / Wire | Ulanish liniyasi |
| Power Line | Kuchli elektr liniyasi |

### Grafik komponentlar
| Komponent | Tavsif |
|-----------|--------|
| Label | Matn yorliq |
| Arrow | Yo'naltiruvchi strelka |
| Rectangle | To'rtburchak (konteyner/zona) |
| Circle | Doira |
| Image | Rasm qo'yish |

### Data komponentlar
| Komponent | Tavsif |
|-----------|--------|
| Device Block | Qurilma bloki (signallar bilan) |
| Signal Display | Bitta signal qiymati |
| Status Indicator | On/Off indikatori (doira, rang bilan) |
| Gauge | Analog o'lchov ko'rsatkichi |

---

## Helper vositalar

### Canvas boshqaruv
- **Grid** — panjara ko'rsatish/yashirish (G tugmasi)
- **Snap to grid** — komponentlar panjara nuqtalariga yopishadi
- **Alignment guides** — ikki komponent tekislanganda chiziq chiqadi
- **Zoom** — Ctrl+Scroll yoki ± tugmalari (10% — 400%)
- **Pan** — Bo'sh joyni drag qilish yoki Space + drag
- **Fit to screen** — Ctrl+0, hammasini ekranga sig'diradi
- **Mini-map** — pastki burchakda kichik ko'rinish (katta sxemalarda)

### Tarix
- **Undo** — Ctrl+Z (50 qadam)
- **Redo** — Ctrl+Y / Ctrl+Shift+Z

### Tanlash
- **Ctrl+A** — hammasini tanlash
- **Shift+click** — qo'shimcha tanlash
- **Drag to select** — to'rtburchak bilan tanlash
- **Escape** — tanlovdan chiqish

### Nusxa
- **Ctrl+C / Ctrl+V** — nusxa ko'chirish
- **Ctrl+D** — tanlanganni duplikat qilish
- **Delete / Backspace** — o'chirish

### Saqlash
- **Ctrl+S** — saqlab qo'yish (avtosaqlash ham bor)
- Har 30 soniyada avtosaqlash

---

## Xossalar paneli (o'ng)

Tanlangan element uchun:

### Geometriya
- X, Y koordinata
- Kenglik, balandlik
- Burchak (rotation)

### Ko'rinish
- Fill rangi (color picker)
- Border rangi
- Border qalinligi (px)
- Border stili: solid | dashed | dotted
- Opacity (0–100%)
- Border radius (px)

### Matn
- Matn rangi
- Font o'lchami (px)
- Font og'irligi: normal | bold
- Matn holati: chapga | markazga | o'ngga

### Z-index
- "Oldinga olib chiqish" (bring forward)
- "Orqaga yuborish" (send backward)
- "Eng oldinga" (bring to front)
- "Eng orqaga" (send to back)
- Raqamli qiymat ko'rsatiladi

### Signal Display uchun qo'shimcha
- Ko'rsatiladigan signal tanlash
- Birlik ko'rsatish: ha/yo'q
- Rang: qiymat bo'yicha (normal/ogohlantirish/xato)
- Yangilanish tezligi

---

## Rang sozlash

- **Color picker** — HTML hex, RGB, HSL qo'llab-quvvatlanadi
- **Saved colors** — oxirgi 8 ta ishlatilgan rang
- **Preset palette** — elektr sxema standart ranglar:
  - Shina: qora `#000000`
  - Faol liniya: qizil `#ef4444`
  - O'chiq liniya: kulrang `#71717a`
  - Zamin: yashil `#22c55e`

---

## Sxema saqlash formati (DB)

```json
{
  "version": 1,
  "viewport": { "x": 0, "y": 0, "zoom": 1 },
  "nodes": [
    {
      "id": "node_1",
      "type": "bus_bar",
      "x": 100, "y": 200,
      "width": 400, "height": 8,
      "style": {
        "fill": "#000000",
        "border": "#000000",
        "borderWidth": 2,
        "opacity": 1
      },
      "zIndex": 1
    },
    {
      "id": "node_2",
      "type": "device_block",
      "deviceId": 5,
      "x": 150, "y": 300,
      "width": 160, "height": 80,
      "style": { ... },
      "zIndex": 2
    },
    {
      "id": "node_3",
      "type": "signal_display",
      "deviceId": 5,
      "signalName": "ia",
      "x": 350, "y": 300,
      "style": { ... },
      "zIndex": 3
    }
  ],
  "edges": [
    {
      "id": "edge_1",
      "from": "node_1",
      "to": "node_2",
      "style": { "stroke": "#000", "strokeWidth": 2 }
    }
  ]
}
```

---

## Export

- **PNG export** — canvas ni rasm sifatida yuklab olish
- **SVG export** — vektoral format (chop etish uchun)

---

## Texnologiya tanlovi

| Variant | Afzalligi | Kamchiligi |
|---------|-----------|------------|
| **React Flow** | Tayyor node/edge tizim, kengaytirish oson | Custom komponentlar ko'p yozish kerak |
| **Konva.js** | To'liq canvas nazorat, performans yaxshi | Ko'proq quyi darajali kod |
| **Fabric.js** | Electr sxema uchun moslashtirilgan | Eskirib qolgan |

**Tavsiya: React Flow** — node asosli tizim, device block va signal display uchun ideal.

---

## Bog'liq
- [[F02 - Substation Management]] — sxema podstansiyaga tegishli
- [[F03 - Device Management]] — qurilmalar sxemada blok sifatida
- [[F05 - IEC104 Signal Config]] — signallar sxemada ko'rinadi
- [[F07 - Dispatcher View]] — sxema read-only ko'rinishda ham chiqadi
