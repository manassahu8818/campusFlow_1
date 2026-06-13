"""
Local test runner for the ingest Lambda.

Run: python local_test.py
No AWS services needed when EXTRACTOR_MODE=stub (default).
"""

import sys
import os
import json

# Set env vars BEFORE importing handler
os.environ.setdefault("EXTRACTOR_MODE", "stub")
os.environ.setdefault("DYNAMODB_TABLE", "CampusFlow")
os.environ.setdefault("S3_BUCKET", "campusflow-uploads")
os.environ.setdefault("AWS_REGION", "us-east-1")

# Add parent paths
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from handler import handler


def test_timetable_upload():
    """Simulate uploading a timetable image."""
    print("\n" + "=" * 60)
    print("TEST: Timetable upload (stub extractor)")
    print("=" * 60)

    event = {
        "headers": {
            "Content-Type": "application/json",
            "X-Student-Id": "aarav-demo",
        },
        "body": json.dumps({
            "file_base64": "aGVsbG8=",  # dummy base64
            "filename": "my_timetable.png",
            "content_type": "image/png",
        }),
        "isBase64Encoded": False,
    }

    result = handler(event, None)
    body = json.loads(result["body"])

    print(f"Status: {result['statusCode']}")
    print(f"Document Type: {body.get('documentType')}")
    print(f"Confidence: {body.get('overallConfidence')}")
    print(f"Items extracted: {body.get('itemCount')}")
    print(f"\nFull response:")
    print(json.dumps(body, indent=2))
    return result["statusCode"] == 200


def test_menu_upload():
    """Simulate uploading a mess menu."""
    print("\n" + "=" * 60)
    print("TEST: Mess menu upload (stub extractor)")
    print("=" * 60)

    event = {
        "headers": {
            "Content-Type": "application/json",
            "X-Student-Id": "aarav-demo",
        },
        "body": json.dumps({
            "file_base64": "aGVsbG8=",
            "filename": "hostel_mess_menu.jpg",
            "content_type": "image/jpeg",
        }),
        "isBase64Encoded": False,
    }

    result = handler(event, None)
    body = json.loads(result["body"])

    print(f"Status: {result['statusCode']}")
    print(f"Document Type: {body.get('documentType')}")
    print(f"Items extracted: {body.get('itemCount')}")
    print(json.dumps(body, indent=2))
    return result["statusCode"] == 200


def test_notice_upload():
    """Simulate uploading a notice."""
    print("\n" + "=" * 60)
    print("TEST: Notice upload (stub extractor)")
    print("=" * 60)

    event = {
        "headers": {
            "Content-Type": "application/json",
            "X-Student-Id": "aarav-demo",
        },
        "body": json.dumps({
            "file_base64": "aGVsbG8=",
            "filename": "dept_notice_midsem.png",
            "content_type": "image/png",
        }),
        "isBase64Encoded": False,
    }

    result = handler(event, None)
    body = json.loads(result["body"])

    print(f"Status: {result['statusCode']}")
    print(f"Document Type: {body.get('documentType')}")
    print(f"Items extracted: {body.get('itemCount')}")
    print(json.dumps(body, indent=2))
    return result["statusCode"] == 200


def test_unknown_document():
    """Simulate uploading an unknown document type."""
    print("\n" + "=" * 60)
    print("TEST: Unknown document (stub extractor)")
    print("=" * 60)

    event = {
        "headers": {
            "Content-Type": "application/json",
            "X-Student-Id": "aarav-demo",
        },
        "body": json.dumps({
            "file_base64": "aGVsbG8=",
            "filename": "random_photo.png",
            "content_type": "image/png",
        }),
        "isBase64Encoded": False,
    }

    result = handler(event, None)
    body = json.loads(result["body"])

    print(f"Status: {result['statusCode']}")
    print(f"Document Type: {body.get('documentType')}")
    print(f"Items extracted: {body.get('itemCount')}")
    return result["statusCode"] == 200


if __name__ == "__main__":
    # Mock boto3 clients to avoid real AWS calls in pure stub mode
    import unittest.mock as mock

    # Patch S3 and DynamoDB to no-op (we're just testing extraction logic)
    with mock.patch("shared.s3_client._get_client") as mock_s3, \
         mock.patch("shared.dynamo._get_table") as mock_dynamo:

        mock_s3.return_value.put_object.return_value = {}
        mock_table = mock.MagicMock()
        mock_dynamo.return_value = mock_table

        results = [
            test_timetable_upload(),
            test_menu_upload(),
            test_notice_upload(),
            test_unknown_document(),
        ]

    print("\n" + "=" * 60)
    print(f"RESULTS: {sum(results)}/{len(results)} tests passed")
    print("=" * 60)

    if not all(results):
        sys.exit(1)
    print("\n✅ All tests passed! Ingestion pipeline works end-to-end with stub extractor.")
    print("   → Set EXTRACTOR_MODE=bedrock to use real Bedrock/Textract when model access is live.")
