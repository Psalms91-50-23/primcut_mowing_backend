import jwt from 'jsonwebtoken';
import supabase from '../config/db.js';
import User from '../models/User.js'; 

export async function requireAuth(req, res, next) {
  try {
    const accessToken = req.cookies.accessToken;
    const refreshToken = req.cookies.refreshToken;
    console.log("requireAuth cookies:", req.headers.cookie);
console.log("requireAuth user:", req.user);
    let supabaseUser = null;
    const now = Math.floor(Date.now() / 1000);

    if (accessToken) {
      const decoded = jwt.decode(accessToken);

      if (decoded && decoded.exp > now) {
        const { data, error } = await supabase.auth.getUser(accessToken);

        if (!error && data?.user) {
          supabaseUser = data.user;
        }
      }
    }

    if (!supabaseUser) {
      if (!refreshToken) {
        return res.status(401).json({ error: "Please log in again" });
      }

      const { data: refreshData, error: refreshError } =
        await supabase.auth.refreshSession({
          refresh_token: refreshToken,
        });

      if (refreshError || !refreshData?.session) {

         res.clearCookie("accessToken", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        });

        res.clearCookie("refreshToken", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        });
        return res.status(401).json({ error: "Refresh failed, please log in again" });
      }

      res.cookie("accessToken", refreshData.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 1000 * 60 * 15,
        path: "/",
      });

      res.cookie("refreshToken", refreshData.session.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24 * 7,
        path: "/",
      });

      supabaseUser = refreshData.session.user;
    }
    const localUser = await User.findByAuthID(supabaseUser.id);
    if (!localUser) {
      res.clearCookie("accessToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });

      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });

      return res.status(404).json({ error: "User not found" });
    }

    req.user = {
      uuid: localUser.uuid,
      email: localUser.email,
      first_name: localUser.first_name,
      last_name: localUser.last_name,
      role: localUser.role,
      customer_uuid: localUser.customer_uuid ?? null,
      supabaseUser: {
        id: supabaseUser.id,
        email: supabaseUser.email,
        email_confirmed_at: supabaseUser.email_confirmed_at,
        user_metadata: supabaseUser.user_metadata,
      },
    };

    next();
  } catch (err) {
    console.error("requireAuth error:", err);
    return res.status(500).json({ error: err.message });
  }
}

// export async function requireAuth(req, res, next) {
//   try {
//     const accessToken = req.cookies.accessToken;
//     const refreshToken = req.cookies.refreshToken;

//     if (!accessToken) {
//       return res.status(401).json({ error: 'Missing access token' });
//     }

//     const decoded = jwt.decode(accessToken);
//     const now = Math.floor(Date.now() / 1000); // seconds
//     let supabaseUser;

//     if (decoded && decoded.exp > now) {
//       // Token valid
//       const { data, error } = await supabase.auth.getUser(accessToken);
//       if (error || !data?.user) return res.status(401).json({ error: 'Invalid token' });

//       supabaseUser = data.user;
//     } else {
//       // Token expired → refresh
//       if (!refreshToken) return res.status(401).json({ error: 'Access token expired, please log in again' });

//       const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
//         refresh_token: refreshToken
//       });

//       if (refreshError || !refreshData?.session) {
//         return res.status(401).json({ error: 'Refresh failed, please log in again' });
//       }

//       // Update cookies
//       res.cookie('accessToken', refreshData.session.access_token, {
//         httpOnly: true,
//         secure: process.env.NODE_ENV === 'production',
//         sameSite: 'strict',
//         // maxAge: 1000 * 60 * 60 * 24,
//         maxAge: 1000 * 60 * 15, //15 minutes
//         path: "/",
//       });

//       res.cookie('refreshToken', refreshData.session.refresh_token, {
//         httpOnly: true,
//         secure: process.env.NODE_ENV === 'production',
//         sameSite: 'strict',
//         maxAge: 1000 * 60 * 60 * 24 * 7,
//         path: "/",
//       });

//       supabaseUser = refreshData.session.user;
//     }

//     // Attach local user
//     const localUser = await User.findByAuthID(supabaseUser.id);
//     if (!localUser) return res.status(404).json({ error: 'User not found' });

//     req.user = {
//       uuid: localUser.uuid,
//       email: localUser.email,
//       first_name: localUser.first_name,
//       last_name: localUser.last_name,
//       role: localUser.role,
//       customer_uuid: localUser.customer_uuid ?? null,
//       supabaseUser: {
//         id: supabaseUser.id,
//         email: supabaseUser.email,
//         email_confirmed_at: supabaseUser.email_confirmed_at,
//         user_metadata: supabaseUser.user_metadata
//       }
//     };

//     next();
//   } catch (err) {
//     console.error('requireAuth error:', err);
//     return res.status(500).json({ error: err.message });
//   }
// }