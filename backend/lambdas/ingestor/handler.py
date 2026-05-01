"""
Ingestor Lambda - runs on a schedule during market hours.

Pulls intraday OHLCV data from Alpha Vantage for each tracked symbol
and writes it to DynamoDB. Alpha Vantage free tier is rate-limited so
we sleep 1.2s between requests to stay safe.
"""

from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any

import boto3
import urllib.request
import urllib.error

from dynamo_client import DynamoClient
from models import PriceRecord
from utils import setup_logging

setup_logging()
logger = logging.getLogger(__name__)

ALPHA_VANTAGE_KEY  = os.environ["ALPHA_VANTAGE_KEY"]
STOCKS_TO_TRACK    = [s.strip().upper() for s in os.environ.get("STOCKS_TO_TRACK", "AAPL,MSFT").split(",")]
ALPHA_VANTAGE_BASE = "https://www.alphavantage.co/query"

cw = boto3.client("cloudwatch")
db = DynamoClient()


def lambda_handler(event: dict, context: Any) -> dict:
    logger.info("Ingestor triggered. symbols=%s", STOCKS_TO_TRACK)

    records_written = 0
    errors = []

    for symbol in STOCKS_TO_TRACK:
        try:
            records = _fetch_and_parse(symbol)
            if records:
                _batch_write(symbol, records)
                records_written += len(records)
                logger.info("wrote %d records for %s", len(records), symbol)
        except Exception as exc:
            logger.error("failed to ingest %s: %s", symbol, exc, exc_info=True)
            errors.append({"symbol": symbol, "error": str(exc)})
        time.sleep(1.2)

    _emit_metric("records_written", records_written)
    _emit_metric("symbols_failed", len(errors))

    logger.info("done. records_written=%d errors=%d", records_written, len(errors))

    if errors:
        logger.warning("partial failures: %s", json.dumps(errors))

    return {"records_written": records_written, "errors": errors}


def _fetch_and_parse(symbol: str) -> list[tuple]:
    url = (
        f"{ALPHA_VANTAGE_BASE}"
        f"?function=TIME_SERIES_INTRADAY"
        f"&symbol={symbol}"
        f"&interval=5min"
        f"&outputsize=compact"
        f"&apikey={ALPHA_VANTAGE_KEY}"
    )

    try:
        with urllib.request.urlopen(url, timeout=15) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.URLError as e:
        raise RuntimeError(f"http error for {symbol}: {e}") from e

    if "Note" in data:
        raise RuntimeError(f"rate limit hit for {symbol}: {data['Note']}")
    if "Error Message" in data:
        raise RuntimeError(f"av error for {symbol}: {data['Error Message']}")

    time_series = data.get("Time Series (5min)", {})
    if not time_series:
        logger.warning("empty time series for %s", symbol)
        return []

    records = []
    for ts_str, ohlcv in time_series.items():
        try:
            ts = datetime.strptime(ts_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
            iso_ts = ts.strftime("%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            logger.warning("bad timestamp %s for %s", ts_str, symbol)
            continue

        try:
            record = PriceRecord(
                symbol=symbol,
                timestamp=iso_ts,
                open=float(ohlcv["1. open"]),
                high=float(ohlcv["2. high"]),
                low=float(ohlcv["3. low"]),
                close=float(ohlcv["4. close"]),
                volume=int(ohlcv["5. volume"]),
            )
            records.append((record.timestamp, record.to_dynamo_attrs()))
        except (KeyError, ValueError) as e:
            logger.warning("malformed candle %s@%s: %s", symbol, ts_str, e)
            continue

    return records


def _batch_write(symbol: str, records: list[tuple]) -> None:
    for timestamp, attrs in records:
        db.put_price_record(symbol=symbol, timestamp=timestamp, data=attrs)


def _emit_metric(name: str, value: float) -> None:
    try:
        cw.put_metric_data(
            Namespace="StockPulse/Ingestor",
            MetricData=[{"MetricName": name, "Value": value, "Unit": "Count"}],
        )
    except Exception as e:
        logger.warning("metric emit failed %s: %s", name, e)
