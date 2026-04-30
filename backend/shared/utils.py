"""
Shared Lambda response helpers and logging setup.
Nothing fancy - just avoids copy-pasting CORS headers into every handler.
"""

from __future__ import annotations
import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

CORS_HEADERS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Content-Type":                 "application/json",
}


def ok(body: Any, status: int = 200) -> dict:
    return {
        "statusCode": status,
        "headers":    CORS_HEADERS,
        "body":       json.dumps(body, default=str),
    }


def error(message: str, status: int = 400) -> dict:
    logger.error("returning %d: %s", status, message)
    return {
        "statusCode": status,
        "headers":    CORS_HEADERS,
        "body":       json.dumps({"error": message}),
    }


def get_path_param(event: dict, name: str) -> str | None:
    return (event.get("pathParameters") or {}).get(name)


def get_query_param(event: dict, name: str, default: Any = None) -> Any:
    return (event.get("queryStringParameters") or {}).get(name, default)


def parse_body(event: dict) -> dict:
    body = event.get("body") or "{}"
    if isinstance(body, str):
        return json.loads(body)
    return body


def setup_logging() -> None:
    logging.basicConfig(
        format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
        level=os.getenv("LOG_LEVEL", "INFO"),
    )
