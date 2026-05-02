"""
Alerting Lambda - runs every 5 minutes during market hours.

Checks stored price alerts against current DynamoDB prices.
If a threshold is crossed, fires an SNS notification and marks
the alert inactive so it doesn't keep firing.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import boto3

from dynamo_client import DynamoClient
from utils import setup_logging

setup_logging()
logger = logging.getLogger(__name__)

STOCKS_TO_TRACK  = [s.strip().upper() for s in os.environ.get("STOCKS_TO_TRACK", "AAPL,MSFT").split(",")]
ALERTS_TOPIC_ARN = os.environ.get("ALERTS_TOPIC_ARN", "")

db  = DynamoClient()
sns = boto3.client("sns")


def lambda_handler(event: dict, context: Any) -> dict:
    triggered = []
    checked   = 0

    for symbol in STOCKS_TO_TRACK:
        alerts = db.get_alerts(symbol)
        if not alerts:
            continue

        latest = db.get_latest_price(symbol)
        if not latest:
            continue

        current_price = latest["close"]
        checked += len(alerts)

        for alert in alerts:
            if not alert.get("active", True):
                continue

            target = float(alert["target_price"])
            direction = alert.get("direction", "above")
            email = alert.get("email", "")

            crossed = (
                (direction == "above" and current_price >= target) or
                (direction == "below" and current_price <= target)
            )

            if crossed:
                _notify(symbol, email, current_price, target, direction)
                db.put_alert(symbol, email, {
                    "target_price":    target,
                    "direction":       direction,
                    "active":          False,
                    "triggered_at":    latest["timestamp"],
                    "triggered_price": current_price,
                })
                triggered.append({"symbol": symbol, "email": email, "price": current_price, "target": target})
                logger.info("alert fired: %s %s $%.2f vs target $%.2f", symbol, direction, current_price, target)

    logger.info("checked=%d triggered=%d", checked, len(triggered))
    return {"checked": checked, "triggered": len(triggered), "alerts": triggered}


def _notify(symbol: str, email: str, price: float, target: float, direction: str) -> None:
    if not ALERTS_TOPIC_ARN:
        logger.warning("ALERTS_TOPIC_ARN not set, skipping SNS")
        return

    word = "risen above" if direction == "above" else "fallen below"
    msg = (
        f"StockPulse: {symbol} has {word} your target.\n\n"
        f"Current price: ${price:.2f}\n"
        f"Target: ${target:.2f}\n"
    )
    try:
        sns.publish(TopicArn=ALERTS_TOPIC_ARN, Subject=f"StockPulse alert: {symbol}", Message=msg)
    except Exception as e:
        logger.error("SNS publish failed for %s: %s", symbol, e)
