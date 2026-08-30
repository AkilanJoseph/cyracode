@echo off
echo Starting CyraCode Backend...
cd C:\Projects\CyraCodeNew\cyracode\backend
call .venv\Scripts\activate
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
pause