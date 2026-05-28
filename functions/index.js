const { onRequest } = require("firebase-functions/v2/https");
const app = require("./server");

// Export the Express server app as a Firebase Cloud Function (v2 HTTPS Trigger)
exports.api = onRequest({
  timeoutSeconds: 60,
  memory: "512MiB",
  cors: true // Enable CORS for the cloud function origin
}, app);
