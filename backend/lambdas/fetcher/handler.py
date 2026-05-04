"""
Fetcher Lambda - handles all API Gateway routes.

Routes based on HTTP method + path. Returns API Gateway proxy format.
Nothing clever here, just reads from DynamoDB and serializes to JSON.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from dynamo_client import DynamoClient
from models import AlertRecord
from utils import setup_logging, ok, error, get_query_param, parse_body

setup_logging()
logger = logging.getLogger(__name__)

STOCKS_TO_TRACK = [s.strip().upper() for s in os.environ.get("STOCKS_TO_TRACK", "AAPL,MSFT,GOOGL,AMZN,NVDA,META,TSLA").split(",")]
db = DynamoClient()

# static metadata - avoids extra API calls for basic info
SYMBOL_METADATA = {
    "AAPL":  {"name": "Apple Inc.",          "sector": "Technology", "market_cap": "2.94T"},
    "MSFT":  {"name": "Microsoft Corp.",     "sector": "Technology", "market_cap": "2.81T"},
    "GOOGL": {"name": "Alphabet Inc.",       "sector": "Technology", "market_cap": "1.73T"},
    "AMZN":  {"name": "Amazon.com Inc.",     "sector": "Consumer",   "market_cap": "1.84T"},
    "NVDA":  {"name": "NVIDIA Corp.",        "sector": "Technology", "market_cap": "1.22T"},
    "META":  {"name": "Meta Platforms Inc.", "sector": "Technology", "market_cap": "1.31T"},
    "TSLA":  {"name": "Tesla Inc.",          "sector": "Automotive", "market_cap": "0.71T"},
    "JPM":   {"name": "JPMorgan Chase",      "sector": "Financials", "market_cap": "0.55T"},
    "GS":    {"name": "Goldman Sachs",       "sector": "Financials", "market_cap": "0.14T"},
    "BAC":   {"name": "Bank of America",     "sector": "Financials", "market_cap": "0.31T"},
}


def lambda_handler(event: dict, context: Any) -> dict:
    method = event.get("httpMethod", "GET")
    path   = event.get("path", "/")
    parts  = [p for p in path.strip("/").split("/") if p]

    logger.info("%s %s", method, path)

    if method == "OPTIONS":
        return ok({})

    if method == "GET" and len(parts) == 1 and parts[0] == "stocks":
        return _list_stocks()

    if method == "GET" and len(parts) == 2:
        return _get_stock(parts[1].upper())

    if method == "GET" and len(parts) == 3 and parts[2] == "history":
        hours = int(get_query_param(event, "hours", 24))
        return _get_history(parts[1].upper(), hours)

    if method == "GET" and len(parts) == 3 and parts[2] == "aggregates":
        days = int(get_query_param(event, "days", 30))
        return _get_aggregates(parts[1].upper(), days)

    if method == "GET" and len(parts) == 3 and parts[2] == "alerts":
        return _get_alerts(parts[1].upper())

    if method == "POST" and len(parts) == 3 and parts[2] == "alerts":
        return _create_alert(parts[1].upper(), parse_body(event))

    return error(f"not found: {method} {path}", 404)


def _list_stocks() -> dict:
    results = []
    for symbol in STOCKS_TO_TRACK:
        latest = db.get_latest_price(symbol)
        meta   = SYMBOL_METADATA.get(symbol, {})
        if latest:
            change, change_pct = _compute_change(symbol, latest["close"])
            results.append({
                "symbol":       symbol,
                "name":         meta.get("name", symbol),
                "sector":       meta.get("sector"),
                "price":        latest["close"],
                "change":       change,
                "change_pct":   change_pct,
                "volume":       latest.get("volume", 0),
                "last_updated": latest.get("timestamp"),
            })
        else:
            results.append({"symbol": symbol, "name": meta.get("name", symbol), "price": None})
    return ok({"stocks": results, "count": len(results)})


def _get_stock(symbol: str) -> dict:
    if symbol not in STOCKS_TO_TRACK:
        return error(f"{symbol} not tracked", 404)
    latest = db.get_latest_price(symbol)
    if not latest:
        return error(f"no data for {symbol}", 404)
    meta = SYMBOL_METADATA.get(symbol, {})
    change, change_pct = _compute_change(symbol, latest["close"])
    return ok({
        "symbol":       symbol,
        "name":         meta.get("name", symbol),
        "sector":       meta.get("sector"),
        "market_cap":   meta.get("market_cap"),
        "price":        latest["close"],
        "open":         latest.get("open"),
        "high":         latest.get("high"),
        "low":          latest.get("low"),
        "volume":       latest.get("volume", 0),
        "change":       change,
        "change_pct":   change_pct,
        "last_updated": latest.get("timestamp"),
    })


def _get_history(symbol: str, hours: int) -> dict:
    history = db.get_price_history(symbol, hours=min(hours, 168))
    return ok({"symbol": symbol, "hours": hours, "count": len(history), "history": history})


def _get_aggregates(symbol: str, days: int) -> dict:
    aggs = db.get_aggregates(symbol, days=min(days, 365))
    return ok({"symbol": symbol, "days": days, "count": len(aggs), "aggregates": aggs})


def _get_alerts(symbol: str) -> dict:
    return ok({"symbol": symbol, "alerts": db.get_alerts(symbol)})


def _create_alert(symbol: str, body: dict) -> dict:
    email        = body.get("email")
    target_price = body.get("target_price")
    direction    = body.get("direction", "above")

    if not email or not target_price:
        return error("email and target_price required", 400)
    if direction not in ("above", "below"):
        return error("direction must be above or below", 400)

    try:
        target_price = float(target_price)
    except (TypeError, ValueError):
        return error("target_price must be a number", 400)

    alert = AlertRecord(symbol=symbol, email=email, target_price=target_price, direction=direction)
    db.put_alert(symbol, email, {
        "target_price": alert.target_price,
        "direction":    alert.direction,
        "created_at":   alert.created_at,
        "active":       alert.active,
    })
    return ok({"message": "alert created", "alert": {
        "symbol": symbol, "email": email, "target_price": target_price, "direction": direction,
    }}, status=201)


def _compute_change(symbol: str, current: float) -> tuple[float, float]:
    history = db.get_price_history(symbol, hours=25)
    if len(history) < 2:
        return 0.0, 0.0
    prev = history[0]["close"]
    if prev == 0:
        return 0.0, 0.0
    change     = round(current - prev, 4)
    change_pct = round((change / prev) * 100, 4)
    return change, change_pct
