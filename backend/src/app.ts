// ====================================
// What app.ts should do
//
// - Create and configure the Express application
// - JSON body parsing middleware with a small limit, CORS and rate limits for endpoints
// - Mount routes /health, public routes /slots, /appointments
// - 404 handler for unknown routes
// - Central error handler that hides internals in prod
// - Export the app so server.ts can import and start it
// ====================================

import express from "express";
import cors from "cors";                 // restrict origin later
import helmet from "helmet";             // security headers
import rateLimit from "express-rate-limit"; // request throttling
import crypto from "crypto";             // UUIDs for ids/tokens

import { pool } from "./db/pool";        // MySQL connection pool
// NOTE: ensure the folder name here matches your file path exactly:
import {
  validateAppointment,
  normalizeAppointment,
  enforceFifteenMinuteGrid, // optional; require if you added it
  computeEndAt,
} from "./validation/appointments";

// We export because server.ts will import and start the app
export const app = express();

// ---- Security and basics ----
app.use(express.json({ limit: "32kb" }));
app.use(helmet());
app.use(cors({ origin: false })); // set explicit origin when you have a frontend

// Rate limiter for write endpoints (tweak later)
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,                  // limit each IP
  standardHeaders: true,
  legacyHeaders: false,
});

// -- Health route (quick check) --
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// ---- Public routes (mount real routes later) ----
app.get("/slots", (_req, res) => res.json([])); // return empty list for now

// Example: POST /appointments with manual validation + DB insert
app.post("/appointments", writeLimiter, async (req, res, next) => {
  try {
    // 1) Validate incoming data
    const errors = validateAppointment(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    // 2) Normalize (trim, lower, canonicalize time)
    const data = normalizeAppointment(req.body);

    // 3) Business rule checks
    // 3a) optional: enforce 15-minute grid
    if (typeof enforceFifteenMinuteGrid === "function") {
      const gridErr = enforceFifteenMinuteGrid(data.startAt);
      if (gridErr) return res.status(400).json({ errors: [gridErr] });
    }

    // 3b) startAt must be in the future
    const now = Date.now();
    const startMs = Date.parse(data.startAt);
    if (Number.isNaN(startMs) || startMs <= now) {
      return res.status(400).json({ errors: ["startAt must be in the future"] });
    }

    // 4) Compute end time (placeholder: 60 minutes; replace with service duration later)
    const endAt = computeEndAt(data.startAt, 60);

    // 5) Generate IDs/tokens for DB insert
    const id = crypto.randomUUID();            // Unique appointment ID
    const confirmToken = crypto.randomUUID();  // One-time token for confirming
    const cancelToken = crypto.randomUUID();   // One-time token for canceling

    // 6) Insert into database with parameterized query (SQLi-safe)
    // await pool.execute(
    //   `INSERT INTO appointments
    //    (id, service_id, start_at, end_at, client_name, client_email, client_phone, status, confirm_token, cancel_token)
    //    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    //   [
    //     id,
    //     data.serviceId,
    //     data.startAt,
    //     endAt,
    //     data.clientName,
    //     data.clientEmail ?? null,
    //     data.clientPhone ?? null,
    //     confirmToken,
    //     cancelToken,
    //   ]
    // );

    // 7) Respond to the client with a generic success message.
    // In production, don’t return the tokens; email/text them instead.
    return res.status(202).json({
      message: "Appointment received. Please check your email to confirm.",
      debug: { id, confirmToken, cancelToken }, // for testing only; remove later
    });
  } catch (err) {
    next(err);
  }
});

// --- 404 handler (must come AFTER all routes) ----
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// --- Central error handler (must have 4 params) ---
app.use((
  err: unknown,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction
) => {
  // TODO: add structured logging & PII redaction
  const isProd = process.env.NODE_ENV === "production";
  console.error(err);
  res.status(500).json({ error: isProd ? "Something went wrong." : String(err) });
});

