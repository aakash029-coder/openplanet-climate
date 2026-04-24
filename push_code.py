"""
Automated deployment script for syncing local service modules to the Hugging Face Space environment.
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

def deploy_services() -> None:
    hf_token = os.environ.get("HF_TOKEN")
    if not hf_token:
        logger.error("Authentication failed: 'HF_TOKEN' environment variable is not set.")
        sys.exit(1)

    api = HfApi()
    repo_id = "albus2903/openplanet-engine"
    
    files_to_sync = [
        ("climate_engine/api/main.py", "climate_engine/api/main.py"),
        ("climate_engine/services/historical_service.py", "climate_engine/services/historical_service.py")
    ]

    logger.info("Initiating deployment pipeline to Hugging Face Spaces...")

    for local_path, remote_path in files_to_sync:
        logger.info("Uploading %s...", local_path)
        try:
            api.upload_file(
                path_or_fileobj=local_path,
                path_in_repo=remote_path,
                repo_id=repo_id,
                repo_type="space",
                token=hf_token
            )
            logger.info("Successfully synced %s", remote_path)
        except Exception as e:
            logger.error("Failed to deploy %s: %s", local_path, str(e))
            sys.exit(1)

    logger.info("Deployment pipeline completed successfully. Services are active.")

if __name__ == "__main__":
    deploy_services()