# Inicia o servidor FastAPI na porta 8001
# Execute: .\start-server.ps1
Set-Location $PSScriptRoot
python -m uvicorn api.main:app --reload --port 8001
