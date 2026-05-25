---
type: reference
tags: [requirements, glossary, explain, terms]
status: approved
created: 2026-05-24
---

# EXPLAIN — Barcha terminlar izohi

> Bu fayl loyihada ishlatiladigan **har bir atama**ni oddiy tilda tushuntiradi.  
> Texnik bilim talab qilinmaydi — o'qing va tushuning.

---

## Obsidian terminlari

### MOC (Map of Content)
**O'zbek tilida:** Kontent xaritasi  
**Nima:** Obsidian vaultidagi "bosh sahifa" yoki "yo'riqnoma". Ichida hech qanday ma'lumot yo'q — faqat boshqa hujjatlarga havolalar.  
**Nima uchun:** Katta loyihada 30–50 ta fayl bo'ladi. MOC bo'lmasa qayerdan boshlashni bilmaysiz. MOC — kutubxonadagi katalog kabi.  
**Misol:** `000 MOC - newScada.md` — vaultning bosh eshigi. U yerdan hamma narsaga yo'l bor.

---

### Vault
**O'zbek tilida:** Seif / Ombor  
**Nima:** Obsidian ilovasida bir papkani "vault" sifatida ochiladi. O'sha papka ichidagi barcha `.md` fayllar — sizning bilimlar bazangiz.  
**Nima uchun:** Obsidian fayllarni oddiy matn sifatida saqlaydi. Vault = loyiha dokumentatsiyasi uchun alohida papka.

---

### Frontmatter (YAML metadata)
**O'zbek tilida:** Fayl boshi ma'lumotlari  
**Nima:** Har bir `.md` faylning tepasida `---` ichida yoziladigan maxsus ma'lumot bloki.  
**Nima uchun:** Obsidian bu ma'lumotni o'qib, fayllarni filter qilish, ranglab ko'rsatish, Dataview jadval yaratish uchun ishlatadi.  
**Misol:**
```
---
type: feature
status: planned
priority: 1
tags: [feature, backend]
---
```

---

### Dataview
**O'zbek tilida:** Ma'lumot ko'rinishi  
**Nima:** Obsidian plagin. Frontmatter ma'lumotlaridan avtomatik jadval, ro'yxat, vazifalar ro'yxati yaratadi.  
**Nima uchun:** Har safar qo'lda ro'yxat yangilamay, frontmatter o'zgarsa jadval o'zi yangilanadi.  
**Misol:** `000 MOC` da barcha featurelar statusini ko'rsatuvchi jadval — Dataview yozadi.

---

### Wikilink `[[]]`
**O'zbek tilida:** Ichki havola  
**Nima:** `[[fayl nomi]]` — bir hujjatdan boshqasiga havola.  
**Nima uchun:** Hujjatlar bir-biriga bog'lanadi. Graph view da chiziqlar paydo bo'ladi. Bosib o'tish mumkin.  
**Misol:** `[[features/F01 - Branch Management]]` — bosilganda o'sha faylga o'tadi.

---

### Graph View
**O'zbek tilida:** Grafik ko'rinish  
**Nima:** Obsidian dagi barcha fayllarni va ular orasidagi havolalarni vizual ko'rsatuvchi xarita.  
**Nima uchun:** Loyihaning umumiy manzarasini ko'rish. Qaysi hujjatlar ko'p bog'liq, qaysilari yolg'iz — bir qarashdayoq bilinadi.

---

### Color Groups (Rang guruhlari)
**O'zbek tilida:** Rang guruhlari  
**Nima:** Graph view da fayllarni teglariga qarab ranglash sozlamasi.  
**Bizda:**
| Rang | Guruh | Ma'nosi |
|------|-------|---------|
| 🟤 Oltin | MOC | Bosh navigatsiya |
| 🟣 Indigo | Architecture | Tizim dizayni |
| 🔴 Qizil | ADR | Qabul qilingan qarorlar |
| 🟢 Yashil | Technical | Kod namunalar |
| 🔵 Ko'k | Feature | Yetkazib beriladigan funksiyalar |
| 🟠 Amber | Requirements | Texnologiyalar ro'yxati |

---

## Arxitektura terminlari

### ADR (Architecture Decision Record)
**O'zbek tilida:** Arxitektura qaror yozuvi  
**Nima:** "Nima uchun aynan shu texnologiyani/yondashuvni tanladik?" degan savolga javob beradigan qisqa hujjat.  
**Nima uchun:** Ertaga yangi dasturchi kelsa yoki 6 oydan keyin o'zingiz "nima uchun shunday qilgan edim?" desangiz — ADR javob beradi. Qarorni emas, **sababini** saqlaydi.  
**Tuzilmasi:** Kontekst → Ko'rilgan variantlar → Qaror → Sabab → Oqibat  
**Bizda:** `ADR/ADR-001` dan `ADR-005` gacha — 5 ta muhim qaror yozib qo'yilgan.

---

### Clean Architecture
**O'zbek tilida:** Toza arxitektura  
**Nima:** Kodni 4 qatlamga bo'lish usuli. Har qatlam faqat o'zidan ichkari qatlamni "biladi".  
**Nima uchun:** Bazani PostgreSQL dan MySQL ga o'zgartirsangiz — faqat 1 ta fayl o'zgaradi. Framework ni FastAPI dan boshqasiga o'tirsangiz — biznes logika o'zgarmaydi.  
**Qatlamlar (tashqaridan ichkariga):**
```
API Layer       ← Foydalanuvchi so'rovlari
   ↓
Application     ← "Nima qilish" (use cases)
   ↓
Domain          ← Biznes qoidalari (DB, framework bilmaydi)
   ↓
Infrastructure  ← "Qanday qilish" (DB, socket, Redis)
```

---

### CQRS (Command Query Responsibility Segregation)
**O'zbek tilida:** Yozish va O'qish vazifalarini ajratish  
**Nima:** Ma'lumot **yozish** (Command) va **o'qish** (Query) logikasini alohida sinflar/modullar bilan boshqarish.  
**Nima uchun:** O'qish juda tez-tez bo'ladi (har 2 soniya), yozish kamroq. Ularni ajratib Redis orqali o'qisak — DB yuklanmaydi.  
**Bizda:**
- Command: `CreateDevice`, `SaveSchema` → PostgreSQL ga yozadi
- Query: `GetLatestSnapshot` → Redis dan o'qiydi (tez)

---

### Repository Pattern
**O'zbek tilida:** Ombor naqshi  
**Nima:** DB bilan ishlash kodi alohida sinf ichiga joylashtiriladi. Boshqa kod bu sinfni chaqiradi, SQL yozmaydi.  
**Nima uchun:** DB ni o'zgartirsangiz — faqat repository sinf o'zgaradi. Test yozganda haqiqiy DB o'rniga "soxta" repository ishlatiladi.  
**Misol:**
```python
# Repository bo'lmasdan (yomon):
users = db.execute("SELECT * FROM device WHERE id = ?", id)

# Repository bilan (yaxshi):
device = await device_repo.get_with_signals(id)
```

---

### Unit of Work
**O'zbek tilida:** Ish birligi  
**Nima:** Bir nechta DB operatsiyasini bitta "tranzaksiya" sifatida bajarish. Biri muvaffaqiyatsiz bo'lsa — hammasi bekor bo'ladi.  
**Nima uchun:** Qurilma yaratildi lekin signallar yozilmadi — bu yaxshi emas. UoW ikkalasini birgalikda saqlaydi yoki birgalikda bekor qiladi.

---

### Domain Events
**O'zbek tilida:** Soha hodisalari  
**Nima:** Tizimda muhim narsa sodir bo'lganda "xabar" yuboriladi. Boshqa qismlar bu xabarga "obuna" bo'lib, o'z ishini bajaradi.  
**Nima uchun:** `Collector` signal o'zgarganini aniqlaydi — u WebSocket ga, DB ga, Redis ga to'g'ridan-to'g'ri yozmaydi. Faqat `SignalChangedEvent` chiqaradi. Qolganlar o'z ishini bajaradi.  
**Bizda:** `SignalChangedEvent`, `DeviceOfflineEvent`, `DeviceOnlineEvent`

---

### Event Bus
**O'zbek tilida:** Hodisa magistrali  
**Nima:** Hodisalarni (events) yuborish va qabul qilish uchun markaziy qurilma.  
**Nima uchun:** `Collector` faqat `bus.publish(event)` deydi. Kimlar eshitishini bilmaydi — bu yaxshi, bog'liqlik yo'q.

---

### State Machine
**O'zbek tilida:** Holat mashina  
**Nima:** Tizim faqat ma'lum holatlar to'plamida bo'lishi mumkin va holatlar orasida faqat belgilangan yo'llar bor.  
**Nima uchun:** Collector "RECEIVING" holatida bo'lmasdan turib "PROCESSING" ga o'ta olmaydi. Bu tartib va xatosizlik.  
**Bizda:** `IDLE → CONNECTING → CONNECTED → INTERROGATING → RECEIVING → PROCESSING → IDLE`

---

### Dependency Injection (DI)
**O'zbek tilida:** Bog'liqlikni tashqaridan berish  
**Nima:** Sinfga kerakli ob'ektlar (DB, cache) uni **ichida** yaratmasdan, **tashqaridan** beriladi.  
**Nima uchun:** Test yozganda haqiqiy DB o'rniga "soxta" DB beriladi. Sinf o'zgarmaydi.  
**FastAPI da:** `Depends()` — endpoint ga kerakli narsa avtomatik "inject" qilinadi.

---

### Partitioning (DB)
**O'zbek tilida:** Bo'laklash  
**Nima:** Katta jadvalni kichik bo'laklarga (partition) ajratish. `record` jadvali oy bo'yicha bo'linadi.  
**Nima uchun:** 3 yillik ma'lumot = 100 million qator. Hammasi bitta jadvalda bo'lsa — so'rovlar sekinlashadi. Har oy alohida bo'lakda bo'lsa — yanvar oyini so'rasangiz faqat yanvar bo'lagi tekshiriladi.  
**Bizda:** `record_2026_01`, `record_2026_02`, ... — har oy alohida.

---

## Protokol terminlari

### IEC 60870-5-104 (IEC104)
**O'zbek tilida:** Xalqaro elektr standart 104  
**Nima:** Elektr energetika tizimlarida qurilmalardan ma'lumot olish uchun xalqaro standart protokol. TCP/IP orqali ishlaydi.  
**Nima uchun:** BMRZ kabi elektr himoya qurilmalari shu protokolda gaplashadi. Boshqa yo'l yo'q — standart shu.

---

### ASDU (Application Service Data Unit)
**O'zbek tilida:** Ilova xizmati ma'lumot birligi  
**Nima:** IEC104 da ma'lumot to'plami. Bir ASDU ichida bir yoki bir nechta o'lchov qiymati bo'ladi.  
**Tuzilmasi:** `TI | VSQ | COT | CA | [IOA + qiymat] × N`

---

### APDU (Application Protocol Data Unit)
**O'zbek tilida:** Protokol ma'lumot birligi  
**Nima:** IEC104 da yuborib/qabul qilinayotgan to'liq paket. Ichida ASDU bo'ladi.

---

### IOA (Information Object Address)
**O'zbek tilida:** Ma'lumot ob'ekti manzili  
**Nima:** Qurilmadagi har bir signal uchun noyob raqam. Telefon raqami kabi.  
**Bizda:** `641 → ia (IA faza toki)`, `642 → ib`, `643 → ic`

---

### TI (Type Identification)
**O'zbek tilida:** Ma'lumot turi identifikatori  
**Nima:** ASDU dagi qiymat qanday formatda ekanligi. Float mi, integer mi, status mi?  
**Bizda:** `TI 13 (M_ME_NC_1)` — IEEE 754 float, `TI 1 (M_SP_NA_1)` — on/off holat

---

### COT (Cause of Transmission)
**O'zbek tilida:** Uzatish sababi  
**Nima:** Bu ma'lumot nima sababdan yuborildi? Siklik so'rovga javobmi yoki o'zgarish sababli?  
**Muhim:** `COT=20` — General Interrogation javobida keladi.

---

### CASDU / Common Address
**O'zbek tilida:** Umumiy qurilma manzili  
**Nima:** IEC104 dagi qurilmaning umumiy manzili. Bir tarmoqda bir nechta qurilma bo'lsa ularni ajratish uchun.  
**Bizda:** BMRZ da `CASDU = 3`

---

### General Interrogation (GI)
**O'zbek tilida:** Umumiy so'rov  
**Nima:** "Men hozir ulandim, barcha qiymatlarni ber" degan so'rov.  
**IEC104 da:** `C_IC_NA_1` (TI=100) — barcha signallar bir vaqtda javob beradi.

---

### STARTDT
**O'zbek tilida:** Ma'lumot uzatishni boshlash  
**Nima:** IEC104 ulanish o'rnatilgach, qurilmaga "ma'lumot yuborishni boshlash" signali.  
**Ketma-ketlik:** TCP ulanish → STARTDT act → STARTDT con → GI yuborish

---

## Frontend terminlari

### WebSocket (WS)
**O'zbek tilida:** Veb rozetkasi  
**Nima:** Browser va server o'rtasida **doimiy ikki tomonlama** ulanish. HTTP dan farqli — server ham o'zi xabar yuborishi mumkin.  
**Nima uchun:** Dispatcher da qiymat o'zgarganda — server darhol browserga yuboradi. HTTP polling kerak emas.  
**Bizda:** `/ws/telemetry` — collector yangi qiymat topsa darhol barcha ulangan browserlarga yuboradi.

---

### TanStack Query
**O'zbek tilida:** Server holat boshqaruvi kutubxonasi  
**Nima:** React da API so'rovlarini boshqarish kutubxonasi. Cache, loading, error, refetch — hammasi avtomatik.  
**Nima uchun:** Qo'lda `useEffect + fetch + useState` yozish o'rniga — bir qator bilan barcha holatlar boshqariladi.

---

### Zustand
**O'zbek tilida:** Holat boshqaruvi (nemischa "holat" degani)  
**Nima:** React ilovasidagi global holat (state) boshqarish kutubxonasi. Redux dan sodda.  
**Bizda:** Schema Editor da `nodes`, `edges`, `selection`, `clipboard` — hammasi Zustand store da.

---

### zundo
**O'zbek tilida:** Undo/Redo kutubxonasi  
**Nima:** Zustand store uchun "bekor qilish / qayta qilish" (Ctrl+Z / Ctrl+Y) imkoniyati qo'shadigan kichik kutubxona.  
**Bizda:** Schema Editor da 50 ta qadam orqaga qaytish imkoni.

---

### React Flow
**O'zbek tilida:** — (nomini o'zgartirib bo'lmaydi)  
**Nima:** React da node va edge (tugun va bog'lovchi chiziq) asosida interaktiv diagramma yaratish kutubxonasi.  
**Bizda:** Schema Editor ning asosi — elektr sxema chizish uchun.

---

### HMR (Hot Module Replacement)
**O'zbek tilida:** Issiq modul almashtirish  
**Nima:** Kod yozayotganda sahifani to'liq qayta yuklamasdan o'zgarishlarni darhol ko'rsatish.  
**Bizda:** Vite bu xususiyatni ta'minlaydi — development da juda qulay.

---

### Virtual Scroll
**O'zbek tilida:** Virtual aylantirish  
**Nima:** Jadvaldagi 10,000 qatorning hammasini DOMga yuklamasdan faqat ko'rinayotganlarini yuklaydigan usul.  
**Nima uchun:** 10,000 qator DOM da bo'lsa — sahifa muzlaydi. Virtual scroll da faqat 20-30 qator DOM da.  
**Bizda:** Dispatcher xronologiya jadvali.

---

## Infratuzilma terminlari

### Docker
**O'zbek tilida:** —  
**Nima:** Ilovani o'z muhiti bilan birga "qutiga" solib ishlatish texnologiyasi. "Mening kompyuterimda ishlaydi" muammosini hal qiladi.

---

### Docker Compose
**O'zbek tilida:** Docker tartiblash  
**Nima:** Bir nechta Docker konteynerini birgalikda boshqarish. `docker compose up` — bitta buyruq bilan PostgreSQL + Redis + Backend + Frontend ishga tushadi.

---

### Redis
**O'zbek tilida:** —  
**Nima:** RAM da ishlaydigan kalit-qiymat ma'lumotlar bazasi. Juda tez (mikrosoniya).  
**Bizda:** Oxirgi telemetriya qiymatlarini saqlash + WebSocket uchun Pub/Sub kanal.

---

### Pub/Sub (Publish/Subscribe)
**O'zbek tilida:** Nashr qilish / Obuna bo'lish  
**Nima:** Xabarlar almashish naqshi. Yuboruvchi kanalga "nashr" qiladi, tinglovchilar shu kanalga "obuna" bo'lgan.  
**Bizda:** Collector `telemetry:5` kanaliga nashr qiladi → WebSocket Manager obuna, darhol browserlarga yuboradi.

---

### Alembic
**O'zbek tilida:** —  
**Nima:** Python/SQLAlchemy uchun DB schema versioning vositasi. "Migratsiya" — DB tuzilmasini qadamba-qadam o'zgartirish.  
**Nima uchun:** Yangi jadval yoki maydon qo'shganda barcha dasturchilar bir xil DB tuzilmasiga ega bo'lishi uchun.

---

### BIGSERIAL
**O'zbek tilida:** Katta avtomatik raqam  
**Nima:** PostgreSQL da avtomatik oshib boradigan katta butun son (8 bayt, max ~9.2 kvintillion).  
**Nima uchun:** `SERIAL` (4 bayt, max ~2.1 milliard) yillar o'tsa to'lib qolishi mumkin. `record` jadval katta bo'lgani uchun `BIGSERIAL`.

---

### TIMESTAMPTZ
**O'zbek tilida:** Vaqt tamg'asi (timezone bilan)  
**Nima:** Sana va vaqt + timezone ma'lumotini saqlaydigan PostgreSQL turi.  
**Nima uchun:** `TIMESTAMP` (timezone yo'q) bilan UTC da saqlangan vaqtni Toshkent vaqtiga o'girganda xato bo'lishi mumkin. `TIMESTAMPTZ` har doim UTC da saqlaydi, ko'rsatishda local vaqtga o'giradi.

---

### JSONB
**O'zbek tilida:** Ikkilik JSON  
**Nima:** PostgreSQL da JSON ma'lumotni samaraliroq saqlaydigan tur. `TEXT` ga o'xshash lekin indekslash va `->` operator ishlaydi.  
**Bizda:** `substation_schema.canvas_json` — sxema ma'lumotini JSONB da saqlaymiz.

---

### Epsilon
**O'zbek tilida:** Kichik farq chegarasi  
**Nima:** Floating point sonlarni solishtirish uchun "yetarlicha farq" chegarasi.  
**Nima uchun:** `245.3000001 == 245.3` deb hisoblash kerak. `abs(new - old) > 0.001` — yetarlicha o'zgarish.  
**Bizda:** `EPSILON_FLOAT = 0.001` — 0.001 A dan kichik o'zgarish ahamiyatsiz deb hisoblanadi.

---

## Loyiha tuzilmasi terminlari

### EDITOR
**Nima:** Tizimning konfiguratsiya qismi. Faqat adminlar kiradi.  
**Nima qiladi:** Filial, podstansiya, qurilma, model, signal yaratish va boshqarish. Sxema chizish.

---

### DISPATCHER
**Nima:** Tizimning monitoring qismi. Operatorlar uchun.  
**Nima qiladi:** Real-vaqt ma'lumotlarni faqat ko'rish. Hech narsa o'zgartirish mumkin emas.

---

### Collector
**Nima:** Fon da ishlaydigan background service.  
**Nima qiladi:** Har N soniyada BMRZ qurilmalariga IEC104 so'rov yuboradi, javobni o'qiydi, o'zgangan qiymatlarni DB ga va Redis ga yozadi.

---

### Qurilma IP manzili (iec104_host)
**Nima:** Har bir fizik qurilma (BMRZ, relay va boshqalar) tarmoqda o'zining IP manzili va port raqamiga ega. Collector o'sha IP ga TCP ulanib IEC104 orqali ma'lumot oladi.  
**Nima uchun:** Bir podstansiyada bir nechta qurilma bo'lishi mumkin — har birining IP si boshqacha. Collector qaysi qurilmaga ulanishini bilishi uchun IP DB da saqlanadi.  
**Misol:**
```
BMRZ №1  →  192.168.199.10 : 2404  (CASDU = 3)
BMRZ №2  →  192.168.199.11 : 2404  (CASDU = 1)
Relay    →  192.168.199.20 : 2404  (CASDU = 5)
```
**Qanday ishlaydi:**
```
Admin → Qurilma yaratadi → IP, Port, CASDU kiritadi
           ↓
      DB: device.iec104_host = '192.168.199.10'
           ↓
Collector → DB dan device ni o'qiydi
           ↓
      socket.connect('192.168.199.10', 2404)
           ↓
      STARTDT → General Interrogation → Ma'lumotlar keladi
```
**DB maydonlari:**

| Maydon | Misol | Ma'nosi |
|--------|-------|---------|
| `iec104_host` | `192.168.199.10` | Qurilma IP manzili |
| `iec104_port` | `2404` | Port (IEC104 standarti) |
| `iec104_common_address` | `3` | CASDU — qurilma identifikatori |
| `poll_interval_seconds` | `2.0` | Necha soniyada bir so'rov |

---

### Snapshot
**O'zbek tilida:** Anliq holat  
**Nima:** Biror vaqt momentidagi barcha qurilmalarning oxirgi ma'lum qiymatlar to'plami.  
**Bizda:** `/api/telemetry/latest` → Redis dan o'qiladi, browser ochilganda dastlabki holat ko'rsatiladi.
