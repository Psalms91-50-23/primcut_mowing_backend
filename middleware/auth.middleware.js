import jwt from 'jsonwebtoken';
import supabase from '../config/db.js'; // your existing Supabase client
import User from '../models/User.js'; // your local user model

// export async function requireAuth(req, res, next) {
//   try {
//     // 1️⃣ Grab tokens from cookies
//     const accessToken = req.cookies.accessToken;
//     const refreshToken = req.cookies.refreshToken;

//     if (!accessToken) {
//       return res.status(401).json({ error: 'Missing access token' });
//     }

//     // 2️⃣ Decode JWT to check expiry
//     const decoded = jwt.decode(accessToken);

//     const now = Math.floor(Date.now() / 1000); // current time in seconds
//     let sessionUser = null;

//     if (decoded && decoded.exp > now) {
//       // 3️⃣ Access token valid
//       const { data, error } = await supabase.auth.getUser(accessToken);
//       if (error || !data?.user) {
//         return res.status(401).json({ error: 'Invalid token' });
//       }
//       // console.log({data});
//       sessionUser = data.user;
//     } else {
//       // 4️⃣ Access token expired → refresh
//       if (!refreshToken) {
//         return res.status(401).json({ error: 'Access token expired and no refresh token' });
//       }

//       const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
//         refresh_token: refreshToken
//       });

//       if (refreshError || !refreshData?.session) {
//         return res.status(401).json({ error: 'Refresh failed, please log in again' });
//       }
//       console.log({refreshData}, {refreshError})
//       // 5️⃣ Update cookies with new tokens (refresh)
//     res.cookie('accessToken', refreshData.session.access_token, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === 'production',
//       sameSite: 'strict',
//       maxAge: 1000 * 60 * 60 * 24, // 1 day
//       path: '/', // important!
//     });

//     res.cookie('refreshToken', refreshData.session.refresh_token, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === 'production',
//       sameSite: 'strict',
//       maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
//       path: '/',
// });
//       sessionUser = refreshData.session.user;
//     }

//     // 6️⃣ Fetch local user from DB
//     const localUser = await User.findByAuthUserId(sessionUser.id);
//     if (!localUser) {
//       return res.status(404).json({ error: 'User not found' });
//     }

//     // 7️⃣ Attach full user object to request
//     req.user = {
//       uuid: localUser.uuid,
//       email: localUser.email,
//       first_name: localUser.first_name,
//       last_name: localUser.last_name,
//       role: localUser.role,
//       supabaseUser: {
//         id: sessionUser.id,
//         email: sessionUser.email,
//         email_confirmed_at: sessionUser.email_confirmed_at,
//         user_metadata: sessionUser.user_metadata
//       }
//     };

//     next();
//   } catch (err) {
//     console.error('requireAuth error:', err);
//     return res.status(500).json({ error: err.message });
//   }
// }


export async function requireAuth(req, res, next) {
  try {
    const accessToken = req.cookies.accessToken;
    const refreshToken = req.cookies.refreshToken;
    console.log("refresh token", refreshToken);
    console.log("access token", accessToken);
    if (!accessToken) {
      return res.status(401).json({ error: 'Missing access token' });
    }

    const decoded = jwt.decode(accessToken);
    const now = Math.floor(Date.now() / 1000); // seconds
    let sessionUser;

    if (decoded && decoded.exp > now) {
      // Token valid
      const { data, error } = await supabase.auth.getUser(accessToken);
      if (error || !data?.user) return res.status(401).json({ error: 'Invalid token' });
      console.log("data in require auth", data.user);
      sessionUser = data.user;
    } else {
      // Token expired → refresh
      if (!refreshToken) return res.status(401).json({ error: 'Access token expired, please log in again' });

      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
        refresh_token: refreshToken
      });

      if (refreshError || !refreshData?.session) {
        return res.status(401).json({ error: 'Refresh failed, please log in again' });
      }
      console.log({refreshData}, {refreshError});
      // Update cookies
      res.cookie('accessToken', refreshData.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 1000 * 60 * 60 * 24,
        path: "/",
      });

      res.cookie('refreshToken', refreshData.session.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 1000 * 60 * 60 * 24 * 7,
        path: "/",
      });

      sessionUser = refreshData.session.user;
    }

    // Attach local user
    const localUser = await User.findByAuthUserId(sessionUser.id);
    if (!localUser) return res.status(404).json({ error: 'User not found' });
    console.log({localUser})

    req.user = {
      uuid: localUser.uuid,
      email: localUser.email,
      first_name: localUser.first_name,
      last_name: localUser.last_name,
      role: localUser.role,
      supabaseUser: {
        id: sessionUser.id,
        email: sessionUser.email,
        email_confirmed_at: sessionUser.email_confirmed_at,
        user_metadata: sessionUser.user_metadata
      }
    };

    next();
  } catch (err) {
    console.error('requireAuth error:', err);
    return res.status(500).json({ error: err.message });
  }
}