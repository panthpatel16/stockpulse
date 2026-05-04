"""
local_server.py — FastAPI mock server for local frontend development.

Serves realistic simulated stock data without requiring AWS credentials
or an Alpha Vantage API key. Run with:

    pip install -r requirements.txt
    python local_server.py

API available at http://localhost:8000
Docs at http://localhost:8000/docs
"""

from __future__ import annotations

import math
import random
from datetime import datetime, timezone, timedelta

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="StockPulse Local Mock API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Seed data ─────────────────────────────────────────────────────────────────
STOCKS = {
    "AAPL":  {"name": "Apple Inc.",          "sector": "Technology",  "base": 189.0,  "market_cap": "2.94T"},
    "MSFT":  {"name": "Microsoft Corp.",     "sector": "Technology",  "base": 374.0,  "market_cap": "2.81T"},
    "GOOGL": {"name": "Alphabet Inc.",       "sector": "Technology",  "base": 140.0,  "market_cap": "1.73T"},
    "AMZN":  {"name": "Amazon.com Inc.",     "sector": "Consumer",    "base": 187.0,  "market_cap": "1.84T"},
    "NVDA":  {"name": "NVIDIA Corp.",        "sector": "Technology",  "base": 496.0,  "market_cap": "1.22T"},
    "META":  {"name": "Meta Platforms Inc.", "sector": "Technology",  "base": 503.0,  "market_cap": "1.31T"},
    "TSLA":  {"name": "Tesla Inc.",          "sector": "Automotive",  "base": 227.0,  "market_cap": "0.71T"},
    "JPM":   {"name": "JPMorgan Chase",      "sector": "Financials",  "base": 200.0,  "market_cap": "0.55T"},
    "GS":    {"name": "Goldman Sachs",       "sector": "Financials",  "base": 494.0,  "market_cap": "0.14T"},
    "BAC":   {"name": "Bank of America",     "sector": "Financials",  "base": 39.0,   "market_cap": "0.31T"},
}

rng = random.Random(42)


def _simulate_price(symbol: str, offset_minutes: int = 0) -> float:
    """Generate a realistic price using geometric Brownian motion."""
    base    = STOCKS[symbol]["base"]
    seed    = hash(symbol) + offset_minutes
    rng2    = random.Random(seed)
    drift   = 0.0001
    sigma   = 0.002
    t       = offset_minutes / 390  # normalize to trading day
    return round(base * math.exp(drift * t + sigma * rng2.gauss(0, 1)), 2)


def _make_candle(symbol: str, ts: datetime, idx: int) -> dict:
    close  = _simulate_price(symbol, idx)
    spread = close * 0.003
    return {
        "symbol":    symbol,
        "timestamp": ts.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "open":      round(close - rng.uniform(-spread, spread), 2),
        "high":      round(close + rng.uniform(0, spread * 2), 2),
        "low":       round(close - rng.uniform(0, spread * 2), 2),
        "close":     close,
        "volume":    rng.randint(50_000, 800_000),
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/api/stocks")
def list_stocks():
    stocks = []
    for symbol, meta in STOCKS.items():
        price      = _simulate_price(symbol, 0)
        prev_price = _simulate_price(symbol, -390)
        change     = round(price - prev_price, 2)
        change_pct = round((change / prev_price) * 100, 2)
        stocks.append({
            "symbol":      symbol,
            "name":        meta["name"],
            "sector":      meta["sector"],
            "price":       price,
            "change":      change,
            "change_pct":  change_pct,
            "volume":      rng.randint(10_000_000, 80_000_000),
            "market_cap":  meta["market_cap"],
            "last_updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        })
    return {"stocks": stocks, "count": len(stocks)}


@app.get("/api/stocks/{symbol}")
def get_stock(symbol: str):
    symbol = symbol.upper()
    if symbol not in STOCKS:
        raise HTTPException(404, f"Symbol {symbol} not tracked")
    meta       = STOCKS[symbol]
    price      = _simulate_price(symbol, 0)
    prev_price = _simulate_price(symbol, -390)
    change     = round(price - prev_price, 2)
    change_pct = round((change / prev_price) * 100, 2)
    return {
        "symbol":       symbol,
        "name":         meta["name"],
        "sector":       meta["sector"],
        "market_cap":   meta["market_cap"],
        "price":        price,
        "open":         _simulate_price(symbol, -380),
        "high":         round(price * 1.012, 2),
        "low":          round(price * 0.988, 2),
        "volume":       rng.randint(10_000_000, 80_000_000),
        "change":       change,
        "change_pct":   change_pct,
        "high_52w":     round(price * 1.18, 2),
        "low_52w":      round(price * 0.82, 2),
        "last_updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


@app.get("/api/stocks/{symbol}/history")
def get_history(symbol: str, hours: int = 24):
    symbol = symbol.upper()
    if symbol not in STOCKS:
        raise HTTPException(404, detail=f"{symbol} not found")
    now     = datetime.now(timezone.utc)
    candles = []
    total_candles = min(hours * 12, 500)
    for i in range(total_candles):
        ts = now - timedelta(minutes=5 * (total_candles - i))
        candles.append(_make_candle(symbol, ts, i))
    return {"symbol": symbol, "hours": hours, "count": len(candles), "history": candles}


@app.get("/api/stocks/{symbol}/aggregates")
def get_aggregates(symbol: str, days: int = 30):
    symbol = symbol.upper()
    if symbol not in STOCKS:
        raise HTTPException(404, detail=f"{symbol} not found")
    now  = datetime.now(timezone.utc)
    aggs = []
    closes = []
    for i in range(days):
        dt     = now - timedelta(days=days - i)
        close  = _simulate_price(symbol, i * 5)
        spread = close * 0.015
        closes.append(close)
        ma20 = round(sum(closes[-20:]) / min(len(closes), 20), 2)
        ma50 = round(sum(closes[-50:]) / min(len(closes), 50), 2)
        aggs.append({
            "symbol":  symbol,
            "date":    dt.strftime("%Y-%m-%d"),
            "open":    round(close + rng.uniform(-spread, spread), 2),
            "high":    round(close + abs(rng.gauss(0, spread)), 2),
            "low":     round(close - abs(rng.gauss(0, spread)), 2),
            "close":   close,
            "volume":  rng.randint(20_000_000, 100_000_000),
            "ma20":    ma20,
            "ma50":    ma50,
            "vwap":    round(close * 1.001, 2),
        })
    return {"symbol": symbol, "days": days, "count": len(aggs), "aggregates": aggs}


@app.get("/api/stocks/{symbol}/alerts")
def get_alerts(symbol: str):
    return {"symbol": symbol.upper(), "alerts": []}


class AlertRequest(BaseModel):
    email:        str
    target_price: float
    direction:    str = "above"


@app.post("/api/stocks/{symbol}/alerts", status_code=201)
def create_alert(symbol: str, body: AlertRequest):
    return {
        "message": "Alert created",
        "alert": {"symbol": symbol.upper(), **body.dict()},
    }


if __name__ == "__main__":
    print("\n  StockPulse local mock API")
    print("  http://localhost:8000")
    print("  http://localhost:8000/docs\n")
    uvicorn.run("local_server:app", host="0.0.0.0", port=8000, reload=True)
