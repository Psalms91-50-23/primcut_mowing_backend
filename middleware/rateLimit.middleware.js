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