export function requireRole(...inputRoles) {
  const roles =
    inputRoles.length === 1 && Array.isArray(inputRoles[0])
      ? inputRoles[0]
      : inputRoles;

  return (req, res, next) => {
    console.log("requireRole user:", req.user);
    console.log("required roles:", roles);

    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    next();
  };
}