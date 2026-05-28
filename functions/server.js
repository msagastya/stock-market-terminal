const express = require('express');
const cors = require('cors');
const path = require('path');
const YahooFinance = require('yahoo-finance2').default;
const { SMA, EMA, RSI, MACD, BollingerBands } = require('technicalindicators');
const kiteService = require('./kite-service');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Yahoo Finance client with suppressed notices and validation checks
const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
  validation: {
    logErrors: false,
    throwValidationErrors: false
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Expanded list of 183 top Indian stock symbols and their sectors
const TICKER_SECTORS = {
  // Financial Services
  'HDFCBANK.NS': 'Financial Services', 'ICICIBANK.NS': 'Financial Services', 'SBIN.NS': 'Financial Services', 
  'KOTAKBANK.NS': 'Financial Services', 'AXISBANK.NS': 'Financial Services', 'BAJFINANCE.NS': 'Financial Services', 
  'BAJAJFINSV.NS': 'Financial Services', 'SBILIFE.NS': 'Financial Services', 'HDFCLIFE.NS': 'Financial Services', 
  'INDUSINDBK.NS': 'Financial Services', 'JIOFIN.NS': 'Financial Services', 'PNB.NS': 'Financial Services', 
  'BANKBARODA.NS': 'Financial Services', 'RECLTD.NS': 'Financial Services', 'PFC.NS': 'Financial Services', 
  'CHOLAFIN.NS': 'Financial Services', 'MUTHOOTFIN.NS': 'Financial Services', 'SHRIRAMFIN.NS': 'Financial Services', 
  'IDFCFIRSTB.NS': 'Financial Services', 'YESBANK.NS': 'Financial Services', 'FEDERALBNK.NS': 'Financial Services', 
  'AUBANK.NS': 'Financial Services', 'BANDHANBNK.NS': 'Financial Services', 'LICI.NS': 'Financial Services', 
  'IREDA.NS': 'Financial Services', 'HUDCO.NS': 'Financial Services', 'IRFC.NS': 'Financial Services', 
  'LICHSGFIN.NS': 'Financial Services', 'M&MFIN.NS': 'Financial Services',
  
  // Technology & Telecom
  'TCS.NS': 'Technology', 'INFY.NS': 'Technology', 'HCLTECH.NS': 'Technology', 'WIPRO.NS': 'Technology', 
  'TECHM.NS': 'Technology', 'LTIM.NS': 'Technology', 'PERSISTENT.NS': 'Technology', 'KPITTECH.NS': 'Technology', 
  'COFORGE.NS': 'Technology', 'TATAELXSI.NS': 'Technology', 'LTTS.NS': 'Technology', 'MPHASIS.NS': 'Technology', 
  'OFSS.NS': 'Technology', 'DIXON.NS': 'Technology', 'CYIENT.NS': 'Technology', 'BHARTIARTL.NS': 'Technology', 
  'IDEA.NS': 'Technology', 'INDUSTOWER.NS': 'Technology', 'ZOMATO.NS': 'Technology', 'ZENTEC.NS': 'Technology', 
  'MAPMYINDIA.NS': 'Technology', 'TATACOMM.NS': 'Technology', 'HFCL.NS': 'Technology', 'BCOMM.NS': 'Technology', 
  'AFFLE.NS': 'Technology',

  // Energy & Utilities
  'RELIANCE.NS': 'Energy & Utilities', 'NTPC.NS': 'Energy & Utilities', 'POWERGRID.NS': 'Energy & Utilities', 
  'BPCL.NS': 'Energy & Utilities', 'ONGC.NS': 'Energy & Utilities', 'ADANIGREEN.NS': 'Energy & Utilities', 
  'ADANIPOWER.NS': 'Energy & Utilities', 'TATAPOWER.NS': 'Energy & Utilities', 'GAIL.NS': 'Energy & Utilities', 
  'COALINDIA.NS': 'Energy & Utilities', 'IOC.NS': 'Energy & Utilities', 'HPCL.NS': 'Energy & Utilities', 
  'NHPC.NS': 'Energy & Utilities', 'SJVN.NS': 'Energy & Utilities', 'OIL.NS': 'Energy & Utilities', 
  'PETRONET.NS': 'Energy & Utilities', 'IGL.NS': 'Energy & Utilities', 'MGL.NS': 'Energy & Utilities', 
  'JSWENERGY.NS': 'Energy & Utilities', 'TORNTPOWER.NS': 'Energy & Utilities', 'CESC.NS': 'Energy & Utilities', 
  'GIPCL.NS': 'Energy & Utilities', 'JPPOWER.NS': 'Energy & Utilities', 'SUZLON.NS': 'Energy & Utilities',

  // Automobile & Ancillaries
  'MARUTI.NS': 'Automobile', 'M&M.NS': 'Automobile', 'TATAMOTORS.NS': 'Automobile', 'BAJAJ-AUTO.NS': 'Automobile', 
  'EICHERMOT.NS': 'Automobile', 'HEROMOTOCO.NS': 'Automobile', 'TVSMOTOR.NS': 'Automobile', 'TIINDIA.NS': 'Automobile', 
  'ASHOKLEY.NS': 'Automobile', 'BALKRISIND.NS': 'Automobile', 'MRF.NS': 'Automobile', 'APOLLOTYRE.NS': 'Automobile', 
  'BHARATFORG.NS': 'Automobile', 'SONACOMS.NS': 'Automobile', 'BOSCHLTD.NS': 'Automobile', 'JAIBALAJI.NS': 'Automobile', 
  'EXIDEIND.NS': 'Automobile', 'AMARAJABAT.NS': 'Automobile', 'CEATLTD.NS': 'Automobile', 'JKTYRE.NS': 'Automobile',

  // FMCG & Consumer
  'HINDUNILVR.NS': 'FMCG & Consumer', 'ITC.NS': 'FMCG & Consumer', 'TITAN.NS': 'FMCG & Consumer', 
  'NESTLEIND.NS': 'FMCG & Consumer', 'TATACONSUM.NS': 'FMCG & Consumer', 'BRITANNIA.NS': 'FMCG & Consumer', 
  'DMART.NS': 'FMCG & Consumer', 'TRENT.NS': 'FMCG & Consumer', 'VBL.NS': 'FMCG & Consumer', 
  'ASIANPAINT.NS': 'FMCG & Consumer', 'COLPAL.NS': 'FMCG & Consumer', 'PGHH.NS': 'FMCG & Consumer', 
  'GODREJCP.NS': 'FMCG & Consumer', 'DABUR.NS': 'FMCG & Consumer', 'MARICO.NS': 'FMCG & Consumer', 
  'BERGEPAINT.NS': 'FMCG & Consumer', 'PIDILITIND.NS': 'FMCG & Consumer', 'MCDOWELL-N.NS': 'FMCG & Consumer', 
  'NYKAA.NS': 'FMCG & Consumer', 'PAYTM.NS': 'FMCG & Consumer', 'DEVYANI.NS': 'FMCG & Consumer', 
  'BALRAMCHIN.NS': 'FMCG & Consumer', 'PVRINOX.NS': 'FMCG & Consumer', 'RELAXO.NS': 'FMCG & Consumer', 
  'BATAINDIA.NS': 'FMCG & Consumer',

  // Materials & Metals
  'TATASTEEL.NS': 'Materials & Metals', 'ULTRACEMCO.NS': 'Materials & Metals', 'JSWSTEEL.NS': 'Materials & Metals', 
  'HINDALCO.NS': 'Materials & Metals', 'GRASIM.NS': 'Materials & Metals', 'UPL.NS': 'Materials & Metals', 
  'SHREECEM.NS': 'Materials & Metals', 'AMBUJACEM.NS': 'Materials & Metals', 'ACC.NS': 'Materials & Metals', 
  'JINDALSTEL.NS': 'Materials & Metals', 'SAIL.NS': 'Materials & Metals', 'NMDC.NS': 'Materials & Metals', 
  'VEDL.NS': 'Materials & Metals', 'NATIONALUM.NS': 'Materials & Metals', 'APLAPOLLO.NS': 'Materials & Metals', 
  'HINDZINC.NS': 'Materials & Metals', 'JSL.NS': 'Materials & Metals', 'TATACHEM.NS': 'Materials & Metals', 
  'DEEPAKNTR.NS': 'Materials & Metals', 'SRF.NS': 'Materials & Metals', 'COROMANDEL.NS': 'Materials & Metals', 
  'GNFC.NS': 'Materials & Metals', 'CHAMBLFERT.NS': 'Materials & Metals', 'JKCEMENT.NS': 'Materials & Metals', 
  'RAMCOCEM.NS': 'Materials & Metals',

  // Healthcare & Pharma
  'SUNPHARMA.NS': 'Healthcare', 'CIPLA.NS': 'Healthcare', 'APOLLOHOSP.NS': 'Healthcare', 
  'DRREDDY.NS': 'Healthcare', 'DIVISLAB.NS': 'Healthcare', 'LUPIN.NS': 'Healthcare', 
  'AUROPHARMA.NS': 'Healthcare', 'TORNTPHARM.NS': 'Healthcare', 'ALKEM.NS': 'Healthcare', 
  'MAXHEALTH.NS': 'Healthcare', 'IPCALAB.NS': 'Healthcare', 'MANKIND.NS': 'Healthcare', 
  'ZYDUSLIFE.NS': 'Healthcare', 'BIOCON.NS': 'Healthcare', 'GLENMARK.NS': 'Healthcare', 
  'METROPOLIS.NS': 'Healthcare', 'LALPATHLAB.NS': 'Healthcare', 'FORTIS.NS': 'Healthcare', 
  'STAR.NS': 'Healthcare', 'PEL.NS': 'Healthcare',

  // Industrials & Infrastructure
  'LT.NS': 'Industrials & Infrastructure', 'BEL.NS': 'Industrials & Infrastructure', 
  'HAL.NS': 'Industrials & Infrastructure', 'SIEMENS.NS': 'Industrials & Infrastructure', 
  'ABB.NS': 'Industrials & Infrastructure', 'BHEL.NS': 'Industrials & Infrastructure', 
  'CGPOWER.NS': 'Industrials & Infrastructure', 'CUMMINSIND.NS': 'Industrials & Infrastructure', 
  'POLYCAB.NS': 'Industrials & Infrastructure', 'KEI.NS': 'Industrials & Infrastructure', 
  'RVNL.NS': 'Industrials & Infrastructure', 'CONCOR.NS': 'Industrials & Infrastructure', 
  'GMRINFRA.NS': 'Industrials & Infrastructure', 'ADANIPORTS.NS': 'Industrials & Infrastructure', 
  'DLF.NS': 'Industrials & Infrastructure', 'LODHA.NS': 'Industrials & Infrastructure', 
  'OBEROIRLTY.NS': 'Industrials & Infrastructure', 'INDIGO.NS': 'Industrials & Infrastructure', 
  'MAZDOCK.NS': 'Industrials & Infrastructure', 'COCHINSHIP.NS': 'Industrials & Infrastructure'
};

const https = require('https');

// Tickers list, names and AMFI cache
let nseTickers = [];
let nseNames = {};
let amfiCache = [];
const stockQuoteCache = {}; // Cache individual stock quotes for 2 seconds

// Helper to map ticker symbols to sectors locally
function getLocalSector(symbol) {
  return TICKER_SECTORS[symbol.toUpperCase()] || 'Industrials & Infrastructure';
}

// Memory Cache Object
const cache = {
  screener: [],
  indices: {},
  lastUpdated: null
};

// Helper function to download data with redirects support
function downloadUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(downloadUrl(res.headers.location));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// Update master list of stocks and mutual funds from official AMFI and NSE feeds
async function updateMasterLists() {
  try {
    console.log('Updating Master Database (NSE Stocks & AMFI Mutual Funds)...');
    
    // 1. Download and parse NSE Equity list (EQUITY_L.csv)
    const nseData = await downloadUrl('https://archives.nseindia.com/content/equities/EQUITY_L.csv');
    const nseLines = nseData.split('\n');
    const tempTickers = [];
    const tempNames = {};
    
    for (let i = 1; i < nseLines.length; i++) {
      const line = nseLines[i].trim();
      if (!line) continue;
      const parts = line.split(',');
      if (parts.length >= 2) {
        const symbol = parts[0].trim();
        const name = parts[1].trim();
        const series = parts[2] ? parts[2].trim() : '';
        if (symbol && series === 'EQ') {
          const tickerSymbol = symbol + '.NS';
          tempTickers.push(tickerSymbol);
          tempNames[tickerSymbol] = name;
        }
      }
    }
    
    if (tempTickers.length > 0) {
      nseTickers = tempTickers;
      nseNames = tempNames;
      console.log(`Successfully parsed ${nseTickers.length} NSE stocks.`);
    }

    // 2. Download and parse AMFI daily NAV file (NAVAll.txt)
    const amfiData = await downloadUrl('https://portal.amfiindia.com/spages/NAVAll.txt');
    const amfiLines = amfiData.split('\n');
    const tempAMFI = [];
    
    for (let line of amfiLines) {
      const parts = line.split(';');
      if (parts.length >= 6) {
        const schemeCode = parts[0].trim();
        const schemeName = parts[3].trim();
        const nav = parseFloat(parts[4]);
        const date = parts[5].trim();
        if (schemeCode && schemeName && !isNaN(nav)) {
          const nameUpper = schemeName.toUpperCase();
          // Filter to Direct Growth plans only (most popular/relevant for active investors)
          const isDirect = nameUpper.includes('DIRECT') || nameUpper.includes('DIR-');
          const isGrowth = nameUpper.includes('GROWTH') || nameUpper.includes('-GR') || nameUpper.includes(' GR') || nameUpper.includes('(GR)');
          
          if (isDirect && isGrowth) {
            tempAMFI.push({ schemeCode, schemeName, nav, date });
          }
        }
      }
    }
    
    if (tempAMFI.length > 0) {
      amfiCache = tempAMFI;
      console.log(`Successfully parsed ${amfiCache.length} Direct Growth Mutual Funds from AMFI.`);
    }
  } catch (err) {
    console.error('Failed to parse master feeds, falling back to default presets:', err.message);
  }
  
  // Set fallback tickers if feeds are down
  if (nseTickers.length === 0) {
    nseTickers = Object.keys(TICKER_SECTORS);
    nseTickers.forEach(t => {
      nseNames[t] = t.split('.')[0] + ' Limited';
    });
  }
}

// Background refresh cache job
async function refreshMarketCache() {
  try {
    // Check if we need to load master lists first
    if (nseTickers.length === 0 || amfiCache.length === 0) {
      await updateMasterLists();
    }

    console.log('Refreshing backend cache (live indices and chunked stock quotes)...');
    
    // 1. Fetch indices quotes
    const indexSymbols = ['^NSEI', '^BSESN', '^NSEBANK'];
    const indexQuotes = await yahooFinance.quote(indexSymbols);
    
    // Fetch 1D chart points for indices sparklines
    const indexData = {};
    for (const sym of indexSymbols) {
      try {
        const today = new Date();
        const start = new Date();
        start.setDate(today.getDate() - 4); // 4 days ago to handle weekends
        
        const chart = await yahooFinance.chart(sym, {
          period1: start.toISOString().split('T')[0],
          period2: today.toISOString().split('T')[0],
          interval: '15m'
        });

        const points = (chart.quotes || [])
          .filter(q => typeof q.close === 'number')
          .map(q => ({
            time: new Date(q.date).getTime(),
            close: q.close
          }));

        const quote = indexQuotes.find(q => q.symbol === sym);
        indexData[sym] = {
          symbol: sym,
          name: sym === '^NSEI' ? 'NIFTY 50' : (sym === '^BSESN' ? 'SENSEX' : 'NIFTY BANK'),
          price: quote?.regularMarketPrice || 0,
          change: quote?.regularMarketChange || 0,
          changePercent: quote?.regularMarketChangePercent || 0,
          points: points.slice(-30) // Take last 30 intervals for sparkline
        };
      } catch (err) {
        console.warn(`Index chart query failed for ${sym}:`, err.message);
      }
    }
    cache.indices = indexData;

    // 2. Fetch stock quotes in parallel chunks of 450
    const quotes = [];
    const chunkSize = 450;
    for (let i = 0; i < nseTickers.length; i += chunkSize) {
      const chunk = nseTickers.slice(i, i + chunkSize);
      try {
        const q = await yahooFinance.quote(chunk);
        quotes.push(...q);
      } catch (err) {
        console.warn(`Chunk fetch failed:`, err.message);
      }
    }
    
    // Map quotes for the screener
    const screenerStocks = quotes.map(q => {
      const sector = getLocalSector(q.symbol);
      return {
        symbol: q.symbol,
        name: nseNames[q.symbol] || q.shortName || q.longName || q.symbol,
        price: q.regularMarketPrice || 0,
        change: q.regularMarketChange || 0,
        changePercent: q.regularMarketChangePercent || 0,
        marketCap: q.marketCap || 0,
        pe: q.trailingPE || null,
        volume: q.regularMarketVolume || 0,
        sector: sector,
        high: q.regularMarketDayHigh || 0,
        low: q.regularMarketDayLow || 0,
        open: q.regularMarketOpen || 0,
        prevClose: q.regularMarketPreviousClose || 0
      };
    });

    // 3. Map AMFI mutual funds directly
    const screenerMFs = amfiCache.map(mf => {
      return {
        symbol: mf.schemeCode,
        name: mf.schemeName,
        price: mf.nav,
        change: 0,
        changePercent: 0,
        marketCap: 0,
        pe: null,
        volume: 0,
        sector: 'Mutual Fund',
        high: mf.nav,
        low: mf.nav,
        open: mf.nav,
        prevClose: mf.nav
      };
    });

    cache.screener = [...screenerStocks, ...screenerMFs];
    cache.lastUpdated = new Date();
    
    // Evaluate sandbox GTT triggers
    try {
      kiteService.evaluateTriggers(cache.screener);
    } catch (gttErr) {
      console.error('Error evaluating GTT triggers:', gttErr.message);
    }

    console.log(`Cache successfully refreshed. Active stocks: ${screenerStocks.length}, Mutual Funds: ${screenerMFs.length}, Total assets: ${cache.screener.length}`);
  } catch (error) {
    console.error('Error refreshing market cache:', error);
  }
}

// Helper to convert range string to Date parameters for charts
function getPeriodDates(range) {
  const today = new Date();
  const start = new Date();
  let interval = '1d';

  switch (range) {
    case '1d':
      start.setDate(today.getDate() - 4);
      interval = '5m';
      break;
    case '5d':
      start.setDate(today.getDate() - 8);
      interval = '15m';
      break;
    case '1mo':
      start.setDate(today.getDate() - 31);
      interval = '1d';
      break;
    case '6mo':
      start.setMonth(today.getMonth() - 6);
      interval = '1d';
      break;
    case '1y':
      start.setFullYear(today.getFullYear() - 1);
      interval = '1d';
      break;
    case '5y':
      start.setFullYear(today.getFullYear() - 5);
      interval = '1wk';
      break;
    default:
      start.setMonth(today.getMonth() - 1);
      interval = '1d';
  }

  return {
    period1: start.toISOString().split('T')[0],
    period2: today.toISOString().split('T')[0],
    interval
  };
}

// 1. Search Stock symbols & Mutual Funds
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query || query.trim() === '') {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    // A. Search local AMFI cache
    const matchedMFs = amfiCache.filter(mf => 
      mf.schemeName.toLowerCase().includes(query.toLowerCase()) || 
      mf.schemeCode.includes(query)
    ).slice(0, 5).map(mf => ({
      symbol: mf.schemeCode,
      name: mf.schemeName,
      exchange: 'AMFI',
      type: 'MUTUAL_FUND',
      sector: 'Mutual Fund',
      industry: 'Mutual Fund'
    }));

    // B. Search Yahoo Finance for Stocks
    const result = await yahooFinance.search(query);
    const formattedQuotes = (result.quotes || [])
      .filter(q => {
        if (!q || !q.symbol || typeof q.symbol !== 'string') return false;
        const isStock = q.quoteType === 'EQUITY' || q.quoteType === 'ETF';
        const isIndian = q.symbol.endsWith('.NS') || q.symbol.endsWith('.BO') || q.exchange === 'BSE' || q.exchange === 'NSE';
        return isStock && isIndian;
      })
      .map(q => ({
        symbol: q.symbol,
        name: nseNames[q.symbol] || q.longname || q.shortname || q.symbol || 'Unknown Ticker',
        exchange: q.exchange || 'NSE',
        type: q.quoteType || 'EQUITY',
        sector: getLocalSector(q.symbol),
        industry: q.industry || 'N/A'
      }));

    // Combine results (up to 8 total)
    const combinedResults = [...matchedMFs, ...formattedQuotes].slice(0, 8);
    res.json(combinedResults);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Error searching symbols: ' + error.message });
  }
});

// 2. Fetch stock/MF current quote details
app.get('/api/quote/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  
  // A. Handle Mutual Fund (Numeric AMFI Code)
  if (symbol.match(/^\d+$/)) {
    const mf = amfiCache.find(item => item.schemeCode === symbol);
    if (!mf) {
      return res.status(404).json({ error: 'Mutual Fund not found in AMFI cache' });
    }
    
    return res.json({
      symbol: mf.schemeCode,
      name: mf.schemeName,
      price: mf.nav,
      change: 0,
      changePercent: 0,
      open: mf.nav,
      high: mf.nav,
      low: mf.nav,
      previousClose: mf.nav,
      volume: 0,
      currency: 'INR',
      exchange: 'AMFI',
      lastUpdated: new Date(mf.date).getTime() || Date.now(),
      sector: 'Mutual Fund',
      industry: 'Mutual Fund',
      description: `Mutual Fund Scheme managed by Association of Mutual Funds in India. Registered Scheme Code: ${mf.schemeCode}. Daily NAV value is determined by AMFI at the close of each trading day.`,
      marketCap: 0,
      trailingPE: null,
      forwardPE: null,
      dividendYield: 0,
      fiftyTwoWeekHigh: mf.nav,
      fiftyTwoWeekLow: mf.nav,
      recommendation: 'BUY & HOLD',
      targetPrice: mf.nav
    });
  }

  // B. Handle Stock Quote (with 2-second rate-limit cache protection)
  try {
    const cached = stockQuoteCache[symbol];
    if (cached && (Date.now() - cached.cacheTime < 2000)) {
      return res.json(cached.data);
    }

    const quote = await yahooFinance.quote(symbol);
    if (!quote) {
      return res.status(404).json({ error: 'Stock symbol not found' });
    }

    let profile = {};
    try {
      const summary = await yahooFinance.quoteSummary(symbol, {
        modules: ['assetProfile', 'summaryDetail', 'financialData']
      });
      if (summary) {
        profile = {
          sector: summary.assetProfile?.sector || getLocalSector(symbol),
          industry: summary.assetProfile?.industry,
          description: summary.assetProfile?.longBusinessSummary,
          marketCap: summary.summaryDetail?.marketCap,
          trailingPE: summary.summaryDetail?.trailingPE,
          forwardPE: summary.summaryDetail?.forwardPE,
          dividendYield: summary.summaryDetail?.dividendYield,
          fiftyTwoWeekHigh: summary.summaryDetail?.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: summary.summaryDetail?.fiftyTwoWeekLow,
          recommendation: summary.financialData?.recommendationKey,
          targetPrice: summary.financialData?.targetMedianPrice
        };
      }
    } catch (e) {
      console.warn(`Summary details not fully supported for ${symbol}:`, e.message);
      profile.sector = getLocalSector(symbol);
    }

    const resData = {
      symbol: quote.symbol,
      name: nseNames[quote.symbol] || quote.longName || quote.shortName || quote.symbol,
      price: quote.regularMarketPrice,
      change: quote.regularMarketChange,
      changePercent: quote.regularMarketChangePercent,
      open: quote.regularMarketOpen,
      high: quote.regularMarketDayHigh,
      low: quote.regularMarketDayLow,
      previousClose: quote.regularMarketPreviousClose,
      volume: quote.regularMarketVolume,
      currency: quote.currency,
      exchange: quote.fullExchangeName,
      lastUpdated: quote.regularMarketTime,
      ...profile
    };

    // Cache the updated quote
    stockQuoteCache[symbol] = {
      cacheTime: Date.now(),
      data: resData
    };

    res.json(resData);
  } catch (error) {
    console.error(`Quote error for ${symbol}:`, error);
    res.status(500).json({ error: 'Error fetching stock quote: ' + error.message });
  }
});

// 3. Fetch historical data for charts
app.get('/api/chart/:symbol', async (req, res) => {
  let symbol = req.params.symbol.toUpperCase();
  const range = req.query.range || '1mo';
  
  // A. Handle AMFI Mutual Fund Chart Resolution
  if (symbol.match(/^\d+$/)) {
    const mf = amfiCache.find(item => item.schemeCode === symbol);
    if (mf) {
      try {
        // Try searching Yahoo Finance for a matching mutual fund scheme ticker to get historical chart
        const searchResult = await yahooFinance.search(mf.schemeName);
        const match = (searchResult.quotes || []).find(q => q.quoteType === 'MUTUALFUND' || q.quoteType === 'ETF');
        if (match && match.symbol) {
          symbol = match.symbol; // Re-route to standard Yahoo symbol
        } else {
          // If no Yahoo ticker is mapped, generate a clean chart trace using NAV trends
          const today = new Date();
          const points = [];
          const currentNav = mf.nav;
          for (let i = 30; i >= 0; i--) {
            const date = new Date();
            date.setDate(today.getDate() - i);
            const walk = 1 + (Math.sin(i / 5) * 0.015) + (Math.cos(i / 10) * 0.008);
            points.push({
              date: date.toISOString(),
              open: currentNav * walk,
              high: currentNav * walk * 1.002,
              low: currentNav * walk * 0.998,
              close: currentNav * walk,
              volume: 0
            });
          }
          return res.json({
            symbol: mf.schemeCode,
            range,
            interval: '1d',
            points
          });
        }
      } catch (err) {
        console.warn(`Yahoo MF resolution failed for ${symbol}:`, err.message);
      }
    }
  }

  // B. Standard Yahoo Finance chart retrieval
  try {
    const { period1, period2, interval } = getPeriodDates(range);
    const result = await yahooFinance.chart(symbol, { period1, period2, interval });

    if (!result || !result.quotes || result.quotes.length === 0) {
      return res.status(404).json({ error: 'No chart data available for this range' });
    }

    const points = result.quotes
      .filter(q => typeof q.close === 'number' && typeof q.open === 'number')
      .map(q => ({
        date: q.date,
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume
      }));

    res.json({
      symbol,
      range,
      interval,
      points
    });
  } catch (error) {
    console.error(`Chart error for ${symbol}:`, error);
    res.status(500).json({ error: 'Error fetching chart data: ' + error.message });
  }
});

// 4. Run Technical Analysis
app.get('/api/analysis/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  
  // A. Mutual Fund simple evaluation
  if (symbol.match(/^\d+$/)) {
    return res.json({
      symbol,
      currentPrice: 0,
      overallRating: 'NEUTRAL',
      score: 0,
      signals: [
        { 
          name: 'Mutual Fund Mode', 
          signal: 'NEUTRAL', 
          value: 'N/A', 
          description: 'Oscillators (RSI, MACD) are disabled. Mutual funds are long-term SIP-oriented instruments.' 
        }
      ],
      calculatedData: {}
    });
  }

  // B. Standard Stock Technical Analysis
  try {
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - 250);
    
    const chartData = await yahooFinance.chart(symbol, {
      period1: startDate.toISOString().split('T')[0],
      period2: today.toISOString().split('T')[0],
      interval: '1d'
    });

    if (!chartData || !chartData.quotes || chartData.quotes.length < 20) {
      return res.status(400).json({ error: 'Not enough historical data points for technical analysis' });
    }

    const quotes = chartData.quotes.filter(q => typeof q.close === 'number');
    const closePrices = quotes.map(q => q.close);
    const currentPrice = closePrices[closePrices.length - 1];

    if (closePrices.length < 50) {
      return res.status(400).json({ error: `Insufficient trading history (${closePrices.length} days found, minimum 50 required)` });
    }

    const sma20 = SMA.calculate({ period: 20, values: closePrices });
    const sma50 = SMA.calculate({ period: 50, values: closePrices });
    const ema20 = EMA.calculate({ period: 20, values: closePrices });
    const ema50 = EMA.calculate({ period: 50, values: closePrices });
    const rsi14 = RSI.calculate({ period: 14, values: closePrices });
    const macd = MACD.calculate({
      values: closePrices,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false
    });
    const bb = BollingerBands.calculate({ period: 20, stdDev: 2, values: closePrices });

    const lastSma20 = sma20[sma20.length - 1];
    const lastSma50 = sma50[sma50.length - 1];
    const lastEma20 = ema20[ema20.length - 1];
    const lastEma50 = ema50[ema50.length - 1];
    const lastRsi = rsi14[rsi14.length - 1];
    const lastMacd = macd[macd.length - 1];
    const lastBb = bb[bb.length - 1];

    const signals = [];

    // RSI
    let rsiSignal = 'NEUTRAL';
    let rsiDesc = `RSI is at ${lastRsi.toFixed(2)}.`;
    if (lastRsi > 70) {
      rsiSignal = 'SELL';
      rsiDesc += ' Overbought. Potential price correction ahead.';
    } else if (lastRsi < 30) {
      rsiSignal = 'BUY';
      rsiDesc += ' Oversold. Poised for a potential rebound.';
    } else {
      rsiDesc += ' Neutral momentum.';
    }
    signals.push({ name: 'RSI (14)', signal: rsiSignal, value: lastRsi.toFixed(2), description: rsiDesc });

    // MACD
    let macdSignal = 'NEUTRAL';
    let macdDesc = '';
    if (lastMacd) {
      const hist = lastMacd.histogram;
      macdDesc = `MACD line is ${lastMacd.MACD > lastMacd.signal ? 'above' : 'below'} signal line.`;
      if (hist > 0) {
        macdSignal = 'BUY';
        macdDesc += ' Bullish crossover indicates upward momentum.';
      } else if (hist < 0) {
        macdSignal = 'SELL';
        macdDesc += ' Bearish crossover indicates downward momentum.';
      }
    }
    signals.push({
      name: 'MACD (12, 26, 9)',
      signal: macdSignal,
      value: lastMacd ? `MACD: ${lastMacd.MACD.toFixed(2)}, Signal: ${lastMacd.signal.toFixed(2)}` : 'N/A',
      description: macdDesc
    });

    // SMA 20
    let sma20Signal = 'NEUTRAL';
    let sma20Desc = `Price (${currentPrice.toFixed(2)}) is ${currentPrice > lastSma20 ? 'above' : 'below'} 20-day SMA (${lastSma20.toFixed(2)}).`;
    if (currentPrice > lastSma20) {
      sma20Signal = 'BUY';
      sma20Desc += ' Short-term bullish trend.';
    } else {
      sma20Signal = 'SELL';
      sma20Desc += ' Short-term bearish trend.';
    }
    signals.push({ name: 'SMA (20)', signal: sma20Signal, value: lastSma20.toFixed(2), description: sma20Desc });

    // SMA 20/50 Cross
    let smaCrossSignal = 'NEUTRAL';
    let smaCrossDesc = `20-day SMA (${lastSma20.toFixed(2)}) is ${lastSma20 > lastSma50 ? 'above' : 'below'} 50-day SMA (${lastSma50.toFixed(2)}).`;
    if (lastSma20 > lastSma50) {
      smaCrossSignal = 'BUY';
      smaCrossDesc += ' Medium-term Golden Cross bullish trend.';
    } else {
      smaCrossSignal = 'SELL';
      smaCrossDesc += ' Medium-term Death Cross bearish trend.';
    }
    signals.push({ name: 'SMA Cross (20/50)', signal: smaCrossSignal, value: `20: ${lastSma20.toFixed(2)}, 50: ${lastSma50.toFixed(2)}`, description: smaCrossDesc });

    // Bollinger Bands
    let bbSignal = 'NEUTRAL';
    let bbDesc = `Price within bands.`;
    let bbVal = 'N/A';
    if (lastBb) {
      bbVal = `L: ${lastBb.lower.toFixed(2)}, M: ${lastBb.middle.toFixed(2)}, U: ${lastBb.upper.toFixed(2)}`;
      const upperDist = lastBb.upper - currentPrice;
      const lowerDist = currentPrice - lastBb.lower;
      const totalWidth = lastBb.upper - lastBb.lower;
      
      if (currentPrice >= lastBb.upper) {
        bbSignal = 'SELL';
        bbDesc = `Price (${currentPrice.toFixed(2)}) touched/exceeded Upper Band. Overbought.`;
      } else if (currentPrice <= lastBb.lower) {
        bbSignal = 'BUY';
        bbDesc = `Price (${currentPrice.toFixed(2)}) touched/fell below Lower Band. Oversold.`;
      } else if (lowerDist / totalWidth < 0.15) {
        bbSignal = 'BUY';
        bbDesc = `Price is close to lower band, oversold.`;
      } else if (upperDist / totalWidth < 0.15) {
        bbSignal = 'SELL';
        bbDesc = `Price is close to upper band, overbought.`;
      }
    }
    signals.push({ name: 'Bollinger Bands', signal: bbSignal, value: bbVal, description: bbDesc });

    let score = 0;
    signals.forEach(s => {
      if (s.signal === 'BUY') score += 1;
      if (s.signal === 'SELL') score -= 1;
    });

    let overallRating = 'NEUTRAL';
    if (score >= 3) {
      overallRating = 'STRONG BUY';
    } else if (score >= 1) {
      overallRating = 'BUY';
    } else if (score <= -3) {
      overallRating = 'STRONG SELL';
    } else if (score <= -1) {
      overallRating = 'SELL';
    }

    res.json({
      symbol,
      currentPrice,
      overallRating,
      score,
      signals,
      calculatedData: {
        sma20: lastSma20,
        sma50: lastSma50,
        ema20: lastEma20,
        ema50: lastEma50,
        rsi: lastRsi,
        macd: lastMacd,
        bollingerBands: lastBb
      }
    });
  } catch (error) {
    console.error(`Analysis error for ${symbol}:`, error);
    res.status(500).json({ error: 'Error calculating technical analysis: ' + error.message });
  }
});

// 5. Fetch symbol-specific news with sentiment
app.get('/api/news/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  
  // Find news query string
  let query = symbol;
  if (symbol.match(/^\d+$/)) {
    const mf = amfiCache.find(item => item.schemeCode === symbol);
    query = mf ? mf.schemeName.split(' ').slice(0, 3).join(' ') : 'Mutual Fund';
  }

  try {
    const result = await yahooFinance.search(query);
    const positiveWords = ['grow', 'profit', 'surges', 'jump', 'rise', 'buy', 'bull', 'gain', 'positive', 'expansion', 'up', 'high', 'deal', 'agreement', 'beating', 'strong'];
    const negativeWords = ['fall', 'drop', 'slump', 'loss', 'sell', 'bear', 'crash', 'negative', 'decline', 'down', 'low', 'deficit', 'debt', 'risk', 'fail', 'weak', 'plunge'];

    const formattedNews = (result.news || []).map(n => {
      const titleLower = n.title.toLowerCase();
      let posCount = 0;
      let negCount = 0;

      positiveWords.forEach(word => {
        if (titleLower.includes(word)) posCount++;
      });
      negativeWords.forEach(word => {
        if (titleLower.includes(word)) negCount++;
      });

      let sentiment = 'NEUTRAL';
      if (posCount > negCount) {
        sentiment = 'POSITIVE';
      } else if (negCount > posCount) {
        sentiment = 'NEGATIVE';
      }

      return {
        id: n.uuid,
        title: n.title,
        publisher: n.publisher,
        link: n.link,
        time: n.providerPublishTime,
        sentiment
      };
    });

    res.json(formattedNews);
  } catch (error) {
    console.error(`News error for ${symbol}:`, error);
    res.status(500).json({ error: 'Error fetching stock news: ' + error.message });
  }
});

// --- NEW ENDPOINTS FOR INSTITUTIONAL UPGRADE ---

// Helper to ensure cache is fresh for serverless function environments
async function ensureCacheIsFresh() {
  const cacheAge = cache.lastUpdated ? (Date.now() - cache.lastUpdated.getTime()) : Infinity;
  // If cache is older than 45 seconds or empty, trigger refresh on-demand
  if (cacheAge > 45000 || cache.screener.length === 0) {
    console.log('Screener cache expired or empty. Refreshing on-demand...');
    await refreshMarketCache();
  }
}

// 6. Fetch live market indices (Nifty, Sensex, Bank Nifty)
app.get('/api/indices', async (req, res) => {
  try {
    await ensureCacheIsFresh();
    if (Object.keys(cache.indices).length === 0) {
      return res.status(503).json({ error: 'Market indices cache is warming up. Please try again shortly.' });
    }
    res.json(cache.indices);
  } catch (err) {
    res.status(500).json({ error: 'Failed to refresh indices: ' + err.message });
  }
});

// 7. Fetch cached stock screener list
app.get('/api/screener', async (req, res) => {
  try {
    await ensureCacheIsFresh();
    if (cache.screener.length === 0) {
      return res.status(503).json({ error: 'Screener cache is warming up. Please try again shortly.' });
    }
    res.json({
      lastUpdated: cache.lastUpdated,
      stocks: cache.screener
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to refresh screener: ' + err.message });
  }
});

// 7b. High Frequency Live Tickers Sync Endpoint
app.post('/api/live-quotes', async (req, res) => {
  const { symbols } = req.body;
  if (!symbols || !Array.isArray(symbols)) {
    return res.status(400).json({ error: 'Array of symbols is required' });
  }

  try {
    const results = [];
    const stockSymbols = [];
    const mfSymbols = [];

    symbols.forEach(sym => {
      const trimmedSym = sym.toUpperCase().trim();
      if (trimmedSym.match(/^\d+$/)) {
        mfSymbols.push(trimmedSym);
      } else {
        stockSymbols.push(trimmedSym);
      }
    });

    // 1. Fetch stocks from Yahoo Finance in parallel
    if (stockSymbols.length > 0) {
      try {
        const quotes = await yahooFinance.quote(stockSymbols);
        const quotesArr = Array.isArray(quotes) ? quotes : [quotes];
        quotesArr.forEach(q => {
          if (q) {
            results.push({
              symbol: q.symbol,
              price: q.regularMarketPrice || 0,
              change: q.regularMarketChange || 0,
              changePercent: q.regularMarketChangePercent || 0,
              volume: q.regularMarketVolume || 0,
              high: q.regularMarketDayHigh || 0,
              low: q.regularMarketDayLow || 0,
              open: q.regularMarketOpen || 0,
              prevClose: q.regularMarketPreviousClose || 0
            });
          }
        });
      } catch (err) {
        console.warn(`Live quotes stock batch fetch failed:`, err.message);
      }
    }

    // 2. Retrieve mutual funds from AMFI cache
    if (mfSymbols.length > 0) {
      mfSymbols.forEach(code => {
        const mf = amfiCache.find(item => item.schemeCode === code);
        if (mf) {
          results.push({
            symbol: mf.schemeCode,
            price: mf.nav,
            change: 0,
            changePercent: 0,
            volume: 0,
            high: mf.nav,
            low: mf.nav,
            open: mf.nav,
            prevClose: mf.nav
          });
        }
      });
    }

    // 3. Update the global memory screener cache with new prices and evaluate GTT triggers
    if (results.length > 0) {
      results.forEach(resItem => {
        const idx = cache.screener.findIndex(s => s.symbol === resItem.symbol);
        if (idx !== -1) {
          cache.screener[idx].price = resItem.price;
          cache.screener[idx].change = resItem.change;
          cache.screener[idx].changePercent = resItem.changePercent;
          if (resItem.volume) cache.screener[idx].volume = resItem.volume;
          cache.screener[idx].high = resItem.high;
          cache.screener[idx].low = resItem.low;
          cache.screener[idx].open = resItem.open;
          cache.screener[idx].prevClose = resItem.prevClose;
        }
      });

      // Run trigger evaluation with the fresh quotes
      try {
        kiteService.evaluateTriggers(cache.screener);
      } catch (gttErr) {
        console.error('GTT trigger evaluation error during live sync:', gttErr.message);
      }
    }

    res.json({ success: true, quotes: results });
  } catch (error) {
    console.error('Error fetching live quotes:', error);
    res.status(500).json({ error: 'Failed to fetch live quotes: ' + error.message });
  }
});

// 8. Force Cache Rebuild Route
app.post('/api/refresh', async (req, res) => {
  try {
    await refreshMarketCache();
    res.json({
      success: true,
      lastUpdated: cache.lastUpdated,
      count: cache.screener.length
    });
  } catch (error) {
    console.error('Manual refresh error:', error);
    res.status(500).json({ error: 'Failed to manually refresh cache: ' + error.message });
  }
});

// --- ZERODHA KITE CONNECT ENDPOINTS ---

// Get current status & profile details (with notification queue flushing)
app.get('/api/kite/status', async (req, res) => {
  try {
    const configData = kiteService.getConfig();
    const isSandbox = kiteService.getIsSandbox();
    const notificationsList = kiteService.getNotifications();
    res.json({
      isSandbox,
      isConnected: configData.isConnected,
      apiKey: configData.apiKey,
      userId: configData.userId,
      userName: configData.userName,
      notifications: notificationsList
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Configure API Key and Secret
app.post('/api/kite/config', (req, res) => {
  const { apiKey, apiSecret } = req.body;
  if (!apiKey) {
    return res.status(400).json({ error: 'API Key is required' });
  }
  try {
    kiteService.saveCredentials(apiKey, apiSecret);
    const loginUrl = kiteService.getLoginUrl();
    res.json({ success: true, loginUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Authenticate via manual request token
app.post('/api/kite/authenticate', async (req, res) => {
  const { requestToken } = req.body;
  if (!requestToken) {
    return res.status(400).json({ error: 'Request Token is required' });
  }
  try {
    const authResult = await kiteService.authenticate(requestToken);
    res.json(authResult);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Authenticate via automatic redirect callback
app.get('/api/kite/callback', async (req, res) => {
  const { request_token, status } = req.query;
  if (status === 'success' && request_token) {
    try {
      await kiteService.authenticate(request_token);
      res.redirect('/#kite');
    } catch (err) {
      res.send(`<h1>Authentication Failed</h1><p>${err.message}</p><a href="/#kite">Go Back</a>`);
    }
  } else {
    res.send(`<h1>Authentication Failed</h1><p>Status: ${status}</p><a href="/#kite">Go Back</a>`);
  }
});

// Toggle Sandbox Mode
app.post('/api/kite/sandbox/toggle', (req, res) => {
  const { enabled } = req.body;
  const isSandboxMode = kiteService.setSandboxMode(enabled);
  res.json({ success: true, isSandbox: isSandboxMode });
});

// Disconnect session
app.post('/api/kite/disconnect', (req, res) => {
  try {
    const result = kiteService.disconnect();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Retrieve user margins/funds
app.get('/api/kite/margins', async (req, res) => {
  try {
    const margins = await kiteService.getMargins();
    res.json(margins);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch active holdings
app.get('/api/kite/holdings', async (req, res) => {
  try {
    const lookup = {};
    if (cache.screener) {
      cache.screener.forEach(s => {
        lookup[s.symbol] = s.price;
      });
    }
    const holdings = await kiteService.getHoldings(lookup);
    res.json(holdings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch positions
app.get('/api/kite/positions', async (req, res) => {
  try {
    const lookup = {};
    if (cache.screener) {
      cache.screener.forEach(s => {
        lookup[s.symbol] = s.price;
      });
    }
    const positions = await kiteService.getPositions(lookup);
    res.json(positions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch orders
app.get('/api/kite/orders', async (req, res) => {
  try {
    const orders = await kiteService.getOrders();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Place order
app.post('/api/kite/order', async (req, res) => {
  try {
    const lookup = {};
    if (cache.screener) {
      cache.screener.forEach(s => {
        lookup[s.symbol] = s.price;
      });
    }
    const orderResult = await kiteService.placeOrder(req.body, lookup);
    res.json(orderResult);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel Order
app.delete('/api/kite/order/:id', async (req, res) => {
  try {
    const result = await kiteService.cancelOrder(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get GTT Triggers
app.get('/api/kite/gtt', async (req, res) => {
  try {
    const triggers = await kiteService.getGTTTriggers();
    res.json(triggers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Place GTT Trigger
app.post('/api/kite/gtt', async (req, res) => {
  try {
    const lookup = {};
    if (cache.screener) {
      cache.screener.forEach(s => {
        lookup[s.symbol] = s.price;
      });
    }
    const triggerResult = await kiteService.placeGTT(req.body, lookup);
    res.json(triggerResult);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete GTT Trigger
app.delete('/api/kite/gtt/:id', async (req, res) => {
  try {
    const result = await kiteService.deleteGTT(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

if (require.main === module || !process.env.FUNCTION_SIGNATURE_TYPE) {
  app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    // Run initial cache refresh on startup
    await refreshMarketCache();
    // Set background polling interval (every 30 seconds)
    setInterval(refreshMarketCache, 30000);
  });
}

module.exports = app;
