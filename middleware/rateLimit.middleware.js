const requests = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

export function rateLimit(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  const record = requests.get(key) || { count: 0, last: now };
  if (now - record.last > WINDOW_MS) { record.count = 0; record.last = now; }
  record.count++;
  requests.set(key, record);
  if (record.count > MAX_REQUESTS) return res.status(429).json({ error: 'Too many requests' });
  next();
}

const store = new Map();

/**
 * @param {Object} options
 * @param {number} options.windowMs
 * @param {number} options.max
 * @param {(req) => string} options.keyGenerator
 */
export function createRateLimit({ windowMs, max, keyGenerator }) {
  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();

    const record = store.get(key) || { count: 0, last: now };

    if (now - record.last > windowMs) {
      record.count = 0;
      record.last = now;
    }

    record.count++;
    store.set(key, record);

    if (record.count > max) {
      return res.status(429).json({
        error: 'Too many requests, please try again later'
      });
    }

    next();
  };
}

export const authRateLimit = createRateLimit({
  windowMs: 60_000, // 1 minute
  max: 10,
  keyGenerator: (req) => `auth:${req.ip}`
});

export const publicRateLimit = createRateLimit({
  windowMs: 60_000, // 1 minute
  max: 10,
  keyGenerator: (req) => {
    const token = req.query.token || 'no-token';
    return `quote:${req.ip}:${token.slice(0, 8)}`;
  }
});

export const authenticatedRateLimit = createRateLimit({
  windowMs: 60_000, // 1 minute
  max: 120,
  keyGenerator: (req) => {
    // Prefer user ID if authenticated
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    return `ip:${req.ip}`;
  }
});