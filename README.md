# 📈 Indian Stock Market Terminal

A real-time stock market terminal and trading app for Indian markets, built with Node.js and Zerodha Kite Connect API integration.

## ✨ Features

- **Live Market Data** — 2,500+ Indian stocks & mutual funds via Yahoo Finance + AMFI
- **Real-Time Quotes** — Active tickers update every 2 seconds; full screener refreshes every 30 seconds
- **Market Overview** — Live indices (NIFTY 50, SENSEX, BANK NIFTY, etc.) with trend indicators
- **Stock Analyzer** — Technical indicators (RSI, MACD, Bollinger Bands, SMA/EMA) with interactive charts
- **Stock Screener** — Filter by sector, exchange, price range, and % change
- **Kite Trading Hub** — Zerodha Kite Connect integration with:
  - Live portfolio (holdings, positions, P&L)
  - Buy / Sell order placement
  - Good Till Triggered (GTT) orders with custom buy/sell price conditions
  - Sandbox mode for paper trading without real money
- **Mutual Funds** — Live NAV from AMFI for 1,000+ schemes
- **Dark Glassmorphism UI** — Premium cyberpunk-inspired trading terminal design

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- A Zerodha Kite Connect API key (optional — sandbox mode works without it)

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/stock-market-terminal.git
cd stock-market-terminal
npm install
```

### Kite API Configuration (Optional)

Copy the example config and fill in your credentials:

```bash
cp kite-config.example.json kite-config.json
```

Edit `kite-config.json`:
```json
{
  "apiKey": "YOUR_KITE_API_KEY",
  "apiSecret": "YOUR_KITE_API_SECRET",
  "accessToken": "",
  "sandboxMode": false
}
```

> **Note:** Leave `sandboxMode: true` to use the app in paper-trading mode without a real Kite account.

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🏗 Architecture

| Layer | Tech |
|---|---|
| Backend | Node.js + Express |
| Market Data | Yahoo Finance (`yahoo-finance2`) + AMFI |
| Technical Analysis | `technicalindicators` |
| Kite Trading | Zerodha Kite Connect REST API |
| Frontend | Vanilla HTML/CSS/JS |
| Charts | Chart.js |
| Persistence | Local JSON files |

### Live Data Flow

```
Active UI Symbols ──► POST /api/live-quotes ──► Yahoo Finance (every 2s)
                                                      │
Full Screener ──────► Background Cron ──────────────► Yahoo Finance + AMFI (every 30s)
```

## 📂 Project Structure

```
├── server.js              # Express server, API routes, market cache engine
├── kite-service.js        # Zerodha Kite Connect service + GTT trigger engine
├── kite-config.json       # Your Kite credentials (gitignored)
├── kite-config.example.json
├── public/
│   ├── index.html         # Main SPA shell + all page templates
│   ├── app.js             # Frontend state management + UI logic
│   ├── api.js             # API client wrapper
│   ├── chart-manager.js   # Chart.js integration
│   ├── firebase-manager.js# Firebase integration (optional)
│   └── style.css          # Glassmorphism dark theme
└── package.json
```

## ⚠️ Disclaimer

This app is for **educational and informational purposes only**. It is not financial advice. Always do your own research before making investment decisions.

## 📄 License

MIT
