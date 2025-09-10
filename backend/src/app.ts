// ====================================
// What app.ts should do
//
// - Create and configure the Express application
// - JSON body parsing middleware with a small limit, CORS and rate limits for endpoints
// - Mount routes /health, public routes /slots, /appointments
// - 404 handler for unknown routes
// - Central erroer handler that hides internal in prod
// - Export the app so server.ts can import and start it
