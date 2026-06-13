"""
S3 client wrapper for CampusFlow file uploads.
"""

from __future__ import annotations

import os
import logging
from typing import Optional

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

BUCKET_NAME = os.environ.get("S3_BUCKET", "campusflow-uploads")
REGION = os.environ.get("AWS_REGION", "us-east-1")

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = boto3.client("s3", region_name=REGION)
    return _client


def upload_file(student_id: str, filename: str, file_bytes: bytes, content_type: str = "application/octet-stream") -> Optional[str]:
    """
    Upload a file to S3 under the student's prefix.
    Returns the S3 key on success, None on failure.
    """
    import time
    key = f"uploads/{student_id}/{int(time.time())}-{filename}"
    try:
        _get_client().put_object(
            Bucket=BUCKET_NAME,
            Key=key,
            Body=file_bytes,
            ContentType=content_type,
        )
        logger.info(f"Uploaded to s3://{BUCKET_NAME}/{key}")
        return key
    except ClientError as e:
        logger.error(f"S3 upload failed: {e}")
        return None


def get_file(key: str) -> Optional[bytes]:
    """Download a file from S3."""
    try:
        resp = _get_client().get_object(Bucket=BUCKET_NAME, Key=key)
        return resp["Body"].read()
    except ClientError as e:
        logger.error(f"S3 get failed: {e}")
        return None


def generate_presigned_url(key: str, expires_in: int = 3600) -> Optional[str]:
    """Generate a presigned URL for direct upload."""
    try:
        url = _get_client().generate_presigned_url(
            "put_object",
            Params={"Bucket": BUCKET_NAME, "Key": key},
            ExpiresIn=expires_in,
        )
        return url
    except ClientError as e:
        logger.error(f"Presigned URL generation failed: {e}")
        return None
