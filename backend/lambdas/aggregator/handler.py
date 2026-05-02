"""
Aggregator Lambda - runs after market close (4:30 PM ET).

For each tracked symbol, pulls the day's 5-min records from DynamoDB,
computes daily OHLC + VWAP + 20/50-day moving averages, and writes
an aggregate record. The frontend uses these for the daily chart view.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone, timedelta
from statistics import mean
from typing import Any

from dynamo_client import DynamoClient
from models import AggregateRecord
from utils import setup_logging

setup_logging()
logger = logging.getLogger(__name__)

STOCKS_TO_TRACK = [s.strip().upper() for s in os.environ.get("STOCKS_TO_TRACK", "AAPL,MSFT").split(",")]
db = DynamoClient()


def lambda_handler(event: dict, context: Any) -> dict:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    logger.info("aggregating for %s", today)

    results = {"date": today, "aggregated": [], "errors": []}

    for symbol in STOCKS_TO_TRACK:
        try:
            agg = _compute_daily(symbol, today)
            if agg:
                _save(agg)
                results["aggregated"].append(symbol)
            else:
                logger.warning("no data for %s on %s, skipping", symbol, today)
        except Exception as exc:
            logger.error("failed for %s: %s", symbol, exc, exc_info=True)
            results["errors"].append({"symbol": symbol, "error": str(exc)})

    logger.info("done. success=%d errors=%d", len(results["aggregated"]), len(results["errors"]))
    return results


def _compute_daily(symbol: str, date: str) -> AggregateRecord | None:
    records = db.get_price_history(symbol, hours=24)
    if not records:
        return None

    today_records = [r for r in records if r.get("timestamp", "").startswith(date)]
    if not today_records:
        today_records = records

    today_records.sort(key=lambda r: r.get("timestamp", ""))

    daily_open  = today_records[0]["open"]
    daily_close = today_records[-1]["close"]
    daily_high  = max(r["high"] for r in today_records)
    daily_low   = min(r["low"]  for r in today_records)
    daily_vol   = int(sum(r.get("volume", 0) for r in today_records))

    # VWAP = sum(typical_price * volume) / sum(volume)
    typical_prices = [((r["high"] + r["low"] + r["close"]) / 3) for r in today_records]
    volumes = [r.get("volume", 0) for r in today_records]
    total_vol = sum(volumes)
    vwap = sum(tp * v for tp, v in zip(typical_prices, volumes)) / total_vol if total_vol > 0 else None

    ma20 = _sma(symbol, 20, daily_close)
    ma50 = _sma(symbol, 50, daily_close)

    return AggregateRecord(
        symbol=symbol, date=date,
        open=round(daily_open, 4), high=round(daily_high, 4),
        low=round(daily_low, 4),   close=round(daily_close, 4),
        volume=daily_vol,
        ma20=round(ma20, 4) if ma20 else None,
        ma50=round(ma50, 4) if ma50 else None,
        vwap=round(vwap, 4) if vwap else None,
    )


def _sma(symbol: str, period: int, today_close: float) -> float | None:
    aggs = db.get_aggregates(symbol, days=period + 5)
    closes = [a["close"] for a in aggs if "close" in a]
    closes.append(today_close)
    if len(closes) < period:
        return None
    return mean(closes[-period:])


def _save(agg: AggregateRecord) -> None:
    data = {"open": agg.open, "high": agg.high, "low": agg.low, "close": agg.close, "volume": agg.volume}
    if agg.ma20 is not None: data["ma20"] = agg.ma20
    if agg.ma50 is not None: data["ma50"] = agg.ma50
    if agg.vwap is not None: data["vwap"] = agg.vwap
    db.put_aggregate_record(agg.symbol, agg.date, data)
