@echo off
cd /d %~dp0
echo Starting newSCADA backend...
uvicorn main:app --reload --host 0.0.0.0 --port 8000
