// api.js - Frontend Client Wrapper for Stock Analyzer REST API

const API_BASE = '/api';

export async function searchSymbols(query) {
  const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to search symbols');
  }
  return response.json();
}

export async function getStockQuote(symbol) {
  const response = await fetch(`${API_BASE}/quote/${encodeURIComponent(symbol)}`);
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to fetch stock quote');
  }
  return response.json();
}

export async function getHistoricalData(symbol, range = '1mo') {
  const response = await fetch(`${API_BASE}/chart/${encodeURIComponent(symbol)}?range=${range}`);
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to fetch historical chart data');
  }
  return response.json();
}

export async function getTechnicalAnalysis(symbol) {
  const response = await fetch(`${API_BASE}/analysis/${encodeURIComponent(symbol)}`);
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to fetch technical analysis');
  }
  return response.json();
}

export async function getStockNews(symbol) {
  const response = await fetch(`${API_BASE}/news/${encodeURIComponent(symbol)}`);
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to fetch news');
  }
  return response.json();
}

export async function getIndices() {
  const response = await fetch(`${API_BASE}/indices`);
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to fetch indices');
  }
  return response.json();
}

export async function getScreenerData() {
  const response = await fetch(`${API_BASE}/screener`);
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to fetch screener data');
  }
  return response.json();
}

export async function triggerLiveSync() {
  const response = await fetch(`${API_BASE}/refresh`, { method: 'POST' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Sync failed' }));
    throw new Error(err.error || 'Failed to trigger live sync');
  }
  return response.json();
}

// --- ZERODHA KITE CONNECT CLIENT WRAPPERS ---

export async function getKiteStatus() {
  const response = await fetch(`${API_BASE}/kite/status`);
  return response.json();
}

export async function saveKiteConfig(apiKey, apiSecret) {
  const response = await fetch(`${API_BASE}/kite/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, apiSecret })
  });
  return response.json();
}

export async function authenticateKite(requestToken) {
  const response = await fetch(`${API_BASE}/kite/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestToken })
  });
  return response.json();
}

export async function toggleKiteSandbox(enabled) {
  const response = await fetch(`${API_BASE}/kite/sandbox/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled })
  });
  return response.json();
}

export async function disconnectKite() {
  const response = await fetch(`${API_BASE}/kite/disconnect`, { method: 'POST' });
  return response.json();
}

export async function getKiteMargins() {
  const response = await fetch(`${API_BASE}/kite/margins`);
  return response.json();
}

export async function getKiteHoldings() {
  const response = await fetch(`${API_BASE}/kite/holdings`);
  return response.json();
}

export async function getKitePositions() {
  const response = await fetch(`${API_BASE}/kite/positions`);
  return response.json();
}

export async function getKiteOrders() {
  const response = await fetch(`${API_BASE}/kite/orders`);
  return response.json();
}

export async function placeKiteOrder(orderParams) {
  const response = await fetch(`${API_BASE}/kite/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderParams)
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to place order');
  }
  return response.json();
}

export async function cancelKiteOrder(orderId) {
  const response = await fetch(`${API_BASE}/kite/order/${encodeURIComponent(orderId)}`, {
    method: 'DELETE'
  });
  return response.json();
}

export async function getKiteGTT() {
  const response = await fetch(`${API_BASE}/kite/gtt`);
  return response.json();
}

export async function placeKiteGTT(gttParams) {
  const response = await fetch(`${API_BASE}/kite/gtt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(gttParams)
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to place GTT');
  }
  return response.json();
}

export async function deleteKiteGTT(triggerId) {
  const response = await fetch(`${API_BASE}/kite/gtt/${encodeURIComponent(triggerId)}`, {
    method: 'DELETE'
  });
  return response.json();
}


