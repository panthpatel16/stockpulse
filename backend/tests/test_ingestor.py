"""
tests/test_ingestor.py — Unit tests for the ingestor Lambda.
Uses moto to mock DynamoDB without AWS credentials.
"""

import os
import pytest
import boto3
from unittest.mock import patch, MagicMock
from moto import mock_dynamodb

os.environ.setdefault("DYNAMODB_TABLE",    "stockpulse-test")
os.environ.setdefault("ALPHA_VANTAGE_KEY", "demo")
os.environ.setdefault("STOCKS_TO_TRACK",   "AAPL,MSFT")


@mock_dynamodb
def test_put_price_record_writes_to_dynamo():
    """DynamoClient.put_price_record should write a correctly shaped item."""
    # Create the mock table
    ddb = boto3.resource("dynamodb", region_name="us-east-1")
    table = ddb.create_table(
        TableName="stockpulse-test",
        KeySchema=[
            {"AttributeName": "pk", "KeyType": "HASH"},
            {"AttributeName": "sk", "KeyType": "RANGE"},
        ],
        AttributeDefinitions=[
            {"AttributeName": "pk", "AttributeType": "S"},
            {"AttributeName": "sk", "AttributeType": "S"},
        ],
        BillingMode="PAY_PER_REQUEST",
    )

    from dynamo_client import DynamoClient
    client = DynamoClient("stockpulse-test")
    client.put_price_record(
        symbol="AAPL",
        timestamp="2024-11-20T14:35:00Z",
        data={"open": 189.0, "high": 190.1, "low": 188.5, "close": 189.8, "volume": 500000},
    )

    resp = table.get_item(
        Key={"pk": "SYMBOL#AAPL", "sk": "PRICE#2024-11-20T14:35:00Z"}
    )
    item = resp["Item"]
    assert item["symbol"] == "AAPL"
    assert float(item["close"]) == pytest.approx(189.8)
    assert "ttl" in item  # TTL must be set


@mock_dynamodb
def test_get_latest_price_returns_most_recent():
    """get_latest_price should return the record with the highest SK (latest timestamp)."""
    ddb = boto3.resource("dynamodb", region_name="us-east-1")
    ddb.create_table(
        TableName="stockpulse-test",
        KeySchema=[
            {"AttributeName": "pk", "KeyType": "HASH"},
            {"AttributeName": "sk", "KeyType": "RANGE"},
        ],
        AttributeDefinitions=[
            {"AttributeName": "pk", "AttributeType": "S"},
            {"AttributeName": "sk", "AttributeType": "S"},
        ],
        BillingMode="PAY_PER_REQUEST",
    )

    from dynamo_client import DynamoClient
    from decimal import Decimal
    client = DynamoClient("stockpulse-test")
    client.put_price_record("AAPL", "2024-11-20T14:30:00Z", {"close": 188.0, "open": 187.0, "high": 189.0, "low": 187.0, "volume": 400000})
    client.put_price_record("AAPL", "2024-11-20T14:35:00Z", {"close": 189.5, "open": 188.0, "high": 190.0, "low": 188.0, "volume": 500000})

    latest = client.get_latest_price("AAPL")
    assert latest is not None
    assert latest["close"] == pytest.approx(189.5)


def test_response_helpers():
    """ok() and error() should return properly structured API Gateway responses."""
    from utils import ok, error
    import json

    r = ok({"symbol": "AAPL"})
    assert r["statusCode"] == 200
    body = json.loads(r["body"])
    assert body["symbol"] == "AAPL"
    assert "Access-Control-Allow-Origin" in r["headers"]

    err = error("Not found", 404)
    assert err["statusCode"] == 404
    err_body = json.loads(err["body"])
    assert "error" in err_body
