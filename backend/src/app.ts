// ====================================
// What app.ts should do
//
// - Create and configure the Express application
// - JSON body parsing middleware with a small limit, CORS and rate limits for endpoints
// - Mount routes /health, public routes /slots, /appointments
// - 404 handler for unknown routes
// - Central erroer handler that hides internal in prod
// - Export the app so server.ts can import and start it

import express from 'express';
import cors from 'cors'; // restrict origin later
import helmet from 'helmet'; // for security header
import rateLimit from 'express-rate-limit'; // to limit requests

// We export because server.ts will import and start the app
export const app = express();

// ---- Security and basics ----
app.use(express.json({ limit: "32kb" }));
app.use(helmet());
app.use(cors({ origin: false })); // restrict origin later

// Rate limiter for endpoints, tweak later
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,
});

// -- Health route (quick check) --
app.get('/health', (req, res) => {
  return res.json({ ok: true });
})

// ---- Public routes (mount real routes later) ----
app.get('/slots', (req, res) => res.json([])); // return empty list for now

// Write route behind limiter
app.post('/appointments', writeLimiter, (req, res) => {
  res.status(202).json({ status: 'pending' });
});

// --- 404 handler ----
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
})


// Add route stubs
// GET /health (from server.ts, can move here)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
  res.end();
});

// --- Central error handler ---
app.use((err: any, _req: any, res: any, _next: any) => {
  // TODO: add structured logging & PII redaction
  const isProd = process.env.NODE_ENV === "production";
  res.status(500).json({ error: isProd ? "Something went wrong." : String(err) });
});
