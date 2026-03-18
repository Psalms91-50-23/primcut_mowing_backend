export function requireRole(roles = []) {
  return (req, res, next) => {
    // console.log(req.user, " inside require role")
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}