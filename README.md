# StockPulse

Serverless stock data aggregator — Lambda functions pull OHLCV from Alpha Vantage every 5 minutes during market hours, store it in DynamoDB, and serve it through API Gateway to a React dashboard. Runs at $0 when idle.

I built this after getting tired of paying for always-on EC2 instances for a side project that only gets traffic during market hours. The whole thing costs basically nothing — Lambda and DynamoDB free tiers cover all of it unless you're tracking hundreds of symbols with heavy query traffic.

---

## How it works

Four Lambda functions, each with one job:

**ingestor** — fires every 5 min on an EventBridge cron during market hours. Calls Alpha Vantage for each tracked symbol, parses the OHLCV response, writes records to DynamoDB with a 30-day TTL so old 5-min candles auto-expire.

**fetcher** — the API Gateway handler. All the REST routes hit this function. Reads from DynamoDB and returns JSON. Cold starts aren't a problem here since the frontend polls every 30s anyway.

**aggregator** — runs once after market close. Reads the day's 5-min records, computes daily OHLC, VWAP, and 20/50-day moving averages, writes an aggregate record back.

**alerting** — checks price thresholds every 5 min during market hours. If current price crosses a stored target, publishes to SNS. Alert gets marked inactive after firing so you don't get spammed.

---

## Stack

- AWS Lambda (Python 3.12) + EventBridge for the backend
- DynamoDB (single-table, pay-per-request) for storage
- API Gateway REST for the HTTP layer
- SAM for infrastructure-as-code
- React 18 + Vite + Recharts for the frontend
- Alpha Vantage API for market data (free tier)

---

## DynamoDB schema

Single-table design. The access patterns drove the key structure:

```
PK                SK                              Data
SYMBOL#AAPL       PRICE#2024-11-20T14:35:00Z      open, high, low, close, volume, ttl
SYMBOL#AAPL       PRICE#2024-11-20T14:30:00Z      open, high, low, close, volume, ttl
SYMBOL#AAPL       AGG#DAILY#2024-11-20            open, high, low, close, ma20, ma50, vwap
SYMBOL#AAPL       META#INFO                       name, sector, market_cap
ALERT#AAPL        THRESHOLD#you@email.com         target_price, direction, active
```

Range queries like `SK BETWEEN PRICE#2024-11-20 AND PRICE#2024-11-21` are fast because DynamoDB sorts within a partition. A GSI on the date field handles cross-symbol queries by date if you need them.

I originally did this with a relational model (separate tables for symbols, prices, aggregates) and the JOIN overhead was noticeable at even moderate query rates. The single-table approach dropped p99 latency from ~180ms to ~40ms for the history endpoint.

---

## Running locally

You don't need AWS credentials for local dev. There's a FastAPI mock server that generates simulated price data:

```bash
# terminal 1 - backend
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux
pip install -r requirements.txt
python local_server.py
# running at http://localhost:8000
```

```bash
# terminal 2 - frontend
cd frontend
npm install
npm run dev
# running at http://localhost:5173
```

The mock generates prices using geometric Brownian motion so the charts look realistic. API docs at `http://localhost:8000/docs`.

---

## Deploying to AWS

You'll need the AWS CLI and SAM CLI set up, plus an Alpha Vantage API key (free at alphavantage.co).

```bash
cd infrastructure
sam build
sam deploy --guided
```

The guided deploy will ask for your Alpha Vantage key and which symbols to track. It outputs the API Gateway URL — copy that into a `.env` file in `/frontend`:

```
VITE_API_BASE_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com/prod
```

Then build and push the frontend to the S3 bucket SAM created:

```bash
cd frontend
npm run build
aws s3 sync dist/ s3://YOUR_BUCKET_NAME --delete
```

---

## API

```
GET  /stocks                     all tracked symbols, latest prices
GET  /stocks/{symbol}            single symbol detail
GET  /stocks/{symbol}/history    price history, ?hours=24 default
GET  /stocks/{symbol}/aggregates daily OHLC + MAs, ?days=30 default
POST /stocks/{symbol}/alerts     set a price alert
```

Sample response:
```json
{
  "symbol": "AAPL",
  "name": "Apple Inc.",
  "price": 189.42,
  "change": 2.18,
  "change_pct": 1.16,
  "volume": 48291042,
  "last_updated": "2024-11-20T20:00:00Z"
}
```

---

## Cost

Within AWS free tier for personal/light use:

| Service | Free tier limit | Typical usage |
|---|---|---|
| Lambda | 1M invocations/mo | ~8,000/mo (10 symbols, market hours only) |
| DynamoDB | 25GB + 200M req/mo | well under |
| API Gateway | 1M calls/mo | depends on frontend traffic |
| CloudWatch | 5GB logs | fine |

Realistically this runs at $0/month unless you're tracking a lot of symbols or have significant user traffic.

---

## Environment variables

| Name | Used in | Notes |
|---|---|---|
| `ALPHA_VANTAGE_KEY` | ingestor Lambda | get one free at alphavantage.co |
| `DYNAMODB_TABLE` | all Lambdas | set by SAM automatically |
| `STOCKS_TO_TRACK` | ingestor, fetcher | comma-separated, e.g. `AAPL,MSFT,GOOGL` |
| `VITE_API_BASE_URL` | frontend build | API Gateway URL from SAM output |

---

## Project layout

```
stockpulse/
├── infrastructure/
│   ├── template.yaml       SAM template - all AWS resources
│   └── samconfig.toml
├── backend/
│   ├── local_server.py     FastAPI mock for local dev
│   ├── requirements.txt
│   ├── shared/
│   │   ├── dynamo_client.py
│   │   ├── models.py
│   │   └── utils.py
│   ├── lambdas/
│   │   ├── ingestor/handler.py
│   │   ├── fetcher/handler.py
│   │   ├── aggregator/handler.py
│   │   └── alerting/handler.py
│   └── tests/
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Dashboard.jsx
    │   │   └── StockDetail.jsx
    │   ├── components/
    │   │   ├── charts/Charts.jsx
    │   │   ├── Sidebar.jsx
    │   │   └── TopBar.jsx
    │   ├── hooks/
    │   │   ├── useStockList.js
    │   │   ├── useStockDetail.js
    │   │   └── usePolling.js
    │   └── api/
    │       └── stocksApi.js
    └── ...
```

---
