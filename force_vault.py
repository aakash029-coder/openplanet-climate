"""
Utility script for deploying local data assets to the remote Hugging Face Space.
"""

import os
import sys
import logging
from huggingface_hub import HfApi

# Configure standard logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

def deploy_vault() -> None:
    hf_token = os.environ.get("HF_TOKEN")
    if not hf_token:
        logger.error("Authentication failed: 'HF_TOKEN' environment variable is not set.")
        sys.exit(1)

    api = HfApi()
    repo_id = "albus2903/openplanet-engine"
    local_path = "climate_engine/data/socio_vault.json"
    remote_path = "climate_engine/data/socio_vault.json"

    logger.info("Initiating upload of socioeconomic vault to remote repository...")

    try:
        api.upload_file(
            path_or_fileobj=local_path,
            path_in_repo=remote_path,
            repo_id=repo_id,
            repo_type="space",
            token=hf_token
        )
        logger.info("Upload completed successfully: %s", remote_path)
    except Exception as e:
        logger.error("Failed to upload data vault: %s", str(e))
        sys.exit(1)

if __name__ == "__main__":
    deploy_vault()