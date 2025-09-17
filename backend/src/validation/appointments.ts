// validating appointments (manual, no external libs)
// This module keeps all booking input checks in one place so routes stay clean.

export interface AppointmentInput {
  // serviceId should be a number in your app (DB expects numeric id).
  // Your old interface had string, but your validator checks "typeof number".
  // We'll use number here to match the validator + DB.
  serviceId: number;
  startAt: string;     // ISO minute-level (no seconds/milliseconds), e.g. "2025-09-20T18:00Z"
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
}

/**
 * Regex for ISO 8601 WITHOUT seconds/milliseconds at minute precision.
 * Accepts:
 *   2025-09-20T18:00Z
 *   2025-09-20T18:00+01:00
 * Rejects:
 *   2025-09-20T18:00:00Z   (has seconds)
 *   2025-09-20T18:00.123Z  (has milliseconds)
 */
const ISO_MINUTE_NO_SECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * Validate that startAt is:
 *  - a string
 *  - ISO minute-precision only (no seconds/ms)
 *  - actually parseable as a Date
 */
function validateStartAtMinuteOnly(s: unknown): string | null {
  if (typeof s !== "string") return "startAt must be a string";
  if (!ISO_MINUTE_NO_SECONDS.test(s)) {
    return "startAt must be ISO 8601 without seconds/milliseconds (e.g., 2025-09-20T18:00Z)";
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "startAt is not a valid datetime";
  return null;
}

/**
 * Normalize any valid minute-level datetime to canonical UTC string:
 * "YYYY-MM-DDTHH:MM:00Z" (no milliseconds, seconds forced to 00).
 * This gives the DB consistent values regardless of input timezone.
 */
export function normalizeToIsoMinuteZ(s: string): string {
  const d = new Date(s); // handles "Z" or "±HH:MM" offsets
  const ms = d.getTime();
  const minuteFloor = Math.floor(ms / 60_000) * 60_000; // drop seconds/ms
  return new Date(minuteFloor).toISOString().replace(".000Z", "Z");
}

/**
 * OPTIONAL business rule: enforce 15-minute increments.
 * Returns null if ok, or an error message if not aligned.
 */
export function enforceFifteenMinuteGrid(isoMinuteZ: string): string | null {
  const d = new Date(isoMinuteZ);
  const m = d.getUTCMinutes();
  return m % 15 === 0 ? null : "startAt must align to 15-minute increments";
}

// Main validator: collects all problems and returns them as an array of messages.
export function validateAppointment(data: any) {
  const errors: string[] = []; // store error messages

  // serviceId must be a positive integer
  // NOTE: your previous code checked number but interface had string (fixed here).
  if (typeof data.serviceId !== "number" || !Number.isInteger(data.serviceId) || data.serviceId <= 0) {
    errors.push("serviceId must be a positive integer");
  }

  // startAt must be minute-precision ISO (no seconds/ms) and parseable
  // (You had a small typo: startAT vs startAt, which would always error. Fixed.)
  const startErr = validateStartAtMinuteOnly(data.startAt);
  if (startErr) errors.push(startErr);

  // clientName required (non-empty after trimming)
  if (typeof data.clientName !== "string" || data.clientName.trim().length === 0) {
    errors.push("clientName is required");
  }

  // checking email or phone: at least one must be provided
  // Your old check required each to be a string; here we just require at least one present.
  if (!data.clientEmail && !data.clientPhone) {
    errors.push("Either clientEmail or clientPhone must be provided");
  }

  // if email is provided, check format with basic regex
  if (typeof data.clientEmail === "string" && data.clientEmail.length > 0) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.clientEmail)) {
      errors.push("clientEmail must be a valid email address");
    }
    if (data.clientEmail.length > 255) {
      errors.push("clientEmail is too long");
    }
  }

  // if phone is provided, check it's length
  if (typeof data.clientPhone === "string" && data.clientPhone.length > 0) {
    if (data.clientPhone.length < 7) {
      errors.push("clientPhone must be at least 7 digits long");
    }
    if (data.clientPhone.length > 40) {
      errors.push("clientPhone is too long");
    }
  }

  // Optional: add simple length cap for name
  if (typeof data.clientName === "string" && data.clientName.trim().length > 120) {
    errors.push("clientName is too long");
  }

  return errors;
}

// Normalize fields after validation so DB always sees consistent values.
export function normalizeAppointment(data: any) {
  // shallow copy so we don't mutate req.body
  const d: any = { ...data };

  // trim + cap lengths for PII hygiene
  d.clientName = String(d.clientName).trim().slice(0, 120);
  if (d.clientEmail) d.clientEmail = String(d.clientEmail).trim().toLowerCase().slice(0, 255);
  if (d.clientPhone) d.clientPhone = String(d.clientPhone).trim().slice(0, 40);

  // coerce serviceId to number (if client sent "1")
  d.serviceId = Number(d.serviceId);

  // canonicalize time to minute-level ISO UTC ("YYYY-MM-DDTHH:MM:00Z").
  // Previously you used toISOString() on the parsed value (which included milliseconds) — this now strips seconds.
  d.startAt = normalizeToIsoMinuteZ(String(d.startAt));

  return d as AppointmentInput & { startAt: string };
}

// OPTIONAL: compute endAt (e.g., 60 min service) here or in service layer
export function computeEndAt(startIso: string, durationMin: number) {
  const ms = new Date(startIso).getTime() + durationMin * 60_000;
  // We return canonical minute-level ISO as well (drop ms).
  return new Date(ms).toISOString().replace(".000Z", "Z");
}

