// firebase-manager.js - Handles Firebase Firestore & Auth integration with LocalStorage fallbacks

// Check if Firebase configuration is saved in local storage
export function getSavedFirebaseConfig() {
  const config = localStorage.getItem('firebase_config');
  return config ? JSON.parse(config) : null;
}

export function saveFirebaseConfig(config) {
  localStorage.setItem('firebase_config', JSON.stringify(config));
}

export function clearFirebaseConfig() {
  localStorage.removeItem('firebase_config');
}

class FirebaseManager {
  constructor() {
    this.app = null;
    this.db = null;
    this.auth = null;
    this.user = null;
    this.initialized = false;
    this.onAuthChangeCallbacks = [];
  }

  // Dynamically initialize Firebase if configuration exists
  async initialize(config) {
    if (this.initialized) return true;
    if (!config) return false;

    try {
      // Dynamic imports from Firebase JS SDK CDN
      const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
      const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
      const { getAuth, signInAnonymously, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");

      this.app = initializeApp(config);
      this.db = getFirestore(this.app);
      this.auth = getAuth(this.app);

      // Sign in anonymously
      await signInAnonymously(this.auth);

      // Listen for auth state changes
      onAuthStateChanged(this.auth, (user) => {
        this.user = user;
        this.onAuthChangeCallbacks.forEach(cb => cb(user));
      });

      this.initialized = true;
      console.log("Firebase initialized successfully with Anonymous Auth.");
      return true;
    } catch (e) {
      console.error("Firebase dynamic initialization failed:", e);
      this.initialized = false;
      return false;
    }
  }

  onAuthStateChanged(callback) {
    this.onAuthChangeCallbacks.push(callback);
    if (this.initialized && this.user) {
      callback(this.user);
    }
  }

  // Watchlist Sync
  async syncWatchlist(localWatchlist) {
    if (!this.initialized || !this.user) return localWatchlist;

    try {
      const { doc, getDoc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
      const userRef = doc(this.db, 'users', this.user.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists() && userDoc.data().watchlist) {
        // Merge cloud and local watchlist, unique values
        const cloudWatchlist = userDoc.data().watchlist;
        const merged = Array.from(new Set([...localWatchlist, ...cloudWatchlist]));
        
        // Write merged back
        await setDoc(userRef, { watchlist: merged }, { merge: true });
        return merged;
      } else {
        // Write local to cloud
        await setDoc(userRef, { watchlist: localWatchlist }, { merge: true });
        return localWatchlist;
      }
    } catch (e) {
      console.error("Error syncing watchlist with Firestore:", e);
      return localWatchlist;
    }
  }

  async saveWatchlist(watchlist) {
    if (!this.initialized || !this.user) return;
    try {
      const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
      const userRef = doc(this.db, 'users', this.user.uid);
      await setDoc(userRef, { watchlist }, { merge: true });
    } catch (e) {
      console.error("Error saving watchlist to Firestore:", e);
    }
  }

  // Portfolio Sync
  async syncPortfolio(localPortfolio) {
    if (!this.initialized || !this.user) return localPortfolio;

    try {
      const { doc, getDoc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
      const userRef = doc(this.db, 'users', this.user.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists() && userDoc.data().portfolio) {
        const cloudPortfolio = userDoc.data().portfolio;
        
        // Merge portfolios by combining holdings of the same symbol
        const mergedMap = new Map();
        [...localPortfolio, ...cloudPortfolio].forEach(h => {
          if (mergedMap.has(h.symbol)) {
            const existing = mergedMap.get(h.symbol);
            const totalShares = existing.shares + h.shares;
            const avgPrice = ((existing.shares * existing.buyPrice) + (h.shares * h.buyPrice)) / totalShares;
            mergedMap.set(h.symbol, { symbol: h.symbol, shares: totalShares, buyPrice: avgPrice });
          } else {
            mergedMap.set(h.symbol, { ...h });
          }
        });
        
        const merged = Array.from(mergedMap.values());
        await setDoc(userRef, { portfolio: merged }, { merge: true });
        return merged;
      } else {
        await setDoc(userRef, { portfolio: localPortfolio }, { merge: true });
        return localPortfolio;
      }
    } catch (e) {
      console.error("Error syncing portfolio with Firestore:", e);
      return localPortfolio;
    }
  }

  async savePortfolio(portfolio) {
    if (!this.initialized || !this.user) return;
    try {
      const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
      const userRef = doc(this.db, 'users', this.user.uid);
      await setDoc(userRef, { portfolio }, { merge: true });
    } catch (e) {
      console.error("Error saving portfolio to Firestore:", e);
    }
  }

  // Economic Mote Reports Save/Load
  async getMoteReport(symbol) {
    if (!this.initialized || !this.user) {
      // Local fallback
      const saved = localStorage.getItem(`mote_${symbol}`);
      return saved ? JSON.parse(saved) : null;
    }

    try {
      const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
      const moteRef = doc(this.db, 'users', this.user.uid, 'motes', symbol);
      const moteDoc = await getDoc(moteRef);
      return moteDoc.exists() ? moteDoc.data() : null;
    } catch (e) {
      console.error(`Error loading mote report for ${symbol}:`, e);
      return null;
    }
  }

  async saveMoteReport(symbol, moteData) {
    // Local save first
    localStorage.setItem(`mote_${symbol}`, JSON.stringify(moteData));

    if (!this.initialized || !this.user) return;

    try {
      const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
      const moteRef = doc(this.db, 'users', this.user.uid, 'motes', symbol);
      await setDoc(moteRef, moteData);
      console.log(`Saved Economic Mote report for ${symbol} to Firestore.`);
    } catch (e) {
      console.error(`Error saving mote report for ${symbol}:`, e);
    }
  }
}

export const firebaseManager = new FirebaseManager();
