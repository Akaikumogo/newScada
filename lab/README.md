# IEC104 Lab Console

DB dagi `device` larni chiqaradi, tanlangan device uchun `active=true` IOA larni IEC-104 orqali o'qib console da yangilab turadi.

## Ishga tushirish

```powershell
cd C:\Users\User\Desktop\newScada
python lab\main.py
```

`DATABASE_URL` `backend/.env` dan olinadi. Kerak bo'lsa environment orqali berish mumkin:

```powershell
$env:DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/newscada"
python lab\main.py
```

## Komandalar

```text
change index   # device listni qayta chiqaradi va index tanlaysiz
change 2       # darhol 2-indexdagi device ga o'tadi
list           # device listni chiqaradi
quit           # dasturdan chiqadi
```

## Barcha active IOA larni recordga yozish

```powershell
cd C:\Users\User\Desktop\newScada
python lab\record_all.py
```

Default: har 1 sekundda barcha `protocol='iec104'` device larni o'qiydi va kelgan `active=true` signallarni `record` jadvaliga yozadi.

```powershell
python lab\record_all.py --once
python lab\record_all.py --interval 1 --concurrency 10
```
