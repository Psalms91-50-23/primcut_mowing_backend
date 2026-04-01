import jwt from "jsonwebtoken";
import { supabase } from "../config/db.js";
import User from "../models/User.js";

export async function optionalAuth(req, res, next) {
  try {
    const accessToken = req.cookies.accessToken;

    if (!accessToken) return next();

    const decoded = jwt.decode(accessToken);
    const now = Math.floor(Date.now() / 1000);

    if (!decoded || decoded.exp <= now) return next();

    const { data, error } = await supabase().auth.getUser(accessToken);

    if (!error && data?.user) {
      const localUser = await User.findByAuthID(data.user.id);

      if (localUser) {
        req.user = {
          uuid: localUser.uuid,
          email: localUser.email,
          first_name: localUser.first_name,
          last_name: localUser.last_name,
          role: localUser.role,
          customer_uuid: localUser.customer_uuid ?? null,
        };
      }
    }

    next();
  } catch (err) {
    console.error("optionalAuth error:", err);
    next();
  }
}