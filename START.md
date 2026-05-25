# newSCADA — Ishga tushirish

## O'rnatish

```bash
# Frontend (Dispatcher) — Port 3000
cd frontend
npm install
npm run dev

# EDITOR — Port 3001
cd EDITOR
npm install
npm run dev

# Backend — Port 8000 (Codex tomonidan)
cd backend
# ...
```

## URL manzillar

| App | URL | Tavsif |
|-----|-----|--------|
| Dispatcher | http://localhost:3000 | Operator monitoring |
| Editor | http://localhost:3001 | Admin panel |
| Backend API | http://localhost:8000 | FastAPI |
| API Docs | http://localhost:8000/docs | Swagger UI |

## Texnologiyalar

### Frontend (Dispatcher)
- React 18 + TypeScript
- Framer Motion — animatsiyalar
- Zustand — WebSocket state
- TanStack Query — HTTP data
- Tailwind CSS — stil
- JetBrains Mono — raqamlar uchun mono font

### Editor
- React 18 + TypeScript
- Framer Motion — animatsiyalar
- @xyflow/react — Schema Editor canvas
- React Hook Form + Zod — forma validatsiya
- TanStack Query — CRUD
- Sonner — toast bildirishnomalar
