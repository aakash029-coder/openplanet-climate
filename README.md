---
title: OpenPlanet Engine
emoji: 🌍
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
---

# OpenPlanet Climate Engine

[![License](https://img.shields.io/badge/License-MIT-green.svg)](#)

Enterprise-grade backend API for high-resolution climate risk intelligence and localized economic and epidemiological translation.

The OpenPlanet Engine is a stateless, vectorized, pure-function pipeline that dynamically queries ERA5 and CMIP6 datasets to convert climate hazards into financial and human risk metrics.

## Scientific Methodology

This system is not a black box. All models are based on peer-reviewed research and empirical thresholds.

Read the full methodology here: docs/methodology.md

## Core Capabilities

- Historical Baseline Generation: Computes location-specific heatwave thresholds (P95) using 30-year ERA5 climatology.
- Epidemiological Risk Modeling: Estimates heat-related mortality using Gasparrini et al. (2017), including acclimation effects and vulnerability adjustments.
- Economic Impact Modeling: Calculates macroeconomic losses using Burke et al. (2018) damage functions and ILO productivity loss models.
- Survivability Analysis: Computes Wet-Bulb Temperature (WBT) using Stull (2011) to flag 31°C (danger threshold) and 35°C (fatal threshold).

## Architecture

- API Framework: FastAPI
- Computation: NumPy, Pandas (fully vectorized)
- Database: PostgreSQL, SQLAlchemy, pgvector
- Data Sources: ERA5 and CMIP6 via Open-Meteo

## Local Setup

```bash
# Clone repository
git clone [https://github.com/aakash029-coder/openplanet-climate.git](https://github.com/aakash029-coder/openplanet-climate.git)
cd openplanet-climate

# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run server
uvicorn climate_engine.api.main:app --reload --port 7860

