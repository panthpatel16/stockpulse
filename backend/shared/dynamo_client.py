"""
DynamoDB wrapper for the single-table StockPulse schema.

Handles retries on throttling, converts Decimals back to floats for JSON,
and keeps all the key construction logic in one place so the Lambda
handlers don't have to care about the PK/SK format.
"""

from __future__ import annotations

import os
import time
import logging
from decimal import Decimal
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)
logger.setLevel(os.getenv("LOG_LEVEL", "INFO"))

TABLE_NAME = os.environ["DYNAMODB_TABLE"]


class DynamoClient:

    def __init__(self, table_name: str = TABLE_NAME):
        self._resource = boto3.resource("dynamodb")
        self.table = self._resource.Table(table_name)

    # writes

    def put_price_record(self, symbol: str, timestamp: str, data: dict) -> None:
        """Write a 5-min OHLCV record. TTL set to 30 days so old candles auto-expire."""
        pk = f"SYMBOL#{symbol.upper()}"
        sk = f"PRICE#{timestamp}"
        ttl = int(time.time()) + (30 * 24 * 60 * 60)
        item = {
            "pk": pk,
            "sk": sk,
            "gsi_date": timestamp[:10],
            "symbol": symbol.upper(),
            "timestamp": timestamp,
            "ttl": ttl,
            **{k: Decimal(str(v)) for k, v in data.items() if v is not None},
        }
        self._put_with_retry(item)

    def put_aggregate_record(self, symbol: str, date: str, data: dict) -> None:
        """Daily aggregate — no TTL, we want to keep these long term."""
        pk = f"SYMBOL#{symbol.upper()}"
        sk = f"AGG#DAILY#{date}"
        item = {
            "pk": pk,
            "sk": sk,
            "gsi_date": date,
            "symbol": symbol.upper(),
            "date": date,
            **{k: Decimal(str(v)) for k, v in data.items() if v is not None},
        }
        self._put_with_retry(item)

    def put_metadata(self, symbol: str, data: dict) -> None:
        item = {
            "pk": f"SYMBOL#{symbol.upper()}",
            "sk": "META#INFO",
            "symbol": symbol.upper(),
            **data,
        }
        self._put_with_retry(item)

    def put_alert(self, symbol: str, email: str, data: dict) -> None:
        item = {
            "pk": f"ALERT#{symbol.upper()}",
            "sk": f"THRESHOLD#{email}",
            "symbol": symbol.upper(),
            "email": email,
            **{k: Decimal(str(v)) if isinstance(v, float) else v for k, v in data.items()},
        }
        self._put_with_retry(item)

    def batch_put_prices(self, records: list[dict]) -> None:
        with self.table.batch_writer() as batch:
            for record in records:
                batch.put_item(Item=record)

    # reads

    def get_latest_price(self, symbol: str) -> dict | None:
        resp = self.table.query(
            KeyConditionExpression=(
                Key("pk").eq(f"SYMBOL#{symbol.upper()}") &
                Key("sk").begins_with("PRICE#")
            ),
            ScanIndexForward=False,
            Limit=1,
        )
        items = resp.get("Items", [])
        return self._deserialize(items[0]) if items else None

    def get_price_history(self, symbol: str, hours: int = 24) -> list[dict]:
        from datetime import datetime, timezone, timedelta
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M:%SZ")
        resp = self.table.query(
            KeyConditionExpression=(
                Key("pk").eq(f"SYMBOL#{symbol.upper()}") &
                Key("sk").between(f"PRICE#{cutoff}", "PRICE#9999")
            ),
            ScanIndexForward=True,
        )
        return [self._deserialize(i) for i in resp.get("Items", [])]

    def get_aggregates(self, symbol: str, days: int = 30) -> list[dict]:
        from datetime import datetime, timezone, timedelta
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
        resp = self.table.query(
            KeyConditionExpression=(
                Key("pk").eq(f"SYMBOL#{symbol.upper()}") &
                Key("sk").between(f"AGG#DAILY#{cutoff}", "AGG#DAILY#9999")
            ),
            ScanIndexForward=True,
        )
        return [self._deserialize(i) for i in resp.get("Items", [])]

    def get_metadata(self, symbol: str) -> dict | None:
        resp = self.table.get_item(
            Key={"pk": f"SYMBOL#{symbol.upper()}", "sk": "META#INFO"}
        )
        item = resp.get("Item")
        return self._deserialize(item) if item else None

    def get_alerts(self, symbol: str) -> list[dict]:
        resp = self.table.query(
            KeyConditionExpression=(
                Key("pk").eq(f"ALERT#{symbol.upper()}") &
                Key("sk").begins_with("THRESHOLD#")
            ),
        )
        return [self._deserialize(i) for i in resp.get("Items", [])]

    # internals

    def _put_with_retry(self, item: dict, max_retries: int = 3) -> None:
        for attempt in range(max_retries):
            try:
                self.table.put_item(Item=item)
                return
            except ClientError as e:
                code = e.response["Error"]["Code"]
                if code in ("ProvisionedThroughputExceededException", "RequestLimitExceeded"):
                    wait = (2 ** attempt) * 0.1
                    logger.warning("throttled, retrying in %.1fs (attempt %d)", wait, attempt + 1)
                    time.sleep(wait)
                else:
                    raise
        raise RuntimeError(f"dynamo write failed after {max_retries} retries")

    @staticmethod
    def _deserialize(item: dict) -> dict:
        """Decimal -> float so we can JSON serialize without custom encoders."""
        result = {}
        for k, v in item.items():
            result[k] = float(v) if isinstance(v, Decimal) else v
        return result
