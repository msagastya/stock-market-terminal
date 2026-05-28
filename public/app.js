// app.js - Main client application logic using ES Modules
import * as api from './api.js';
import { ChartManager, renderSparkline } from './chart-manager.js';
import { firebaseManager, getSavedFirebaseConfig, saveFirebaseConfig, clearFirebaseConfig } from './firebase-manager.js';

// Application State
const state = {
  currentSymbol: 'RELIANCE.NS',
  currentRange: '1mo',
  watchlist: JSON.parse(localStorage.getItem('watchlist')) || ['RELIANCE.NS', 'TCS.NS', 'INFY.NS'],
  portfolio: JSON.parse(localStorage.getItem('portfolio')) || [],
  quotesCache: {}, // Keep track of latest quote details
  currentAnalysis: null,
  screenerData: [], // Store list of 70 cached stocks
  screenerSort: { column: 'marketCap', direction: 'desc' },
  activePage: 'market-page',
  firebaseConnected: false,
  user: null,
  activeIndicators: {
    sma20: false,
    sma50: false,
    bb: false
  },
  kite: {
    isSandbox: true,
    isConnected: false,
    apiKey: '',
    userId: '',
    userName: 'Kite User',
    margins: null,
    holdings: [],
    positions: [],
    orders: [],
    gtt: [],
    activeTab: 'kite-tab-holdings'
  }
};

// Heuristic sentence-level summarizer for short, impactful descriptions
function shortenDescription(text) {
  if (!text) return 'No business description available for this ticker.';
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (!sentences || sentences.length <= 2) return text;
  return sentences.slice(0, 2).map(s => s.trim()).join(' ');
}

// Markdown-to-HTML parser for clean chatbot formatting
function parseMarkdown(text) {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;br\s*\/?&gt;/gi, '<br/>'); // restore break tags

  // Bold: **text** -> <strong>text</strong>
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic: *text* -> <em>text</em>
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Bullets: • text -> Bullet block
  html = html.replace(/•\s*(.*?)(<br\/>|\n|$)/g, '<div style="margin-left: 12px; margin-top: 4px; display: flex; gap: 6px;"><span>•</span><span>$1</span></div>');
  // Action headings
  html = html.replace(/(WHAT TO DO|WHAT NOT TO DO|CAUTION):/g, '<span style="font-weight:bold; letter-spacing:0.03em; color:var(--color-warning);">$1:</span>');
  // Line breaks
  html = html.replace(/\n/g, '<br/>');
  return html;
}

// Initialize Chart Manager
const chartManager = new ChartManager('stock-chart');

// DOM Elements Reference Map
const elements = {
  // Navigation sidebar items
  navItems: document.querySelectorAll('.nav-item'),
  pageSections: document.querySelectorAll('.page-section'),
  syncStatusDot: document.getElementById('sync-status-dot'),
  syncStatusText: document.getElementById('sync-status-text'),

  // Header
  searchInput: document.getElementById('search-input'),
  searchSuggestions: document.getElementById('search-suggestions'),
  searchForm: document.getElementById('search-form'),
  btnQuickWatchlist: document.getElementById('btn-quick-watchlist'),
  btnLiveSync: document.getElementById('btn-live-sync'),

  // PAGE 1: Market Overview
  niftyPrice: document.getElementById('nifty-price'),
  niftyChange: document.getElementById('nifty-change'),
  niftySparkline: document.getElementById('nifty-sparkline'),
  sensexPrice: document.getElementById('sensex-price'),
  sensexChange: document.getElementById('sensex-change'),
  sensexSparkline: document.getElementById('sensex-sparkline'),
  niftybankPrice: document.getElementById('niftybank-price'),
  niftybankChange: document.getElementById('niftybank-change'),
  niftybankSparkline: document.getElementById('niftybank-sparkline'),
  topGainersList: document.getElementById('top-gainers-list'),
  topLosersList: document.getElementById('top-losers-list'),
  generalNewsContainer: document.getElementById('general-news-container'),
  marketHealthPointer: document.getElementById('market-health-pointer'),
  marketHealthText: document.getElementById('market-health-text'),
  marketHealthSub: document.getElementById('market-health-sub'),
  sidebarWatchlistContainer: document.getElementById('sidebar-watchlist-container'),

  // PAGE 2: Stock Analyzer
  stockName: document.getElementById('stock-name'),
  stockSymbol: document.getElementById('stock-symbol'),
  stockPrice: document.getElementById('stock-price'),
  stockChange: document.getElementById('stock-change'),
  stockExchange: document.getElementById('stock-exchange'),
  stockSector: document.getElementById('stock-sector'),
  stockIndustry: document.getElementById('stock-industry'),
  stockDescription: document.getElementById('stock-description'),
  btnWatchlistToggle: document.getElementById('btn-watchlist-toggle'),
  btnGoToMote: document.getElementById('btn-go-to-mote'),
  lastUpdatedText: document.getElementById('last-updated-text'),
  timeframeButtons: document.querySelectorAll('.timeframe-btn'),
  indicatorButtons: document.querySelectorAll('.indicator-btn'),
  metricOpen: document.getElementById('metric-open'),
  metricHigh: document.getElementById('metric-high'),
  metricLow: document.getElementById('metric-low'),
  metricVolume: document.getElementById('metric-volume'),
  metricMcap: document.getElementById('metric-mcap'),
  metricPe: document.getElementById('metric-pe'),
  metric52wHigh: document.getElementById('metric-52w-high'),
  metric52wLow: document.getElementById('metric-52w-low'),
  metricForwardPe: document.getElementById('metric-forward-pe'),
  metricDividend: document.getElementById('metric-dividend'),
  metricTargetPrice: document.getElementById('metric-target-price'),
  metricRecommendation: document.getElementById('metric-recommendation'),
  taRatingText: document.getElementById('ta-rating-text'),
  taRatingSub: document.getElementById('ta-rating-sub'),
  taMeterFill: document.getElementById('ta-meter-fill'),
  taSignalsList: document.getElementById('ta-signals-list'),
  aiVerdictRating: document.getElementById('ai-verdict-rating'),
  aiVerdictSummaryText: document.getElementById('ai-verdict-summary-text'),
  aiVerdictDoList: document.getElementById('ai-verdict-do-list'),
  aiVerdictDontList: document.getElementById('ai-verdict-dont-list'),
  aiVerdictDisclaimerText: document.getElementById('ai-verdict-disclaimer-text'),
  portfolioForm: document.getElementById('portfolio-form'),
  portfolioSymbol: document.getElementById('portfolio-symbol'),
  portfolioShares: document.getElementById('portfolio-shares'),
  portfolioPrice: document.getElementById('portfolio-price'),
  portfolioTotalInvested: document.getElementById('portfolio-total-invested'),
  portfolioCurrentValue: document.getElementById('portfolio-current-value'),
  portfolioTotalProfit: document.getElementById('portfolio-total-profit'),
  portfolioHoldingsList: document.getElementById('portfolio-holdings-list'),
  newsContainer: document.getElementById('news-container'),

  // PAGE 3: Market Screener
  filterSector: document.getElementById('filter-sector'),
  filterCap: document.getElementById('filter-cap'),
  filterPe: document.getElementById('filter-pe'),
  filterChange: document.getElementById('filter-change'),
  screenerSearch: document.getElementById('screener-search'),
  screenerResultsCount: document.getElementById('screener-results-count'),
  screenerLastUpdated: document.getElementById('screener-last-updated'),
  screenerResultsBody: document.getElementById('screener-results-body'),
  screenerHeaders: document.querySelectorAll('.screener-table th.sortable'),

  // PAGE 4: Sentiment & Chatbot
  sentimentCircle: document.getElementById('sentiment-circle'),
  sentimentRatioPct: document.getElementById('sentiment-ratio-pct'),
  sentimentOverallLabel: document.getElementById('sentiment-overall-label'),
  sentimentRatioText: document.getElementById('sentiment-ratio-text'),
  sentimentPosCount: document.getElementById('sentiment-pos-count'),
  sentimentNegCount: document.getElementById('sentiment-neg-count'),
  sentimentTotalCount: document.getElementById('sentiment-total-count'),
  wordCloudContainer: document.getElementById('word-cloud-container'),
  sentimentNewsFeed: document.getElementById('sentiment-news-feed'),
  chatActiveStock: document.getElementById('chat-active-stock'),
  chatbotMessagesContainer: document.getElementById('chatbot-messages-container'),
  chatbotInputForm: document.getElementById('chatbot-input-form'),
  chatbotUserInput: document.getElementById('chatbot-user-input'),
  chatQuickBtns: document.querySelectorAll('.chat-quick-btn'),

  // PAGE 5: Economic Mote
  moteActiveSymbol: document.getElementById('mote-active-symbol'),
  moteStarsDisplay: document.getElementById('mote-stars-display'),
  moteScoreBadge: document.getElementById('mote-score-badge'),
  moteCheckboxes: document.querySelectorAll('.mote-checkbox'),
  moteNotes: document.getElementById('mote-notes'),
  btnSaveMote: document.getElementById('btn-save-mote'),

  // PAGE 6: Settings
  settingsSyncStatusBadge: document.getElementById('settings-sync-status-badge'),
  settingsSyncStatusDesc: document.getElementById('settings-sync-status-desc'),
  settingsFirebaseForm: document.getElementById('settings-firebase-form'),
  btnClearSettings: document.getElementById('btn-clear-settings'),
  fbApiKey: document.getElementById('fb-apiKey'),
  fbAuthDomain: document.getElementById('fb-authDomain'),
  fbProjectId: document.getElementById('fb-projectId'),
  fbStorageBucket: document.getElementById('fb-storageBucket'),
  fbAppId: document.getElementById('fb-appId'),
  settingsApiForm: document.getElementById('settings-api-form'),
  settingsApiUrl: document.getElementById('settings-api-url'),

  // Utilities
  loadingOverlay: document.getElementById('loading-overlay'),
  errorMessage: document.getElementById('error-message'),

  // ZERODHA KITE ELEMENTS
  kitePage: document.getElementById('kite-page'),
  btnToggleKiteConfig: document.getElementById('btn-toggle-kite-config'),
  btnDisconnectKite: document.getElementById('btn-disconnect-kite'),
  kiteConfigPanel: document.getElementById('kite-config-panel'),
  kiteApiKey: document.getElementById('kite-api-key'),
  kiteApiSecret: document.getElementById('kite-api-secret'),
  kiteSandboxCheckbox: document.getElementById('kite-sandbox-checkbox'),
  btnSaveKiteConfig: document.getElementById('btn-save-kite-config'),
  kiteRequestTokenInput: document.getElementById('kite-request-token-input'),
  btnSubmitRequestToken: document.getElementById('btn-submit-request-token'),
  kiteConnectionPulse: document.getElementById('kite-connection-pulse'),
  kiteConnectionBadge: document.getElementById('kite-connection-badge'),
  kiteConnectionDesc: document.getElementById('kite-connection-desc'),
  
  // Summary Cards
  kiteMarginAvailable: document.getElementById('kite-margin-available'),
  kitePortfolioInvested: document.getElementById('kite-portfolio-invested'),
  kitePortfolioValue: document.getElementById('kite-portfolio-value'),
  kiteMarginUsed: document.getElementById('kite-margin-used'),
  kiteTotalPnl: document.getElementById('kite-total-pnl'),
  kiteDayPnl: document.getElementById('kite-day-pnl'),
  
  // Tab content and buttons
  tradingTabBtns: document.querySelectorAll('.trading-tab-btn'),
  tradingTabContents: document.querySelectorAll('.trading-tab-content'),
  btnCreateGttShortcut: document.getElementById('btn-create-gtt-shortcut'),
  
  // Tab tables
  kiteHoldingsTbody: document.getElementById('kite-holdings-tbody'),
  kitePositionsTbody: document.getElementById('kite-positions-tbody'),
  kiteOrdersTbody: document.getElementById('kite-orders-tbody'),
  kiteGttTbody: document.getElementById('kite-gtt-tbody'),
  
  // GTT Modal
  gttModal: document.getElementById('gtt-modal'),
  btnCloseGttModal: document.getElementById('btn-close-gtt-modal'),
  gttModalForm: document.getElementById('gtt-modal-form'),
  gttSearchInput: document.getElementById('gtt-search-input'),
  gttSearchSuggestions: document.getElementById('gtt-search-suggestions'),
  gttTransactionType: document.getElementById('gtt-transaction-type'),
  gttTriggerType: document.getElementById('gtt-trigger-type'),
  gttTriggerPrice: document.getElementById('gtt-trigger-price'),
  gttOrderPrice: document.getElementById('gtt-order-price'),
  gttOcoFields: document.getElementById('gtt-oco-fields'),
  gttSlTriggerPrice: document.getElementById('gtt-sl-trigger-price'),
  gttSlOrderPrice: document.getElementById('gtt-sl-order-price'),
  gttQuantity: document.getElementById('gtt-quantity'),
  gttProduct: document.getElementById('gtt-product'),
  kiteToastContainer: document.getElementById('kite-toast-container'),

  // Analyzer Trading Tabs
  btnTradingViewLocal: document.getElementById('btn-trading-view-local'),
  btnTradingViewKite: document.getElementById('btn-trading-view-kite'),
  btnTradingViewGtt: document.getElementById('btn-trading-view-gtt'),
  kiteOrderForm: document.getElementById('kite-order-form'),
  kiteGttForm: document.getElementById('kite-gtt-form'),

  // Analyzer Kite Order Inputs
  analyzerKiteTransaction: document.getElementById('analyzer-kite-transaction'),
  analyzerKiteType: document.getElementById('analyzer-kite-type'),
  analyzerKiteQty: document.getElementById('analyzer-kite-qty'),
  analyzerKitePrice: document.getElementById('analyzer-kite-price'),
  
  // Analyzer Kite GTT Inputs
  analyzerGttTransaction: document.getElementById('analyzer-gtt-transaction'),
  analyzerGttType: document.getElementById('analyzer-gtt-type'),
  analyzerGttTriggerPrice: document.getElementById('analyzer-gtt-trigger-price'),
  analyzerGttOrderPrice: document.getElementById('analyzer-gtt-order-price'),
  analyzerGttOcoFields: document.getElementById('analyzer-gtt-oco-fields'),
  analyzerGttSlTriggerPrice: document.getElementById('analyzer-gtt-sl-trigger-price'),
  analyzerGttSlOrderPrice: document.getElementById('analyzer-gtt-sl-order-price'),
  analyzerGttQty: document.getElementById('analyzer-gtt-qty')
};

// Formats large numbers for financial reporting (Lakhs, Crores, Trillions)
function formatLargeNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return 'N/A';
  if (num >= 1e12) return `₹${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e7) return `₹${(num / 1e7).toFixed(2)}Cr`; // Crore (10M)
  if (num >= 1e5) return `₹${(num / 1e5).toFixed(2)}L`;  // Lakh (100k)
  return `₹${num.toLocaleString('en-IN')}`;
}

// Show/Hide page loaders
function showLoader(show) {
  if (elements.loadingOverlay) {
    elements.loadingOverlay.classList.toggle('hidden', !show);
  }
}

// Toast notification for user feedback
function displayError(msg, isSuccess = false) {
  if (elements.errorMessage) {
    elements.errorMessage.textContent = msg;
    elements.errorMessage.classList.remove('hidden');
    elements.errorMessage.style.backgroundColor = isSuccess ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)';
    setTimeout(() => {
      elements.errorMessage.classList.add('hidden');
    }, 5000);
  }
}

// Local storage saving fallbacks
function saveWatchlistLocally() {
  localStorage.setItem('watchlist', JSON.stringify(state.watchlist));
  if (state.firebaseConnected) {
    firebaseManager.saveWatchlist(state.watchlist);
  }
}

function savePortfolioLocally() {
  localStorage.setItem('portfolio', JSON.stringify(state.portfolio));
  if (state.firebaseConnected) {
    firebaseManager.savePortfolio(state.portfolio);
  }
}

// Update Add/Remove watchlist button
function updateWatchlistBtnUI() {
  if (!elements.btnWatchlistToggle) return;
  const isWatched = state.watchlist.includes(state.currentSymbol);
  elements.btnWatchlistToggle.innerHTML = isWatched 
    ? `<span class="icon">★</span> Remove from Watchlist`
    : `<span class="icon">☆</span> Add to Watchlist`;
  elements.btnWatchlistToggle.classList.toggle('active', isWatched);
}

// Tab navigation routing logic
function setupNavigation() {
  elements.navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetPageId = item.getAttribute('data-target');
      navigateToPage(targetPageId);
    });
  });
}

function navigateToPage(pageId) {
  elements.pageSections.forEach(section => {
    if (section.id === pageId) {
      section.classList.remove('hidden');
    } else {
      section.classList.add('hidden');
    }
  });

  elements.navItems.forEach(item => {
    if (item.getAttribute('data-target') === pageId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  state.activePage = pageId;

  // Render/refresh target sections on view focus
  if (pageId === 'market-page') {
    refreshMarketOverview();
  } else if (pageId === 'screener-page') {
    refreshScreenerTable();
  } else if (pageId === 'sentiment-page') {
    refreshSentimentPage();
  } else if (pageId === 'mote-page') {
    refreshMotePage();
  } else if (pageId === 'kite-page') {
    refreshKiteTerminalData();
  } else if (pageId === 'analyzer-page') {
    if (chartManager && chartManager.chart) {
      chartManager.chart.resize();
    }
  }
}

// -------------------------------------------------------------
// PAGE 1: MARKET OVERVIEW
// -------------------------------------------------------------
async function refreshIndices() {
  try {
    const indices = await api.getIndices();
    
    // Nifty 50
    if (indices['^NSEI']) {
      const idx = indices['^NSEI'];
      elements.niftyPrice.textContent = idx.price.toLocaleString('en-IN', { minimumFractionDigits: 2 });
      const isUp = idx.change >= 0;
      elements.niftyChange.className = isUp ? 'index-change text-positive' : 'index-change text-negative';
      elements.niftyChange.textContent = `${isUp ? '▲' : '▼'} ${isUp ? '+' : ''}${idx.change.toFixed(2)} (${isUp ? '+' : ''}${idx.changePercent.toFixed(2)}%)`;
      if (idx.points && idx.points.length > 0) {
        renderSparkline(elements.niftySparkline, idx.points.map(p => p.close), isUp);
      }
    }

    // Sensex
    if (indices['^BSESN']) {
      const idx = indices['^BSESN'];
      elements.sensexPrice.textContent = idx.price.toLocaleString('en-IN', { minimumFractionDigits: 2 });
      const isUp = idx.change >= 0;
      elements.sensexChange.className = isUp ? 'index-change text-positive' : 'index-change text-negative';
      elements.sensexChange.textContent = `${isUp ? '▲' : '▼'} ${isUp ? '+' : ''}${idx.change.toFixed(2)} (${isUp ? '+' : ''}${idx.changePercent.toFixed(2)}%)`;
      if (idx.points && idx.points.length > 0) {
        renderSparkline(elements.sensexSparkline, idx.points.map(p => p.close), isUp);
      }
    }

    // Bank Nifty
    if (indices['^NSEBANK']) {
      const idx = indices['^NSEBANK'];
      elements.niftybankPrice.textContent = idx.price.toLocaleString('en-IN', { minimumFractionDigits: 2 });
      const isUp = idx.change >= 0;
      elements.niftybankChange.className = isUp ? 'index-change text-positive' : 'index-change text-negative';
      elements.niftybankChange.textContent = `${isUp ? '▲' : '▼'} ${isUp ? '+' : ''}${idx.change.toFixed(2)} (${isUp ? '+' : ''}${idx.changePercent.toFixed(2)}%)`;
      if (idx.points && idx.points.length > 0) {
        renderSparkline(elements.niftybankSparkline, idx.points.map(p => p.close), isUp);
      }
    }
  } catch (err) {
    console.error("Error refreshing indices:", err);
  }
}

async function refreshMarketOverview() {
  await refreshIndices();
  await loadScreenerData(); // Make sure cached 70 stock quotes are available
  
  // Calculate Market Health and Movers
  if (state.screenerData && state.screenerData.length > 0) {
    const total = state.screenerData.length;
    const gainers = state.screenerData.filter(s => s.changePercent > 0);
    const gCount = gainers.length;
    
    // Percentage advancing (Bullish indicator)
    const bullishPct = Math.round((gCount / total) * 100);
    elements.marketHealthPointer.style.left = `${bullishPct}%`;
    elements.marketHealthSub.textContent = `${gCount} of ${total} stocks advancing today`;
    
    let healthLabel = 'NEUTRAL';
    let healthClass = 'text-neutral';
    if (bullishPct >= 65) {
      healthLabel = 'BULLISH';
      healthClass = 'text-positive';
    } else if (bullishPct >= 80) {
      healthLabel = 'STRONG BULLISH';
      healthClass = 'text-positive';
    } else if (bullishPct <= 35) {
      healthLabel = 'BEARISH';
      healthClass = 'text-negative';
    } else if (bullishPct <= 20) {
      healthLabel = 'STRONG BEARISH';
      healthClass = 'text-negative';
    }
    
    elements.marketHealthText.textContent = healthLabel;
    elements.marketHealthText.className = `ta-rating-text font-bold ${healthClass}`;

    // Fill Gainers & Losers Tables
    const sortedGainers = [...state.screenerData].sort((a, b) => b.changePercent - a.changePercent).slice(0, 5);
    const sortedLosers = [...state.screenerData].sort((a, b) => a.changePercent - b.changePercent).slice(0, 5);

    elements.topGainersList.innerHTML = sortedGainers.map(s => `
      <tr class="cursor-pointer hover-accent" data-symbol="${s.symbol}">
        <td class="font-bold">${s.symbol}</td>
        <td>₹${s.price.toFixed(2)}</td>
        <td class="text-positive">+${s.changePercent.toFixed(2)}%</td>
      </tr>
    `).join('');

    elements.topLosersList.innerHTML = sortedLosers.map(s => `
      <tr class="cursor-pointer hover-accent" data-symbol="${s.symbol}">
        <td class="font-bold">${s.symbol}</td>
        <td>₹${s.price.toFixed(2)}</td>
        <td class="text-negative">${s.changePercent.toFixed(2)}%</td>
      </tr>
    `).join('');

    // Click handler to load analyzer
    [...elements.topGainersList.querySelectorAll('tr'), ...elements.topLosersList.querySelectorAll('tr')].forEach(tr => {
      tr.addEventListener('click', () => {
        const sym = tr.getAttribute('data-symbol');
        loadStock(sym);
        navigateToPage('analyzer-page');
      });
    });
  }

  // Refresh Sidebar Watchlist Quote summaries
  refreshSidebarWatchlist();
}

async function refreshSidebarWatchlist(useCacheOnly = false) {
  if (state.watchlist.length === 0) {
    elements.sidebarWatchlistContainer.innerHTML = '<div class="empty-state">Watchlist is empty. Search a ticker to add.</div>';
    return;
  }

  const listContainer = elements.sidebarWatchlistContainer;
  const allCached = state.watchlist.every(sym => state.quotesCache[sym]);
  
  let quotes = [];
  if (useCacheOnly && allCached) {
    quotes = state.watchlist.map(sym => state.quotesCache[sym]);
  } else {
    try {
      const res = await api.getLiveQuotes(state.watchlist);
      const liveQuotes = res.quotes || [];
      liveQuotes.forEach(q => {
        const screenItem = state.screenerData?.find(s => s.symbol === q.symbol);
        q.name = screenItem?.name || state.quotesCache[q.symbol]?.name || q.symbol;
        state.quotesCache[q.symbol] = q;
      });
      
      // Ensure all watchlist items exist in quotesCache
      state.watchlist.forEach(sym => {
        if (!state.quotesCache[sym]) {
          state.quotesCache[sym] = { symbol: sym, name: sym, price: 0, changePercent: 0 };
        }
      });
      quotes = state.watchlist.map(sym => state.quotesCache[sym]);
    } catch (err) {
      console.error('Error batch loading watchlist:', err);
      quotes = state.watchlist.map(sym => state.quotesCache[sym] || { symbol: sym, name: sym, price: null, changePercent: null });
    }
  }

  listContainer.innerHTML = '';
  quotes.forEach(quote => {
    if (!quote) return;
    const card = document.createElement('div');
    card.className = `watchlist-card ${state.currentSymbol === quote.symbol ? 'active' : ''}`;
    
    const isUp = quote.changePercent >= 0;
    const priceText = quote.price !== null && quote.price !== undefined ? `₹${quote.price.toFixed(2)}` : 'N/A';
    const pctText = quote.changePercent !== null && quote.changePercent !== undefined 
      ? `${isUp ? '+' : ''}${quote.changePercent.toFixed(2)}%` 
      : '';
    const colorClass = isUp ? 'text-positive' : 'text-negative';

    card.innerHTML = `
      <div class="watchlist-info">
        <div class="watchlist-symbol">${quote.symbol}</div>
        <div class="watchlist-name">${quote.name || quote.symbol}</div>
      </div>
      <div class="watchlist-price-block">
        <div class="watchlist-price">${priceText}</div>
        <div class="watchlist-pct ${colorClass}">${pctText}</div>
      </div>
      <button class="watchlist-delete-btn" data-symbol="${quote.symbol}">×</button>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('watchlist-delete-btn')) {
        e.stopPropagation();
        const symToDelete = e.target.getAttribute('data-symbol');
        state.watchlist = state.watchlist.filter(s => s !== symToDelete);
        saveWatchlistLocally();
        refreshSidebarWatchlist();
        updateWatchlistBtnUI();
        return;
      }
      loadStock(quote.symbol);
      navigateToPage('analyzer-page');
    });
    listContainer.appendChild(card);
  });
}

// -------------------------------------------------------------
// PAGE 2: STOCK ANALYZER & PORTFOLIO
// -------------------------------------------------------------
async function loadStock(symbol, silent = false) {
  if (!silent) showLoader(true);
  state.currentSymbol = symbol;
  
  if (elements.portfolioSymbol) {
    elements.portfolioSymbol.value = symbol;
  }
  
  // Set active stock in chat panel title
  if (elements.chatActiveStock) {
    elements.chatActiveStock.textContent = symbol;
  }

  try {
    // 1. Fetch stock details
    const quote = await api.getStockQuote(symbol);
    state.quotesCache[symbol] = quote;

    elements.stockName.textContent = quote.name;
    elements.stockSymbol.textContent = quote.symbol;
    elements.stockPrice.textContent = `₹${quote.price.toFixed(2)}`;

    const isUp = quote.change >= 0;
    elements.stockChange.className = `stock-change ${isUp ? 'positive' : 'negative'}`;
    elements.stockChange.textContent = `${isUp ? '▲' : '▼'} ₹${Math.abs(quote.change).toFixed(2)} (${isUp ? '+' : ''}${quote.changePercent.toFixed(2)}%)`;

    elements.stockExchange.textContent = quote.exchange || 'NSE';
    elements.stockSector.textContent = quote.sector || 'N/A';
    elements.stockIndustry.textContent = quote.industry || 'N/A';
    elements.stockDescription.textContent = shortenDescription(quote.description);

    // Populate Key Statistics Grid
    elements.metricOpen.textContent = quote.open ? `₹${quote.open.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : `₹${quote.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    elements.metricHigh.textContent = quote.high ? `₹${quote.high.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'N/A';
    elements.metricLow.textContent = quote.low ? `₹${quote.low.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'N/A';
    elements.metricVolume.textContent = quote.volume ? quote.volume.toLocaleString('en-IN') : 'N/A';
    elements.metricMcap.textContent = formatLargeNumber(quote.marketCap);
    elements.metricPe.textContent = quote.trailingPE ? quote.trailingPE.toFixed(2) : 'N/A';
    elements.metric52wHigh.textContent = quote.fiftyTwoWeekHigh ? `₹${quote.fiftyTwoWeekHigh.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'N/A';
    elements.metric52wLow.textContent = quote.fiftyTwoWeekLow ? `₹${quote.fiftyTwoWeekLow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'N/A';
    elements.metricForwardPe.textContent = quote.forwardPE ? quote.forwardPE.toFixed(2) : 'N/A';
    elements.metricDividend.textContent = quote.dividendYield ? (quote.dividendYield < 1 ? `${(quote.dividendYield * 100).toFixed(2)}%` : `${quote.dividendYield.toFixed(2)}%`) : 'N/A';
    elements.metricTargetPrice.textContent = quote.targetPrice ? `₹${quote.targetPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'N/A';
    elements.metricRecommendation.textContent = quote.recommendation ? quote.recommendation.toUpperCase().replace(/_/g, ' ') : 'N/A';

    updateWatchlistBtnUI();

    // Auto populate portfolio form buy price
    if (elements.portfolioPrice) {
      elements.portfolioPrice.value = quote.price.toFixed(2);
    }

    if (elements.lastUpdatedText) {
      const date = quote.lastUpdated ? new Date(quote.lastUpdated) : new Date();
      elements.lastUpdatedText.textContent = `Last active tick: ${date.toLocaleTimeString()}`;
    }

    // 2. Fetch Chart Data
    await loadChartData();

    // 3. Fetch Technical Indicator ratings
    await loadTechnicalAnalysis();

    // 3.5. Update AI Executive Verdict
    updateAiVerdict(quote, state.currentAnalysis);

    // 4. Fetch Stock news
    await loadStockNews();

    // Refresh Portfolio simulator calculations
    await refreshPortfolio();

  } catch (error) {
    console.error('Error loading stock:', error);
    if (!silent) {
      displayError(`Error loading stock ${symbol}: ${error.message}`);
    }
  } finally {
    if (!silent) showLoader(false);
  }
}

async function loadChartData() {
  try {
    const chartData = await api.getHistoricalData(state.currentSymbol, state.currentRange);
    const points = chartData.points;
    const currentPrice = points[points.length - 1]?.close || 0;
    const startPrice = points[0]?.close || 0;
    chartManager.render(chartData, currentPrice >= startPrice);
  } catch (e) {
    console.error('Error loading chart:', e);
    displayError('Historical price chart query failed');
  }
}

async function loadTechnicalAnalysis() {
  try {
    const analysis = await api.getTechnicalAnalysis(state.currentSymbol);
    state.currentAnalysis = analysis;
    elements.taRatingText.textContent = analysis.overallRating;
    elements.taRatingSub.textContent = `Score: ${analysis.score > 0 ? '+' : ''}${analysis.score} / +5 indicators`;
    
    // Meter position (-5 is left/0%, 0 is center/50%, +5 is right/100%)
    const pct = ((analysis.score + 5) / 10) * 100;
    elements.taMeterFill.style.left = `${pct}%`;

    let ratingColorClass = 'text-neutral';
    if (analysis.overallRating.includes('BUY')) {
      ratingColorClass = 'text-positive';
    } else if (analysis.overallRating.includes('SELL')) {
      ratingColorClass = 'text-negative';
    }
    elements.taRatingText.className = `ta-rating-text font-bold ${ratingColorClass}`;

    // Render detailed signals breakdown
    elements.taSignalsList.innerHTML = analysis.signals.map(s => {
      let badgeClass = 'badge-neutral';
      if (s.signal === 'BUY') badgeClass = 'badge-positive';
      if (s.signal === 'SELL') badgeClass = 'badge-negative';
      return `
        <li class="ta-signal-item">
          <div class="ta-signal-header">
            <span class="ta-signal-name">${s.name}</span>
            <span class="badge ${badgeClass}">${s.signal}</span>
          </div>
          <div class="ta-signal-value text-muted">Value: ${s.value}</div>
          <div class="ta-signal-desc">${s.description}</div>
        </li>
      `;
    }).join('');
  } catch (e) {
    console.error('Error loading technical indicators rating:', e);
    state.currentAnalysis = null;
    elements.taRatingText.textContent = 'NEUTRAL';
    elements.taRatingSub.textContent = 'Indicator signals failed to compute';
    elements.taMeterFill.style.left = '50%';
    elements.taRatingText.className = 'ta-rating-text font-bold text-neutral';
    elements.taSignalsList.innerHTML = '<li class="text-center text-muted">Trading day range is insufficient for calculations.</li>';
  }
}

function updateAiVerdict(quote, analysis) {
  if (!quote) return;

  const ratingEl = elements.aiVerdictRating;
  const summaryEl = elements.aiVerdictSummaryText;
  const doListEl = elements.aiVerdictDoList;
  const dontListEl = elements.aiVerdictDontList;
  const disclaimerEl = elements.aiVerdictDisclaimerText;

  if (!ratingEl || !summaryEl || !doListEl || !dontListEl || !disclaimerEl) return;

  // 1. Determine Rating & Color class
  let ratingText = 'NEUTRAL / RANGEBOUND';
  let ratingColor = 'text-neutral';
  let ratingBg = 'badge-neutral';

  if (analysis) {
    if (analysis.score >= 3) {
      ratingText = 'STRONGLY BULLISH';
      ratingColor = 'text-positive';
      ratingBg = 'badge-positive';
    } else if (analysis.score >= 1) {
      ratingText = 'MODERATELY BULLISH';
      ratingColor = 'text-positive';
      ratingBg = 'badge-positive';
    } else if (analysis.score <= -3) {
      ratingText = 'STRONGLY BEARISH';
      ratingColor = 'text-negative';
      ratingBg = 'badge-negative';
    } else if (analysis.score <= -1) {
      ratingText = 'MODERATELY BEARISH';
      ratingColor = 'text-negative';
      ratingBg = 'badge-negative';
    }
  }

  ratingEl.textContent = ratingText;
  ratingEl.className = `badge ${ratingBg}`;

  // 2. Generate summary sentence
  const changeStr = quote.changePercent >= 0 ? `+${quote.changePercent.toFixed(2)}%` : `${quote.changePercent.toFixed(2)}%`;
  let summary = `🤖 **${quote.name} (${quote.symbol})** is currently trading at **₹${quote.price.toFixed(2)}** (${changeStr}). `;
  if (analysis) {
    summary += `Technical analysis registers an overall **${analysis.overallRating}** (Score: ${analysis.score}/+5) based on SMA crossovers, RSI, and Bollinger Band positions. `;
  } else {
    summary += `Insufficient technical details are available to calculate a rating scorecard. `;
  }

  if (quote.trailingPE) {
    summary += `Its Trailing P/E sits at **${quote.trailingPE.toFixed(2)}** ${quote.forwardPE ? `with a Forward P/E of **${quote.forwardPE.toFixed(2)}**` : ''}. `;
  }

  summaryEl.innerHTML = parseMarkdown(summary);

  // 3. Generate WHAT TO DO
  const doItems = [];
  if (analysis && analysis.score >= 1) {
    const sma20 = analysis.calculatedData.sma20;
    doItems.push(`**Accumulate in tranches**: Since indicators are bullish, buy shares incrementally near short-term support lines (SMA 20) at **₹${sma20 ? sma20.toFixed(2) : quote.price.toFixed(2)}**.`);
  } else if (analysis && analysis.score <= -1) {
    doItems.push(`**Wait for stabilization**: Technical momentum is downward. Wait for a clear hammer candlestick pattern or volume spike indicating buying absorption before entering.`);
    doItems.push(`**Trim leverage/exposure**: If you hold active short-term positions, consider trimming size or setting a tight trailing stop-loss.`);
  } else {
    doItems.push(`**Rangebound trading**: Buy strictly near support bands and lock in profits at resistance levels.`);
  }

  // Forward PE vs Trailing PE check
  if (quote.forwardPE && quote.trailingPE) {
    if (quote.forwardPE < quote.trailingPE) {
      doItems.push(`**Growth play**: The forward P/E is lower than trailing P/E, implying analysts predict earnings growth. This justifies a long-term accumulation thesis.`);
    } else {
      doItems.push(`**Hold / Monitor earnings**: Forward P/E is higher/equal, indicating potential margin contraction. Keep close track of quarterly reports.`);
    }
  }

  // Dividend Yield check
  if (quote.dividendYield && quote.dividendYield > 0) {
    const divPct = quote.dividendYield < 1 ? (quote.dividendYield * 100).toFixed(2) : quote.dividendYield.toFixed(2);
    if (parseFloat(divPct) > 1.5) {
      doItems.push(`**Passive income support**: A high dividend yield of **${divPct}%** provides a cash-flow buffer during market downturns.`);
    }
  }

  // Default general check
  if (doItems.length === 0) {
    doItems.push(`**Watchlist tracking**: Add to watchlist and monitor daily volume trends before deploying capital.`);
  }

  doListEl.innerHTML = doItems.map(item => `<li>${parseMarkdown(item)}</li>`).join('');

  // 4. Generate WHAT NOT TO DO
  const dontItems = [];
  dontItems.push(`**DO NOT FOMO buy**: Avoid buying full positions during sudden intraday spikes or near the day's high of **₹${quote.high ? quote.high.toFixed(2) : 'N/A'}**.`);

  if (quote.trailingPE && quote.trailingPE > 45) {
    dontItems.push(`**DO NOT ignore premium valuation**: P/E ratio is highly elevated (**${quote.trailingPE.toFixed(2)}**). Avoid buying for short-term quick gains, as any earnings miss will trigger aggressive multiples contraction.`);
  }

  if (analysis && analysis.calculatedData.rsi > 70) {
    dontItems.push(`**DO NOT chase overbought levels**: RSI is at **${parseFloat(analysis.calculatedData.rsi).toFixed(2)}** (overbought). Buying here carries extreme risk of near-term price reversal.`);
  }

  if (analysis && analysis.calculatedData.rsi < 30) {
    dontItems.push(`**DO NOT panic sell**: RSI is oversold (**${parseFloat(analysis.calculatedData.rsi).toFixed(2)}**). Selling here might lock in losses right before a technical dead-cat bounce or structural rebound.`);
  }

  if (quote.recommendation && (quote.recommendation.toLowerCase().includes('sell') || quote.recommendation.toLowerCase().includes('underperform'))) {
    dontItems.push(`**DO NOT go against consensus**: Analyst consensus recommends **${quote.recommendation.toUpperCase().replace(/_/g, ' ')}**. Avoid contrarian long trades without robust custom justification.`);
  }

  // Default general check
  dontItems.push(`**DO NOT trade without stop-loss**: Never deploy capital without defining your exit threshold. Limit single-stock allocation to 5-10% of total portfolio.`);

  dontListEl.innerHTML = dontItems.map(item => `<li>${parseMarkdown(item)}</li>`).join('');

  // 5. Generate CAUTION & DISCLAIMER
  let caution = `**CAUTION**: Current market price is **₹${quote.price.toFixed(2)}**. `;
  if (quote.targetPrice) {
    const diffPct = ((quote.targetPrice - quote.price) / quote.price) * 100;
    caution += `Analyst consensus median target price is **₹${quote.targetPrice.toFixed(2)}** (`;
    if (diffPct > 0) {
      caution += `projected **+${diffPct.toFixed(2)}%** upside). `;
    } else {
      caution += `projected **${diffPct.toFixed(2)}%** downside risk). `;
    }
  }

  caution += `52-Week trading range is **₹${quote.fiftyTwoWeekLow ? quote.fiftyTwoWeekLow.toLocaleString('en-IN') : 'N/A'}** to **₹${quote.fiftyTwoWeekHigh ? quote.fiftyTwoWeekHigh.toLocaleString('en-IN') : 'N/A'}**. High-beta stocks pose elevated risk during index consolidations. `;
  caution += `*Disclaimer: Indian Stock Markets are subject to high volatility. All recommendations are generated by simulated algorithmic models and do not constitute certified financial advice under SEBI guidelines. Run independent due diligence before investing real funds.*`;

  disclaimerEl.innerHTML = parseMarkdown(caution);
}

async function loadStockNews() {
  try {
    const news = await api.getStockNews(state.currentSymbol);
    elements.newsContainer.innerHTML = '';
    
    if (news.length === 0) {
      elements.newsContainer.innerHTML = '<div class="empty-state">No recent news found for this stock.</div>';
      return;
    }

    elements.newsContainer.innerHTML = news.map(item => {
      const badgeClass = item.sentiment === 'POSITIVE' 
        ? 'badge-positive' 
        : (item.sentiment === 'NEGATIVE' ? 'badge-negative' : 'badge-neutral');
      const dateStr = item.time 
        ? new Date(item.time * 1000).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'N/A';
      return `
        <a href="${item.link}" target="_blank" class="news-card">
          <div class="news-header">
            <span class="news-publisher">${item.publisher}</span>
            <span class="badge ${badgeClass}">${item.sentiment}</span>
          </div>
          <div class="news-title">${item.title}</div>
          <div class="news-footer text-muted">${dateStr}</div>
        </a>
      `;
    }).join('');
  } catch (err) {
    console.error("Error loading news feed:", err);
    elements.newsContainer.innerHTML = '<div class="empty-state">Failed to load news feed.</div>';
  }
}

async function refreshPortfolio() {
  elements.portfolioHoldingsList.innerHTML = '';
  
  if (state.portfolio.length === 0) {
    elements.portfolioHoldingsList.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No holdings simulated yet. Buy shares below.</td></tr>';
    elements.portfolioTotalInvested.textContent = '₹0.00';
    elements.portfolioCurrentValue.textContent = '₹0.00';
    elements.portfolioTotalProfit.innerHTML = '₹0.00 (0.00%)';
    elements.portfolioTotalProfit.className = 'portfolio-sum-val';
    return;
  }

  let totalInvested = 0;
  let totalValue = 0;

  try {
    for (const holding of state.portfolio) {
      const symbol = holding.symbol;
      let currentPrice = 0;

      // Fetch or use cached price
      if (state.quotesCache[symbol]) {
        currentPrice = state.quotesCache[symbol].price;
      } else {
        try {
          const q = await api.getStockQuote(symbol);
          state.quotesCache[symbol] = q;
          currentPrice = q.price;
        } catch (e) {
          console.error(e);
        }
      }

      const cost = holding.shares * holding.buyPrice;
      const value = holding.shares * currentPrice;
      const pnl = value - cost;
      const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;

      totalInvested += cost;
      totalValue += value;

      const tr = document.createElement('tr');
      const pnlClass = pnl >= 0 ? 'text-positive' : 'text-negative';
      
      tr.innerHTML = `
        <td class="font-bold cursor-pointer hover-accent" data-symbol="${symbol}">${symbol}</td>
        <td>${holding.shares}</td>
        <td>₹${holding.buyPrice.toFixed(2)}</td>
        <td>₹${currentPrice ? currentPrice.toFixed(2) : 'N/A'}</td>
        <td class="${pnlClass}">${pnl >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%</td>
        <td>
          <button class="btn-sell btn-small" data-symbol="${symbol}">Sell</button>
        </td>
      `;

      tr.querySelector('td[data-symbol]').addEventListener('click', () => {
        loadStock(symbol);
      });

      tr.querySelector('.btn-sell').addEventListener('click', () => {
        state.portfolio = state.portfolio.filter(item => item.symbol !== symbol);
        savePortfolioLocally();
        refreshPortfolio();
      });

      elements.portfolioHoldingsList.appendChild(tr);
    }

    const totalPnl = totalValue - totalInvested;
    const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
    
    elements.portfolioTotalInvested.textContent = `₹${totalInvested.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    elements.portfolioCurrentValue.textContent = `₹${totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    const overallPnlClass = totalPnl >= 0 ? 'text-positive' : 'text-negative';
    elements.portfolioTotalProfit.className = `portfolio-sum-val font-bold ${overallPnlClass}`;
    elements.portfolioTotalProfit.textContent = `${totalPnl >= 0 ? '+' : ''}₹${totalPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${totalPnl >= 0 ? '+' : ''}${totalPnlPct.toFixed(2)}%)`;
  } catch (err) {
    console.error('Error refreshing portfolio:', err);
    displayError('Failed to refresh portfolio calculations');
  }
}

// -------------------------------------------------------------
// PAGE 3: MARKET SCREENER
// -------------------------------------------------------------
async function loadScreenerData() {
  try {
    const data = await api.getScreenerData();
    state.screenerData = data.stocks;
    
    if (elements.screenerLastUpdated) {
      const date = data.lastUpdated ? new Date(data.lastUpdated) : new Date();
      elements.screenerLastUpdated.textContent = `Terminal cache refreshed: ${date.toLocaleTimeString()}`;
    }
  } catch (err) {
    console.error("Error loading screener data:", err);
    displayError("Failed to fetch terminal cache database");
  }
}

function getFilteredScreenerData() {
  let filtered = [...state.screenerData];
  
  // Sector filter
  const sector = elements.filterSector.value;
  if (sector !== 'ALL') {
    filtered = filtered.filter(s => s.sector === sector);
  }
  
  // Cap filter
  const cap = elements.filterCap.value;
  if (cap !== 'ALL') {
    filtered = filtered.filter(s => {
      const mcapCr = s.marketCap / 1e7;
      if (cap === 'LARGE') return mcapCr > 25000;
      if (cap === 'MID') return mcapCr >= 5000 && mcapCr <= 25000;
      if (cap === 'SMALL') return mcapCr < 5000;
      return true;
    });
  }
  
  // PE filter
  const peFilter = elements.filterPe.value;
  if (peFilter !== 'ALL') {
    filtered = filtered.filter(s => {
      if (!s.pe) return peFilter === 'NEGATIVE';
      if (peFilter === 'LOW') return s.pe < 20;
      if (peFilter === 'MODERATE') return s.pe >= 20 && s.pe <= 45;
      if (peFilter === 'HIGH') return s.pe > 45;
      if (peFilter === 'NEGATIVE') return s.pe < 0;
      return true;
    });
  }
  
  // Change filter
  const change = elements.filterChange.value;
  if (change !== 'ALL') {
    filtered = filtered.filter(s => {
      if (change === 'GAINERS') return s.changePercent > 0;
      if (change === 'LOSERS') return s.changePercent < 0;
      if (change === 'STRONG_GAIN') return s.changePercent > 2;
      return true;
    });
  }
  
  // Search text filter
  const searchVal = elements.screenerSearch.value.trim().toLowerCase();
  if (searchVal) {
    filtered = filtered.filter(s => 
      s.symbol.toLowerCase().includes(searchVal) || 
      s.name.toLowerCase().includes(searchVal)
    );
  }
  
  // Sort
  const { column, direction } = state.screenerSort;
  filtered.sort((a, b) => {
    let valA = a[column];
    let valB = b[column];
    
    if (valA === null || valA === undefined) return direction === 'asc' ? 1 : -1;
    if (valB === null || valB === undefined) return direction === 'asc' ? -1 : 1;
    
    if (typeof valA === 'string') {
      return direction === 'asc' 
        ? valA.localeCompare(valB) 
        : valB.localeCompare(valA);
    } else {
      return direction === 'asc' ? valA - valB : valB - valA;
    }
  });
  
  return filtered;
}

function refreshScreenerTable() {
  const filtered = getFilteredScreenerData();
  elements.screenerResultsCount.textContent = `Showing ${Math.min(filtered.length, 150)} of ${filtered.length} matches (from ${state.screenerData.length} total assets)`;

  elements.screenerResultsBody.innerHTML = filtered.slice(0, 150).map(s => {
    const isUp = s.changePercent >= 0;
    const colorClass = isUp ? 'text-positive' : 'text-negative';
    const mcapFormatted = s.marketCap ? `₹${(s.marketCap / 1e7).toFixed(0)}Cr` : 'N/A';
    
    return `
      <tr>
        <td class="font-bold">${s.symbol}</td>
        <td>${s.name}</td>
        <td>${s.sector}</td>
        <td class="text-right">₹${s.price.toFixed(2)}</td>
        <td class="text-right ${colorClass}">${isUp ? '+' : ''}${s.changePercent.toFixed(2)}%</td>
        <td class="text-right">${s.pe ? s.pe.toFixed(1) : 'N/A'}</td>
        <td class="text-right">${mcapFormatted}</td>
        <td class="text-right">${s.volume.toLocaleString('en-IN')}</td>
        <td>
          <button class="btn-secondary btn-small btn-view-analyzer" data-symbol="${s.symbol}">Analyze</button>
        </td>
      </tr>
    `;
  }).join('');

  elements.screenerResultsBody.querySelectorAll('.btn-view-analyzer').forEach(btn => {
    btn.addEventListener('click', () => {
      const sym = btn.getAttribute('data-symbol');
      loadStock(sym);
      navigateToPage('analyzer-page');
    });
  });
}

// -------------------------------------------------------------
// PAGE 4: SENTIMENT ANALYSIS & GEMINI ASSISTANT
// -------------------------------------------------------------
async function refreshSentimentPage() {
  const symbol = state.currentSymbol;
  
  try {
    const news = await api.getStockNews(symbol);
    
    // Buzzwords
    const positives = ['grow', 'profit', 'surges', 'jump', 'rise', 'buy', 'bull', 'gain', 'positive', 'expansion', 'up', 'high', 'deal', 'agreement', 'beating', 'strong'];
    const negatives = ['fall', 'drop', 'slump', 'loss', 'sell', 'bear', 'crash', 'negative', 'decline', 'down', 'low', 'deficit', 'debt', 'risk', 'fail', 'weak', 'plunge'];

    let posMatches = 0;
    let negMatches = 0;
    let totalCrawled = news.length;

    const wordsMap = {};

    news.forEach(item => {
      const titleLower = item.title.toLowerCase();
      
      positives.forEach(w => {
        if (titleLower.includes(w)) posMatches++;
      });
      negatives.forEach(w => {
        if (titleLower.includes(w)) negMatches++;
      });

      // Simple tokenizing for keyword density cloud
      const words = titleLower
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 4); // Keep words with more than 4 letters
      
      const stopWords = ['about', 'their', 'would', 'could', 'should', 'after', 'before', 'under', 'these', 'those', 'there', 'where', 'which', 'other', 'shares', 'stock', 'market', 'india', 'indian', 'price', 'share'];
      
      words.forEach(w => {
        if (stopWords.includes(w)) return;
        wordsMap[w] = (wordsMap[w] || 0) + 1;
      });
    });

    // Sentiment ratio
    const sum = posMatches + negMatches;
    const ratio = sum > 0 ? Math.round((posMatches / sum) * 100) : 50;

    elements.sentimentRatioPct.textContent = `${ratio}%`;
    elements.sentimentCircle.style.borderTopColor = ratio >= 55 ? 'var(--color-positive)' : (ratio <= 45 ? 'var(--color-negative)' : 'var(--color-accent)');

    let sentimentLabel = 'NEUTRAL SENTIMENT';
    let sentimentClass = 'text-neutral';
    if (ratio >= 60) {
      sentimentLabel = 'BULLISH SENTIMENT';
      sentimentClass = 'text-positive';
    } else if (ratio <= 40) {
      sentimentLabel = 'BEARISH SENTIMENT';
      sentimentClass = 'text-negative';
    }

    elements.sentimentOverallLabel.textContent = sentimentLabel;
    elements.sentimentOverallLabel.className = `font-bold ${sentimentClass}`;
    elements.sentimentRatioText.textContent = `Ratio computed over ${totalCrawled} crawled news feeds`;

    elements.sentimentPosCount.textContent = posMatches;
    elements.sentimentNegCount.textContent = negMatches;
    elements.sentimentTotalCount.textContent = totalCrawled;

    // Word Cloud
    const sortedWords = Object.entries(wordsMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    if (sortedWords.length === 0) {
      elements.wordCloudContainer.innerHTML = '<span class="text-muted">Insufficient keywords</span>';
    } else {
      elements.wordCloudContainer.innerHTML = sortedWords.map(([word, freq]) => {
        // Size proportional to frequency
        const size = 0.85 + (freq * 0.15);
        return `<span class="badge" style="font-size: ${size}rem; padding: 0.35rem 0.65rem; background: rgba(255,255,255,0.03); opacity: ${Math.min(0.5 + (freq * 0.1), 1)};">${word}</span>`;
      }).join('');
    }

    // Sentiment Feed
    elements.sentimentNewsFeed.innerHTML = news.map(item => {
      const badgeClass = item.sentiment === 'POSITIVE' ? 'badge-positive' : (item.sentiment === 'NEGATIVE' ? 'badge-negative' : 'badge-neutral');
      const dateStr = item.time ? new Date(item.time * 1000).toLocaleDateString() : 'N/A';
      return `
        <a href="${item.link}" target="_blank" class="news-card">
          <div class="news-header">
            <span>${item.publisher}</span>
            <span class="badge ${badgeClass}">${item.sentiment}</span>
          </div>
          <div class="news-title">${item.title}</div>
          <div class="news-footer text-muted">${dateStr}</div>
        </a>
      `;
    }).join('');

  } catch (err) {
    console.error("Error loading news sentiment page:", err);
    elements.sentimentNewsFeed.innerHTML = '<div class="empty-state">Failed to fetch sentiment news.</div>';
  }
}

// chatbot reply simulation logic (Data Driven Financial Advisor)
async function sendChatMessage(userText) {
  if (!userText || userText.trim() === '') return;

  // Render user bubble
  appendChatBubble(userText, 'user');
  elements.chatbotUserInput.value = '';

  // Show typing bubble
  const typingId = 'chat-typing-bubble';
  const typingBubble = document.createElement('div');
  typingBubble.className = 'chat-message assistant';
  typingBubble.id = typingId;
  typingBubble.innerHTML = '<span class="loader-small"></span> AI is analyzing statistics...';
  elements.chatbotMessagesContainer.appendChild(typingBubble);
  elements.chatbotMessagesContainer.scrollTop = elements.chatbotMessagesContainer.scrollHeight;

  try {
    const symbol = state.currentSymbol;
    const quote = state.quotesCache[symbol] || await api.getStockQuote(symbol);
    let analysis = null;
    try {
      analysis = await api.getTechnicalAnalysis(symbol);
    } catch(e) {}

    // Formulate a response based on matching keywords
    let responseText = '';
    const textLower = userText.toLowerCase();

    // Small delay to simulate processing
    await new Promise(resolve => setTimeout(resolve, 800));

    if (textLower.includes('buy') || textLower.includes('sell') || textLower.includes('recommendation')) {
      if (analysis) {
        const smaCrossSignal = analysis.signals.find(s=>s.name.includes('Cross'))?.signal || 'NEUTRAL';
        const rsiSignal = analysis.signals.find(s=>s.name.includes('RSI'))?.signal || 'NEUTRAL';
        const isBullish = analysis.overallRating.includes('BUY');
        
        responseText = `### Strategic Scorecard for **${symbol}**
        Consensus Rating: **${analysis.overallRating}** (Score: ${analysis.score}/+5)
        <br/>
        • **Moving Averages (20/50)**: Indicated trend is **${smaCrossSignal}**.
        • **RSI (14)**: Current momentum is **${rsiSignal}** (Value: ${analysis.calculatedData.rsi ? analysis.calculatedData.rsi.toFixed(2) : 'N/A'}).
        <br/>
        **WHAT TO DO**:
        • ${isBullish 
          ? `Accumulate shares slowly in tranches near the 20-day SMA support of **₹${analysis.calculatedData.sma20 ? analysis.calculatedData.sma20.toFixed(2) : quote.price.toFixed(2)}**. Use trailing stop-losses.` 
          : `Trim long exposure or hedge active positions. Consider waiting for the price to stabilize around the lower Bollinger Band.`}
        <br/>
        **WHAT NOT TO DO**:
        • ${isBullish
          ? `DO NOT FOMO buy a full position during sudden intraday spikes. Wait for a retest of support levels before committing capital.`
          : `DO NOT attempt to catch a falling knife. Avoid buying until the MACD histogram shows a bullish reversal crossover.`}
        <br/>
        **CAUTION**:
        • This stock is trading at a trailing P/E of **${quote.trailingPE ? quote.trailingPE.toFixed(2) : 'N/A'}** with a 52W range of **₹${quote.fiftyTwoWeekLow?.toLocaleString('en-IN')} - ₹${quote.fiftyTwoWeekHigh?.toLocaleString('en-IN')}**. High volatility can trigger stop-losses. This is simulated analysis for paper trading.`;
      } else {
        responseText = `### Tactical Report for **${symbol}**
        Current Price: **₹${quote.price.toFixed(2)}** (Change: ${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%)
        <br/>
        **WHAT TO DO**:
        • Analyze the 1D trend chart to see if price is consolidatng. Watch the daily volume trends.
        <br/>
        **WHAT NOT TO DO**:
        • DO NOT enter trades without technical indicators confirmation.
        <br/>
        **CAUTION**:
        • Historical data is insufficient to compute SMA/RSI rating scorecard for this symbol. Proceed with caution.`;
      }
    } else if (textLower.includes('technical') || textLower.includes('signal') || textLower.includes('indicator')) {
      if (analysis) {
        responseText = `### Technical Scorecard: **${symbol}**
        <br/>
        1. **RSI (14)**: ${analysis.calculatedData.rsi ? analysis.calculatedData.rsi.toFixed(2) : 'N/A'} (Momentum is **${analysis.signals.find(s=>s.name.includes('RSI'))?.signal}**)
        2. **MACD**: Histogram is **${analysis.calculatedData.macd?.histogram > 0 ? 'Above' : 'Below'}** zero line (Signal: **${analysis.signals.find(s=>s.name.includes('MACD'))?.signal}**)
        3. **SMA 20**: Price is trading **${quote.price > analysis.calculatedData.sma20 ? 'Above' : 'Below'}** the 20-day SMA of ₹${analysis.calculatedData.sma20?.toFixed(2)} (**${analysis.signals.find(s=>s.name.includes('SMA (20)'))?.signal}**)
        4. **Bollinger Bands**: Price position is **${analysis.signals.find(s=>s.name.includes('Bands'))?.signal}**
        <br/>
        **WHAT TO DO**:
        • Monitor Bollinger Band width. If bands are contracting (Bollinger Squeeze), prepare for a massive breakout trade.
        <br/>
        **WHAT NOT TO DO**:
        • DO NOT ignore volume divergence. A breakout on low volume is usually a bull/bear trap.
        <br/>
        **CAUTION**:
        • Moving average signals are lagging indicators. Always confirm with real-time price action.`;
      } else {
        responseText = `### Technical Indicators for **${symbol}**
        Indicator signals are currently unavailable due to insufficient historical trading day records. Check back shortly.`;
      }
    } else if (textLower.includes('pe') || textLower.includes('p/e') || textLower.includes('valuation') || textLower.includes('cap')) {
      responseText = `### Valuation Insights: **${quote.name} (${symbol})**
      <br/>
      • **Trailing P/E**: ${quote.trailingPE ? quote.trailingPE.toFixed(2) : 'N/A'}
      • **Forward P/E**: ${quote.forwardPE ? quote.forwardPE.toFixed(2) : 'N/A'}
      • **Dividend Yield**: ${quote.dividendYield ? (quote.dividendYield < 1 ? `${(quote.dividendYield * 100).toFixed(2)}%` : `${quote.dividendYield.toFixed(2)}%`) : '0.00%'}
      • **Market Capitalization**: ${formatLargeNumber(quote.marketCap)}
      <br/>
      **WHAT TO DO**:
      • Compare Forward P/E to Trailing P/E. ${quote.forwardPE < quote.trailingPE ? 'Forward P/E is lower, indicating projected earnings growth.' : 'Forward P/E is higher or equal, signaling potential stagnation or premium valuation.'}
      <br/>
      **WHAT NOT TO DO**:
      • DO NOT assume low P/E is always a bargain (value trap). Verify competitive advantages (Economic Moat) and debt metrics first.
      <br/>
      **CAUTION**:
      • Analyst consensus recommendation is **${quote.recommendation ? quote.recommendation.toUpperCase().replace(/_/g, ' ') : 'N/A'}** with a median target of **₹${quote.targetPrice ? quote.targetPrice.toLocaleString('en-IN') : 'N/A'}**. Discrepancies between market price and target price pose investment risk.`;
    } else if (textLower.includes('mote') || textLower.includes('advantage')) {
      responseText = `### Competitive Advantage (Moat) Analysis: **${symbol}**
      <br/>
      **WHAT TO DO**:
      • Assess if the company has high switching costs, brand power, or cost secrets. Grade the stock in the **Economic Moat** sidebar section.
      <br/>
      **WHAT NOT TO DO**:
      • DO NOT confuse a cyclical price surge with structural moat advantages. True moats sustain high return on equity (ROE) over decades.
      <br/>
      **CAUTION**:
      • Regulatory changes, product obsolescence, or competitor scale expansions can erode even the strongest brand moats rapidly.`;
    } else {
      responseText = `### Gemini Omni Advisory: **${quote.name} (${symbol})**
      Current Price: **₹${quote.price.toFixed(2)}** (${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%)
      Sector: *${quote.sector || 'N/A'}*
      <br/>
      **WHAT TO DO**:
      • Ask me specific questions to run deep-dives on **${symbol}**:
        • *'Should I buy or sell this?'*
        • *'Explain technical indicators'*
        • *'Analyze P/E valuation'*
      <br/>
      **WHAT NOT TO DO**:
      • DO NOT make capital decisions based on a single metric. Perform economic moat audits and watchlist tracking.
      <br/>
      **CAUTION**:
      • Paper simulation data is delayed. Set strict stop-losses to protect capital.`;
    }

    // Remove typing bubble and render assistant bubble
    const bubbleElement = document.getElementById(typingId);
    if (bubbleElement) bubbleElement.remove();
    
    appendChatBubble(responseText, 'assistant');

  } catch (err) {
    console.error("Chatbot error:", err);
    const bubbleElement = document.getElementById(typingId);
    if (bubbleElement) bubbleElement.remove();
    appendChatBubble("Unable to query active stock details. Please check connection.", 'assistant');
  }
}

function appendChatBubble(text, sender) {
  const msg = document.createElement('div');
  msg.className = `chat-message ${sender}`;
  msg.innerHTML = parseMarkdown(text);
  elements.chatbotMessagesContainer.appendChild(msg);
  elements.chatbotMessagesContainer.scrollTop = elements.chatbotMessagesContainer.scrollHeight;
}

// -------------------------------------------------------------
// PAGE 5: ECONOMIC MOAT RATINGS
// -------------------------------------------------------------
async function refreshMotePage() {
  const symbol = state.currentSymbol;
  elements.moteActiveSymbol.textContent = symbol;

  // Load existing report
  try {
    const report = await firebaseManager.getMoteReport(symbol);
    
    if (report) {
      document.getElementById('mote-q-brand').checked = report.qBrand || false;
      document.getElementById('mote-q-switching').checked = report.qSwitching || false;
      document.getElementById('mote-q-network').checked = report.qNetwork || false;
      document.getElementById('mote-q-cost').checked = report.qCost || false;
      document.getElementById('mote-q-barriers').checked = report.qBarriers || false;
      elements.moteNotes.value = report.notes || '';
    } else {
      // Clear checkboxes
      elements.moteCheckboxes.forEach(cb => cb.checked = false);
      elements.moteNotes.value = '';
    }

    calculateMoteRating();
  } catch (err) {
    console.error("Error loading mote report:", err);
  }
}

function calculateMoteRating() {
  let score = 0;
  elements.moteCheckboxes.forEach(cb => {
    if (cb.checked) score += 1.0;
  });

  elements.moteScoreBadge.textContent = `${score.toFixed(1)} / 5.0 Mote`;
  
  const starsCount = Math.round(score);
  elements.moteStarsDisplay.textContent = '★'.repeat(starsCount) + '☆'.repeat(5 - starsCount);
}

async function saveMoteReport() {
  const symbol = state.currentSymbol;
  let score = 0;
  elements.moteCheckboxes.forEach(cb => {
    if (cb.checked) score += 1.0;
  });

  const moteData = {
    symbol,
    score,
    qBrand: document.getElementById('mote-q-brand').checked,
    qSwitching: document.getElementById('mote-q-switching').checked,
    qNetwork: document.getElementById('mote-q-network').checked,
    qCost: document.getElementById('mote-q-cost').checked,
    qBarriers: document.getElementById('mote-q-barriers').checked,
    notes: elements.moteNotes.value.trim(),
    timestamp: new Date().toISOString()
  };

  showLoader(true);
  try {
    await firebaseManager.saveMoteReport(symbol, moteData);
    displayError(`Competitive Mote report for ${symbol} saved successfully!`, true);
  } catch (err) {
    displayError("Failed to save mote report");
  } finally {
    showLoader(false);
  }
}

// -------------------------------------------------------------
// PAGE 6: FIREBASE CLOUD SETTINGS
// -------------------------------------------------------------
function updateSyncStatusUI() {
  if (state.firebaseConnected) {
    elements.syncStatusDot.className = 'user-status-dot online';
    elements.syncStatusText.textContent = 'Real-time Cloud Sync';
    
    if (elements.settingsSyncStatusBadge) {
      elements.settingsSyncStatusBadge.textContent = 'CLOUD SYNC ACTIVE';
      elements.settingsSyncStatusBadge.className = 'badge badge-positive';
      elements.settingsSyncStatusDesc.textContent = `Connected securely. Watchlist, simulated portfolio, and moat reports are synced to Firestore.`;
    }
  } else {
    elements.syncStatusDot.className = 'user-status-dot offline';
    elements.syncStatusText.textContent = 'LocalStorage Mode';

    if (elements.settingsSyncStatusBadge) {
      elements.settingsSyncStatusBadge.textContent = 'LOCAL STORAGE MODE';
      elements.settingsSyncStatusBadge.className = 'badge badge-neutral';
      elements.settingsSyncStatusDesc.textContent = `Anonymous guest mode. Data is stored locally in your browser.`;
    }
  }
}

async function connectFirebase(config) {
  showLoader(true);
  try {
    const success = await firebaseManager.initialize(config);
    if (success) {
      saveFirebaseConfig(config);
      state.firebaseConnected = true;

      // Sync local watchlist and portfolio with cloud
      state.watchlist = await firebaseManager.syncWatchlist(state.watchlist);
      state.portfolio = await firebaseManager.syncPortfolio(state.portfolio);
      
      // Save merged locally
      localStorage.setItem('watchlist', JSON.stringify(state.watchlist));
      localStorage.setItem('portfolio', JSON.stringify(state.portfolio));

      updateSyncStatusUI();
      displayError("Firebase Connected! Merged cloud & local data.", true);
    } else {
      displayError("Firebase Connection failed. Verify credentials.");
      state.firebaseConnected = false;
      updateSyncStatusUI();
    }
  } catch (err) {
    console.error("Firebase startup error:", err);
    displayError("Error configuring Firebase: " + err.message);
  } finally {
    showLoader(false);
  }
}

function disconnectFirebase() {
  clearFirebaseConfig();
  displayError("Firebase credentials cleared. Refreshing application...", true);
  setTimeout(() => {
    window.location.reload();
  }, 1000);
}

// -------------------------------------------------------------
// GENERAL EVENT LISTENERS & SEARCH AUTOCOMPLETE
// -------------------------------------------------------------
// Debounce helper
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

const handleSuggestions = debounce(async (query) => {
  if (!query || query.trim() === '') {
    elements.searchSuggestions.classList.add('hidden');
    elements.searchSuggestions.innerHTML = '';
    return;
  }

  try {
    const suggestions = await api.searchSymbols(query);
    elements.searchSuggestions.innerHTML = '';
    
    if (suggestions.length === 0) {
      elements.searchSuggestions.innerHTML = '<div class="suggestion-item text-muted">No matching stocks found</div>';
      elements.searchSuggestions.classList.remove('hidden');
      return;
    }

    suggestions.slice(0, 8).forEach(item => {
      const div = document.createElement('div');
      div.className = 'suggestion-item';
      div.innerHTML = `
        <span class="suggestion-symbol font-bold">${item.symbol}</span>
        <span class="suggestion-name text-muted">${item.name}</span>
        <span class="suggestion-exchange">${item.exchange}</span>
      `;
      div.addEventListener('click', () => {
        elements.searchInput.value = '';
        elements.searchSuggestions.classList.add('hidden');
        elements.searchSuggestions.innerHTML = '';
        loadStock(item.symbol);
        navigateToPage('analyzer-page');
      });
      elements.searchSuggestions.appendChild(div);
    });

    // Add search helper note
    const helperNote = document.createElement('div');
    helperNote.className = 'suggestion-footer';
    helperNote.innerHTML = '🔍 Search all 5,000+ Indian stocks on NSE/BSE';
    elements.searchSuggestions.appendChild(helperNote);
    
    elements.searchSuggestions.classList.remove('hidden');
  } catch (e) {
    console.error('Suggestions error:', e);
  }
}, 250);

async function refreshActivePageData() {
  if (state.activePage === 'market-page') {
    await refreshMarketOverview();
  } else if (state.activePage === 'analyzer-page') {
    await loadStock(state.currentSymbol);
  } else if (state.activePage === 'screener-page') {
    await loadScreenerData();
    refreshScreenerTable();
  }
}

function setupListeners() {
  // Live Sync Button Click Handler
  if (elements.btnLiveSync) {
    elements.btnLiveSync.addEventListener('click', async () => {
      const syncIcon = elements.btnLiveSync.querySelector('.sync-icon');
      if (syncIcon) syncIcon.classList.add('spinning');
      elements.btnLiveSync.disabled = true;
      
      try {
        displayError('Initiating Live Sync with Server...', true);
        const result = await api.triggerLiveSync();
        if (result.success) {
          displayError(`Live Sync Complete! Updated ${result.count} stocks.`, true);
          await refreshActivePageData();
        } else {
          displayError('Failed to complete Live Sync.');
        }
      } catch (err) {
        console.error('Live Sync click error:', err);
        displayError(`Live Sync Error: ${err.message}`);
      } finally {
        if (syncIcon) syncIcon.classList.remove('spinning');
        elements.btnLiveSync.disabled = false;
      }
    });
  }

  // Autocomplete suggestions
  elements.searchInput.addEventListener('input', (e) => {
    handleSuggestions(e.target.value);
  });

  // Hide suggestions list when clicking outside
  document.addEventListener('click', (e) => {
    if (!elements.searchInput.contains(e.target) && !elements.searchSuggestions.contains(e.target)) {
      elements.searchSuggestions.classList.add('hidden');
    }
  });

  // Submit search box
  elements.searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = elements.searchInput.value.trim();
    if (!query) return;

    showLoader(true);
    try {
      const results = await api.searchSymbols(query);
      if (results && results.length > 0) {
        elements.searchInput.value = '';
        elements.searchSuggestions.classList.add('hidden');
        loadStock(results[0].symbol);
        navigateToPage('analyzer-page');
      } else {
        displayError(`No stocks found matching "${query}"`);
      }
    } catch (err) {
      displayError(err.message);
    } finally {
      showLoader(false);
    }
  });

  // Header quick watchlist button
  if (elements.btnQuickWatchlist) {
    elements.btnQuickWatchlist.addEventListener('click', () => {
      navigateToPage('market-page');
      // Scroll smoothly to watchlist card on overview page
      const card = document.getElementById('sidebar-watchlist-container').closest('.card');
      if (card) {
        card.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // Watchlist Toggle
  elements.btnWatchlistToggle.addEventListener('click', () => {
    const isWatched = state.watchlist.includes(state.currentSymbol);
    if (isWatched) {
      state.watchlist = state.watchlist.filter(s => s !== state.currentSymbol);
      displayError(`Removed ${state.currentSymbol} from Watchlist`, true);
    } else {
      state.watchlist.push(state.currentSymbol);
      displayError(`Added ${state.currentSymbol} to Watchlist`, true);
    }
    saveWatchlistLocally();
    updateWatchlistBtnUI();
    refreshSidebarWatchlist();
  });

  // Chart Timeframe Selection
  elements.timeframeButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      elements.timeframeButtons.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      
      state.currentRange = e.target.getAttribute('data-range');
      showLoader(true);
      loadChartData().finally(() => showLoader(false));
    });
  });

  // Chart Indicators Overlays
  elements.indicatorButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      const ind = e.target.getAttribute('data-indicator');
      chartManager.toggleIndicator(ind);
    });
  });

  // Portfolio buying form submit
  elements.portfolioForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const symbol = elements.portfolioSymbol.value.trim().toUpperCase();
    const shares = parseInt(elements.portfolioShares.value);
    const price = parseFloat(elements.portfolioPrice.value);

    if (!symbol || isNaN(shares) || shares <= 0 || isNaN(price) || price <= 0) {
      displayError('Please enter a valid stock symbol, shares, and purchase price');
      return;
    }

    const existingIndex = state.portfolio.findIndex(item => item.symbol === symbol);
    if (existingIndex !== -1) {
      const existing = state.portfolio[existingIndex];
      const newShares = existing.shares + shares;
      const newAvgPrice = ((existing.shares * existing.buyPrice) + (shares * price)) / newShares;
      state.portfolio[existingIndex] = {
        symbol,
        shares: newShares,
        buyPrice: newAvgPrice
      };
    } else {
      state.portfolio.push({ symbol, shares, buyPrice: price });
    }

    savePortfolioLocally();
    refreshPortfolio();
    displayError(`Successfully simulated buy of ${shares} shares of ${symbol}`, true);

    elements.portfolioShares.value = '';
  });

  // Screener Filters listeners
  const filterElements = [elements.filterSector, elements.filterCap, elements.filterPe, elements.filterChange];
  filterElements.forEach(el => {
    el.addEventListener('change', () => {
      refreshScreenerTable();
    });
  });
  elements.screenerSearch.addEventListener('input', () => {
    refreshScreenerTable();
  });

  // Go to Mote rating button
  if (elements.btnGoToMote) {
    elements.btnGoToMote.addEventListener('click', () => {
      navigateToPage('mote-page');
    });
  }

  // Mote Checkboxes
  elements.moteCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      calculateMoteRating();
    });
  });

  // Mote Notes keypress/change autosaves rating
  elements.moteNotes.addEventListener('input', () => {
    calculateMoteRating();
  });

  // Save Mote Report
  elements.btnSaveMote.addEventListener('click', () => {
    saveMoteReport();
  });

  // Chatbot send message form
  elements.chatbotInputForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = elements.chatbotUserInput.value.trim();
    sendChatMessage(query);
  });

  // Chatbot quick prompt buttons
  elements.chatQuickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const prompt = btn.getAttribute('data-prompt');
      sendChatMessage(prompt);
    });
  });

  // Settings Firebase submit
  elements.settingsFirebaseForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const config = {
      apiKey: elements.fbApiKey.value.trim(),
      authDomain: elements.fbAuthDomain.value.trim(),
      projectId: elements.fbProjectId.value.trim(),
      storageBucket: elements.fbStorageBucket.value.trim(),
      appId: elements.fbAppId.value.trim()
    };
    connectFirebase(config);
  });

  // Settings disconnect Firebase
  elements.btnClearSettings.addEventListener('click', () => {
    disconnectFirebase();
  });

  // Settings API submit
  elements.settingsApiForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = elements.settingsApiUrl.value.trim();
    if (url) {
      localStorage.setItem('BACKEND_API_URL', url);
      api.setApiBase(url);
      alert('API Server URL updated successfully! Refresh page to apply.');
    } else {
      localStorage.removeItem('BACKEND_API_URL');
      api.setApiBase('');
      alert('API Server URL reset to default. Refresh page to apply.');
    }
  });

  setupKiteTerminalListeners();
}

// --- ZERODHA KITE TERMINAL IMPLEMENTATIONS ---

function formatINR(num) {
  if (num === null || num === undefined || isNaN(num)) return '₹0.00';
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPrice(num) {
  if (num === null || num === undefined || isNaN(num)) return '0.00';
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const handleGttSuggestions = debounce(async (query) => {
  if (!query || query.trim() === '') {
    elements.gttSearchSuggestions.classList.add('hidden');
    elements.gttSearchSuggestions.innerHTML = '';
    return;
  }

  try {
    const suggestions = await api.searchSymbols(query);
    elements.gttSearchSuggestions.innerHTML = '';
    
    if (suggestions.length === 0) {
      elements.gttSearchSuggestions.innerHTML = '<div class="suggestion-item text-muted">No matches found</div>';
      elements.gttSearchSuggestions.classList.remove('hidden');
      return;
    }

    suggestions.slice(0, 8).forEach(item => {
      const div = document.createElement('div');
      div.className = 'suggestion-item';
      div.innerHTML = `
        <span class="suggestion-symbol font-bold">${item.symbol}</span>
        <span class="suggestion-name text-muted">${item.name}</span>
        <span class="suggestion-exchange">${item.exchange}</span>
      `;
      div.addEventListener('click', () => {
        elements.gttSearchInput.value = `${item.symbol} - ${item.name}`;
        elements.gttSearchInput.dataset.symbol = item.symbol;
        elements.gttSearchInput.dataset.price = item.price;
        elements.gttSearchSuggestions.classList.add('hidden');
        elements.gttSearchSuggestions.innerHTML = '';
        
        if (item.price) {
          elements.gttTriggerPrice.value = item.price.toFixed(2);
          elements.gttOrderPrice.value = item.price.toFixed(2);
          if (elements.gttSlTriggerPrice) {
            elements.gttSlTriggerPrice.value = (item.price * 0.95).toFixed(2);
            elements.gttSlOrderPrice.value = (item.price * 0.94).toFixed(2);
          }
        }
      });
      elements.gttSearchSuggestions.appendChild(div);
    });

    elements.gttSearchSuggestions.classList.remove('hidden');
  } catch (e) {
    console.error('GTT suggestions error:', e);
  }
}, 250);

async function refreshKiteTerminalData() {
  try {
    const status = await api.getKiteStatus();
    
    // Process GTT trigger notifications
    if (status.notifications && status.notifications.length > 0) {
      status.notifications.forEach(msg => {
        showKiteToast(msg, 'success');
      });
    }

    // Status bar
    const pulse = elements.kiteConnectionPulse;
    const badge = elements.kiteConnectionBadge;
    const desc = elements.kiteConnectionDesc;
    const disconnectBtn = elements.btnDisconnectKite;

    if (status.isSandbox) {
      pulse.className = 'pulse-icon sandbox';
      badge.className = 'badge badge-kite-sandbox';
      badge.textContent = 'SANDBOX ACTIVE';
      desc.textContent = 'Running in persistent simulated mode. Virtual funds active.';
      disconnectBtn.classList.add('hidden');
      elements.kiteSandboxCheckbox.checked = true;
    } else if (status.isConnected) {
      pulse.className = 'pulse-icon online';
      badge.className = 'badge badge-kite-real';
      badge.textContent = 'CONNECTED';
      desc.textContent = `Live Zerodha Account connected as ${status.userName || status.userId}.`;
      disconnectBtn.classList.remove('hidden');
      elements.kiteSandboxCheckbox.checked = false;
    } else {
      pulse.className = 'pulse-icon offline';
      badge.className = 'badge badge-kite-disconnected';
      badge.textContent = 'DISCONNECTED';
      desc.textContent = 'Kite API disconnected. Configure credentials to trade.';
      disconnectBtn.classList.add('hidden');
      elements.kiteSandboxCheckbox.checked = false;
    }

    // Fetch margins
    const margins = await api.getKiteMargins();
    const eq = margins.equity || { net: 0, utilised: { debits: 0 } };
    const cash = eq.available?.cash || eq.net || 0;
    const used = eq.utilised?.debits || 0;
    
    elements.kiteMarginAvailable.textContent = formatINR(cash);
    elements.kiteMarginUsed.textContent = formatINR(used);

    // Update active tab table content
    const activeTab = state.kite?.activeTab || 'kite-tab-holdings';
    
    if (activeTab === 'kite-tab-holdings') {
      const holdings = await api.getKiteHoldings();
      renderKiteHoldings(holdings);
    } else if (activeTab === 'kite-tab-positions') {
      const positions = await api.getKitePositions();
      renderKitePositions(positions.net || []);
    } else if (activeTab === 'kite-tab-orders') {
      const orders = await api.getKiteOrders();
      renderKiteOrders(orders);
    } else if (activeTab === 'kite-tab-gtt') {
      const triggers = await api.getKiteGTT();
      renderKiteGTT(triggers);
    }
  } catch (err) {
    console.error('Error refreshing Kite terminal:', err.message);
  }
}

function renderKiteHoldings(holdings) {
  elements.kiteHoldingsTbody.innerHTML = '';
  
  if (!holdings || holdings.length === 0) {
    elements.kiteHoldingsTbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:2rem;">No holdings in account. Buy assets in Analyzer.</td></tr>';
    elements.kitePortfolioInvested.textContent = '₹0.00';
    elements.kitePortfolioValue.textContent = '₹0.00';
    elements.kiteTotalPnl.textContent = '₹0.00 (0.00%)';
    elements.kiteTotalPnl.className = 'portfolio-sum-val font-bold text-neutral';
    elements.kiteDayPnl.textContent = '₹0.00';
    elements.kiteDayPnl.className = 'portfolio-sum-val text-neutral';
    return;
  }

  let totalInvested = 0;
  let totalValue = 0;
  let totalPnl = 0;

  holdings.forEach(h => {
    const qty = h.quantity;
    const buyPrice = h.average_price;
    const ltp = h.last_price || buyPrice;
    const invested = qty * buyPrice;
    const currentVal = qty * ltp;
    const pnl = h.pnl !== undefined ? h.pnl : (currentVal - invested);
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
    
    totalInvested += invested;
    totalValue += currentVal;
    totalPnl += pnl;

    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    const isPnlPositive = pnl >= 0;
    const pnlClass = isPnlPositive ? 'text-positive' : 'text-negative';
    const pnlSign = isPnlPositive ? '+' : '';

    tr.innerHTML = `
      <td class="font-bold">${h.tradingsymbol}</td>
      <td class="text-right">${qty}</td>
      <td class="text-right">₹${formatPrice(buyPrice)}</td>
      <td class="text-right font-bold">₹${formatPrice(ltp)}</td>
      <td class="text-right">₹${formatPrice(currentVal)}</td>
      <td class="text-right font-bold ${pnlClass}">${pnlSign}₹${formatPrice(pnl)} (${pnlSign}${pnlPct.toFixed(2)}%)</td>
      <td class="text-center">
        <button class="btn-secondary btn-sell-holding" data-symbol="${h.tradingsymbol}" style="padding:0.25rem 0.5rem; font-size:0.75rem; border-radius:6px; background:rgba(255,0,85,0.08); border-color:rgba(255,0,85,0.15); color:var(--color-negative);">Sell</button>
      </td>
    `;

    // Bind sell button click
    tr.querySelector('.btn-sell-holding').addEventListener('click', (e) => {
      e.stopPropagation();
      openQuickSell(h.tradingsymbol, qty, ltp);
    });

    // Click row to view stock details
    tr.addEventListener('click', () => {
      const symNS = h.tradingsymbol.match(/^\d+$/) ? h.tradingsymbol : `${h.tradingsymbol}.NS`;
      loadStock(symNS);
      navigateToPage('analyzer-page');
    });

    elements.kiteHoldingsTbody.appendChild(tr);
  });

  elements.kitePortfolioInvested.textContent = formatINR(totalInvested);
  elements.kitePortfolioValue.textContent = formatINR(totalValue);
  
  const overallPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
  elements.kiteTotalPnl.textContent = `${totalPnl >= 0 ? '+' : ''}${formatINR(totalPnl)} (${totalPnl >= 0 ? '+' : ''}${overallPnlPct.toFixed(2)}%)`;
  elements.kiteTotalPnl.className = `portfolio-sum-val font-bold ${totalPnl >= 0 ? 'text-positive' : 'text-negative'}`;

  // Simulated day change
  elements.kiteDayPnl.textContent = `${totalPnl >= 0 ? '+' : ''}${formatINR(totalPnl * 0.12)}`;
  elements.kiteDayPnl.className = `portfolio-sum-val ${totalPnl >= 0 ? 'text-positive' : 'text-negative'}`;
}

function openQuickSell(symbol, maxQty, ltp) {
  const symNS = symbol.match(/^\d+$/) ? symbol : `${symbol}.NS`;
  return loadStock(symNS).then(() => {
    elements.btnTradingViewKite.click();
    elements.analyzerKiteTransaction.value = 'SELL';
    elements.analyzerKiteQty.value = maxQty;
    elements.analyzerKiteQty.max = maxQty;
    navigateToPage('analyzer-page');
  });
}

function renderKitePositions(positions) {
  elements.kitePositionsTbody.innerHTML = '';
  if (!positions || positions.length === 0) {
    elements.kitePositionsTbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:2rem;">No open day positions.</td></tr>';
    return;
  }

  positions.forEach(p => {
    const tr = document.createElement('tr');
    const isPnlPositive = p.pnl >= 0;
    const pnlClass = isPnlPositive ? 'text-positive' : 'text-negative';
    const pnlSign = isPnlPositive ? '+' : '';
    
    tr.innerHTML = `
      <td class="font-bold">${p.tradingsymbol}</td>
      <td class="text-center"><span class="badge" style="font-size:0.7rem; padding:0.1rem 0.3rem;">${p.product}</span></td>
      <td class="text-right">${p.quantity}</td>
      <td class="text-right">₹${formatPrice(p.average_price)}</td>
      <td class="text-right font-bold">₹${formatPrice(p.last_price)}</td>
      <td class="text-right">₹${formatPrice(p.quantity * p.last_price)}</td>
      <td class="text-right font-bold ${pnlClass}">${pnlSign}₹${formatPrice(p.pnl)}</td>
    `;
    elements.kitePositionsTbody.appendChild(tr);
  });
}

function renderKiteOrders(orders) {
  elements.kiteOrdersTbody.innerHTML = '';
  if (!orders || orders.length === 0) {
    elements.kiteOrdersTbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted" style="padding:2rem;">No orders recorded today.</td></tr>';
    return;
  }

  orders.forEach(o => {
    const tr = document.createElement('tr');
    const statusLower = o.status.toLowerCase();
    
    let badgeClass = 'badge-neutral';
    if (statusLower === 'complete') badgeClass = 'badge-positive';
    else if (statusLower === 'rejected' || statusLower === 'cancelled') badgeClass = 'badge-negative';
    else if (statusLower.includes('pending') || statusLower.includes('req')) badgeClass = 'badge-warning';

    const timeStr = o.order_timestamp ? new Date(o.order_timestamp).toLocaleTimeString() : 'N/A';

    tr.innerHTML = `
      <td class="text-muted" style="font-size:0.8rem;">${timeStr}</td>
      <td class="font-bold">${o.tradingsymbol}</td>
      <td class="text-center"><span class="badge ${o.transaction_type === 'BUY' ? 'badge-positive' : 'badge-negative'}" style="font-size:0.7rem;">${o.transaction_type}</span></td>
      <td class="text-right">${o.quantity}</td>
      <td class="text-right">₹${formatPrice(o.price)}</td>
      <td class="text-center"><span class="badge" style="font-size:0.7rem;">${o.product}</span></td>
      <td class="text-center text-muted" style="font-size:0.75rem;">${o.order_type}</td>
      <td class="text-center"><span class="badge ${badgeClass}" style="font-size:0.75rem;">${o.status}</span></td>
      <td class="text-center">
        ${o.status === 'PUT ORDER REQ RECEIVED' || o.status === 'PENDING' ? 
          `<button class="btn-cancel-order" data-id="${o.order_id}" style="background:none; border:none; color:var(--color-negative); cursor:pointer; font-size:1.1rem; line-height:1;">&times;</button>` : 
          `<span style="opacity:0.2;">&times;</span>`
        }
      </td>
    `;

    const cancelBtn = tr.querySelector('.btn-cancel-order');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Cancel this pending order?')) {
          try {
            await api.cancelKiteOrder(o.order_id);
            showKiteToast('Order cancelled successfully.', 'success');
            refreshKiteTerminalData();
          } catch (err) {
            displayError('Cancel Order Error: ' + err.message);
          }
        }
      });
    }

    elements.kiteOrdersTbody.appendChild(tr);
  });
}

function renderKiteGTT(triggers) {
  elements.kiteGttTbody.innerHTML = '';
  if (!triggers || triggers.length === 0) {
    elements.kiteGttTbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding:2rem;">No active GTT triggers. Set trigger points below.</td></tr>';
    return;
  }

  triggers.forEach(g => {
    const tr = document.createElement('tr');
    
    const conditionVal = g.condition?.trigger_values || [];
    const triggerPriceText = conditionVal.map(v => `₹${v.toFixed(2)}`).join(' / ');
    const order = g.orders[0];
    const orderPriceText = g.orders.map(o => `₹${o.price.toFixed(2)}`).join(' / ');

    const statusLower = g.status.toLowerCase();
    let badgeClass = 'badge-neutral';
    if (statusLower === 'active') badgeClass = 'badge-positive';
    else if (statusLower === 'triggered') badgeClass = 'badge-warning';
    else if (statusLower === 'cancelled' || statusLower === 'error') badgeClass = 'badge-negative';

    tr.innerHTML = `
      <td class="font-bold">${g.tradingsymbol}</td>
      <td class="text-center text-muted" style="font-size:0.75rem; text-transform:uppercase;">${g.type}</td>
      <td class="text-right font-bold" style="color:var(--color-warning);">${triggerPriceText}</td>
      <td class="text-right">₹${orderPriceText}</td>
      <td class="text-right">${order.quantity}</td>
      <td class="text-center"><span class="badge ${order.transaction_type === 'BUY' ? 'badge-positive' : 'badge-negative'}" style="font-size:0.7rem;">${order.transaction_type}</span></td>
      <td class="text-center"><span class="badge ${badgeClass}" style="font-size:0.75rem;">${g.status}</span></td>
      <td class="text-center">
        <button class="btn-delete-gtt" data-id="${g.id}" style="background:none; border:none; color:var(--color-negative); cursor:pointer; font-size:1rem;">🗑️</button>
      </td>
    `;

    tr.querySelector('.btn-delete-gtt').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Delete this GTT trigger?')) {
        try {
          await api.deleteKiteGTT(g.id);
          showKiteToast('GTT trigger removed.', 'success');
          refreshKiteTerminalData();
        } catch (err) {
          displayError('Delete GTT Error: ' + err.message);
        }
      }
    });

    elements.kiteGttTbody.appendChild(tr);
  });
}

function showKiteToast(message, type = 'success') {
  if (!elements.kiteToastContainer) return;
  const div = document.createElement('div');
  div.className = `kite-toast ${type}`;
  div.innerHTML = `
    <div style="font-weight:bold; display:flex; align-items:center; gap:0.4rem; color:var(--color-text-primary);">
      ${type === 'success' ? '⚡ Trade Alert' : '⚠️ System Alert'}
    </div>
    <div style="font-size:0.8rem; margin-top:0.15rem; color:var(--color-text-secondary);">${message}</div>
  `;
  elements.kiteToastContainer.appendChild(div);
  
  setTimeout(() => {
    div.style.animation = 'slideInRight 0.3s forwards reverse';
    setTimeout(() => div.remove(), 300);
  }, 5000);
}

function setupKiteTerminalListeners() {
  if (elements.btnToggleKiteConfig) {
    elements.btnToggleKiteConfig.addEventListener('click', () => {
      elements.kiteConfigPanel.classList.toggle('hidden');
    });
  }

  if (elements.btnSaveKiteConfig) {
    elements.btnSaveKiteConfig.addEventListener('click', async (e) => {
      e.preventDefault();
      const apiKey = elements.kiteApiKey.value.trim();
      const apiSecret = elements.kiteApiSecret.value.trim();
      if (!apiKey) {
        displayError('Kite API Key is required to save credentials.');
        return;
      }
      showLoader(true);
      try {
        const result = await api.saveKiteConfig(apiKey, apiSecret);
        if (result.success && result.loginUrl) {
          showKiteToast('Credentials saved! Opening Zerodha login...', 'success');
          window.open(result.loginUrl, '_blank');
          elements.kiteConfigPanel.classList.remove('hidden');
        } else {
          displayError('Failed to save Kite credentials.');
        }
      } catch (err) {
        displayError('Kite Config Error: ' + err.message);
      } finally {
        showLoader(false);
      }
    });
  }

  if (elements.kiteSandboxCheckbox) {
    elements.kiteSandboxCheckbox.addEventListener('change', async (e) => {
      const enabled = e.target.checked;
      try {
        const result = await api.toggleKiteSandbox(enabled);
        if (result.success) {
          showKiteToast(enabled ? 'Sandbox Mode Enabled' : 'Real Trading Mode Enabled', 'success');
          await refreshKiteTerminalData();
        }
      } catch (err) {
        displayError('Sandbox Toggle Error: ' + err.message);
      }
    });
  }

  if (elements.btnSubmitRequestToken) {
    elements.btnSubmitRequestToken.addEventListener('click', async () => {
      let rawToken = elements.kiteRequestTokenInput.value.trim();
      if (!rawToken) {
        displayError('Please enter a request token or redirect URL.');
        return;
      }
      
      if (rawToken.includes('request_token=')) {
        const urlParams = new URLSearchParams(rawToken.split('?')[1]);
        rawToken = urlParams.get('request_token');
      }

      showLoader(true);
      try {
        const result = await api.authenticateKite(rawToken);
        if (result.success) {
          showKiteToast(`Authenticated successfully! Connected as ${result.user}`, 'success');
          elements.kiteRequestTokenInput.value = '';
          await refreshKiteTerminalData();
        } else {
          displayError('Failed to authenticate request token.');
        }
      } catch (err) {
        displayError('Authentication Error: ' + err.message);
      } finally {
        showLoader(false);
      }
    });
  }

  if (elements.btnDisconnectKite) {
    elements.btnDisconnectKite.addEventListener('click', async () => {
      if (confirm('Disconnect Zerodha Kite account? This will revert back to Sandbox Mode.')) {
        showLoader(true);
        try {
          await api.disconnectKite();
          showKiteToast('Disconnected from Zerodha. Reverted to Sandbox.', 'success');
          await refreshKiteTerminalData();
        } catch (err) {
          displayError('Disconnect Error: ' + err.message);
        } finally {
          showLoader(false);
        }
      }
    });
  }

  elements.tradingTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.tradingTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const targetTabId = btn.getAttribute('data-tab');
      state.kite = state.kite || {};
      state.kite.activeTab = targetTabId;

      elements.tradingTabContents.forEach(content => {
        if (content.id === targetTabId) {
          content.classList.remove('hidden');
        } else {
          content.classList.add('hidden');
        }
      });

      refreshKiteTerminalData();
    });
  });

  if (elements.btnCreateGttShortcut) {
    elements.btnCreateGttShortcut.addEventListener('click', () => {
      elements.gttSearchInput.value = '';
      elements.gttSearchInput.dataset.symbol = '';
      elements.gttSearchInput.dataset.price = '';
      elements.gttTriggerPrice.value = '';
      elements.gttOrderPrice.value = '';
      elements.gttQuantity.value = '10';
      if (elements.gttSlTriggerPrice) {
        elements.gttSlTriggerPrice.value = '';
        elements.gttSlOrderPrice.value = '';
      }
      elements.gttModal.classList.remove('hidden');
    });
  }

  if (elements.btnCloseGttModal) {
    elements.btnCloseGttModal.addEventListener('click', () => {
      elements.gttModal.classList.add('hidden');
    });
  }

  if (elements.gttSearchInput) {
    elements.gttSearchInput.addEventListener('input', (e) => {
      handleGttSuggestions(e.target.value);
    });
    document.addEventListener('click', (e) => {
      if (!elements.gttSearchInput.contains(e.target) && !elements.gttSearchSuggestions.contains(e.target)) {
        elements.gttSearchSuggestions.classList.add('hidden');
      }
    });
  }

  if (elements.gttTriggerType) {
    elements.gttTriggerType.addEventListener('change', (e) => {
      const type = e.target.value;
      if (type === 'oco') {
        elements.gttOcoFields.classList.remove('hidden');
        elements.gttTriggerLabel.textContent = 'Target Trigger Price (₹)';
        elements.gttOrderLabel.textContent = 'Target Limit Order Price (₹)';
      } else {
        elements.gttOcoFields.classList.add('hidden');
        elements.gttTriggerLabel.textContent = 'Trigger Price (₹)';
        elements.gttOrderLabel.textContent = 'Limit Order Price (₹)';
      }
    });
  }

  if (elements.gttModalForm) {
    elements.gttModalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const symbol = elements.gttSearchInput.dataset.symbol;
      if (!symbol) {
        displayError('Please select a stock or mutual fund from the suggestions.');
        return;
      }

      const params = {
        symbol: symbol,
        exchange: 'NSE',
        transaction_type: elements.gttTransactionType.value,
        trigger_type: elements.gttTriggerType.value,
        trigger_price: elements.gttTriggerPrice.value,
        order_price: elements.gttOrderPrice.value,
        quantity: elements.gttQuantity.value,
        product: elements.gttProduct.value
      };

      if (params.trigger_type === 'oco') {
        params.stoploss_trigger_price = elements.gttSlTriggerPrice.value;
        params.stoploss_order_price = elements.gttSlOrderPrice.value;
      }

      showLoader(true);
      try {
        await api.placeKiteGTT(params);
        showKiteToast(`GTT Trigger for ${symbol} set successfully.`, 'success');
        elements.gttModal.classList.add('hidden');
        if (state.activePage === 'kite-page') {
          refreshKiteTerminalData();
        }
      } catch (err) {
        displayError('Failed to place GTT trigger: ' + err.message);
      } finally {
        showLoader(false);
      }
    });
  }

  if (elements.btnTradingViewLocal) {
    elements.btnTradingViewLocal.addEventListener('click', () => {
      elements.btnTradingViewLocal.classList.add('active');
      elements.btnTradingViewKite.classList.remove('active');
      elements.btnTradingViewGtt.classList.remove('active');

      elements.portfolioForm.classList.remove('hidden');
      elements.kiteOrderForm.classList.add('hidden');
      elements.kiteGttForm.classList.add('hidden');
    });
  }

  if (elements.btnTradingViewKite) {
    elements.btnTradingViewKite.addEventListener('click', () => {
      elements.btnTradingViewLocal.classList.remove('active');
      elements.btnTradingViewKite.classList.add('active');
      elements.btnTradingViewGtt.classList.remove('active');

      elements.portfolioForm.classList.add('hidden');
      elements.kiteOrderForm.classList.remove('hidden');
      elements.kiteGttForm.classList.add('hidden');

      const currentPriceVal = parseFloat(elements.stockPrice.textContent.replace(/[₹,]/g, '')) || 0;
      elements.analyzerKitePrice.value = currentPriceVal.toFixed(2);
    });
  }

  if (elements.btnTradingViewGtt) {
    elements.btnTradingViewGtt.addEventListener('click', () => {
      elements.btnTradingViewLocal.classList.remove('active');
      elements.btnTradingViewKite.classList.remove('active');
      elements.btnTradingViewGtt.classList.add('active');

      elements.portfolioForm.classList.add('hidden');
      elements.kiteOrderForm.classList.add('hidden');
      elements.kiteGttForm.classList.remove('hidden');

      const currentPriceVal = parseFloat(elements.stockPrice.textContent.replace(/[₹,]/g, '')) || 0;
      elements.analyzerGttTriggerPrice.value = currentPriceVal.toFixed(2);
      elements.analyzerGttOrderPrice.value = currentPriceVal.toFixed(2);
      elements.analyzerGttSlTriggerPrice.value = (currentPriceVal * 0.95).toFixed(2);
      elements.analyzerGttSlOrderPrice.value = (currentPriceVal * 0.94).toFixed(2);
    });
  }

  if (elements.analyzerKiteType) {
    elements.analyzerKiteType.addEventListener('change', (e) => {
      const type = e.target.value;
      if (type === 'LIMIT') {
        elements.analyzerKitePrice.removeAttribute('disabled');
      } else {
        elements.analyzerKitePrice.setAttribute('disabled', 'true');
        const currentPriceVal = parseFloat(elements.stockPrice.textContent.replace(/[₹,]/g, '')) || 0;
        elements.analyzerKitePrice.value = currentPriceVal.toFixed(2);
      }
    });
  }

  if (elements.kiteOrderForm) {
    elements.kiteOrderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const symbol = state.currentSymbol;
      const actionRaw = elements.analyzerKiteTransaction.value;
      const isMIS = actionRaw.endsWith('_MIS');
      const transactionType = isMIS ? actionRaw.replace('_MIS', '') : actionRaw;
      const product = isMIS ? 'MIS' : 'CNC';

      const params = {
        symbol: symbol,
        exchange: 'NSE',
        transaction_type: transactionType,
        order_type: elements.analyzerKiteType.value,
        quantity: elements.analyzerKiteQty.value,
        product: product
      };

      if (params.order_type === 'LIMIT') {
        params.price = elements.analyzerKitePrice.value;
      }

      showLoader(true);
      try {
        const res = await api.placeKiteOrder(params);
        showKiteToast(`Kite Order placed successfully. ID: ${res.order_id}`, 'success');
        elements.analyzerKiteQty.value = '10';
        if (state.activePage === 'kite-page') {
          refreshKiteTerminalData();
        }
      } catch (err) {
        displayError('Failed to place Kite Order: ' + err.message);
      } finally {
        showLoader(false);
      }
    });
  }

  if (elements.analyzerGttType) {
    elements.analyzerGttType.addEventListener('change', (e) => {
      const type = e.target.value;
      if (type === 'oco') {
        elements.analyzerGttOcoFields.classList.remove('hidden');
        elements.analyzerGttTriggerLabel.textContent = 'Target Trigger (₹)';
        elements.analyzerGttOrderLabel.textContent = 'Target Order Price (₹)';
      } else {
        elements.analyzerGttOcoFields.classList.add('hidden');
        elements.analyzerGttTriggerLabel.textContent = 'Trigger (₹)';
        elements.analyzerGttOrderLabel.textContent = 'Order Price (₹)';
      }
    });
  }

  if (elements.kiteGttForm) {
    elements.kiteGttForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const symbol = state.currentSymbol;
      const params = {
        symbol: symbol,
        exchange: 'NSE',
        transaction_type: elements.analyzerGttTransaction.value,
        trigger_type: elements.analyzerGttType.value,
        trigger_price: elements.analyzerGttTriggerPrice.value,
        order_price: elements.analyzerGttOrderPrice.value,
        quantity: elements.analyzerGttQty.value,
        product: 'CNC'
      };

      if (params.trigger_type === 'oco') {
        params.stoploss_trigger_price = elements.analyzerGttSlTriggerPrice.value;
        params.stoploss_order_price = elements.analyzerGttSlOrderPrice.value;
      }

      showLoader(true);
      try {
        await api.placeKiteGTT(params);
        showKiteToast(`Kite GTT Trigger for ${symbol} set successfully.`, 'success');
        elements.analyzerGttQty.value = '10';
        if (state.activePage === 'kite-page') {
          refreshKiteTerminalData();
        }
      } catch (err) {
        displayError('Failed to place GTT trigger: ' + err.message);
      } finally {
        showLoader(false);
      }
    });
  }
}

// -------------------------------------------------------------
// APP INITIALIZATION
// -------------------------------------------------------------
async function init() {
  setupNavigation();
  setupListeners();
  
  // 1. Initial Load of Screener Data Cache
  await loadScreenerData();

  // 2. Initialize Firebase config if saved
  const savedConfig = getSavedFirebaseConfig();
  if (savedConfig) {
    // Populate form
    elements.fbApiKey.value = savedConfig.apiKey || '';
    elements.fbAuthDomain.value = savedConfig.authDomain || '';
    elements.fbProjectId.value = savedConfig.projectId || '';
    elements.fbStorageBucket.value = savedConfig.storageBucket || '';
    elements.fbAppId.value = savedConfig.appId || '';
    
    // Connect silently
    await connectFirebase(savedConfig);
  } else {
    state.firebaseConnected = false;
    updateSyncStatusUI();
  }

  // Populate Backend Server URL configuration
  elements.settingsApiUrl.value = localStorage.getItem('BACKEND_API_URL') || '';

  // 3. Load default active stock (Reliance Industries)
  await loadStock(state.currentSymbol);
  
  // 4. Initial render of Market Overview and sub components
  await refreshMarketOverview();
  
  // Helper to gather visible assets to prioritize live quoting
  function getActiveSymbols() {
    const symbols = new Set();
    
    // Sidebar watchlist is always visible
    if (state.watchlist && Array.isArray(state.watchlist)) {
      state.watchlist.forEach(sym => symbols.add(sym.toUpperCase()));
    }
    
    if (state.activePage === 'analyzer-page') {
      if (state.currentSymbol) {
        symbols.add(state.currentSymbol.toUpperCase());
      }
    } else if (state.activePage === 'market-page') {
      // Gainers & Losers
      const rows = [
        ...elements.topGainersList.querySelectorAll('tr'),
        ...elements.topLosersList.querySelectorAll('tr')
      ];
      rows.forEach(tr => {
        const sym = tr.getAttribute('data-symbol');
        if (sym) symbols.add(sym.toUpperCase());
      });

      // Screener results (visible slice)
      const screenerRows = [...elements.screenerResultsBody.querySelectorAll('tr')].slice(0, 30);
      screenerRows.forEach(tr => {
        const cellText = tr.cells[0]?.textContent?.trim();
        if (cellText && !cellText.includes('Showing')) symbols.add(cellText.toUpperCase());
      });
    } else if (state.activePage === 'kite-page') {
      const holdingRows = [...elements.kiteHoldingsTbody.querySelectorAll('tr')];
      holdingRows.forEach(tr => {
        const cellText = tr.cells[0]?.textContent?.trim();
        if (cellText && !cellText.includes('No holdings')) symbols.add(cellText.toUpperCase());
      });
      const positionRows = [...elements.kitePositionsTbody.querySelectorAll('tr')];
      positionRows.forEach(tr => {
        const cellText = tr.cells[0]?.textContent?.trim();
        if (cellText && !cellText.includes('No open positions')) symbols.add(cellText.toUpperCase());
      });
      const gttRows = [...elements.kiteGttTbody.querySelectorAll('tr')];
      gttRows.forEach(tr => {
        const cellText = tr.cells[0]?.textContent?.trim();
        if (cellText && !cellText.includes('No GTT triggers')) symbols.add(cellText.toUpperCase());
      });
    }
    return Array.from(symbols);
  }

  // Set background polling loop for market data updates (every 2s)
  let ticksCount = 0;
  setInterval(async () => {
    ticksCount++;
    
    // 1. Fetch live quotes for active symbols in a single batch
    const activeSymbols = getActiveSymbols();
    if (activeSymbols.length > 0) {
      try {
        const res = await api.getLiveQuotes(activeSymbols);
        const liveQuotes = res.quotes || [];
        
        // Update local client quote cache
        liveQuotes.forEach(q => {
          state.quotesCache[q.symbol] = {
            ...state.quotesCache[q.symbol],
            ...q
          };
          
          // Also update state.screenerData if present
          if (state.screenerData) {
            const idx = state.screenerData.findIndex(s => s.symbol === q.symbol);
            if (idx !== -1) {
              state.screenerData[idx] = {
                ...state.screenerData[idx],
                ...q
              };
            }
          }
        });

        // 2. Perform granular in-place UI updates
        // Watchlist update (cheap re-render since we have cached data)
        await refreshSidebarWatchlist(true);

        // Analyzer details update (if on analyzer page)
        if (state.activePage === 'analyzer-page' && state.currentSymbol) {
          const q = state.quotesCache[state.currentSymbol.toUpperCase()];
          if (q) {
            elements.stockPrice.textContent = `₹${q.price.toFixed(2)}`;
            const isUp = q.change >= 0;
            elements.stockChange.className = `stock-change ${isUp ? 'positive' : 'negative'}`;
            elements.stockChange.textContent = `${isUp ? '▲' : '▼'} ₹${Math.abs(q.change).toFixed(2)} (${isUp ? '+' : ''}${q.changePercent.toFixed(2)}%)`;
            if (elements.lastUpdatedText) {
              elements.lastUpdatedText.textContent = `Last active tick: ${new Date().toLocaleTimeString()}`;
            }
            if (elements.portfolioPrice) {
              elements.portfolioPrice.value = q.price.toFixed(2);
            }
          }
        }

        // Market/Screener rows update in-place
        if (state.activePage === 'market-page') {
          // Update gainers/losers in-place
          const moverRows = [
            ...elements.topGainersList.querySelectorAll('tr'),
            ...elements.topLosersList.querySelectorAll('tr')
          ];
          moverRows.forEach(tr => {
            const sym = tr.getAttribute('data-symbol');
            const q = state.quotesCache[sym];
            if (q) {
              const priceCell = tr.cells[1];
              const pctCell = tr.cells[2];
              if (priceCell) priceCell.textContent = `₹${q.price.toFixed(2)}`;
              if (pctCell) {
                const isUp = q.changePercent >= 0;
                pctCell.className = isUp ? 'text-positive' : 'text-negative';
                pctCell.textContent = `${isUp ? '+' : ''}${q.changePercent.toFixed(2)}%`;
              }
            }
          });

          // Update visible screener table rows in-place
          const screenerRows = [...elements.screenerResultsBody.querySelectorAll('tr')];
          screenerRows.forEach(tr => {
            const sym = tr.cells[0]?.textContent?.trim();
            const q = state.quotesCache[sym];
            if (q) {
              const isUp = q.changePercent >= 0;
              const priceCell = tr.cells[3];
              const pctCell = tr.cells[4];
              const volCell = tr.cells[7];
              
              if (priceCell) priceCell.textContent = `₹${q.price.toFixed(2)}`;
              if (pctCell) {
                pctCell.className = `text-right ${isUp ? 'text-positive' : 'text-negative'}`;
                pctCell.textContent = `${isUp ? '+' : ''}${q.changePercent.toFixed(2)}%`;
              }
              if (volCell && q.volume) {
                volCell.textContent = q.volume.toLocaleString('en-IN');
              }
            }
          });
        }
      } catch (err) {
        console.warn('Live quotes active sync failed:', err.message);
      }
    }

    // 3. Page specific background loops (Indices, Kite connection details)
    if (state.activePage === 'market-page' && ticksCount % 3 === 0) {
      await refreshIndices();
    } else if (state.activePage === 'kite-page') {
      await refreshKiteTerminalData();
    }

    // 4. Secondary process: Full refresh of master lists/database every 30 seconds (15 ticks)
    if (ticksCount % 15 === 0) {
      try {
        console.log('Triggering background secondary full refresh...');
        await api.triggerLiveSync();
        await loadScreenerData();
      } catch (refreshErr) {
        console.error('Secondary full refresh failed:', refreshErr.message);
      }
    }
  }, 2000);
}

// Execute on DOM load
document.addEventListener('DOMContentLoaded', () => {
  init().catch(err => {
    console.error("Initialization error:", err);
    displayError("Application failed to boot cleanly. Check logs.");
  });
});
