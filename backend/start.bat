@echo off
cd /d %~dp0
echo Starting newSCADA backend...
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
