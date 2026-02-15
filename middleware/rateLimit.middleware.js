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

// Rate limit for auth endpoints (e.g., login, signup)
export const authRateLimit = createRateLimit({
  windowMs: 60_000, // 1 minute
  max: 10, // max 10 requests per window
  keyGenerator: (req) => `auth:${req.ip}`,
  handler: (req, res) => {
    res.status(429).json({
      error: "Too many authentication requests. Please wait a minute and try again.",
    });
  },
});

export const publicRateLimit = createRateLimit({
  windowMs: 60_000, // 1 minute
  max: 10,
  keyGenerator: (req) => {
    const token = req.query.token || 'no-token';
    return `quote:${req.ip}:${token.slice(0, 8)}`;
  },
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many requests' }); // JSON response
  },
});

// Rate limit for authenticated users (e.g., fetching data)
export const authenticatedRateLimit = createRateLimit({
  windowMs: 60_000, // 1 minute
  max: 120, // max 120 requests per window
  keyGenerator: (req) => {
        // Prefer Supabase auth_user_id if authenticated
    if (req.user?.supabaseUser?.id) {
      return `user:${req.user.supabaseUser.id}`;
    }
    return `ip:${req.ip}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: "Rate limit exceeded. Please try again later."
    });
  },
});