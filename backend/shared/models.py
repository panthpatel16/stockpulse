"""
Data models shared across Lambda functions.
Keeping these in the layer so handlers don't duplicate the same dataclasses.
"""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Optional
from datetime import datetime


@dataclass
class PriceRecord:
    symbol:    str
    timestamp: str
    open:      float
    high:      float
    low:       float
    close:     float
    volume:    int

    def to_dynamo_attrs(self) -> dict:
        return {
            "open":   self.open,
            "high":   self.high,
            "low":    self.low,
            "close":  self.close,
            "volume": self.volume,
        }

    def to_api_dict(self) -> dict:
        return asdict(self)


@dataclass
class AggregateRecord:
    symbol:  str
    date:    str
    open:    float
    high:    float
    low:     float
    close:   float
    volume:  int
    ma20:    Optional[float] = None
    ma50:    Optional[float] = None
    vwap:    Optional[float] = None


@dataclass
class StockSummary:
    symbol:       str
    name:         str
    price:        float
    change:       float
    change_pct:   float
    volume:       int
    last_updated: str
    sector:       Optional[str]   = None
    market_cap:   Optional[str]   = None
    high_52w:     Optional[float] = None
    low_52w:      Optional[float] = None


@dataclass
class AlertRecord:
    symbol:       str
    email:        str
    target_price: float
    direction:    str   # "above" or "below"
    created_at:   str   = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    active:       bool  = True
