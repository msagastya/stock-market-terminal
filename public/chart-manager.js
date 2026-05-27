// chart-manager.js - Handles stock price chart rendering and indicator calculations using Chart.js

// Math helpers for technical indicators
function calculateSMA(values, period) {
  const sma = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      sma.push(null);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += values[i - j];
      }
      sma.push(sum / period);
    }
  }
  return sma;
}

function calculateEMA(values, period) {
  const ema = [];
  if (values.length === 0) return ema;
  
  const k = 2 / (period + 1);
  
  // First value is SMA of the first 'period' elements
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i] || 0;
  }
  const initialSMA = sum / period;
  
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      ema.push(null);
    } else if (i === period - 1) {
      ema.push(initialSMA);
    } else {
      const prevEMA = ema[i - 1];
      const curEMA = (values[i] - prevEMA) * k + prevEMA;
      ema.push(curEMA);
    }
  }
  return ema;
}

function calculateBollingerBands(values, period, stdDevMultiplier = 2) {
  const middle = calculateSMA(values, period);
  const upper = [];
  const lower = [];
  
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1 || middle[i] === null) {
      upper.push(null);
      lower.push(null);
    } else {
      const mean = middle[i];
      let varianceSum = 0;
      for (let j = 0; j < period; j++) {
        varianceSum += Math.pow(values[i - j] - mean, 2);
      }
      const stdDev = Math.sqrt(varianceSum / period);
      upper.push(mean + stdDevMultiplier * stdDev);
      lower.push(mean - stdDevMultiplier * stdDev);
    }
  }
  
  return { middle, upper, lower };
}

// Draw a simple miniature index trend sparkline
export function renderSparkline(canvas, dataPoints, isPositive) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const color = isPositive ? '#10b981' : '#ef4444';
  
  const existingChart = Chart.getChart(canvas);
  if (existingChart) {
    existingChart.destroy();
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.clientHeight);
  gradient.addColorStop(0, isPositive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: dataPoints.map((_, i) => i),
      datasets: [{
        data: dataPoints,
        borderColor: color,
        borderWidth: 1.5,
        pointRadius: 0,
        fill: true,
        backgroundColor: gradient,
        tension: 0.25
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      },
      scales: {
        x: { display: false },
        y: { display: false }
      }
    }
  });
}

const lastPriceLinePlugin = {
  id: 'lastPriceLine',
  afterDraw: (chart) => {
    if (chart.data.datasets.length === 0) return;
    
    // Only apply to the main price chart
    const dataset = chart.data.datasets[0];
    if (dataset.label !== 'Price') return;
    
    const meta = chart.getDatasetMeta(0);
    if (!meta || meta.hidden || !meta.data.length) return;
    
    const lastPoint = meta.data[meta.data.length - 1];
    if (!lastPoint) return;
    
    const ctx = chart.ctx;
    const y = lastPoint.y;
    const chartArea = chart.chartArea;
    
    ctx.save();
    ctx.strokeStyle = dataset.borderColor;
    ctx.lineWidth = 1.25;
    ctx.setLineDash([4, 4]);
    
    // Draw horizontal dashed line across the chart area
    ctx.beginPath();
    ctx.moveTo(chartArea.left, y);
    ctx.lineTo(chartArea.right, y);
    ctx.stroke();
    
    // Draw small price badge on the right side of the chart area
    const lastVal = dataset.data[dataset.data.length - 1];
    const text = '₹' + lastVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    ctx.font = 'bold 10px Geist, sans-serif';
    const textWidth = ctx.measureText(text).width;
    const badgeHeight = 18;
    const badgeWidth = textWidth + 10;
    
    ctx.beginPath();
    ctx.fillStyle = dataset.borderColor;
    // Draw badge rounded rect slightly offset to prevent overlapping axes lines
    ctx.roundRect(chartArea.right - badgeWidth - 4, y - (badgeHeight / 2), badgeWidth, badgeHeight, 4);
    ctx.fill();
    
    ctx.fillStyle = '#030712'; // Base dark color for high contrast inside neon badge
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, chartArea.right - (badgeWidth / 2) - 4, y + 0.5);
    ctx.restore();
  }
};

export class ChartManager {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.chart = null;
    this.stockData = null;
    this.activeIndicators = {
      sma20: false,
      sma50: false,
      bb: false
    };
  }

  render(stockData, isChangePositive = true) {
    this.stockData = stockData;
    const points = stockData.points;
    points.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const labels = points.map(p => {
      const d = new Date(p.date);
      if (stockData.interval === '5m' || stockData.interval === '15m') {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else {
        return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
      }
    });
    
    const prices = points.map(p => p.close);
    
    if (this.chart) {
      this.chart.destroy();
    }

    const ctx = this.canvas.getContext('2d');
    const priceColor = isChangePositive ? '#00f5a0' : '#ff0055';
    const priceFillGradient = ctx.createLinearGradient(0, 0, 0, this.canvas.clientHeight);
    priceFillGradient.addColorStop(0, isChangePositive ? 'rgba(0, 245, 160, 0.15)' : 'rgba(255, 0, 85, 0.15)');
    priceFillGradient.addColorStop(1, 'rgba(5, 20, 38, 0)');

    const datasets = [
      {
        label: 'Price',
        data: prices,
        borderColor: priceColor,
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#ffffff',
        pointHoverBorderColor: priceColor,
        pointHoverBorderWidth: 3,
        fill: true,
        backgroundColor: priceFillGradient,
        tension: 0.4,
        order: 1
      }
    ];

    if (this.activeIndicators.sma20) {
      const sma20Data = calculateSMA(prices, 20);
      datasets.push({
        label: 'SMA 20',
        data: sma20Data,
        borderColor: '#3b82f6',
        borderWidth: 1.5,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        tension: 0.1,
        order: 2
      });
    }

    if (this.activeIndicators.sma50) {
      const sma50Data = calculateSMA(prices, 50);
      datasets.push({
        label: 'SMA 50',
        data: sma50Data,
        borderColor: '#eab308',
        borderWidth: 1.5,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        tension: 0.1,
        order: 3
      });
    }

    if (this.activeIndicators.bb) {
      const { middle, upper, lower } = calculateBollingerBands(prices, 20);
      datasets.push({
        label: 'Upper Band',
        data: upper,
        borderColor: 'rgba(168, 85, 247, 0.4)',
        borderWidth: 1,
        pointRadius: 0,
        fill: false,
        tension: 0.1,
        order: 4
      });
      datasets.push({
        label: 'Lower Band',
        data: lower,
        borderColor: 'rgba(168, 85, 247, 0.4)',
        borderWidth: 1,
        pointRadius: 0,
        fill: false,
        tension: 0.1,
        order: 5
      });
    }

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      plugins: [lastPriceLinePlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: '#94a3b8',
              boxWidth: 12,
              font: {
                family: 'Geist, sans-serif',
                size: 11
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(18, 32, 51, 0.95)',
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            borderWidth: 1,
            titleFont: { family: 'Geist, sans-serif', weight: 'bold' },
            bodyFont: { family: 'Geist, sans-serif' },
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) label += ': ';
                if (context.parsed.y !== null) {
                  label += '₹' + context.parsed.y.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                }
                return label;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.025)', borderDash: [2, 4] },
            ticks: {
              color: '#94a3b8',
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8,
              font: { family: 'Geist, sans-serif', size: 10 }
            }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.025)', borderDash: [2, 4] },
            ticks: {
              color: '#94a3b8',
              font: { family: 'Geist, sans-serif', size: 10 },
              callback: function(value) {
                return '₹' + value.toLocaleString();
              }
            }
          }
        }
      }
    });
  }

  toggleIndicator(indicatorKey) {
    if (indicatorKey in this.activeIndicators) {
      this.activeIndicators[indicatorKey] = !this.activeIndicators[indicatorKey];
      if (this.stockData) {
        const price = this.stockData.points[this.stockData.points.length - 1].close;
        const prevPrice = this.stockData.points[0].close;
        this.render(this.stockData, price >= prevPrice);
      }
    }
  }
}
