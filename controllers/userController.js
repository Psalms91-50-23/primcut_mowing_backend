import User from '../models/User.js';
import Customer from '../models/Customer.js';
import Employee from '../models/Employee.js';
import UserLogin from '../models/UserLogin.js';
import { createChangeLogSafe } from '../util/createChangeLogSafe.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import {
  formatFullName,
  EMAIL_TOKEN_EXPIRES_IN,
  getClientIp,
  generatePrefixedId
} from '../util/util.js';
import { supabase, supabaseNonAdmin } from '../config/db.js';
import { verifyEmailLink, sendInviteLink } from "../lib/email/index.js";
import { createClient } from '@supabase/supabase-js';
import fetch from "node-fetch";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Register new user
export const registerUser = async (req, res) => {
  const {
    email,
    password,
    firstName,
    lastName,
    role,
    customerUuid,
    recaptchaToken,
  } = req.body;

  let authUser = null;
  let user = null;
  let resolvedCustomer = null;

  const normalizedEmail = email?.trim().toLowerCase();
  const safeFirstName = firstName?.trim();
  const safeLastName = lastName?.trim();

  if (!normalizedEmail) {
    return res.status(400).json({ error: "Email is required" });
  }

  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  if (!password) {
    return res.status(400).json({ error: "Password is required" });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  if (!safeFirstName) {
    return res.status(400).json({ error: "First name is required" });
  }

  if (!safeLastName) {
    return res.status(400).json({ error: "Last name is required" });
  }

  if (!recaptchaToken) {
    return res.status(400).json({ error: "reCAPTCHA token is required" });
  }

  const actorUserUuid = req.user?.uuid || null;

  let finalRole = role || "customer";

  if (process.env.NODE_ENV !== "production") {
    const allowedRoles = ["admin", "employee", "customer", "owner"];
    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    finalRole = role || "customer";
  }

  try {
    const verifyRecaptcha = async (token, secret) => {
      const url = `https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${token}`;
      const response = await fetch(url, { method: "POST" });
      return response.json();
    };

    const v3Result = await verifyRecaptcha(
      recaptchaToken,
      process.env.RECAPTCHA_V3_SECRET_KEY
    );

    let recaptchaPassed = false;

    if (v3Result.success && Number(v3Result.score) >= 0.5) {
      recaptchaPassed = true;
    } else {
      const v2Result = await verifyRecaptcha(
        recaptchaToken,
        process.env.RECAPTCHA_V2_SECRET_KEY
      );

      if (!v2Result.success) {
        return res.status(400).json({ error: "reCAPTCHA verification failed" });
      }

      recaptchaPassed = true;
    }

    if (!recaptchaPassed) {
      return res.status(400).json({ error: "reCAPTCHA verification failed" });
    }

    if (customerUuid) {
      const customerExists = await Customer.findByUUID(customerUuid);
      if (!customerExists) {
        return res.status(400).json({ error: "Invalid customer UUID" });
      }
      resolvedCustomer = customerExists;
    }

    const { data: existingUsers } = await supabase().auth.admin.listUsers({
      email: normalizedEmail,
    });

    if (existingUsers?.length) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const { data, error: authError } = await supabase().auth.admin.createUser({
      email: normalizedEmail,
      password,
      options: {
        data: {
          first_name: safeFirstName,
          last_name: safeLastName,
        },
      },
    });

    if (authError) throw authError;
    authUser = data.user;

    let userUUID;
    let exists;
    do {
      userUUID = generatePrefixedId("U", 8);
      exists = await User.findByUUID(userUUID);
    } while (exists);

    user = await User.create({
      auth_user_id: authUser.id,
      email: authUser.email,
      first_name: safeFirstName.toLowerCase(),
      last_name: safeLastName.toLowerCase(),
      role: finalRole,
      uuid: userUUID,
      customer_uuid: resolvedCustomer?.uuid ?? null,
    });

    if (!user) {
      throw new Error("Failed to create local user");
    }

    const emailToken = jwt.sign(
      {
        user_uuid: user.uuid,
        auth_user_id: authUser.id,
        purpose: "email_verification",
      },
      process.env.EMAIL_TOKEN_SECRET,
      { expiresIn: EMAIL_TOKEN_EXPIRES_IN }
    );

    const verifyLink = `${process.env.CLIENT_URL}/verify?token=${emailToken}`;

    const { error: rpcError } = await supabase().rpc(
      "admin_confirmation_sent",
      { user_id: authUser.id }
    );

    if (rpcError) {
      if (user?.uuid) {
        await User.hardDeleteLocalTable(user.uuid);
      }
      throw new Error(rpcError.message);
    }

    await verifyEmailLink({
      to: user.email,
      name: formatFullName(
        safeFirstName.toLowerCase(),
        safeLastName.toLowerCase()
      ),
      verifyLink,
      expiryMinutes: 10,
    });

    await createChangeLogSafe({
      table_name: "users",
      record_uuid: user.uuid,
      user_uuid: actorUserUuid,
      action: "create",
      summary: "User registered",
      changed_fields: {
        email: { old: null, new: user.email },
        first_name: { old: null, new: user.first_name },
        last_name: { old: null, new: user.last_name },
        role: { old: null, new: user.role },
        customer_uuid: { old: null, new: user.customer_uuid ?? null },
        auth_user_id: { old: null, new: user.auth_user_id },
      },
      source: "public_form",
    });

    const response = {
      message: "User registered successfully",
      user,
    };

    if (process.env.NODE_ENV !== "production") {
      response.emailToken = emailToken;
      response.verifyLink = verifyLink;
    }

    return res.status(201).json(response);
  } catch (err) {
    if (authUser?.id) {
      try {
        await supabase().auth.admin.deleteUser(authUser.id);
      } catch (cleanupErr) {
        console.error("FAILED TO ROLLBACK AUTH USER", cleanupErr);
      }
    }

    if (user?.uuid) {
      try {
        await User.hardDeleteLocalTable(user.uuid);
      } catch (cleanupErr) {
        console.error("FAILED TO ROLLBACK LOCAL USER", cleanupErr);
      }
    }

    return res.status(400).json({
      error: err.message || "Failed to register user",
    });
  }
};


export const login = async (req, res) => {
  const { email, password, recaptchaToken } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  if (!recaptchaToken) {
    return res.status(400).json({ error: "reCAPTCHA token is missing" });
  }

  const ipAddress = getClientIp(req);
  const userAgent = req.headers['user-agent'] || '';

  try {
    const recaptchaSecret = process.env.RECAPTCHA_V3_SECRET_KEY;

    const recaptchaRes = await fetch(
      `https://www.google.com/recaptcha/api/siteverify?secret=${recaptchaSecret}&response=${recaptchaToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      }
    );

    const recaptchaData = await recaptchaRes.json();

    if (recaptchaData.action && recaptchaData.action !== "login") {
      return res.status(400).json({ error: "reCAPTCHA action mismatch" });
    }

    if (!recaptchaData.success || (recaptchaData.score && recaptchaData.score < 0.5)) {
      return res.status(403).json({
        error: "reCAPTCHA verification failed. Suspicious activity detected.",
        recaptcha: recaptchaData,
      });
    }

    const { data, error } = await supabaseNonAdmin().auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });

    if (error) {
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

    let localUser = await User.findByAuthID(authUser.id);
    if (!localUser) {
      return res.status(404).json({ error: "User record not found" });
    }

    if (authUser.email_confirmed_at && !localUser.is_email_verified) {
      await User.markVerified(authUser.id);
      localUser = await User.findByAuthID(authUser.id);
    }

    if (!localUser.is_email_verified || !authUser.email_confirmed_at) {
      return res.status(403).json({
        error: "Email not verified",
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    let loginUUID;
    let exists;
    do {
      loginUUID = generatePrefixedId("L", 8);
      exists = await UserLogin.findByUUID(loginUUID);
    } while (exists);

    try {
      const userLogin = await UserLogin.create({
        uuid: loginUUID,
        user_uuid: localUser.uuid,
        ip_address: ipAddress,
        user_agent: userAgent,
        success: true,
      });
      console.log({userLogin})
    } catch (logErr) {
      console.error("UserLogin.create failed:", logErr);
    }
    const isStaffRole = ["admin", "owner", "employee"].includes(localUser.role);
    
    const accessTokenMaxAge = isStaffRole
      ? 1000 * 60 * 60 * 24 // 1 day
      : 1000 * 60 * 60 * 2 ; // 2 hours

    res.cookie("accessToken", data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: accessTokenMaxAge,
      path: "/",
    });

    res.cookie("refreshToken", data.session.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
      path: "/",
    });

    res.cookie("role", localUser.role, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: accessTokenMaxAge,
      path: "/",
    });

    const updatedUser = await User.updateByUUID(localUser.uuid, {
      last_logged_in_at: new Date().toISOString(),
    });

    if (!updatedUser) {
      return res.status(500).json({ error: "Failed to update last login time" });
    }

    return res.status(200).json({
      message: "Login successful",
      user: {
        uuid: localUser.uuid,
        email: localUser.email,
        first_name: localUser.first_name,
        last_name: localUser.last_name,
        role: localUser.role,
        customer_uuid: localUser.customer_uuid ?? null,
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
    const accessToken = req.cookies?.accessToken;

    if (accessToken) {
      const scopedSupabase = createClient(
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

      await scopedSupabase().auth.signOut();
    }

    res.cookie("accessToken", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      expires: new Date(0),
      path: "/",
    });

    res.cookie("refreshToken", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      expires: new Date(0),
      path: "/",
    });

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({ error: "Failed to log out" });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const accessToken = req.cookies.accessToken;
    const refreshToken = req.cookies.refreshToken;

    if (!accessToken) {
      return res.status(401).json({ error: "Missing access token" });
    }

    let sessionUser;

    const { data, error } = await supabase().auth.getUser(accessToken);

    if (error || !data?.user) {
      if (!refreshToken) {
        return res.status(401).json({ error: "Access token expired, please log in again" });
      }

      const { data: refreshData, error: refreshError } = await supabase().auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (refreshError || !refreshData?.session) {
        return res.status(401).json({ error: "Refresh failed, please log in again" });
      }

      res.cookie("accessToken", refreshData.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
        maxAge: 1000 * 60 * 60 * 24,
        path: "/",
      });

      res.cookie("refreshToken", refreshData.session.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
        maxAge: 1000 * 60 * 60 * 24 * 7,
        path: "/",
      });

      sessionUser = refreshData.session.user;
    } else {
      sessionUser = data.user;
    }

    let localUser = await User.findByAuthID(sessionUser.id);
    if (!localUser) {
      localUser = await User.create({
        auth_user_id: sessionUser.id,
        email: sessionUser.email,
        first_name: sessionUser.user_metadata?.first_name || "",
        last_name: sessionUser.user_metadata?.last_name || "",
        role: "customer",
        is_email_verified: !!sessionUser.email_confirmed_at,
      });
    }

    return res.status(200).json({
      message: "Auto-login successful",
      user: {
        uuid: localUser.uuid,
        email: localUser.email,
        first_name: localUser.first_name,
        last_name: localUser.last_name,
        role: localUser.role,
        customer_uuid: localUser.customer_uuid ?? null,
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
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
};

// export const getCurrentCustomer = async (req, res) => {
//   try {
//     if (!req.user?.uuid) {
//       return res.status(401).json({ error: "Unauthorized" });
//     }

//     if (req.user.role !== "customer") {
//       return res.status(403).json({ error: "Only customers can access this route" });
//     }

//     if (!req.user.customer_uuid) {
//       return res.status(404).json({ error: "No customer profile linked to this user" });
//     }

//     const customer = await Customer.findByUUID(req.user.customer_uuid);

//     if (!customer) {
//       return res.status(404).json({ error: "Customer not found" });
//     }

//     return res.status(200).json({
//       customer,
//     });
//   } catch (err) {
//     console.error("getCurrentCustomer error:", err);
//     return res.status(500).json({
//       error: err.message || "Internal server error",
//     });
//   }
// };

export const verifyEmail = async (req, res) => {
  const token = req.body?.token || req.query?.token;

  if (!token) {
    return res.status(400).json({ error: "Token is required" });
  }

  try {
    const payload = jwt.verify(token, process.env.EMAIL_TOKEN_SECRET);

    if (payload.purpose !== "email_verification") {
      return res.status(400).json({ error: "Invalid token purpose" });
    }

    if (!payload.user_uuid) {
      return res.status(400).json({ error: "Invalid token payload" });
    }

    const user = await User.findByUUID(payload.user_uuid);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.auth_user_id) {
      return res.status(400).json({ error: "User auth ID is missing" });
    }

    if (user.is_email_verified) {
      return res.status(200).json({
        message: "User is already verified",
        user,
      });
    }

    const { error: authError } = await supabase().auth.admin.updateUserById(
      user.auth_user_id,
      {
        email_confirm: true,
      }
    );

    if (authError) {
      throw new Error(authError.message);
    }

    let verifiedUser = await User.markVerified(user.auth_user_id);

    if (!verifiedUser) {
      throw new Error("Failed to update local user verification status");
    }

    await createChangeLogSafe({
      table_name: "users",
      record_uuid: user.uuid,
      user_uuid: null,
      action: "update",
      summary: "Email address verified",
      changed_fields: {
        is_email_verified: { old: false, new: true },
        auth_user_id: { old: user.auth_user_id, new: user.auth_user_id },
        verification_method: { old: null, new: "email_link" },
      },
      source: "system",
    });

    if (verifiedUser.role === "customer") {
      let linkedCustomer = null;
      let customerCreated = false;

      const normalizedEmail = verifiedUser.email?.trim().toLowerCase() || null;
      const normalizedFirstName = verifiedUser.first_name?.trim().toLowerCase() || null;
      const normalizedLastName = verifiedUser.last_name?.trim().toLowerCase() || null;

      if (verifiedUser.customer_uuid) {
        linkedCustomer = await Customer.findByUUID(verifiedUser.customer_uuid);
      }

      if (!linkedCustomer && normalizedEmail) {
        linkedCustomer = await Customer.findByEmail(normalizedEmail);
      }

      if (!linkedCustomer) {
        let customerUUID;
        let existsCustomer;

        do {
          customerUUID = generatePrefixedId("C", 8);
          existsCustomer = await Customer.findByUUID(customerUUID);
        } while (existsCustomer);

        linkedCustomer = await Customer.create({
          uuid: customerUUID,
          first_name: normalizedFirstName,
          last_name: normalizedLastName,
          email: normalizedEmail,
          created_via: "self_signup",
        });

        if (!linkedCustomer) {
          throw new Error("Failed to create associated customer record");
        }

        customerCreated = true;

        await createChangeLogSafe({
          table_name: "customers",
          record_uuid: linkedCustomer.uuid,
          user_uuid: null,
          action: "create",
          summary: "Customer created during email verification",
          changed_fields: {
            uuid: { old: null, new: linkedCustomer.uuid },
            first_name: { old: null, new: linkedCustomer.first_name ?? null },
            last_name: { old: null, new: linkedCustomer.last_name ?? null },
            email: { old: null, new: linkedCustomer.email ?? null },
            created_via: { old: null, new: linkedCustomer.created_via ?? null },
          },
          source: "system",
        });
      } else {
        const customerUpdates = {};
        const customerChangedFields = {};

        if (!linkedCustomer.first_name && normalizedFirstName) {
          customerUpdates.first_name = normalizedFirstName;
          customerChangedFields.first_name = {
            old: linkedCustomer.first_name ?? null,
            new: normalizedFirstName,
          };
        }

        if (!linkedCustomer.last_name && normalizedLastName) {
          customerUpdates.last_name = normalizedLastName;
          customerChangedFields.last_name = {
            old: linkedCustomer.last_name ?? null,
            new: normalizedLastName,
          };
        }

        if (!linkedCustomer.email && normalizedEmail) {
          customerUpdates.email = normalizedEmail;
          customerChangedFields.email = {
            old: linkedCustomer.email ?? null,
            new: normalizedEmail,
          };
        }

        if (Object.keys(customerUpdates).length > 0) {
          linkedCustomer = await Customer.updateByUUID(linkedCustomer.uuid, customerUpdates);

          await createChangeLogSafe({
            table_name: "customers",
            record_uuid: linkedCustomer.uuid,
            user_uuid: null,
            action: "update",
            summary: "Customer details enriched during email verification",
            changed_fields: customerChangedFields,
            source: "system",
          });
        }
      }

      if (linkedCustomer?.uuid && verifiedUser.customer_uuid !== linkedCustomer.uuid) {
        const beforeCustomerUuid = verifiedUser.customer_uuid ?? null;

        verifiedUser = await User.updateByUUID(verifiedUser.uuid, {
          customer_uuid: linkedCustomer.uuid,
        });

        if (!verifiedUser) {
          throw new Error("Failed to link verified user to customer");
        }

        await createChangeLogSafe({
          table_name: "users",
          record_uuid: verifiedUser.uuid,
          user_uuid: null,
          action: "update",
          summary: customerCreated
            ? "Verified user linked to newly created customer"
            : "Verified user linked to existing customer",
          changed_fields: {
            customer_uuid: {
              old: beforeCustomerUuid,
              new: linkedCustomer.uuid,
            },
          },
          source: "system",
        });
      }
    }

    return res.status(200).json({
      message: "User verified successfully",
      user: verifiedUser,
    });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(400).json({ error: "Token has expired" });
    }

    if (err.name === "JsonWebTokenError") {
      return res.status(400).json({ error: "Invalid token" });
    }

    console.error("verifyEmail error:", err);
    return res.status(400).json({ error: err.message || "Verification failed" });
  }
};

export const resendVerificationEmail = async (req, res) => {
  const { email } = req.body;
  const actorUserUuid = req.user?.uuid || null;

  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const user = await User.findByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.is_email_verified) {
      return res.status(400).json({ error: 'User is already verified' });
    }

    const emailToken = jwt.sign(
      { user_uuid: user.uuid, email: user.email, purpose: 'email_verification' },
      process.env.EMAIL_TOKEN_SECRET,
      { expiresIn: EMAIL_TOKEN_EXPIRES_IN }
    );

    const verifyLink = `${process.env.CLIENT_URL}/verify?token=${emailToken}`;

    await verifyEmailLink({
      to: user.email,
      name: formatFullName(user.first_name),
      verifyLink,
      expiryMinutes: EMAIL_TOKEN_EXPIRES_IN,
    });

    await createChangeLogSafe({
      table_name: "users",
      record_uuid: user.uuid,
      user_uuid: actorUserUuid,
      action: "update",
      summary: "Verification email resent",
      changed_fields: {
        verification_email_resent: true,
      },
      source: actorUserUuid ? "dashboard" : "public_form",
    });

    return res.status(200).json({
      message: 'Verification email sent',
      verifyLink: process.env.NODE_ENV !== 'production' ? verifyLink : undefined,
    });
  } catch (err) {
    console.error("Resend verification error full:", err);
    console.error("Resend verification error message:", err?.message);
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
    const { data, error } = await supabase().auth.admin.deleteUser(authUserId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ message: `Supabase() user ${authUserId} deleted successfully`, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const deleteSupabaseAndDBUsers = async (req, res) => {
  const { authUserId } = req.params;
  const actorUserUuid = req.user?.uuid || null;

  if (!authUserId) {
    return res.status(400).json({ error: 'Missing authUserId' });
  }

  try {
    const user = await User.findByAuthID(authUserId);
    if (!user) {
      return res.status(400).json({ error: `User not found with authUserId: ${authUserId}` });
    }

    const { error: supabaseError } = await supabase().auth.admin.deleteUser(authUserId);

    if (supabaseError) {
      return res.status(400).json({ error: supabaseError.message });
    }

    const userDeleted = await User.hardDeleteFull(user.uuid);
    if (!userDeleted) {
      return res.status(400).json({ error: `User not found with User uuid: ${user.uuid}` });
    }

    await createChangeLogSafe({
      table_name: "users",
      record_uuid: user.uuid,
      user_uuid: actorUserUuid,
      action: "delete",
      summary: "User deleted from Supabase() and local DB",
      changed_fields: {
        deleted_record: {
          uuid: user.uuid,
          auth_user_id: user.auth_user_id,
          email: user.email,
          role: user.role,
          customer_uuid: user.customer_uuid,
        },
      },
      source: "dashboard",
    });

    return res.status(200).json({
      message: `Supabase() user ${authUserId} deleted successfully`,
      data: userDeleted
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const verifyUser = async (req, res) => {
  const { authUserId } = req.body;
  const actorUserUuid = req.user?.uuid || null;

  if (!authUserId) {
    return res.status(400).json({ error: 'auth_user_id is required' });
  }

  try {
    const exists = await User.findByAuthID(authUserId);
    if (!exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { data: authUser, error: authError } = await supabase().auth.admin.updateUserById(authUserId, {
      email_confirm: true
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    const user = await User.markVerified(authUserId);

    await createChangeLogSafe({
      table_name: "users",
      record_uuid: user.uuid,
      user_uuid: actorUserUuid,
      action: "update",
      summary: "User email verified by admin flow",
      changed_fields: {
        is_email_verified: {
          old: exists.is_email_verified ?? false,
          new: user.is_email_verified ?? true,
        },
      },
      source: "dashboard",
    });

    return res.status(200).json({
      message: 'User email verified successfully',
      user,
      supbaseUser: authUser
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

export const deleteUser = async (req, res) => {
  const { uuid } = req.params;
  const actorUserUuid = req.user?.uuid || null;

  try {
    const existing = await User.findByUUID(uuid, { includeDeleted: true });
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    const deleted = await User.softDelete(uuid);

    await createChangeLogSafe({
      table_name: "users",
      record_uuid: uuid,
      user_uuid: actorUserUuid,
      action: "delete",
      summary: "User soft deleted",
      changed_fields: {
        is_deleted: {
          old: existing.is_deleted ?? false,
          new: deleted?.is_deleted ?? true,
        },
        deleted_at: {
          old: existing.deleted_at ?? null,
          new: deleted?.deleted_at ?? new Date().toISOString(),
        },
      },
      source: "dashboard",
    });

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
  const actorUserUuid = req.user?.uuid || null;

  try {
    const existing = await User.findByUUID(uuid, { includeDeleted: true });
    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    const updatedUser = await User.updateByUUID(uuid, updates);

    const changed_fields = {};
    for (const key of Object.keys(updates || {})) {
      if (JSON.stringify(existing?.[key] ?? null) !== JSON.stringify(updatedUser?.[key] ?? null)) {
        changed_fields[key] = {
          old: existing?.[key] ?? null,
          new: updatedUser?.[key] ?? null,
        };
      }
    }

    if (Object.keys(changed_fields).length > 0) {
      await createChangeLogSafe({
        table_name: "users",
        record_uuid: uuid,
        user_uuid: actorUserUuid,
        action: "update",
        summary: "User updated",
        changed_fields,
        source: "dashboard",
      });
    }

    return res.status(200).json(updatedUser);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

export const hardDeleteFull = async (req, res) => {
  const { uuid } = req.params;
  const actorUserUuid = req.user?.uuid || null;

  if (!uuid) {
    return res.status(400).json({ error: "UUID is required" });
  }

  try {
    const user = await User.findByUUID(uuid);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await UserLogin.deleteByUUID(user.uuid);

    const { data: authUser, error: authError } = await supabase().auth.admin.deleteUser(user.auth_user_id);
    if (authError) {
      return res.status(400).json({
        error: authError.message,
        message: "User deleted from local DB but failed to delete from Supabase() Auth"
      });
    }

    let deletedCustomer = null;
    if (user.customer_uuid) {
      deletedCustomer = await Customer.delete(user.customer_uuid);
      if (!deletedCustomer) {
        return res.status(500).json({ error: "Failed to hard delete customer from local DB" });
      }
    }

    const deletedUser = await User.hardDeleteFull(uuid);
    if (!deletedUser) {
      return res.status(500).json({ error: "Failed to hard delete user from local DB" });
    }

    await createChangeLogSafe({
      table_name: "users",
      record_uuid: uuid,
      user_uuid: actorUserUuid,
      action: "delete",
      summary: "User fully hard deleted",
      changed_fields: {
        deleted_record: {
          uuid: user.uuid,
          auth_user_id: user.auth_user_id,
          email: user.email,
          customer_uuid: user.customer_uuid,
          role: user.role,
        },
      },
      source: "dashboard",
    });

    return res.status(200).json({
      message: 'User hard deleted successfully',
      deletedUser,
      supabaseDeletion: authUser
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

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
};

export const hardDeleteUserLocally = async (req, res) => {
  const { uuid } = req.params;
  const actorUserUuid = req.user?.uuid || null;

  if (!uuid) {
    return res.status(400).json({ error: "UUID is required" });
  }

  try {
    const user = await User.findByUUID(uuid, { includeDeleted: true });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const deletedUser = await User.hardDeleteLocalTable(uuid);

    await createChangeLogSafe({
      table_name: "users",
      record_uuid: uuid,
      user_uuid: actorUserUuid,
      action: "delete",
      summary: "User hard deleted from local DB only",
      changed_fields: {
        deleted_record: {
          uuid: user.uuid,
          auth_user_id: user.auth_user_id,
          email: user.email,
          role: user.role,
        },
      },
      source: "dashboard",
    });

    return res.status(200).json({
      message: 'User hard deleted from local DB successfully',
      data: deletedUser
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

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
};

export const deleteUserByEmail = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const { data, error } = await supabase().auth.admin.listUsers({ email });
    if (error) throw error;

    const users = data?.users || [];

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const userId = users[0].id;
    await supabase().auth.admin.deleteUser(userId);

    return res.status(200).json({ message: "User deleted successfully", data: users });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const refreshToken = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ error: "No refresh token" });
  }

  const { data, error } = await supabase().auth.refreshSession({
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

  const { data, error } = await supabase().auth.api.resetPasswordForEmail(email, {
    redirectTo: `${process.env.CLIENT_URL}/reset-password`,
  });

  if (error) return res.status(400).json({ error: error.message });

  return res.json({ resetLink: data.action_link });
};

export const requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findByEmail(email);
    if (!user) {
      return res.json({ success: true });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    await supabase().from("password_reset_tokens").insert({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 1000 * 60 * 30),
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
};

export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const { data: record } = await supabase()
    .from("password_reset_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .is("used_at", null)
    .gt("expires_at", new Date())
    .single();

  if (!record) {
    return res.status(400).json({ error: "Invalid or expired token" });
  }

  await supabase().auth.admin.updateUserById(record.user_id, { password: newPassword });

  await supabase()
    .from("password_reset_tokens")
    .update({ used_at: new Date() })
    .eq("id", record.id);

  res.json({ success: true });
};

export const checkCookiesExists = async (req, res) => {
  const accessToken = req.cookies.accessToken;
  const refreshToken = req.cookies.refreshToken;

  if (!accessToken || !refreshToken) {
    return res.status(401).json({ loggedIn: false });
  }

  return res.status(200).json({ loggedIn: true });
};

export const createUserEmptyEmployee = async (req, res) => {
  const {
    businessEmail,
    employeeFirstName,
    employeeLastName,
    userRole,
    employeeIrdNumber,
    employeeBankAccount,
    employeeTaxCode,
    employeeEmergencyContactPhone,
    employeeEmergencyFirstName,
    employeeEmergencyLastName,
    employeeDepartment,
    employeeJobTitle,
    employeeContract,
    employeeHireDate,
    createdByUserUUID,
    employeeEmail,
    employeeAddress,
    employeeLandLine,
    employeeMobile
  } = req.body;

  if (!businessEmail) {
    return res.status(400).json({ message: "Email is required!" });
  }

  const normalizedEmail = businessEmail.trim().toLowerCase();
  let newEmployee = null;

  try {
    const userExists = await User.findByEmail(normalizedEmail);
    if (userExists) {
      return res.status(409).json({ message: "Email already exists in DB." });
    }

    const { data: existingUsers } = await supabase().auth.admin.listUsers({ email: normalizedEmail });
    if (existingUsers?.length) {
      return res.status(409).json({ message: "Email already registered in Supabase()." });
    }

    let uuid, exists;
    do {
      uuid = generatePrefixedId("U", 8);
      exists = await User.findByUUID(uuid);
    } while (exists);

    const finalRole = userRole ?? "employee";
    const user = await User.create({
      auth_user_id: null,
      email: normalizedEmail,
      first_name: employeeFirstName?.toLowerCase() ?? "",
      last_name: employeeLastName?.toLowerCase() ?? "",
      role: finalRole,
      uuid
    });

    let employeeUuid, employeeExists;
    do {
      employeeUuid = generatePrefixedId("E", 9);
      employeeExists = await Employee.findByUUID(employeeUuid);
    } while (employeeExists);

    const finalEmployeeContract = employeeContract ?? "casual";

    newEmployee = {
      uuid: employeeUuid,
      user_uuid: user.uuid,
      business_email: normalizedEmail,
      created_by_user_uuid: createdByUserUUID,
      employee_first_name: employeeFirstName ?? "",
      employee_last_name: employeeLastName ?? "",
      employee_ird_number: employeeIrdNumber ?? "",
      employee_mobile: employeeMobile ?? "",
      employee_landline: employeeLandLine ?? "",
      employee_tax_code: employeeTaxCode ?? "",
      employee_job_title: employeeJobTitle ?? "",
      employee_bank_account_number: employeeBankAccount ?? "",
      employee_address: employeeAddress ?? "",
      employee_email: employeeEmail ?? "",
      employee_department: employeeDepartment ?? "",
      employee_emergency_contact_first_name: employeeEmergencyFirstName ?? "",
      employee_emergency_contact_last_name: employeeEmergencyLastName ?? "",
      employee_emergency_contact_phone: employeeEmergencyContactPhone ?? "",
      employee_contract: finalEmployeeContract,
      employee_hire_date: employeeHireDate ?? null,
      employee_termination_date: null,
      is_deleted: false,
      deleted_at: null,
      deleted_by_user_uuid: null
    };

    const newEmployeeAdded = await Employee.create(newEmployee);
    if (!newEmployeeAdded) {
      return res.status(400).json({ message: "Failed to create a new employee." });
    }

    const { data: supabaseData, error: supabaseError } =
      await supabase().auth.admin.generateLink({
        type: "invite",
        email: normalizedEmail,
        options: { redirectTo: `${process.env.FRONTEND_URL_HAPPY_PROPERTY}/user/set-password` }
      });

    if (supabaseError) {
      console.error("Supabase() generateLink error:", supabaseError);
      return res.status(500).json({ message: "Failed to generate invite link" });
    }

    const inviteLink = supabaseData.properties.action_link;

    await sendInviteLink({
      to: normalizedEmail,
      firstName: employeeFirstName,
      lastName: employeeLastName,
      inviteLink,
      expiryHours: 24
    });

    await createChangeLogSafe({
      table_name: "users",
      record_uuid: user.uuid,
      user_uuid: createdByUserUUID || null,
      action: "create",
      summary: "Employee user placeholder created",
      changed_fields: {
        uuid: { old: null, new: user.uuid },
        email: { old: null, new: user.email },
        first_name: { old: null, new: user.first_name },
        last_name: { old: null, new: user.last_name },
        role: { old: null, new: user.role },
      },
      source: "dashboard",
    });

    await createChangeLogSafe({
      table_name: "employees",
      record_uuid: newEmployeeAdded.uuid,
      user_uuid: createdByUserUUID || null,
      action: "create",
      summary: "Employee record created and invite sent",
      changed_fields: {
        uuid: { old: null, new: newEmployeeAdded.uuid },
        user_uuid: { old: null, new: newEmployeeAdded.user_uuid },
        business_email: { old: null, new: newEmployeeAdded.business_email },
        employee_first_name: { old: null, new: newEmployeeAdded.employee_first_name },
        employee_last_name: { old: null, new: newEmployeeAdded.employee_last_name },
        employee_job_title: { old: null, new: newEmployeeAdded.employee_job_title },
        employee_department: { old: null, new: newEmployeeAdded.employee_department },
        employee_contract: { old: null, new: newEmployeeAdded.employee_contract },
      },
      source: "dashboard",
    });

    return res.status(200).json({
      message: "User and employee created and invite sent successfully",
      userUuid: user.uuid,
      user,
      employee: newEmployeeAdded
    });

  } catch (error) {
    console.error("Error creating user:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getUserByAuthUserId = async (req, res) => {
  const { authUserId } = req.params;
  if (!authUserId) {
    return res.status(400).json({ error: "authUserId is required" });
  }

  try {
    const user = await User.findByAuthID(authUserId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.status(200).json(user);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};