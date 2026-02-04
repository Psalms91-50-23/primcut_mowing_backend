import User from '../models/User.js';
import Customer from '../models/Customer.js';
import jwt from 'jsonwebtoken';
import { generateShortId, formatFullName } from '../util/util.js';
import { supabase, supabaseNonAdmin } from '../config/db.js';
import { verifyEmailLink } from "../lib/email/index.js"
import { verifyHuman } from "./verifyHumanController.js";
import { createClient } from '@supabase/supabase-js'
import fetch from "node-fetch"; // if not already imported
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_TOKEN_EXPIRES_IN = '10m';// 10 minutes for testing

// Register new user
export const registerUser = async (req, res) => {
  const { email, password, firstName, lastName, role, customerUuid, recaptchaToken  } = req.body;
  let authUser = null;
  let user = null;
  let customer = null;

  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) return res.status(400).json({ error: "Email is required" });
  if (!emailRegex.test(normalizedEmail)) return res.status(400).json({ error: 'Invalid email format' });

  if (!password) return res.status(400).json({ error: "Password is required" });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

  if (!firstName) return res.status(400).json({ error: "First name is required" });
  if (!lastName) return res.status(400).json({ error: "Last name is required" });
  
  if (!recaptchaToken) return res.status(400).json({ error: "reCAPTCHA token is required" });
  // ===== ROLE HANDLING =====
  // Default role
  let finalRole = role || "customer";

  // Only allow role override in non-production
  if (process.env.NODE_ENV !== "production") {
    const allowedRoles = ["admin", "employee", "customer", "owner"];
    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    finalRole = role || "customer";
  }

  try {

        // ===== reCAPTCHA Verification =====
    const verifyRecaptcha = async (token, secret) => {
      const url = `https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${token}`;
      const response = await fetch(url, { method: "POST" });
      const data = await response.json();
      return data;
    };

    // 1️⃣ Try v3 first
    const v3Result = await verifyRecaptcha(recaptchaToken, process.env.RECAPTCHA_V3_SECRET_KEY);

    let recaptchaPassed = false;

    if (v3Result.success && v3Result.score >= 0.5) {
      recaptchaPassed = true;
    } else {
      // Optional: fallback to v2 if v3 fails
      const v2Result = await verifyRecaptcha(recaptchaToken, process.env.RECAPTCHA_V2_SECRET_KEY);
      if (!v2Result.success) {
        return res.status(400).json({ error: "reCAPTCHA verification failed" });
      }
      recaptchaPassed = true;
    }

    if (!recaptchaPassed) {
      return res.status(400).json({ error: "reCAPTCHA verification failed" });
    }
    
     // ===== Customer UUID check =====
    if (customerUuid) {
      const customer = await Customer.findByUUID(customerUuid);
      if (!customer) return res.status(400).json({ error: "Invalid customer UUID" });
    }
     // ===== Check existing user =====
    const { data: existingUsers } = await supabase.auth.admin.listUsers({ email: normalizedEmail });
    if (existingUsers?.length) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // 1️⃣ Create user in Supabase Auth
    //keeping this incase i want the old way
    const { data, error: authError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    });

    if (authError) throw authError;

    authUser = data.user;
    // 2️⃣ Generate local UUID
    let userUUID;
    let exists;
    do {
      userUUID = generateShortId(9);
      exists = await User.findByUUID(userUUID);
    } while (exists);

        // 4️⃣ Automatically create customer record if role is customer
    if (finalRole === "customer") {

        let customerUUID;
        let existsCustomer;
        do {
          customerUUID = generateShortId(9);
          existsCustomer = await Customer.findByUUID(customerUUID);
        } while (existsCustomer);

        customer = await Customer.create({
          uuid: customerUUID,
          first_name: firstName.toLowerCase(),
          last_name: lastName.toLowerCase(),
          email: normalizedEmail,
        });

        if (!customer) {
          throw new Error("Failed to create associated customer record");
        }
      
    }else {
      
    }

    // 3️⃣ Create user in local DB
    user = await User.create({
      auth_user_id: authUser.id,
      email: authUser.email,
      first_name: firstName.toLowerCase(),
      last_name: lastName.toLowerCase(),
      role: finalRole,
      uuid: userUUID,
      customer_uuid: customerUuid || customer.uuid || null,
    });
   
    // 5️⃣ Create email verification token
    const emailToken = jwt.sign(
      {
        user_uuid: user.uuid,
        auth_user_id: authUser.id,
        purpose: 'email_verification'
      },
      process.env.EMAIL_TOKEN_SECRET,
      { expiresIn: EMAIL_TOKEN_EXPIRES_IN }
    );

    const verifyLink = `${process.env.CLIENT_URL}/verify?token=${emailToken}`;
    console.log({ emailToken })
    // 6️⃣  Mark confirmation sent in Supabase
    const { data: authUserRpc, error: rpcError } = await supabase.rpc('admin_confirmation_sent', {
      user_id: authUser.id,
    });

    if (rpcError) {
      // rollback local user
      if (user?.uuid) await User.hardDeleteUserLocally(user.uuid);

      throw new Error(rpcError.message);
    }
    console.log({ user })
    console.log({ authUserRpc }, "in created user function")
    // 7️⃣  Send email
    await verifyEmailLink({
      to: user.email,
      name: formatFullName(firstName.toLowerCase(), lastName.toLowerCase()),
      verifyLink,
      expiryMinutes: 10, // match your EMAIL_TOKEN_EXPIRES_IN
    });

    const response = {
      message: 'User registered successfully',
      user
    };

    if (process.env.NODE_ENV !== 'production') {
      response.emailToken = emailToken;
      response.verifyLink = verifyLink;
    }

    return res.status(201).json(response);

  } catch (err) {
    // 🔄 Rollback Supabase Auth user if DB creation failed
    if (authUser?.id) {
      try {
        await supabase.auth.admin.deleteUser(authUser.id);
      } catch (cleanupErr) {
        console.error('FAILED TO ROLLBACK AUTH USER', cleanupErr);
      }
    }

    if (user?.uuid) {
      try {
        await User.hardDeleteUserLocally(user.uuid); // your delete function
      } catch (cleanupErr) {
        console.error('FAILED TO ROLLBACK LOCAL USER', cleanupErr);
      }
    }

    return res.status(400).json({ error: err.message });
  };
};

export const verifyEmail = async (req, res) => {
  const token = req.body?.token || req.query?.token;

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }
  console.log({ token }, " verify email route")
  try {

    const decoded = jwt.decode(token);
    if (!decoded) {
      return res.status(400).json({ error: "Invalid token" });
    }
    // Check expiry manually
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && now > decoded.exp) {
      return res.status(400).json({ error: "Token has expired" });
    }
    const payload = jwt.verify(token, process.env.EMAIL_TOKEN_SECRET);

    if (payload.purpose !== 'email_verification') {
      return res.status(400).json({ error: 'Invalid token purpose' });
    }

    const user = await User.findByUUID(payload.user_uuid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.is_email_verified) {
      return res.status(400).json({ error: 'User is already verified' });
    }
    console.log({ user })
    const { data: authUser, error } = await supabase.auth.admin.updateUserById(
      user.auth_user_id,
      // { email_confirmed_at: new Date().toISOString() }
      { email_confirm: true }
    );
    if (error) throw new Error(error.message);
    console.log({ authUser }, " in verified email backend")


    const verifiedUser = await User.markVerified(user.auth_user_id);
    console.log({ verifiedUser })
    // Update Supabase Auth via RPC
    // const { data: authUser, error: authError } = await supabase.rpc('admin_confirm_user', 
    //   { user_id: user.auth_user_id}
    // );

    // if (authError) throw new Error(authError.message);
    // console.log({authUser}, "in mark verified function")

    // const {data: authUser, error} = await supabase.auth.admin.updateUserById(userId, {
    //   email_confirm: true
    // });

    console.log("data:", authUser);
    console.log("error:", error);

    return res.status(200).json({
      message: 'User verified successfully',
      user: verifiedUser,
      supabase: authUser
    });

  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

export const resendVerificationEmail = async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const user = await User.findByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.is_email_verified) {
      return res.status(400).json({ error: 'User is already verified' });
    }

    // Generate new email token
    const emailToken = jwt.sign(
      { user_uuid: user.uuid, email: user.email, purpose: 'email_verification' },
      process.env.EMAIL_TOKEN_SECRET,
      { expiresIn: '5m' } // 5 minutes for testing
    );

    const verifyLink = `${process.env.CLIENT_URL}/verify?token=${emailToken}`;

    await sendVerificationEmail({
      to: user.email,
      name: formatFullName(user.first_name),
      verifyLink,
      expiryMinutes: 5,
    });

    // SUCCESS
    return res.status(200).json({
      message: 'Verification email sent',
      verifyLink: process.env.NODE_ENV !== 'production' ? verifyLink : undefined,
    });
  } catch (err) {
    console.error("Resend verification error:", err);
    return res.status(500).json({ error: "Failed to send verification email" });
  }
};

export const deleteSupabaseUser = async (req, res) => {
  const { authUserId } = req.params;

  if (!authUserId) {
    return res.status(400).json({ error: 'Missing authUserId' });
  }

  try {
    const { data, error } = await supabase.auth.admin.deleteUser(authUserId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }
    // Supabase deleteUser returns empty object; nothing else to return
    return res.status(200).json({ message: `Supabase user ${authUserId} deleted successfully`, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const deleteSupabaseAndDBUsers = async (req, res) => {
  const { authUserId } = req.params;

  if (!authUserId) {
    return res.status(400).json({ error: 'Missing authUserId' });
  }

  try {

    const user = await User.findByAuthUserId(authUserId)
    if (!user) {
      return res.status(400).json({ error: `User not found with authUserId: ${authUserId}` });
    }

    const { error: supabaseError } = await supabase.auth.admin.deleteUser(authUserId);

    if (supabaseError) {
      return res.status(400).json({ error: supabaseError.message });
    }

    const userDeleted = await User.hardDeleteFull(user.uuid);
    if (!userDeleted) {
      return res.status(400).json({ error: `User not found with User uuid: ${userDeleted.uuid}` });
    }
    // Supabase deleteUser returns empty object; nothing else to return
    return res.status(200).json({ message: `Supabase user ${authUserId} deleted successfully`, data: userDeleted });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};



// Mark user verified (app-specific approval)
export const verifyUser = async (req, res) => {
  const { authUserId } = req.body;
  if (!authUserId) {
    return res.status(400).json({ error: 'auth_user_id is required' });
  }

  try {
    const exists = await User.findByAuthID(authUserId);
    if (!exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { data: authUser, error: authError } = await supabase.auth.admin.updateUserById(authUserId, {
      email_confirm: true
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    const user = await User.markVerified(authUserId);
    return res.status(200).json({ message: 'User email verified successfully', user, supbaseUser: authUser });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

// Soft delete user
export const deleteUser = async (req, res) => {
  const { uuid } = req.params;

  try {
    await User.softDelete(uuid);
    return res.status(200).json({ message: 'User deleted' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

export const getUserByUUID = async (req, res) => {
  const { uuid } = req.params;
  if (!uuid) {
    return res.status(400).json({ error: "UUID is required" });
  }

  try {
    const user = await User.findByUUID(uuid, { includeDeleted: true });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.status(200).json(user);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

};

export const updateUser = async (req, res) => {
  const { uuid } = req.params;
  const updates = req.body;

  try {
    const updatedUser = await User.updateByUUID(uuid, updates);
    return res.status(200).json(updatedUser);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

export const hardDeleteFull = async (req, res) => {
  const { uuid } = req.params;
  if (!uuid) {
    return res.status(400).json({ error: "UUID is required" });
  }

  try {

    const user = await User.findByUUID(uuid);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { data: authUser, authError } = await supabase.auth.admin.deleteUser(user.auth_user_id);
    if (authError) {
      return res.status(400).json({ error: authError.message, message: "User deleted from local DB but failed to delete from Supabase Auth" });
    }

    const deletedCustomer = await Customer.hardDeleteFull(customer.uuid);
    if (!deletedCustomer) {
      return res.status(500).json({ error: "Failed to hard delete customer from local DB" });
      }
    

    const deletedUser = await User.hardDeleteFull(uuid);
    if (!deletedUser) {
      return res.status(500).json({ error: "Failed to hard delete user from local DB" });
    }

    return res.status(200).json({ message: 'User hard deleted successfully', deletedUser, supabaseDeletion: authUser });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

// Get all users
export const getUsers = async (req, res) => {
  try {
    const users = await User.findAll();
    if (!users) {
      return res.status(404).json({ error: "No users found" });
    }
    return res.status(200).json({ users: users || [] });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export const hardDeleteUserLocally = async (req, res) => {
  const { uuid } = req.params;
  if (!uuid) {
    return res.status(400).json({ error: "UUID is required" });
  }

  try {
    const user = await User.findByUUID(uuid, { includeDeleted: true });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const deletedUser = await User.hardDeleteLocalTable(uuid);
    return res.status(200).json({ message: 'User hard deleted from local DB successfully', data: deletedUser });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export const getUserByEmail = async (req, res) => {

  const { email } = req.body;
  try {
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await User.findByEmail(email);

    if (!user) {
      return res.status(404).json({ error: `User not found by Email: ${email}` });
    }

    return res.status(200).json({ user });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

//delete user from supabase by email
export const deleteUserByEmail = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const { data, error } = await supabase.auth.admin.listUsers({
      email,
    });
    let temp = data.users;
    if (error) throw error;

    const users = data?.users || [];

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const userId = users[0].id;
    // Delete user
    await supabase.auth.admin.deleteUser(userId);

    return res.status(200).json({ message: "User deleted successfully", data: temp });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const login = async (req, res) => {
  const { email, password, recaptchaToken } = req.body;
  console.log("Attempting login with:", { email, password });
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  if (!recaptchaToken) {
    return res.status(400).json({ error: "reCAPTCHA token is missing" });
  }

  try {
    // 0️⃣ Verify reCAPTCHA token with Google
    const recaptchaSecret = process.env.RECAPTCHA_V3_SECRET_KEY; 

    const recaptchaRes = await fetch(
      `https://www.google.com/recaptcha/api/siteverify?secret=${recaptchaSecret}&response=${recaptchaToken}`,
      { method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
       }
    );
    
    const recaptchaData = await recaptchaRes.json();

    if (recaptchaData.action && recaptchaData.action !== "login") {
      return res.status(400).json({ error: "reCAPTCHA action mismatch" });
    }
    // Minimal logging
    console.log("reCAPTCHA v3 check:", {
      action: recaptchaData.action,
      score: recaptchaData.score,
      success: recaptchaData.success,
      hostname: recaptchaData.hostname,
      timestamp: new Date().toISOString()
    });

    if (!recaptchaData.success || (recaptchaData.score && recaptchaData.score < 0.5)) {
      // Fail if score is low for v3
      return res.status(403).json({
        error: "reCAPTCHA verification failed. Suspicious activity detected.",
        recaptcha: recaptchaData,
      });
    }

    // 1️⃣ Sign in with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });
    console.log({data},{error}, " after sign in with password");
    if (error) {
      console.log("Supabase login error:", error);

      if (error.code === "email_not_confirmed") {
        return res.status(403).json({
          error: "Please confirm your email before logging in",
          code: "EMAIL_NOT_CONFIRMED",
        });
      }

      return res.status(401).json({
        error: error.message || "Invalid email or password",
        code: error.code || "LOGIN_FAILED",
      });
    }

    const authUser = data.user;
    console.log({authUser});
    // 2️⃣ Fetch local user
    let user = await User.findByAuthUserId(authUser.id);
    if (!user) {
      return res.status(404).json({ error: "User record not found" });
    }

    // 3️⃣ Sync verification status
    if (authUser.email_confirmed_at && !user.is_email_verified) {
      await User.markVerified(authUser.id);
      user = await User.findByAuthUserId(authUser.id);
    }

    // 4️⃣ Enforce email verification
    if (!user.is_email_verified) {
      return res.status(403).json({
        error: "Email not verified",
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    // 5️⃣ Set cookies only on success
    res.cookie("accessToken", data.session.access_token, {
      httpOnly: true,
      // secure: false, // only true in production
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      path: "/",
    });

    res.cookie("refreshToken", data.session.refresh_token, {
      httpOnly: true,
      // secure: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    const updatedUser = await User.updateByUUID(user.uuid, {
      last_logged_in_at: new Date().toISOString(),
    });

    console.log(updatedUser, " in login function");
    if (!updatedUser) {
      return res.status(500).json({ error: "Failed to update last login time" });
    }

    return res.status(200).json({
      message: "Login successful",
      user: {
        uuid: user.uuid,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        supabaseUser: {
          id: authUser.id,
          email: authUser.email,
          email_confirmed_at: authUser.email_confirmed_at,
          user_metadata: authUser.user_metadata,
        },
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
};

export const logout = async (req, res) => {
  try {
    console.log("Logging out user");

    const accessToken = req.cookies?.accessToken;

    if (accessToken) {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        }
      );
      console.log("before sign out")
      // Supabase logout (invalidates session)
      await supabase.auth.signOut();
    }

    // Clear your custom auth cookies
        // 2️⃣ Clear cookies
    ["accessToken", "refreshToken"].forEach((cookieName) => {
      res.cookie(cookieName, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        expires: new Date(0),
        path: "/",
      });
    });

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({ error: "Failed to log out" });
  }
};

// controllers/user.controller.js
export const getCurrentUser = async (req, res) => {
  try {
    let accessToken = req.cookies.accessToken;
    const refreshToken = req.cookies.refreshToken;

    if (!accessToken) {
      return res.status(401).json({ error: "Missing access token" });
    }

    let sessionUser;

    // 1️⃣ Decode token to check expiry
    const decoded = jwt.decode(accessToken);
    const now = Math.floor(Date.now() / 1000);

    if (decoded && decoded.exp > now) {
      // Access token valid
      const { data, error } = await supabase.auth.getUser(accessToken);
      if (error || !data?.user) return res.status(401).json({ error: "Invalid token" });
      sessionUser = data.user;
    } else {
      // Access token expired → refresh
      if (!refreshToken) return res.status(401).json({ error: "Access token expired, please log in again" });

      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (refreshError || !refreshData?.session) {
        return res.status(401).json({ error: "Refresh failed, please log in again" });
      }

      // Update cookies with new tokens
      accessToken = refreshData.session.access_token;
      res.cookie("accessToken", refreshData.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 1000 * 60 * 60 * 24, // 1 day
        path: "/",
      });

      res.cookie("refreshToken", refreshData.session.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        path: "/",
      });

      sessionUser = refreshData.session.user;
    }

    // 2️⃣ Fetch local user from DB
    const localUser = await User.findByAuthUserId(sessionUser.id);
    if (!localUser) return res.status(404).json({ error: "User not found" });

    // 3️⃣ Return user in same format as login
    return res.status(200).json({
      message: "Auto-login successful",
      user: {
        uuid: localUser.uuid,
        email: localUser.email,
        first_name: localUser.first_name,
        last_name: localUser.last_name,
        role: localUser.role,
        supabaseUser: {
          id: sessionUser.id,
          email: sessionUser.email,
          email_confirmed_at: sessionUser.email_confirmed_at,
          user_metadata: sessionUser.user_metadata,
        },
      },
    });

  } catch (err) {
    console.error("getCurrentUser error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const refreshToken = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ error: "No refresh token" });
  }

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error) {
    return res.status(401).json({ error: "Invalid refresh token" });
  }

  res.cookie("accessToken", data.session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 1000 * 60 * 60 * 24,
  });

  res.status(200).json({ message: "Token refreshed" });
};

export const generateResetLink = async (req, res) => {
  const { email } = req.body;

  const { data, error } = await supabase.auth.api.resetPasswordForEmail(email, {
    redirectTo: `${process.env.CLIENT_URL}/reset-password`,
  });

  if (error) return res.status(400).json({ error: error.message });

  return res.json({ resetLink: data.action_link });
};


// export const sendPasswordResetEmail = async (req, res) => {
//   const { email } = req.body;

//   if (!email) {
//     return res.status(400).json({ error: "Email is required" });
//   }

//   try {

//     const user = await User.findByEmail(email);
//     if (!user) {
//       // don't expose user enumeration
//       return res.status(200).json({
//         message: "User with email does not exist.",
//       });
//     }

//     // This sends a reset email via Supabase
//     // const { data, error } = await supabase.auth.api.resetPasswordForEmail(email);

//     // if (error) {
//     //   // don't expose user enumeration
//     //   return res.status(200).json({
//     //     message: "If this email exists, a reset link has been sent.",
//     //   });
//     // }

//     console.log({ data }, " in reset function backend")

//     return res.status(200).json({
//       message: "If this email exists, a reset link has been sent.",
//     });
//   } catch (err) {
//     return res.status(500).json({ error: "Server error" });
//   }
// };

export const requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findByEmail(email);
    if (!user) {
      return res.json({ success: true });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    await supabase.from("password_reset_tokens").insert({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 1000 * 60 * 30), // 30 min
    });

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    await sendEmail({
      to: email,
      subject: "Reset your password",
      html: `
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}">${resetLink}</a>
      `,
    });

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
  // const { data: user } = await supabase
  //   .from("users")
  //   .select("id")
  //   .eq("email", email)
  //   .single();

  // Always return success (avoid email enumeration)

};

export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const { data: record } = await supabase
    .from("password_reset_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .is("used_at", null)
    .gt("expires_at", new Date())
    .single();

  if (!record) {
    return res.status(400).json({ error: "Invalid or expired token" });
  }

  // Update password using admin client
  await supabase.auth.admin.updateUserById(
    record.user_id,
    { password: newPassword }
  );

  await supabase
    .from("password_reset_tokens")
    .update({ used_at: new Date() })
    .eq("id", record.id);

  res.json({ success: true });
};

// export const checkCookiesExists = async (req, res) => {
//   const accessToken = req.cookies.accessToken;
//   const refreshToken = req.cookies.refreshToken;

//   if (!accessToken || !refreshToken) {
//     return res.status(401).json({ loggedIn: false });
//   }

//   try {
//     const decoded = jwt.decode(accessToken);
//     const now = Math.floor(Date.now() / 1000);

//     if (!decoded || decoded.exp < now) return res.status(401).json({ loggedIn: false });
//     return res.status(200).json({ loggedIn: true });
//   } catch (err) {
//     return res.status(401).json({ loggedIn: false });
//   }
// };

export const checkCookiesExists = (req, res) => {
    const accessToken = req.cookies.accessToken;
    const refreshToken = req.cookies.refreshToken;
    console.log({accessToken}, {refreshToken}, " in check cookies function")
    console.log({refreshToken}, " refresh token in check cookies function")

  if (!accessToken || !refreshToken) {
    return res.status(401).json({ loggedIn: false });
  }

  return res.status(200).json({ loggedIn: true });
};