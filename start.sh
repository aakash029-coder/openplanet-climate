#!/bin/zsh
echo "⚡ Igniting OpenPlanet Backend Engine..."

# 1. Activate the virtual environment from the root folder
source .venv/bin/activate

# 2. Navigate into the backend architecture
cd backend

# 3. Tell Python exactly where the modules live
export PYTHONPATH=$PWD

# 4. Start the FastAPI server
uvicorn climate_engine.api.main:app --reload --port 8000
