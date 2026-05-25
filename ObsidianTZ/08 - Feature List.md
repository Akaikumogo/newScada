# Feature List — To'liq ro'yxat

> Har bir feature: ✅ Tayyor | 🟡 Jarayonda | ⚪ Boshlanmagan

---

## F01 · Branch Management (Filial boshqaruvi)

- [ ] Filial yaratish (nomi, turi: filial/bosh_boshqarma)
- [ ] Filiallar ro'yxati (jadval ko'rinish)
- [ ] Filialni tahrirlash
- [ ] Filialni o'chirish (bog'liq podstansiyalar bo'lsa ogohlantirish)
- [ ] Bosh boshqarma ham filial sifatida tizimda bo'lishi

→ Batafsil: [[features/F01 - Branch Management]]

---

## F02 · Substation Management (Podstansiya boshqaruvi)

- [ ] Podstansiya yaratish (filialga bog'lash, nomi, manzili)
- [ ] Podstansiyalar ro'yxati (filial bo'yicha filter)
- [ ] Podstansiyani tahrirlash
- [ ] Podstansiyani o'chirish
- [ ] Podstansiyaga sxema qo'shish imkoni (Schema Editor)

→ Batafsil: [[features/F02 - Substation Management]]

---

## F03 · Device Management (Qurilma boshqaruvi)

- [ ] Qurilma yaratish (podstansiyaga bog'lash)
- [ ] Model tanlash (select, device_model katalogidan)
- [ ] Protokol tanlash (select, hozircha faqat IEC104)
- [ ] Qurilmalar ro'yxati (podstansiya bo'yicha)
- [ ] Qurilmani tahrirlash
- [ ] Qurilmani o'chirish
- [ ] Qurilmani sxemada blok sifatida ko'rsatish

→ Batafsil: [[features/F03 - Device Management]]

---

## F04 · Model Catalog (Model katalogi)

- [ ] Model yaratish (nomi, ishlab chiqaruvchi, tavsif)
- [ ] Modellar ro'yxati
- [ ] Modelni tahrirlash
- [ ] Modelni o'chirish (qurilmalarda ishlatilsa ogohlantirish)
- [ ] Qurilma yaratishda model select sifatida chiqishi

→ Batafsil: [[features/F04 - Model Catalog]]

---

## F05 · IEC104 Signal Config (Signal konfiguratsiyasi)

- [ ] Qurilmaga signal qo'shish (register_code, signal_name, unit)
- [ ] Signal ro'yxati (qurilma bo'yicha)
- [ ] Signalni tahrirlash
- [ ] Signalni o'chirish
- [ ] value_type tanlash: float | status
- [ ] Collector shu konfigdan signal o'qishi

→ Batafsil: [[features/F05 - IEC104 Signal Config]]

---

## F06 · Schema Editor (Sxema muharriri)

- [ ] Podstansiyaga bog'langan canvas sxema
- [ ] Drag-and-drop komponent qo'shish
- [ ] Elektr sxema komponentlar kutubxonasi
  - [ ] Shinalar (bus bar)
  - [ ] Transformator
  - [ ] Uzgich (switch / disconnector)
  - [ ] Avtomatik uzgich (circuit breaker)
  - [ ] Kabel / simlar
  - [ ] O'lchov transformatori (CT, VT)
  - [ ] Zamin (ground)
  - [ ] Kondensator
  - [ ] Reaktor
  - [ ] Belgi/yorliq (label)
  - [ ] Strelka (arrow)
  - [ ] To'rtburchak (rectangle/container)
- [ ] Helper vositalar
  - [ ] Grid (panjara)
  - [ ] Snap to grid
  - [ ] Alignment guides (tekislash chiziqlari)
  - [ ] Zoom in/out
  - [ ] Pan (canvas siljitish)
  - [ ] Undo / Redo
  - [ ] Barcha tanlash (Ctrl+A)
  - [ ] Nusxa ko'chirish / Joylashtirish
  - [ ] O'chirish (Delete)
- [ ] Z-index boshqaruvi (oldinga/orqaga yuborish)
- [ ] To'liq rang sozlash
  - [ ] Fill rangi
  - [ ] Border rangi va qalinligi
  - [ ] Matn rangi va o'lchami
  - [ ] Opacity
- [ ] Qurilma bloki sxemaga qo'shish
  - [ ] Qurilma panelidan sxemaga drag → blok paydo bo'ladi
  - [ ] Blok ustida ushlab turish → ichidagi signallar expand bo'ladi
  - [ ] Alohida signal drag qilib istalgan joyga joylashtirish
  - [ ] Signal displayi: real-vaqt qiymat ko'rsatadi
- [ ] Sxemani saqlash (DB ga JSON)
- [ ] Sxemani yuklash (sahifaga kirganda)
- [ ] Responsive canvas (ekran o'lchamiga moslashish)
- [ ] Export (PNG / SVG)

→ Batafsil: [[features/F06 - Schema Editor]]

---

## F07 · Dispatcher View (Operator ko'rinishi)

- [ ] Barcha filiallar ko'rinishi (bosh sahifa)
- [ ] Filial ichida podstansiyalar ro'yxati
- [ ] Podstansiya sahifasi: qurilmalar + signallar real-vaqt
- [ ] Qurilma sahifasi: MetricCard + TrendChart + jadval
- [ ] Podstansiya sxemasini ko'rish (read-only)
- [ ] Sxemada real-vaqt qiymatlar yangilanib turishi
- [ ] IEC104 ulanish holati indikatori
- [ ] Faqat o'qish rejimi — hech qanday tahrirlash yo'q
- [ ] Auto-refresh (har 2 soniya)

→ Batafsil: [[features/F07 - Dispatcher View]]

---

## F08 · History Recording (Tarix yozish)

- [ ] Faqat qiymat o'zganda DB ga yozish
- [ ] Oxirgi qiymatni cache da saqlash (qurilma bo'yicha)
- [ ] O'zgarish aniqlanish mantiq'i (epsilon rounding)
- [ ] record jadvalida faqat device_id (ierarxiya JOIN orqali)
- [ ] Collector loop: har poll_interval da ishga tushadi
- [ ] Ulanish uzilsa status yangilanadi (online/offline)

→ Batafsil: [[features/F08 - History Recording]]
