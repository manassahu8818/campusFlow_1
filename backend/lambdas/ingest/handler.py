"""
campusflow-ingest-handler

Handles file upload → extraction → DynamoDB storage.

Flow:
1. Receive file upload (base64-encoded in API Gateway event, or from S3 trigger)
2. Store raw file in S3
3. Extract structured data (stub or Bedrock, depending on EXTRACTOR_MODE)
4. Write extracted entities to DynamoDB
5. Return extracted data to the client
"""

from __future__ import annotations

import json
import base64
import logging
import sys
import os
from typing import Tuple, Optional

# Add shared module to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from shared.auth import get_student_id
from shared.extractor import extract_structured_data
from shared.dynamo import batch_put_items
from shared.s3_client import upload_file

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event: dict, context) -> dict:
    """Lambda handler for document ingestion."""
    try:
        student_id = get_student_id(event)
        logger.info(f"Ingestion request for student: {student_id}")

        # Parse the uploaded file from the event
        file_bytes, filename, content_type = _parse_upload(event)

        if not file_bytes:
            return _response(400, {"error": "No file provided"})

        # Step 1: Upload raw file to S3
        s3_key = None
        try:
            s3_key = upload_file(student_id, filename, file_bytes, content_type)
        except Exception as e:
            logger.warning(f"S3 upload failed (non-fatal): {e}")
            # Non-fatal: continue with extraction even if S3 fails

        # Step 2: Extract structured data
        result = extract_structured_data(file_bytes, filename, content_type)
        logger.info(f"Extracted: type={result.document_type}, confidence={result.overall_confidence}")

        # Step 3: Store in DynamoDB
        dynamo_items = result.all_dynamo_items()
        if dynamo_items:
            try:
                batch_put_items(student_id, dynamo_items)
                logger.info(f"Stored {len(dynamo_items)} items in DynamoDB")
            except Exception as e:
                logger.warning(f"DynamoDB write failed (non-fatal): {e}")

        # Step 4: Return result
        response_data = {
            "success": True,
            "uploadId": s3_key or "local-only",
            "documentType": result.document_type,
            "overallConfidence": result.overall_confidence,
            "extractedData": result.to_dict(),
            "itemCount": len(dynamo_items),
        }

        return _response(200, response_data)

    except Exception as e:
        logger.error(f"Ingestion failed: {e}", exc_info=True)
        return _response(500, {"error": "Ingestion failed", "details": str(e)})


def _parse_upload(event: dict) -> Tuple[Optional[bytes], str, str]:
    """
    Parse file upload from API Gateway event.

    Supports:
    - Base64-encoded body (API Gateway binary)
    - Multipart form data (simplified parse)
    - Direct JSON body with base64 file field (for local testing)
    """
    body = event.get("body", "")
    is_base64 = event.get("isBase64Encoded", False)
    headers = event.get("headers", {}) or {}
    content_type_header = headers.get("content-type", headers.get("Content-Type", ""))

    # Case 1: Direct JSON with base64 file (local testing)
    if not is_base64 and body:
        try:
            data = json.loads(body) if isinstance(body, str) else body
            if "file_base64" in data:
                file_bytes = base64.b64decode(data["file_base64"])
                filename = data.get("filename", "upload.png")
                ct = data.get("content_type", "image/png")
                return file_bytes, filename, ct
        except (json.JSONDecodeError, TypeError):
            pass

    # Case 2: Base64-encoded binary from API Gateway
    if is_base64 and body:
        file_bytes = base64.b64decode(body)
        filename = headers.get("x-filename", "upload.bin")
        ct = content_type_header or "application/octet-stream"
        return file_bytes, filename, ct

    # Case 3: Raw bytes in body (local invocation)
    if isinstance(body, bytes):
        filename = headers.get("x-filename", "upload.bin")
        return body, filename, content_type_header or "application/octet-stream"

    return None, "", ""


def _response(status_code: int, body: dict) -> dict:
    """Build an API Gateway response."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Student-Id",
        },
        "body": json.dumps(body, default=str),
    }
