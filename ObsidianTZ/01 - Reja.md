# Reja

## Maqsad

Yunusobod podstansiyasi uchun to'liq SCADA tizimi:

1. **EDITOR** — konfiguratsiya va boshqaruv paneli
2. **DISPATCHER** — operatorlar uchun read-only monitoring

---

## Ierarxiya

```
Branch (filial / bosh boshqarma)
  └── Substation (podstansiya)
        └── Device (qurilma)
              ├── Model (qurilma modeli)
              └── Signal (IEC104 register → signal nomi)
                    └── Record (tarix, faqat o'zganda)
```

---

## EDITOR imkoniyatlari

- [ ] Filial yaratish / tahrirlash / o'chirish
- [ ] Podstansiya yaratish (filialga bog'lash)
- [ ] Qurilma yaratish (podstansiyaga bog'lash)
- [ ] Model katalogi (yaratish, tahrirlash)
- [ ] Qurilmaga model tanlash
- [ ] IEC104 signal konfiguratsiyasi (register_code → signal_name)

---

## DISPATCHER imkoniyatlari

- [ ] Barcha filiallar ko'rinishi
- [ ] Podstansiya signallari real-vaqt
- [ ] Tarix grafigi
- [ ] Faqat o'qish (read-only)

---

## History yozish mantiq'i

```
Yangi qiymat keldi
  ↓
Oxirgi yozilgan qiymat bilan solishtir
  ↓
O'zgandimi? → Ha → DB ga yoz
             → Yo'q → O'tkazib yubor
```

**Misol:**
| Vaqt  | Qiymat | Yozildimi? |
|-------|--------|------------|
| 12:00 | 1      | ✅ Ha      |
| 12:01 | 1      | ❌ Yo'q    |
| 12:05 | 1      | ❌ Yo'q    |
| 12:30 | 0      | ✅ Ha      |

---

## Texnologiyalar

| Qatlam | Texnologiya |
|--------|-------------|
| Backend | FastAPI + SQLAlchemy + PostgreSQL |
| Protokol | IEC-104 (socket, hozircha) |
| Editor UI | React + TypeScript + Tailwind |
| Dispatcher UI | React + TypeScript + Tailwind |

---

## Bosqichlar

1. 🔲 DB sxema loyihalash
2. 🔲 Backend CRUD (branch, substation, device, model, signal)
3. 🔲 IEC104 collector (device_signal dan o'qiydi)
4. 🔲 Editor UI
5. 🔲 Dispatcher UI
