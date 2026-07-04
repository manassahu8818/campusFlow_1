"""
campusflow-kb-sync

Triggered by S3 event when a new file is uploaded.
Starts a Bedrock Knowledge Base ingestion job so the KB
indexes the new document automatically.

This is the "event-driven" approach to keeping the Knowledge Base
in sync with S3 — no polling, no manual sync needed.
"""

import json
import logging
import os

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

KNOWLEDGE_BASE_ID = os.environ.get("KNOWLEDGE_BASE_ID", "")
DATA_SOURCE_ID = os.environ.get("DATA_SOURCE_ID", "")
REGION = os.environ.get("AWS_REGION", "us-east-1")


def handler(event: dict, context) -> dict:
    """
    S3 event handler — triggers Knowledge Base sync.

    Triggered when any file is created under uploads/ prefix in S3.
    Starts an ingestion job so Bedrock KB re-indexes the new content.
    """
    if not KNOWLEDGE_BASE_ID or not DATA_SOURCE_ID:
        logger.warning("KNOWLEDGE_BASE_ID or DATA_SOURCE_ID not set. Skipping sync.")
        return {"statusCode": 200, "body": "KB sync skipped — not configured"}

    # Log which file triggered this
    for record in event.get("Records", []):
        s3_info = record.get("s3", {})
        bucket = s3_info.get("bucket", {}).get("name", "unknown")
        key = s3_info.get("object", {}).get("key", "unknown")
        logger.info(f"New file detected: s3://{bucket}/{key}")

    # Start ingestion job
    try:
        client = boto3.client("bedrock-agent", region_name=REGION)

        response = client.start_ingestion_job(
            knowledgeBaseId=KNOWLEDGE_BASE_ID,
            dataSourceId=DATA_SOURCE_ID,
            description=f"Auto-sync triggered by S3 upload",
        )

        job_id = response.get("ingestionJob", {}).get("ingestionJobId", "unknown")
        status = response.get("ingestionJob", {}).get("status", "unknown")

        logger.info(f"Ingestion job started: {job_id} (status: {status})")

        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": "Knowledge Base sync triggered",
                "jobId": job_id,
                "status": status,
            }),
        }

    except ClientError as e:
        error_code = e.response["Error"]["Code"]

        # If a sync is already in progress, that's fine — skip
        if error_code == "ConflictException":
            logger.info("Ingestion job already in progress. Skipping.")
            return {"statusCode": 200, "body": "Sync already in progress"}

        logger.error(f"Failed to start ingestion job: {e}")
        return {"statusCode": 500, "body": f"Sync failed: {str(e)}"}

    except Exception as e:
        logger.error(f"Unexpected error in KB sync: {e}", exc_info=True)
        return {"statusCode": 500, "body": f"Unexpected error: {str(e)}"}
