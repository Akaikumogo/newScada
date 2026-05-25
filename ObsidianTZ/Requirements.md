---
type: reference
tags: [requirements, stack, technologies]
status: approved
created: 2026-05-24
related: ["[[Architecture/Clean Architecture]]", "[[Architecture/WebSocket Strategy]]", "[[Architecture/DB Strategy]]"]
---

# Requirements — Texnologiyalar ro'yxati

> Har bir texnologiya: **nima**, **qayerda**, **nega**, **alternativ** va **nega alternativ emas**.

---

## Backend Runtime

### Python 3.12
| | |
|---|---|
| **Qayerda** | Backend — barcha server kodi |
| **Nega** | AsyncIO yetuk, type hints kuchli, ekosistema boy (FastAPI, SQLAlchemy, asyncpg) |
| **Alternativ** | Node.js, Go, Rust |
| **Nega alternativ emas** | Node.js — IEC104 socket boshqaruvi va binary parse uchun Python ancha qulay; Go/Rust — komanda uchun overkill, tez prototiplash kerak |

---

## Web Framework

### FastAPI
| | |
|---|---|
| **Qayerda** | `api/` qatlami — barcha HTTP endpoint va WebSocket |
| **Nega** | Async-first, OpenAPI avtomatik, Pydantic integratsiya, Depends() DI tizimi kuchli |
| **Alternativ** | Django REST Framework, Flask, Litestar, Starlette |
| **Nega alternativ emas** | Django — og'ir, ORM boshqacha, async qo'llab-quvvatlash cheklangan; Flask — async yo'q, DI yo'q; Litestar — yaxshi lekin kichik ekosistema, kamroq hujjat; Starlette — FastAPI o'zi ustida qurilgan, foydalanish qulayligi pastroq |

---

## ORM

### SQLAlchemy 2.x (AsyncSession)
| | |
|---|---|
| **Qayerda** | `infrastructure/db/` — barcha DB operatsiyalar, Repository implementatsiyalar |
| **Nega** | Async to'liq qo'llab-quvvatlaydi, yetuk, Alembic bilan nativ integratsiya, murakkab so'rovlar uchun kuchli |
| **Alternativ** | Tortoise ORM, SQLModel, raw asyncpg, Beanie (MongoDB) |
| **Nega alternativ emas** | Tortoise — yaxshi lekin Alembic yo'q (o'z migratsiya tizimi), SQLAlchemy kabi kuchli emas; SQLModel — FastAPI avtori yozgan, lekin SQLAlchemy ustida yupqa qatlam, bug lar ko'p; raw asyncpg — juda past daraja, SQL qo'lda yozish |

---

## DB Driver

### asyncpg
| | |
|---|---|
| **Qayerda** | SQLAlchemy async engine ichida: `postgresql+asyncpg://...` |
| **Nega** | PostgreSQL uchun eng tez Python async driver, binary protocol ishlatadi |
| **Alternativ** | psycopg3 (async), aiopg |
| **Nega alternativ emas** | psycopg3 — yaxshi alternativ, lekin asyncpg performans jihatdan ustun (benchmark lar ko'rsatadi); aiopg — psycopg2 ustidagi wrapper, kam faol |

---

## Migratsiya

### Alembic
| | |
|---|---|
| **Qayerda** | `infrastructure/db/migrations/` — DB schema versioning |
| **Nega** | SQLAlchemy bilan nativ ishlaydi, `--autogenerate` mavjud, rollback imkoni |
| **Alternativ** | Yoyo-migrations, Flyway, manual SQL, SQLModel built-in |
| **Nega alternativ emas** | Yoyo — SQLAlchemy bilan integratsiya yo'q; Flyway — Java ekosistema, Python da g'alati; Manual SQL — versiyalash yo'q, rollback qiyin; SQLModel built-in — hali yetarli emas |

---

## Ma'lumotlar bazasi

### PostgreSQL 16
| | |
|---|---|
| **Qayerda** | Barcha doimiy ma'lumotlar: topologiya, signallar, tarix (record) |
| **Nega** | Range partitioning (record jadval uchun), JSONB (schema canvas), indekslar kuchli, Alembic bilan yaxshi |
| **Alternativ** | MySQL, SQLite, TimescaleDB, ClickHouse |
| **Nega alternativ emas** | MySQL — partitioning imkoniyati zaif, JSONB yo'q; SQLite — concurrent write muammo, production uchun emas; TimescaleDB — PostgreSQL extension, alohida setup kerak, hozircha overkill; ClickHouse — OLAP, OLTP uchun emas, CRUD murakkab |

---

## Real-vaqt Cache

### Redis 7
| | |
|---|---|
| **Qayerda** | `infrastructure/cache/` — oxirgi qiymatlar, qurilma holati, WebSocket Pub/Sub |
| **Nega** | Ko'p worker process o'rtasida umumiy holat, Pub/Sub WebSocket uchun tayyor, TTL, tez |
| **Alternativ** | In-memory Python dict, Memcached, RabbitMQ |
| **Nega alternativ emas** | In-memory dict — `uvicorn --workers 4` da har worker alohida RAM, sinxronizatsiya yo'q; Memcached — Pub/Sub yo'q, ma'lumot strukturasi cheklangan; RabbitMQ — message queue, cache uchun emas, og'ir |

---

## Validation / Serialization

### Pydantic v2
| | |
|---|---|
| **Qayerda** | `api/schemas/` — request/response validatsiya; `domain/entities/` — ba'zi entity lar |
| **Nega** | FastAPI bilan nativ, Rust asosida (tez), type hints dan avtomatik schema, OpenAPI chiqaradi |
| **Alternativ** | marshmallow, attrs + cattrs, cerberus, dataclasses |
| **Nega alternativ emas** | marshmallow — FastAPI bilan integratsiya qo'lda, verbose; attrs — yaxshi lekin FastAPI qo'llab-quvvatlamaydi; dataclasses — validatsiya yo'q |

---

## Sozlamalar

### pydantic-settings
| | |
|---|---|
| **Qayerda** | `app/settings.py` — `.env` fayl va env variable o'qish |
| **Nega** | Pydantic v2 bilan nativ, type-safe, `.env` avtomatik parse |
| **Alternativ** | python-dotenv, dynaconf, environs |
| **Nega alternativ emas** | python-dotenv — faqat string, type konversiya yo'q; dynaconf — kuchli lekin murakkab, overkill; environs — marshmallow asosida, FastAPI stack bilan mos emas |

---

## ASGI Server

### Uvicorn
| | |
|---|---|
| **Qayerda** | Production: `uvicorn app.main:app --workers 4` |
| **Nega** | FastAPI tavsiya etadi, uvloop asosida (tez), WebSocket qo'llab-quvvatlaydi |
| **Alternativ** | Hypercorn, Daphne, Gunicorn (WSGI) |
| **Nega alternativ emas** | Hypercorn — HTTP/3 qo'llab-quvvatlaydi lekin sekinroq; Daphne — Django uchun optimallangan; Gunicorn — WSGI (sync), async emas |

---

## IEC-104 Klient

### Custom socket implementatsiya
| | |
|---|---|
| **Qayerda** | `infrastructure/iec104/` — APDU parse, General Interrogation |
| **Nega** | Minimal bog'liqlik, to'liq nazorat, faqat kerakli TI turlari (TI 1,3,9,11,13,30,31,34,35,36), debug oson |
| **Alternativ** | lib60870-python, c104, pyiec104, framer-iec104 |
| **Nega alternativ emas** | lib60870-python — C kutubxona wrapper, Windows da build muammo; c104 — CFFI, murakkab o'rnatish; pyiec104 — yetarli hujjat yo'q, faolmas; Hammasi — faqat socket + binary parse kerak, 300 qator Python yetarli |

---

## Frontend Runtime

### Node.js 20 LTS
| | |
|---|---|
| **Qayerda** | Frontend build toolchain — npm, Vite |
| **Nega** | LTS versiya, barqaror, npm ekosistema |
| **Alternativ** | Node 22, Deno, Bun |
| **Nega alternativ emas** | Node 22 — hali LTS emas; Deno — npm packages bilan muammo bo'lishi mumkin; Bun — tez lekin Windows da ba'zan muammo |

---

## UI Framework

### React 18
| | |
|---|---|
| **Qayerda** | `frontend/src/` va `editor/src/` — barcha UI |
| **Nega** | React Flow, TanStack Query, Zustand — hammasi React ekosistema; katta jamoa, boy kutubxona |
| **Alternativ** | Vue 3, Svelte, SolidJS, Angular |
| **Nega alternativ emas** | Vue 3 — React Flow analog yo'q (vue-flow bor lekin kichik ekosistema); Svelte — React Flow yo'q; Angular — og'ir, enterprise |

---

## Tillar

### TypeScript 5.x
| | |
|---|---|
| **Qayerda** | Barcha frontend kodi — `.ts`, `.tsx` |
| **Nega** | Compile-time xatolar, IDE intellisense, refactoring xavfsiz, API types ishonchli |
| **Alternativ** | JavaScript (vanilla) |
| **Nega alternativ emas** | Schema Editor kabi murakkab state (Node types, Edge types, drag events) da JS — xatolar ko'p, debug og'ir |

---

## Build Tool

### Vite 5
| | |
|---|---|
| **Qayerda** | `frontend/vite.config.ts`, `editor/vite.config.ts` — dev server va production build |
| **Nega** | Juda tez (ESM + esbuild), HMR (Hot Module Replacement) instant, minimal config |
| **Alternativ** | webpack 5, Create React App (CRA), Parcel, Turbopack |
| **Nega alternativ emas** | webpack — sekin, murakkab config; CRA — deprecated, sekin; Parcel — yaxshi lekin Vite kabi keng qo'llanilmaydi; Turbopack — hali beta |

---

## Server State

### TanStack Query v5
| | |
|---|---|
| **Qayerda** | `frontend/src/hooks/` — API so'rovlar, cache, refetch, stale time |
| **Nega** | Cache avtomatik, `staleTime`, `refetchInterval`, optimistic update, DevTools |
| **Alternativ** | SWR, RTK Query, Apollo Client, Jotai async |
| **Nega alternativ emas** | SWR — yaxshi lekin TanStack Query kabi kuchli emas (mutations, parallel queries); RTK Query — Redux bilan keladi, overkill; Apollo — GraphQL uchun |

---

## Client State (Editor)

### Zustand + immer + zundo
| | |
|---|---|
| **Qayerda** | `editor/src/store/editorStore.ts` — nodes, edges, selection, clipboard, undo/redo |
| **Nega** | Zustand — minimal boilerplate; immer — immutable update qulay; zundo — undo/redo 3 qator kod |
| **Alternativ** | Redux Toolkit, Jotai, MobX, Valtio, XState |
| **Nega alternativ emas** | Redux Toolkit — verbose (actions, reducers, slices), undo/redo murakkab; Jotai — atom-based, undo/redo qo'lda; MobX — observable pattern, TypeScript bilan murakkab; XState — state machine (to'g'ri), lekin Schema Editor uchun overkill |

---

## Canvas / Diagram

### @xyflow/react (React Flow v12)
| | |
|---|---|
| **Qayerda** | `editor/src/` — Schema Editor canvas, node/edge tizimi |
| **Nega** | Custom JSX node lar, built-in minimap/controls, TypeScript types tayyor, faol maintainer |
| **Alternativ** | Konva.js, Fabric.js, D3.js, GoJS, mxGraph/draw.io |
| **Nega alternativ emas** | Konva.js — low-level Canvas API, har node uchun o'z render logikasi, React integratsiya qo'lda; Fabric.js — eskirib qolgan (v5 beta uzoq), canvas-based; D3.js — data viz uchun, node/edge tizimi yo'q; GoJS — commercial license ($); mxGraph — deprecated |

---

## CSS Framework

### Tailwind CSS v3
| | |
|---|---|
| **Qayerda** | Dispatcher va Editor — barcha stillar |
| **Nega** | Utility-first (tez yoziladi), dark mode oson, custom design token, purge (kichik bundle) |
| **Alternativ** | CSS Modules, styled-components, MUI, shadcn/ui, Ant Design |
| **Nega alternativ emas** | CSS Modules — verbose, alohida fayl; styled-components — runtime CSS-in-JS (sekinroq); MUI/Ant Design — design system boshqacha (biz dark industrial UI kerak); shadcn/ui — Tailwind ustida, qo'shimcha o'rnatish |

---

## Routing

### React Router v6
| | |
|---|---|
| **Qayerda** | Dispatcher va Editor — sahifalar navigatsiyasi |
| **Nega** | Barqaror, keng qo'llaniladi, nested routes, `<Outlet>` pattern |
| **Alternativ** | TanStack Router, Wouter, Next.js |
| **Nega alternativ emas** | TanStack Router — yaxshi type-safety, lekin hali yangi; Wouter — minimal, features yetishmaydi; Next.js — SSR kerak emas (SPA), overkill |

---

## Ikonlar

### Lucide React
| | |
|---|---|
| **Qayerda** | Barcha UI ikonlar |
| **Nega** | Tree-shakeable, TypeScript types, minimal, Tailwind bilan uyg'un |
| **Alternativ** | Heroicons, React Icons, FontAwesome, Phosphor |
| **Nega alternativ emas** | React Icons — katta bundle; FontAwesome — font-based (o'lchov muammo); Heroicons — kam ikon turi; Phosphor — yaxshi alternativ lekin Lucide keng tarqalgan |

---

## Grafiklar

### Recharts
|                          |                                                                                                                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Qayerda**              | Dispatcher — TrendChart (tok trend)                                                                                                                                                                                              |
| **Nega**                 | React-native, declarative, responsive, TypeScript support                                                                                                                                                                        |
| **Alternativ**           | Chart.js + react-chartjs-2, D3.js, Visx, Victory, lightweight-charts                                                                                                                                                             |
| **Nega alternativ emas** | Chart.js — imperative API, React wrapper noqulay; D3.js — juda past daraja; Visx — airbnb, kuchli lekin murakkab; lightweight-charts (TradingView) — moliyaviy grafiklar uchun optimallangan, oddiy signal grafik uchun overkill |

---

## Virtual list

### @tanstack/react-virtual
| | |
|---|---|
| **Qayerda** | Dispatcher — xronologiya jadvali (virtual scroll) |
| **Nega** | Headless, istalgan stil bilan ishlaydi, 10 000+ qator muammosiz |
| **Alternativ** | react-window, react-virtuoso, AG Grid |
| **Nega alternativ emas** | react-window — eskirib qolmoqda, hujjat kam yangilanadi; react-virtuoso — yaxshi alternativ, lekin TanStack bilan bir ekosistema emas; AG Grid — enterprise table, overkill |

---

## Infratuzilma

### Docker + Docker Compose
| | |
|---|---|
| **Qayerda** | `docker-compose.yml` — PostgreSQL + Redis + Backend + Frontend |
| **Nega** | Bir buyruq bilan barcha servislar, izolatsiya, port konflikt yo'q |
| **Alternativ** | Manual o'rnatish, Podman, Kubernetes |
| **Nega alternativ emas** | Manual — har developer o'z versiyasi, "works on my machine"; Podman — Docker Desktop alternativ, lekin Windows da murakkab; Kubernetes — production scale, hozir overkill |

---

## Xulosa jadvali

| Qatlam        | Texnologiya    | Asosiy raqib      | Afzallik              |
| ------------- | -------------- | ----------------- | --------------------- |
| Web framework | FastAPI        | Django            | Async, DI, OpenAPI    |
| ORM           | SQLAlchemy 2   | Tortoise          | Alembic, kuchli query |
| DB            | PostgreSQL     | MySQL             | Partitioning, JSONB   |
| Cache/RT      | Redis          | in-memory         | Multi-worker, Pub/Sub |
| IEC104        | Custom socket  | lib60870          | Nazorat, minimal dep  |
| UI framework  | React 18       | Vue 3             | React Flow ekosistema |
| Build         | Vite           | webpack           | Tezlik, HMR           |
| Server state  | TanStack Query | SWR               | Kuchli cache          |
| Client state  | Zustand+zundo  | Redux             | Minimal, undo/redo    |
| Canvas        | React Flow     | Konva.js          | JSX nodes, type-safe  |
| CSS           | Tailwind       | styled-components | Utility, dark mode    |
| Grafiklar     | Recharts       | Chart.js          | React-native          |
