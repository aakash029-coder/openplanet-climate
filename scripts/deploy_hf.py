#!/usr/bin/env python3
"""
scripts/deploy_hf.py
Deploy climate engine files to the Hugging Face Space (albus2903/openplanet-engine).

Requires HF_TOKEN in environment or .env at repo root.

Usage:
    python scripts/deploy_hf.py
    HF_TOKEN=hf_xxx python scripts/deploy_hf.py
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[1]
REPO_ID = "albus2903/openplanet-engine"

# Local path → path inside HF Space repo
FILES_TO_SYNC: list[tuple[str, str]] = [
    ("climate_engine/api/main.py",                    "climate_engine/api/main.py"),
    ("climate_engine/api/physics.py",                 "climate_engine/api/physics.py"),
    ("climate_engine/services/historical_service.py", "climate_engine/services/historical_service.py"),
    ("climate_engine/services/cmip6_service.py",      "climate_engine/services/cmip6_service.py"),
    ("climate_engine/services/socioeconomic_service.py", "climate_engine/services/socioeconomic_service.py"),
    ("climate_engine/data/socio_vault.json",          "climate_engine/data/socio_vault.json"),
    ("climate_engine/data/city_vault.json",           "climate_engine/data/city_vault.json"),
]


def _load_dotenv() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key, val = key.strip(), val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


def deploy() -> None:
    _load_dotenv()
    hf_token = os.environ.get("HF_TOKEN")
    if not hf_token:
        logger.error("HF_TOKEN is not set. Add it to .env or export HF_TOKEN=...")
        sys.exit(1)

    try:
        from huggingface_hub import HfApi
    except ImportError:
        logger.error("Install huggingface_hub: pip install huggingface_hub")
        sys.exit(1)

    api = HfApi()
    logger.info("Deploying %d file(s) to %s…", len(FILES_TO_SYNC), REPO_ID)

    uploaded = 0
    for local_rel, remote_path in FILES_TO_SYNC:
        local_path = ROOT / local_rel
        if not local_path.exists():
            logger.warning("Skipping %s — not found", local_rel)
            continue
        logger.info("  %s → %s", local_rel, remote_path)
        api.upload_file(
            path_or_fileobj=str(local_path),
            path_in_repo=remote_path,
            repo_id=REPO_ID,
            repo_type="space",
            token=hf_token,
        )
        uploaded += 1

    logger.info("Deployment complete. %d file(s) uploaded.", uploaded)


if __name__ == "__main__":
    deploy()
