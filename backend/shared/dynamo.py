"""
DynamoDB client wrapper for the CampusFlow single-table design.

Table: CampusFlow
PK: STUDENT#{studentId}
SK: {TYPE}#{id}  (e.g. CLASS#mon-0900, DEADLINE#hw1, NOTICE#n1, MENU#today)
"""

from __future__ import annotations

import os
import logging
from typing import Any, Dict, List, Optional

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

TABLE_NAME = os.environ.get("DYNAMODB_TABLE", "CampusFlow")
REGION = os.environ.get("AWS_REGION", "us-east-1")

_table = None


def _get_table():
    global _table
    if _table is None:
        dynamodb = boto3.resource("dynamodb", region_name=REGION)
        _table = dynamodb.Table(TABLE_NAME)
    return _table


def put_item(student_id: str, sk: str, data: Dict[str, Any]) -> bool:
    """Put an item into the CampusFlow table."""
    try:
        item = {"PK": f"STUDENT#{student_id}", "SK": sk, **data}
        _get_table().put_item(Item=item)
        return True
    except ClientError as e:
        logger.error(f"DynamoDB put_item failed: {e}")
        return False


def get_item(student_id: str, sk: str) -> Optional[Dict[str, Any]]:
    """Get a single item by PK + SK."""
    try:
        resp = _get_table().get_item(Key={"PK": f"STUDENT#{student_id}", "SK": sk})
        return resp.get("Item")
    except ClientError as e:
        logger.error(f"DynamoDB get_item failed: {e}")
        return None


def query_items(student_id: str, sk_prefix: str) -> List[Dict[str, Any]]:
    """Query all items for a student with a given SK prefix."""
    try:
        resp = _get_table().query(
            KeyConditionExpression="PK = :pk AND begins_with(SK, :sk_prefix)",
            ExpressionAttributeValues={
                ":pk": f"STUDENT#{student_id}",
                ":sk_prefix": sk_prefix,
            },
        )
        return resp.get("Items", [])
    except ClientError as e:
        logger.error(f"DynamoDB query failed: {e}")
        return []


def batch_put_items(student_id: str, items: List[Dict[str, Any]]) -> bool:
    """Batch write items (each must have 'SK' key)."""
    try:
        table = _get_table()
        with table.batch_writer() as batch:
            for item in items:
                item["PK"] = f"STUDENT#{student_id}"
                batch.put_item(Item=item)
        return True
    except ClientError as e:
        logger.error(f"DynamoDB batch_put failed: {e}")
        return False
