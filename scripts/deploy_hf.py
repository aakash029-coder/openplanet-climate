"""
scripts/deploy_hf.py
Deploy local service modules and data assets to the Hugging Face Space.

Requires HF_TOKEN environment variable — obtain from huggingface.co/settings/tokens.

Usage:
    HF_TOKEN=hf_xxx python scripts/deploy_hf.py
"""

from __future__ import annotations

import logging
import os
import sys

from huggingface_hub import HfApi

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

REPO_ID = "albus2903/openplanet-engine"

FILES_TO_SYNC: list[tuple[str, str]] = [
    ("climate_engine/api/main.py",                    "climate_engine/api/main.py"),
    ("climate_engine/services/historical_service.py", "climate_engine/services/historical_service.py"),
    ("climate_engine/data/socio_vault.json",          "climate_engine/data/socio_vault.json"),
]


def deploy() -> None:
    hf_token = os.environ.get("HF_TOKEN")
    if not hf_token:
        logger.error("HF_TOKEN environment variable is not set.")
        sys.exit(1)

    api = HfApi()
    logger.info("Deploying %d file(s) to %s…", len(FILES_TO_SYNC), REPO_ID)

    for local_path, remote_path in FILES_TO_SYNC:
        if not os.path.exists(local_path):
            logger.warning("Skipping %s — file not found locally.", local_path)
            continue
        logger.info("  %s → %s", local_path, remote_path)
        api.upload_file(
            path_or_fileobj=local_path,
            path_in_repo=remote_path,
            repo_id=REPO_ID,
            repo_type="space",
            token=hf_token,
        )

    logger.info("Deployment complete.")


if __name__ == "__main__":
    deploy()
