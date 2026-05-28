# Contributing to OpenPlanet

Thank you for your interest in contributing to the OpenPlanet Climate Risk Intelligence Engine. This document describes how climate scientists, data engineers, frontend developers, and infrastructure practitioners can participate in the project.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Project Architecture](#project-architecture)
- [Development Environment Setup](#development-environment-setup)
- [Running Tests](#running-tests)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Scientific Contribution Guidelines](#scientific-contribution-guidelines)
- [Code Style & Quality Standards](#code-style--quality-standards)

---

## Code of Conduct

All contributors are expected to uphold a standard of respectful, collaborative engagement. Contributions that misrepresent scientific findings, introduce unverifiable data sources, or intentionally degrade model accuracy will not be accepted.

---

## Project Architecture

```
openplanet-climate/
├── climate_engine/          # FastAPI backend — physics, epidemiology, econometrics
│   ├── api/                 # Route handlers and Pydantic schemas
│   ├── services/            # ERA5, CMIP6, LLM, socioeconomic service layer
│   ├── data/                # Static reference data (socio_vault.json)
│   └── settings.py          # Pydantic-Settings environment governance
├── frontend/                # Next.js 16 frontend
│   ├── src/app/             # Next.js App Router pages and API proxy routes
│   ├── src/components/      # React UI modules (Map, Research, Compare, Methodology)
│   └── src/context/         # ClimateDataContext — single source of truth
├── hf_space/                # Hugging Face Spaces deployment mirror (git submodule)
├── infra/                   # Docker Compose, Nginx, frontend Dockerfile
├── scripts/                 # Operational utilities (vault build, HF deployment)
├── tests/                   # Python integration tests
└── docs/                    # Scientific methodology documentation
```

---

## Development Environment Setup

### Prerequisites

| Tool | Minimum Version |
|------|----------------|
| Python | 3.11 |
| Node.js | 20 LTS |
| Git | 2.40 |

---

### Backend (FastAPI engine)

```bash
git clone https://github.com/aakash029-coder/openplanet-climate.git
cd openplanet-climate

# Create isolated Python environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — at minimum set GROQ_API_KEY for AI analysis features

# Start the engine
uvicorn climate_engine.api.main:app --reload --port 7860
```

The engine will be available at `http://localhost:7860`. Visit `/docs` for the interactive OpenAPI specification.

---

### Frontend (Next.js)

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp ../.env.example .env.local
# Set NEXT_PUBLIC_ENGINE_URL=http://localhost:7860

# Start the development server
npm run dev
```

The frontend will be available at `http://localhost:3000`.

---

### Full Stack (Docker Compose)

```bash
# From the repository root
docker compose -f infra/docker-compose.yml up --build
```

---

## Running Tests

### Python backend tests

```bash
# From the repository root with .venv activated
pytest tests/ -v

# Run only the geocoding regression suite
pytest tests/test_geocoding.py -v

# Run the full pipeline integration test
pytest tests/test_pipeline.py -v
```

### TypeScript type checking

```bash
cd frontend
npx tsc --noEmit
```

The TypeScript build must exit with zero errors before any PR is merged.

---

## Submitting a Pull Request

1. **Fork** the repository and create a branch from `main`.
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Scope your branch** to a single logical change. Scientific model updates, frontend features, and infrastructure changes should be separate PRs.

3. **Ensure the TypeScript build is clean** (`npx tsc --noEmit` exits 0).

4. **Ensure all Python tests pass** (`pytest tests/` exits 0).

5. **Write a clear commit message** following the format:
   ```
   type(scope): short description

   Longer explanation if needed. Reference the scientific source if
   a model parameter changes (e.g., "Update Gasparrini beta per 2024 meta-analysis").
   ```
   Valid types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.

6. **Open a Pull Request** against `main`. Fill in the PR template:
   - What changed and why
   - Scientific reference if a model coefficient or data source changed
   - Test evidence (screenshot, test output, or curl response)

7. PRs touching `climate_engine/services/` or `climate_engine/api/` require at least one review from a maintainer with climate science domain knowledge.

---

## Scientific Contribution Guidelines

OpenPlanet's credibility rests on methodological transparency. Contributors modifying any of the following must cite a peer-reviewed source in the PR description:

| Component | Source reference required |
|-----------|--------------------------|
| Heatwave threshold calculation | Cite ERA5 percentile methodology |
| CMIP6 model weights or ensemble members | Cite IPCC AR6 WG1 or CMIP6 model card |
| Wet-bulb temperature formula | Stull (2011) — Journal of Applied Meteorology and Climatology |
| Mortality dose-response coefficient (beta) | Gasparrini et al. (2017) — Lancet Planetary Health |
| Economic damage function | Burke et al. (2018) — Nature |
| Labor productivity loss under heat | ILO (2019) — Working on a Warmer Planet |
| Age vulnerability multiplier | Gasparrini et al. (2017) age-decomposition supplement |

**No model parameter may be changed without a corresponding literature citation.** PRs that modify coefficients without references will be closed without review.

---

## Code Style & Quality Standards

### Python

- All production code must pass `pyproject.toml`-configured linters.
- Functions must have type annotations.
- No `print()` statements in production code — use the `logging` module.
- No hardcoded API keys, tokens, or credentials anywhere in source files.
- Scientific formulas must have a one-line comment citing the source equation.

### TypeScript / React

- Zero TypeScript errors (`tsc --noEmit` must be clean).
- No `any` types in component props or context interfaces — use named interfaces.
- Console statements (`console.log`, `console.warn`) must not appear in production component code.
- All React components that read from context must consume `useClimateData()` — no independent `/api/engine` calls from leaf components.
- City names displayed in the UI must follow strict `"City, Country"` format.

---

## Data Contribution

If you wish to contribute updated socioeconomic reference data to `climate_engine/data/socio_vault.json`:

1. Use `scripts/build_socio_vault.py` to regenerate from the World Bank API.
2. Verify the output using `pytest tests/test_pipeline.py`.
3. Confirm that no country entry is missing `death_rate`, `gdp_per_capita`, `pct_over65`, or `physicians_per1000`.
4. Submit the updated `socio_vault.json` as a standalone PR with the World Bank data vintage date in the PR description.

---

## Questions

Open a [GitHub Discussion](https://github.com/aakash029-coder/openplanet-climate/discussions) for questions about methodology, architecture, or contribution scope. For security disclosures, email the maintainer directly — do not open a public issue.
