// Fixed-Window Rate Limiter als Express-Middleware-Factory.
//
// Zwei Buckets werden in server.js instanziiert:
//   - Read  (GET/HEAD): 300 req / 60s per IP
//   - Write (POST/PUT/PATCH/DELETE): 60 req / 60s per IP
//
// Keine separaten Cleanup-Timer: stale Einträge werden beim nächsten
// Check derselben IP überschrieben. Der Speicher-Footprint ist
// proportional zur Zahl unique IPs die je mit dem Hub geredet haben,
// was bei einem Single-User-Hub klein bleibt.
//
// Das Modul ruft auditLog NICHT direkt — der Caller kann optional
// einen onExceeded(req, {bucket, max, windowMs})-Callback übergeben,
// der bei 429 gefeuert wird. Damit bleibt das Modul unabhängig vom
// audit-log und die Reihenfolge der Module-Imports in server.js
// ist unkritisch.

function defaultKeyFn(req) {
  return req.headers['cf-connecting-ip'] || req.ip || 'unknown';
}

export function createRateLimiter({ bucket, max, windowMs, keyFn = defaultKeyFn, onExceeded = null }) {
  if (!bucket) throw new Error('rate-limit: bucket name required');
  if (typeof max !== 'number' || max <= 0) throw new Error('rate-limit: max must be a positive number');
  if (typeof windowMs !== 'number' || windowMs <= 0) throw new Error('rate-limit: windowMs must be a positive number');

  const buckets = new Map();

  return function rateLimitMiddleware(req, res, next) {
    const key = keyFn(req);
    const now = Date.now();
    let entry = buckets.get(key);
    if (!entry || now - entry.windowStart >= windowMs) {
      entry = { count: 0, windowStart: now };
      buckets.set(key, entry);
    }
    entry.count++;
    if (entry.count > max) {
      const retryAfter = Math.max(1, Math.ceil((entry.windowStart + windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      if (onExceeded) {
        try { onExceeded(req, { bucket, max, windowMs }); } catch { /* swallow */ }
      }
      return res.status(429).json({ error: 'Rate limit exceeded', retryAfter });
    }
    next();
  };
}
