---
type: reference
tags: [architecture, database, schema, postgresql]
status: approved
created: 2026-05-24
related: ["[[Architecture/DB Strategy]]", "[[Architecture/Clean Architecture]]"]
---

# DB Sxema

## Jadvallar

### branch
```sql
id          SERIAL PRIMARY KEY
name        VARCHAR(120) NOT NULL
type        VARCHAR(32)  NOT NULL DEFAULT 'filial'
            -- 'filial' | 'bosh_boshqarma'
created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
```

### substation
```sql
id          SERIAL      PRIMARY KEY
branch_id   INT         NOT NULL REFERENCES branch(id) ON DELETE RESTRICT
name        VARCHAR(120) NOT NULL
address     VARCHAR(200)
created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
```

### device_model
```sql
id           SERIAL      PRIMARY KEY
name         VARCHAR(120) NOT NULL
manufacturer VARCHAR(120)
description  TEXT
created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()

UNIQUE(name, manufacturer)
```

### device
```sql
id                    SERIAL      PRIMARY KEY
substation_id         INT         NOT NULL REFERENCES substation(id) ON DELETE RESTRICT
model_id              INT         NOT NULL REFERENCES device_model(id) ON DELETE RESTRICT
name                  VARCHAR(120) NOT NULL
protocol              VARCHAR(32)  NOT NULL DEFAULT 'iec104'

-- IEC104 ulanish sozlamalari
iec104_host           VARCHAR(64)  NOT NULL DEFAULT '127.0.0.1'
iec104_port           INT          NOT NULL DEFAULT 2404
iec104_common_address INT          NOT NULL DEFAULT 1
poll_interval_seconds FLOAT        NOT NULL DEFAULT 2.0

created_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
```

### device_signal
```sql
id             SERIAL       PRIMARY KEY
device_id      INT          NOT NULL REFERENCES device(id) ON DELETE CASCADE
register_code  INT          NOT NULL   -- IEC104 IOA, masalan: 641
signal_name    VARCHAR(64)  NOT NULL   -- masalan: "ia"
signal_title   VARCHAR(160)
unit           VARCHAR(24)  NOT NULL DEFAULT ''
value_type     VARCHAR(32)  NOT NULL DEFAULT 'float'
               -- 'float' | 'status'

UNIQUE(device_id, register_code)
```

### substation_schema
```sql
id             SERIAL      PRIMARY KEY
substation_id  INT         NOT NULL REFERENCES substation(id) ON DELETE CASCADE
               UNIQUE
canvas_json    JSONB       NOT NULL DEFAULT '{}'
               -- {version, nodes, edges, viewport}
updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
```

### record
```sql
id          BIGSERIAL    PRIMARY KEY
device_id   INT          NOT NULL REFERENCES device(id) ON DELETE CASCADE
signal_name VARCHAR(64)  NOT NULL
value       FLOAT        NOT NULL
quality     SMALLINT     NOT NULL DEFAULT 0
captured_at TIMESTAMPTZ  NOT NULL

-- Oy bo'yicha partitioning uchun:
-- PARTITION BY RANGE (captured_at)
```

---

## Munosabatlar

```
branch (1)
  └──< substation (N)
          ├──1 substation_schema
          └──< device (N)
                 ├──> device_model (1)
                 ├──< device_signal (N)  [UNIQUE: device_id + register_code]
                 └──< record (N)         [BIGSERIAL, TIMESTAMPTZ, partitioned]
```

---

## Indekslar

```sql
-- Record — asosiy so'rov indeksi
CREATE INDEX idx_record_device_signal_time
    ON record(device_id, signal_name, captured_at DESC);

-- Record — vaqt oralig'i so'rovlar uchun BRIN
CREATE INDEX idx_record_brin
    ON record USING brin(captured_at)
    WITH (pages_per_range = 128);

-- Topologiya navigatsiya
CREATE INDEX idx_device_substation ON device(substation_id);
CREATE INDEX idx_substation_branch ON substation(branch_id);

-- Signal lookup (collector uchun)
CREATE UNIQUE INDEX idx_device_signal_unique
    ON device_signal(device_id, register_code);
```

---

## Muhim eslatmalar

| Maydon | Qaror | Sabab |
|--------|-------|-------|
| `record.id` | `BIGSERIAL` | Yillar o'tsa INT (~2 mlrd) to'lib ketishi mumkin |
| `captured_at` | `TIMESTAMPTZ` | Timezone bilan — UTC da saqlanadi, lokal ko'rsatiladi |
| `canvas_json` | `JSONB` | PostgreSQL JSONB: indekslash, `->` operator, validatsiya |
| `device_signal` | `UNIQUE(device_id, register_code)` | Bir qurilmada IOA takrorlanmasin |
| `device` | IEC104 maydonlar | Collector DB dan o'qiydi — hardcode emas |
| FK lari | `ON DELETE RESTRICT/CASCADE` | Ma'lumot yaxlitligi |
