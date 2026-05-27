const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CONFIG_PATH = path.join(__dirname, 'kite-config.json');
const SANDBOX_PATH = path.join(__dirname, 'kite-sandbox.json');

// Memory states
let config = {
  apiKey: '',
  apiSecret: '',
  accessToken: '',
  publicToken: '',
  userId: '',
  userName: 'Kite User'
};

let isSandbox = true;
let notifications = [];

// Initialize Sandbox Default Database
const DEFAULT_SANDBOX = {
  margins: {
    cash: 1000000.00,
    used: 0.00,
    collateral: 0.00
  },
  holdings: [
    {
      tradingsymbol: "RELIANCE.NS",
      exchange: "NSE",
      quantity: 50,
      average_price: 2450.00,
      current_price: 2450.00,
      pnl: 0.00
    },
    {
      tradingsymbol: "TCS.NS",
      exchange: "NSE",
      quantity: 25,
      average_price: 3400.00,
      current_price: 3400.00,
      pnl: 0.00
    }
  ],
  positions: [],
  orders: [],
  gtt_triggers: []
};

let sandboxData = { ...DEFAULT_SANDBOX };

// Load files on startup
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf8');
      config = { ...config, ...JSON.parse(data) };
      console.log('Kite config loaded successfully.');
    }
  } catch (err) {
    console.error('Error loading Kite config:', err.message);
  }
}

function loadSandbox() {
  try {
    if (fs.existsSync(SANDBOX_PATH)) {
      const data = fs.readFileSync(SANDBOX_PATH, 'utf8');
      sandboxData = JSON.parse(data);
      console.log('Kite sandbox data loaded successfully.');
    } else {
      saveSandbox();
    }
  } catch (err) {
    console.error('Error loading Kite sandbox data:', err.message);
    sandboxData = { ...DEFAULT_SANDBOX };
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving Kite config:', err.message);
  }
}

function saveSandbox() {
  try {
    fs.writeFileSync(SANDBOX_PATH, JSON.stringify(sandboxData, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving Kite sandbox data:', err.message);
  }
}

// Initialize
loadConfig();
loadSandbox();

// Raw Zerodha HTTP request client helper
async function kiteRequest(method, endpoint, bodyParams = null) {
  if (!config.apiKey || !config.accessToken) {
    throw new Error('Zerodha Kite session not connected. Configure credentials and login.');
  }

  const url = `https://api.kite.trade${endpoint}`;
  const headers = {
    'X-Kite-Version': '3',
    'Authorization': `token ${config.apiKey}:${config.accessToken}`,
    'Accept': 'application/json'
  };

  let body = null;
  if (bodyParams) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = Object.keys(bodyParams)
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(bodyParams[k])}`)
      .join('&');
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body
    });

    const data = await response.json();
    if (!response.ok || data.status === 'error') {
      throw new Error(data.message || `Zerodha API Error: ${response.status}`);
    }
    return data.data;
  } catch (err) {
    console.error(`Kite API request failed [${method} ${endpoint}]:`, err.message);
    throw err;
  }
}

module.exports = {
  // Toggle Mode
  getIsSandbox: () => isSandbox,
  setSandboxMode: (enabled) => {
    isSandbox = !!enabled;
    return isSandbox;
  },

  // Config management
  getConfig: () => ({
    apiKey: config.apiKey,
    hasSecret: !!config.apiSecret,
    userId: config.userId,
    userName: config.userName,
    isConnected: !!config.accessToken
  }),

  saveCredentials: (apiKey, apiSecret) => {
    config.apiKey = apiKey || config.apiKey;
    config.apiSecret = apiSecret || config.apiSecret;
    saveConfig();
    return { success: true };
  },

  getLoginUrl: () => {
    if (!config.apiKey) {
      throw new Error('API Key is missing. Configure credentials first.');
    }
    return `https://kite.zerodha.com/connect/login?api_key=${config.apiKey}&v=3`;
  },

  authenticate: async (requestToken) => {
    if (!config.apiKey || !config.apiSecret) {
      throw new Error('Kite API Key and API Secret must be configured before authentication.');
    }

    const checksumSource = config.apiKey + requestToken + config.apiSecret;
    const checksum = crypto.createHash('sha256').update(checksumSource).digest('hex');

    const bodyParams = {
      api_key: config.apiKey,
      request_token: requestToken,
      checksum: checksum
    };

    try {
      const response = await fetch('https://api.kite.trade/session/token', {
        method: 'POST',
        headers: {
          'X-Kite-Version': '3',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: Object.keys(bodyParams)
          .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(bodyParams[k])}`)
          .join('&')
      });

      const data = await response.json();
      if (!response.ok || data.status === 'error') {
        throw new Error(data.message || `Failed to authenticate token: ${response.status}`);
      }

      const resData = data.data;
      config.accessToken = resData.access_token;
      config.publicToken = resData.public_token;
      config.userId = resData.user_id;
      config.userName = resData.user_name || resData.email || 'Kite User';
      
      saveConfig();
      isSandbox = false; // Automatically switch to real trading once connected
      return { success: true, user: config.userName };
    } catch (err) {
      console.error('Authentication Error:', err.message);
      throw err;
    }
  },

  disconnect: () => {
    config.accessToken = '';
    config.publicToken = '';
    saveConfig();
    isSandbox = true; // Switch back to sandbox mode
    return { success: true };
  },

  // Margin/Funds
  getMargins: async () => {
    if (isSandbox) {
      return {
        equity: {
          enabled: true,
          net: sandboxData.margins.cash,
          available: {
            cash: sandboxData.margins.cash,
            intraday_payin: 0,
            ad_hoc_margin: 0,
            collateral: sandboxData.margins.collateral
          },
          utilised: {
            debits: sandboxData.margins.used,
            exposure: 0,
            m2m_realised: 0,
            m2m_unrealised: 0,
            option_premium: 0,
            span: 0,
            holding_sales: 0,
            turnover: 0
          }
        }
      };
    } else {
      return kiteRequest('GET', '/user/margins');
    }
  },

  // Get Profile
  getProfile: async () => {
    if (isSandbox) {
      return {
        user_id: 'SANDBOX',
        user_name: 'Sandbox Account',
        email: 'sandbox@aurastock.local',
        user_type: 'individual'
      };
    } else {
      return kiteRequest('GET', '/user/profile');
    }
  },

  // Portfolio Holdings
  getHoldings: async (priceLookup = {}) => {
    if (isSandbox) {
      // Update holdings prices from lookup
      sandboxData.holdings.forEach(h => {
        const livePrice = priceLookup[h.tradingsymbol];
        if (livePrice) {
          h.current_price = livePrice;
          h.pnl = (h.current_price - h.average_price) * h.quantity;
        }
      });
      saveSandbox();
      return sandboxData.holdings.map(h => ({
        tradingsymbol: h.tradingsymbol.replace('.NS', ''),
        exchange: h.exchange,
        quantity: h.quantity,
        t1_quantity: 0,
        realised_quantity: h.quantity,
        authorised_quantity: h.quantity,
        average_price: h.average_price,
        last_price: h.current_price,
        pnl: h.pnl,
        close_price: h.average_price // Dummy close
      }));
    } else {
      return kiteRequest('GET', '/portfolio/holdings');
    }
  },

  // Portfolio Positions
  getPositions: async (priceLookup = {}) => {
    if (isSandbox) {
      sandboxData.positions.forEach(p => {
        const livePrice = priceLookup[p.tradingsymbol];
        if (livePrice) {
          p.current_price = livePrice;
          const multiplier = p.transaction_type === 'BUY' ? 1 : -1;
          p.pnl = (p.current_price - p.average_price) * p.quantity * multiplier;
        }
      });
      saveSandbox();
      return {
        net: sandboxData.positions.map(p => ({
          tradingsymbol: p.tradingsymbol.replace('.NS', ''),
          exchange: p.exchange,
          product: p.product,
          quantity: p.quantity,
          buy_quantity: p.transaction_type === 'BUY' ? p.quantity : 0,
          sell_quantity: p.transaction_type === 'SELL' ? p.quantity : 0,
          buy_value: p.transaction_type === 'BUY' ? p.quantity * p.average_price : 0,
          sell_value: p.transaction_type === 'SELL' ? p.quantity * p.average_price : 0,
          average_price: p.average_price,
          last_price: p.current_price,
          pnl: p.pnl,
          m2m: p.pnl
        })),
        day: []
      };
    } else {
      return kiteRequest('GET', '/portfolio/positions');
    }
  },

  // Orders
  getOrders: async () => {
    if (isSandbox) {
      return sandboxData.orders;
    } else {
      return kiteRequest('GET', '/orders');
    }
  },

  // Place Order
  placeOrder: async (params, priceLookup = {}) => {
    // Normalize exchange symbols
    const rawSymbol = params.symbol.toUpperCase();
    const symbolWithNS = rawSymbol.endsWith('.NS') || rawSymbol.match(/^\d+$/) ? rawSymbol : `${rawSymbol}.NS`;
    const cleanSymbol = rawSymbol.replace('.NS', '');

    if (isSandbox) {
      const orderId = `MOCK-${Date.now()}`;
      const livePrice = priceLookup[symbolWithNS] || params.price || 100.00;
      const orderPrice = params.order_type === 'MARKET' ? livePrice : parseFloat(params.price);
      const qty = parseInt(params.quantity);
      const totalCost = qty * orderPrice;

      // Basic validations
      if (params.transaction_type === 'BUY') {
        if (sandboxData.margins.cash < totalCost) {
          const rejectOrder = {
            order_id: orderId,
            tradingsymbol: cleanSymbol,
            exchange: params.exchange || 'NSE',
            transaction_type: 'BUY',
            quantity: qty,
            price: orderPrice,
            order_type: params.order_type || 'LIMIT',
            product: params.product || 'CNC',
            status: 'REJECTED',
            status_message: 'Insufficient margins/funds in account.',
            order_timestamp: new Date().toISOString()
          };
          sandboxData.orders.unshift(rejectOrder);
          saveSandbox();
          throw new Error('Insufficient simulated funds.');
        }

        // Deduct money
        sandboxData.margins.cash -= totalCost;
        sandboxData.margins.used += totalCost;

        // Add to holdings (CNC) or positions (MIS/Intraday)
        if (params.product === 'CNC' || rawSymbol.match(/^\d+$/)) {
          const existing = sandboxData.holdings.find(h => h.tradingsymbol === symbolWithNS);
          if (existing) {
            const totalQty = existing.quantity + qty;
            existing.average_price = ((existing.average_price * existing.quantity) + totalCost) / totalQty;
            existing.quantity = totalQty;
          } else {
            sandboxData.holdings.push({
              tradingsymbol: symbolWithNS,
              exchange: params.exchange || 'NSE',
              quantity: qty,
              average_price: orderPrice,
              current_price: livePrice,
              pnl: 0.00
            });
          }
        } else {
          // Intraday MIS Positions
          const existing = sandboxData.positions.find(p => p.tradingsymbol === symbolWithNS && p.product === params.product);
          if (existing) {
            const totalQty = existing.quantity + qty;
            existing.average_price = ((existing.average_price * existing.quantity) + totalCost) / totalQty;
            existing.quantity = totalQty;
          } else {
            sandboxData.positions.push({
              tradingsymbol: symbolWithNS,
              exchange: params.exchange || 'NSE',
              quantity: qty,
              average_price: orderPrice,
              current_price: livePrice,
              transaction_type: 'BUY',
              product: params.product,
              pnl: 0.00
            });
          }
        }
      } else { // SELL
        if (params.product === 'CNC' || rawSymbol.match(/^\d+$/)) {
          const existing = sandboxData.holdings.find(h => h.tradingsymbol === symbolWithNS);
          if (!existing || existing.quantity < qty) {
            const rejectOrder = {
              order_id: orderId,
              tradingsymbol: cleanSymbol,
              exchange: params.exchange || 'NSE',
              transaction_type: 'SELL',
              quantity: qty,
              price: orderPrice,
              order_type: params.order_type || 'LIMIT',
              product: params.product || 'CNC',
              status: 'REJECTED',
              status_message: 'Insufficient shares in holdings.',
              order_timestamp: new Date().toISOString()
            };
            sandboxData.orders.unshift(rejectOrder);
            saveSandbox();
            throw new Error('Insufficient holding shares.');
          }

          // Reduce shares
          existing.quantity -= qty;
          if (existing.quantity === 0) {
            sandboxData.holdings = sandboxData.holdings.filter(h => h.tradingsymbol !== symbolWithNS);
          }

          // Add cash
          sandboxData.margins.cash += totalCost;
          sandboxData.margins.used = Math.max(0, sandboxData.margins.used - totalCost);
        } else {
          // MIS Positions shorting/closing
          const existing = sandboxData.positions.find(p => p.tradingsymbol === symbolWithNS && p.product === params.product);
          if (existing && existing.transaction_type === 'BUY') {
            // Closing a long position
            if (existing.quantity < qty) {
              throw new Error('Cannot sell more than open positions in sandbox mode.');
            }
            existing.quantity -= qty;
            if (existing.quantity === 0) {
              sandboxData.positions = sandboxData.positions.filter(p => !(p.tradingsymbol === symbolWithNS && p.product === params.product));
            }
            sandboxData.margins.cash += totalCost;
            sandboxData.margins.used = Math.max(0, sandboxData.margins.used - totalCost);
          } else {
            // Opening a short position
            sandboxData.margins.cash += totalCost; // Short sell credit
            sandboxData.positions.push({
              tradingsymbol: symbolWithNS,
              exchange: params.exchange || 'NSE',
              quantity: qty,
              average_price: orderPrice,
              current_price: livePrice,
              transaction_type: 'SELL',
              product: params.product,
              pnl: 0.00
            });
          }
        }
      }

      const completeOrder = {
        order_id: orderId,
        tradingsymbol: cleanSymbol,
        exchange: params.exchange || 'NSE',
        transaction_type: params.transaction_type,
        quantity: qty,
        price: orderPrice,
        order_type: params.order_type || 'LIMIT',
        product: params.product || 'CNC',
        status: 'COMPLETE',
        status_message: 'Executed successfully',
        order_timestamp: new Date().toISOString()
      };

      sandboxData.orders.unshift(completeOrder);
      saveSandbox();
      return { order_id: orderId };
    } else {
      // Real API order placement
      const body = {
        tradingsymbol: cleanSymbol,
        exchange: params.exchange || 'NSE',
        transaction_type: params.transaction_type,
        order_type: params.order_type || 'LIMIT',
        quantity: params.quantity,
        product: params.product || 'CNC',
        validity: params.validity || 'DAY'
      };

      if (params.order_type !== 'MARKET') {
        body.price = params.price;
      }
      return kiteRequest('POST', '/orders/regular', body);
    }
  },

  // Cancel order
  cancelOrder: async (orderId) => {
    if (isSandbox) {
      const order = sandboxData.orders.find(o => o.order_id === orderId);
      if (order && order.status === 'PUT ORDER REQ RECEIVED') {
        order.status = 'CANCELLED';
        saveSandbox();
        return { success: true };
      }
      throw new Error('Order cannot be cancelled. Already completed or rejected.');
    } else {
      return kiteRequest('DELETE', `/orders/regular/${orderId}`);
    }
  },

  // Get GTT Triggers
  getGTTTriggers: async () => {
    if (isSandbox) {
      return sandboxData.gtt_triggers;
    } else {
      return kiteRequest('GET', '/gtt/triggers');
    }
  },

  // Place GTT Trigger
  placeGTT: async (params, priceLookup = {}) => {
    const rawSymbol = params.symbol.toUpperCase();
    const symbolWithNS = rawSymbol.endsWith('.NS') || rawSymbol.match(/^\d+$/) ? rawSymbol : `${rawSymbol}.NS`;
    const cleanSymbol = rawSymbol.replace('.NS', '');

    if (isSandbox) {
      const triggerId = `GTT-${Date.now()}`;
      const livePrice = priceLookup[symbolWithNS] || 100.00;

      const trigger = {
        id: triggerId,
        tradingsymbol: cleanSymbol,
        symbol_ns: symbolWithNS,
        exchange: params.exchange || 'NSE',
        type: params.trigger_type || 'single',
        condition: {
          trigger_values: [parseFloat(params.trigger_price)],
          last_price: livePrice
        },
        orders: [
          {
            transaction_type: params.transaction_type,
            quantity: parseInt(params.quantity),
            price: parseFloat(params.order_price),
            order_type: 'LIMIT',
            product: params.product || 'CNC'
          }
        ],
        status: 'active',
        created_at: new Date().toISOString()
      };

      // If OCO, add second trigger point
      if (params.trigger_type === 'oco') {
        trigger.condition.trigger_values.push(parseFloat(params.stoploss_trigger_price));
        trigger.orders.push({
          transaction_type: params.transaction_type,
          quantity: parseInt(params.quantity),
          price: parseFloat(params.stoploss_order_price),
          order_type: 'LIMIT',
          product: params.product || 'CNC'
        });
      }

      sandboxData.gtt_triggers.unshift(trigger);
      saveSandbox();
      return { id: triggerId };
    } else {
      // Real API GTT Placement
      const condition = {
        exchange: params.exchange || 'NSE',
        tradingsymbol: cleanSymbol,
        trigger_values: [parseFloat(params.trigger_price)],
        last_price: priceLookup[symbolWithNS] || 100.00
      };

      const orders = [
        {
          exchange: params.exchange || 'NSE',
          tradingsymbol: cleanSymbol,
          transaction_type: params.transaction_type,
          quantity: parseInt(params.quantity),
          price: parseFloat(params.order_price),
          order_type: 'LIMIT',
          product: params.product || 'CNC'
        }
      ];

      if (params.trigger_type === 'oco') {
        condition.trigger_values.push(parseFloat(params.stoploss_trigger_price));
        orders.push({
          exchange: params.exchange || 'NSE',
          tradingsymbol: cleanSymbol,
          transaction_type: params.transaction_type,
          quantity: parseInt(params.quantity),
          price: parseFloat(params.stoploss_order_price),
          order_type: 'LIMIT',
          product: params.product || 'CNC'
        });
      }

      const body = {
        type: params.trigger_type === 'oco' ? 'two-leg' : 'single',
        condition: JSON.stringify(condition),
        orders: JSON.stringify(orders)
      };

      return kiteRequest('POST', '/gtt/triggers', body);
    }
  },

  // Delete GTT Trigger
  deleteGTT: async (triggerId) => {
    if (isSandbox) {
      sandboxData.gtt_triggers = sandboxData.gtt_triggers.filter(g => g.id !== triggerId);
      saveSandbox();
      return { success: true };
    } else {
      return kiteRequest('DELETE', `/gtt/triggers/${triggerId}`);
    }
  },

  // Notifications Queue (Retrieve & Flush)
  getNotifications: () => {
    const list = [...notifications];
    notifications = []; // clear queue
    return list;
  },

  // Background matching engine for Sandbox GTT Triggers
  evaluateTriggers: (screenerData) => {
    if (!isSandbox || sandboxData.gtt_triggers.length === 0) return;

    // Map screeners for easy lookups
    const prices = {};
    screenerData.forEach(item => {
      prices[item.symbol] = item.price;
    });

    const activeTriggers = sandboxData.gtt_triggers.filter(g => g.status === 'active');
    let dataModified = false;

    activeTriggers.forEach(g => {
      const symbolNS = g.symbol_ns;
      const livePrice = prices[symbolNS];
      if (!livePrice) return; // Wait until price is in screener list

      // Single trigger evaluation
      if (g.type === 'single') {
        const order = g.orders[0];
        const triggerVal = g.condition.trigger_values[0];

        let shouldFire = false;
        if (order.transaction_type === 'BUY' && livePrice <= triggerVal) {
          shouldFire = true;
        } else if (order.transaction_type === 'SELL' && livePrice >= triggerVal) {
          shouldFire = true;
        }

        if (shouldFire) {
          try {
            // Trigger the trade execution
            module.exports.placeOrder({
              symbol: symbolNS,
              exchange: g.exchange,
              transaction_type: order.transaction_type,
              quantity: order.quantity,
              price: order.price,
              order_type: 'LIMIT',
              product: order.product
            }, prices);

            g.status = 'triggered';
            notifications.push(`⚡ GTT Triggered: ${g.tradingsymbol} hit ${livePrice.toFixed(2)} (Target: ${triggerVal.toFixed(2)}). Order Executed!`);
            dataModified = true;
          } catch (err) {
            g.status = 'error';
            notifications.push(`⚠️ GTT Trigger Failed: ${g.tradingsymbol} hit ${livePrice.toFixed(2)} but order failed: ${err.message}`);
            dataModified = true;
          }
        }
      } 
      // OCO (Two-leg: Take-Profit / Stop-Loss) evaluation
      else if (g.type === 'oco') {
        const tpTrigger = g.condition.trigger_values[0];
        const slTrigger = g.condition.trigger_values[1];
        const tpOrder = g.orders[0];
        const slOrder = g.orders[1];

        let shouldFire = false;
        let selectedOrder = null;
        let firedVal = 0;

        // Sell OCO (Standard long-exit): Take Profit is above current price, Stop Loss is below current price
        if (tpOrder.transaction_type === 'SELL') {
          if (livePrice >= tpTrigger) {
            shouldFire = true;
            selectedOrder = tpOrder;
            firedVal = tpTrigger;
          } else if (livePrice <= slTrigger) {
            shouldFire = true;
            selectedOrder = slOrder;
            firedVal = slTrigger;
          }
        } 
        // Buy OCO (Standard short-exit): Take Profit is below current price, Stop Loss is above current price
        else {
          if (livePrice <= tpTrigger) {
            shouldFire = true;
            selectedOrder = tpOrder;
            firedVal = tpTrigger;
          } else if (livePrice >= slTrigger) {
            shouldFire = true;
            selectedOrder = slOrder;
            firedVal = slTrigger;
          }
        }

        if (shouldFire && selectedOrder) {
          try {
            module.exports.placeOrder({
              symbol: symbolNS,
              exchange: g.exchange,
              transaction_type: selectedOrder.transaction_type,
              quantity: selectedOrder.quantity,
              price: selectedOrder.price,
              order_type: 'LIMIT',
              product: selectedOrder.product
            }, prices);

            g.status = 'triggered';
            notifications.push(`⚡ OCO Triggered: ${g.tradingsymbol} hit ${livePrice.toFixed(2)} (Fired level: ${firedVal.toFixed(2)}). Order Executed!`);
            dataModified = true;
          } catch (err) {
            g.status = 'error';
            notifications.push(`⚠️ OCO Trigger Failed: ${g.tradingsymbol} hit ${livePrice.toFixed(2)} but order failed: ${err.message}`);
            dataModified = true;
          }
        }
      }
    });

    if (dataModified) {
      saveSandbox();
    }
  }
};
