import User from "../models/User.js";
import Customer from "../models/Customer.js";
import Employee from "../models/Employee.js";
import UserLogin from "../models/UserLogin.js";
import { createChangeLogSafe } from "../util/createChangeLogSafe.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import {
  formatFullName,
  EMAIL_TOKEN_EXPIRES_IN,
  generatePrefixedId,
  generateUniqueChangeLogUUID,
} from "../util/util.js";
import { supabase, supabaseNonAdmin } from "../config/db.js";
import { verifyEmailLink, sendInviteLink } from "../lib/email/index.js";
import fetch from "node-fetch";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class ServiceError extends Error {
  constructor(message, status = 400, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const verifyRecaptchaToken = async ({
  token,
  secret,
  expectedAction = null,
  minScore = 0.5,
}) => {
  const response = await fetch(
    `https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );

  const data = await response.json();

  if (expectedAction && data.action && data.action !== expectedAction) {
    throw new ServiceError("reCAPTCHA action mismatch", 400, { recaptcha: data });
  }

  if (!data.success) {
    throw new ServiceError("reCAPTCHA verification failed", 400, {
      recaptcha: data,
    });
  }

  if (typeof data.score === "number" && data.score < minScore) {
    throw new ServiceError(
      "reCAPTCHA verification failed. Suspicious activity detected.",
      403,
      { recaptcha: data }
    );
  }

  return data;
};

const verifySignupRecaptchaWithFallback = async (recaptchaToken) => {
  const v3Result = await fetch(
    `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_V3_SECRET_KEY}&response=${recaptchaToken}`,
    { method: "POST" }
  ).then((res) => res.json());

  if (v3Result.success && Number(v3Result.score) >= 0.5) {
    return true;
  }

  const v2Result = await fetch(
    `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_V2_SECRET_KEY}&response=${recaptchaToken}`,
    { method: "POST" }
  ).then((res) => res.json());

  if (!v2Result.success) {
    throw new ServiceError("reCAPTCHA verification failed", 400);
  }

  return true;
};

const generateUniqueUserUUID = async () => {
  let uuid;
  let exists;

  do {
    uuid = generatePrefixedId("U", 8);
    exists = await User.findByUUID(uuid);
  } while (exists);

  return uuid;
};

const generateUniqueCustomerUUID = async () => {
  let uuid;
  let exists;

  do {
    uuid = generatePrefixedId("C", 8);
    exists = await Customer.findByUUID(uuid);
  } while (exists);

  return uuid;
};

const generateUniqueEmployeeUUID = async () => {
  let uuid;
  let exists;

  do {
    uuid = generatePrefixedId("E", 9);
    exists = await Employee.findByUUID(uuid);
  } while (exists);

  return uuid;
};

const generateUniqueLoginUUID = async () => {
  let uuid;
  let exists;

  do {
    uuid = generatePrefixedId("L", 8);
    exists = await UserLogin.findByUUID(uuid);
  } while (exists);

  return uuid;
};

const buildUserResponse = (localUser, authUser) => ({
  uuid: localUser.uuid,
  email: localUser.email,
  first_name: localUser.first_name,
  last_name: localUser.last_name,
  role: localUser.role,
  customer_uuid: localUser.customer_uuid ?? null,
  supabaseUser: authUser
    ? {
        id: authUser.id,
        email: authUser.email,
        email_confirmed_at: authUser.email_confirmed_at,
        user_metadata: authUser.user_metadata,
      }
    : null,
});

export const registerUserService = async ({
  email,
  password,
  firstName,
  lastName,
  role,
  customerUuid,
  recaptchaToken,
  actorUserUuid = null,
}) => {
  let authUser = null;
  let user = null;
  let resolvedCustomer = null;

  const normalizedEmail = email?.trim().toLowerCase();
  const safeFirstName = firstName?.trim();
  const safeLastName = lastName?.trim();

  if (!normalizedEmail) throw new ServiceError("Email is required", 400);
  if (!emailRegex.test(normalizedEmail)) {
    throw new ServiceError("Invalid email format", 400);
  }
  if (!password) throw new ServiceError("Password is required", 400);
  if (password.length < 8) {
    throw new ServiceError("Password must be at least 8 characters", 400);
  }
  if (!safeFirstName) throw new ServiceError("First name is required", 400);
  if (!safeLastName) throw new ServiceError("Last name is required", 400);
  if (!recaptchaToken) {
    throw new ServiceError("reCAPTCHA token is required", 400);
  }

  let finalRole = role || "customer";

  if (process.env.NODE_ENV !== "production") {
    const allowedRoles = ["admin", "employee", "customer", "owner"];
    if (role && !allowedRoles.includes(role)) {
      throw new ServiceError("Invalid role", 400);
    }
    finalRole = role || "customer";
  }

  try {
    await verifySignupRecaptchaWithFallback(recaptchaToken);

    if (customerUuid) {
      const customerExists = await Customer.findByUUID(customerUuid);
      if (!customerExists) {
        throw new ServiceError("Invalid customer UUID", 400);
      }
      resolvedCustomer = customerExists;
    }

    const { data: existingUsers } = await supabase().auth.admin.listUsers({
      email: normalizedEmail,
    });

    if (existingUsers?.length) {
      throw new ServiceError("Email already registered", 409);
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

    if (authError) throw new ServiceError(authError.message, 400);
    authUser = data.user;

    const userUUID = await generateUniqueUserUUID();

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
      throw new ServiceError("Failed to create local user", 500);
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

    const { error: rpcError } = await supabase().rpc("admin_confirmation_sent", {
      user_id: authUser.id,
    });

    if (rpcError) {
      if (user?.uuid) {
        await User.hardDeleteLocalTable(user.uuid);
      }
      throw new ServiceError(rpcError.message, 500);
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
      uuid: await generateUniqueChangeLogUUID(),
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
      oldData: null,
      newData: user,
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

    return response;
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

    if (err instanceof ServiceError) throw err;
    throw new ServiceError(err.message || "Failed to register user", 400);
  }
};

export const loginService = async ({
  email,
  password,
  recaptchaToken,
  ipAddress,
  userAgent,
}) => {
  if (!email || !password) {
    throw new ServiceError("Email and password are required", 400);
  }

  if (!recaptchaToken) {
    throw new ServiceError("reCAPTCHA token is missing", 400);
  }

  const normalizedEmail = email.toLowerCase().trim();

  await verifyRecaptchaToken({
    token: recaptchaToken,
    secret: process.env.RECAPTCHA_V3_SECRET_KEY,
    expectedAction: "login",
    minScore: 0.5,
  });

  const { data, error } = await supabaseNonAdmin().auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) {
    if (error.code === "email_not_confirmed") {
      throw new ServiceError("Please confirm your email before logging in", 403, {
        code: "EMAIL_NOT_CONFIRMED",
      });
    }

    throw new ServiceError(error.message || "Invalid email or password", 401, {
      code: error.code || "LOGIN_FAILED",
    });
  }

  const authUser = data?.user;
  const session = data?.session;

  if (!authUser || !session) {
    throw new ServiceError("Login failed. Missing authenticated session.", 401, {
      code: "LOGIN_SESSION_MISSING",
    });
  }

  let localUser = await User.findByAuthID(authUser.id);
  if (!localUser) {
    throw new ServiceError("User record not found", 404);
  }

  if (authUser.email_confirmed_at && !localUser.is_email_verified) {
    try {
      await User.markVerified(authUser.id);
      localUser = await User.findByAuthID(authUser.id);
    } catch (verifyErr) {
      console.error("User.markVerified failed:", verifyErr);
    }
  }

  if (!localUser?.is_email_verified || !authUser.email_confirmed_at) {
    throw new ServiceError("Email not verified", 403, {
      code: "EMAIL_NOT_VERIFIED",
    });
  }

  const loginUUID = await generateUniqueLoginUUID();

  let userLogin = null;
  try {
    userLogin = await UserLogin.create({
      uuid: loginUUID,
      user_uuid: localUser.uuid,
      ip_address: ipAddress,
      user_agent: userAgent,
      success: true,
    });
  } catch (logErr) {
    console.error("UserLogin.create failed:", logErr);
  }

  try {
    await createChangeLogSafe({
      uuid: await generateUniqueChangeLogUUID(),
      table_name: "users",
      record_uuid: localUser.uuid,
      user_uuid: localUser.uuid,
      action: "login",
      summary: "User logged in successfully",
      changed_fields: {
        last_logged_in_at: {
          old: localUser.last_logged_in_at ?? null,
          new: new Date().toISOString(),
        },
      },
      oldData: null,
      newData: {
        email: localUser.email,
        role: localUser.role,
        ip_address: ipAddress,
        user_agent: userAgent,
        login_uuid: userLogin?.uuid || loginUUID,
        login_logged: !!userLogin,
      },
      source: "auth",
    });
  } catch (changeLogErr) {
    console.error("createChangeLogSafe failed during login:", changeLogErr);
  }

  const isStaffRole = ["admin", "owner", "employee"].includes(localUser.role);

  const accessTokenMaxAge = isStaffRole
    ? 1000 * 60 * 60 * 24
    : 1000 * 60 * 30;

  let updatedUser = null;
  try {
    updatedUser = await User.updateByUUID(localUser.uuid, {
      last_logged_in_at: new Date().toISOString(),
    });
  } catch (updateErr) {
    console.error("User.updateByUUID failed:", updateErr);
  }

  return {
    message: "Login successful",
    user: buildUserResponse(localUser, authUser),
    warnings: {
      login_audit_saved: !!userLogin,
      last_login_updated: !!updatedUser,
    },
    cookies: {
      accessToken: {
        value: session.access_token,
        options: {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: accessTokenMaxAge,
          path: "/",
        },
      },
      refreshToken: {
        value: session.refresh_token,
        options: {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 1000 * 60 * 60 * 24 * 7,
          path: "/",
        },
      },
      role: {
        value: localUser.role,
        options: {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: accessTokenMaxAge,
          path: "/",
        },
      },
    },
  };
};

export const logoutService = async ({ accessToken }) => {
  if (accessToken) {
    const { createClient } = await import("@supabase/supabase-js");

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

    await scopedSupabase.auth.signOut();
  }

  return {
    message: "Logged out successfully",
    cookiesToClear: [
      {
        name: "accessToken",
        options: {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          expires: new Date(0),
          path: "/",
        },
      },
      {
        name: "refreshToken",
        options: {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          expires: new Date(0),
          path: "/",
        },
      },
    ],
  };
};

export const getCurrentUserService = async ({ accessToken, refreshToken }) => {
  if (!accessToken) {
    throw new ServiceError("Missing access token", 401);
  }

  let sessionUser;
  let refreshedSession = null;

  const { data, error } = await supabase().auth.getUser(accessToken);

  if (error || !data?.user) {
    if (!refreshToken) {
      throw new ServiceError("Access token expired, please log in again", 401);
    }

    const { data: refreshData, error: refreshError } =
      await supabase().auth.refreshSession({
        refresh_token: refreshToken,
      });

    if (refreshError || !refreshData?.session) {
      throw new ServiceError("Refresh failed, please log in again", 401);
    }

    sessionUser = refreshData.session.user;
    refreshedSession = refreshData.session;
  } else {
    sessionUser = data.user;
  }

  let localUser = await User.findByAuthID(sessionUser.id);

  if (!localUser) {
    const userUUID = await generateUniqueUserUUID();
    localUser = await User.create({
      auth_user_id: sessionUser.id,
      email: sessionUser.email,
      first_name: sessionUser.user_metadata?.first_name || "",
      last_name: sessionUser.user_metadata?.last_name || "",
      role: "customer",
      uuid: userUUID,
      is_email_verified: !!sessionUser.email_confirmed_at,
    });
  }

  return {
    message: "Auto-login successful",
    user: buildUserResponse(localUser, sessionUser),
    refreshedSession,
  };
};

export const verifyEmailService = async ({ token }) => {
  if (!token) {
    throw new ServiceError("Token is required", 400);
  }

  try {
    const payload = jwt.verify(token, process.env.EMAIL_TOKEN_SECRET);

    if (payload.purpose !== "email_verification") {
      throw new ServiceError("Invalid token purpose", 400);
    }

    if (!payload.user_uuid) {
      throw new ServiceError("Invalid token payload", 400);
    }

    const user = await User.findByUUID(payload.user_uuid);

    if (!user) {
      throw new ServiceError("User not found", 404);
    }

    if (!user.auth_user_id) {
      throw new ServiceError("User auth ID is missing", 400);
    }

    if (user.is_email_verified) {
      return {
        message: "User is already verified",
        user,
      };
    }

    const { error: authError } = await supabase().auth.admin.updateUserById(
      user.auth_user_id,
      { email_confirm: true }
    );

    if (authError) {
      throw new ServiceError(authError.message, 400);
    }

    let verifiedUser = await User.markVerified(user.auth_user_id);

    if (!verifiedUser) {
      throw new ServiceError("Failed to update local user verification status", 500);
    }

    await createChangeLogSafe({
      uuid: await generateUniqueChangeLogUUID(),
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
      oldData: user,
      newData: verifiedUser,
      source: "system",
    });

    if (verifiedUser.role === "customer") {
      let linkedCustomer = null;
      let customerCreated = false;

      const normalizedEmail = verifiedUser.email?.trim().toLowerCase() || null;
      const normalizedFirstName =
        verifiedUser.first_name?.trim().toLowerCase() || null;
      const normalizedLastName =
        verifiedUser.last_name?.trim().toLowerCase() || null;

      if (verifiedUser.customer_uuid) {
        linkedCustomer = await Customer.findByUUID(verifiedUser.customer_uuid);
      }

      if (!linkedCustomer && normalizedEmail) {
        linkedCustomer = await Customer.findByEmail(normalizedEmail);
      }

      if (!linkedCustomer) {
        const customerUUID = await generateUniqueCustomerUUID();

        linkedCustomer = await Customer.create({
          uuid: customerUUID,
          first_name: normalizedFirstName,
          last_name: normalizedLastName,
          email: normalizedEmail,
          created_via: "self_signup",
        });

        if (!linkedCustomer) {
          throw new ServiceError("Failed to create associated customer record", 500);
        }

        customerCreated = true;

        await createChangeLogSafe({
          uuid: await generateUniqueChangeLogUUID(),
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
          oldData: null,
          newData: linkedCustomer,
          source: "system",
        });
      } else {
        const customerUpdates = {};
        const customerChangedFields = {};
        const existingCustomerBeforeUpdate = { ...linkedCustomer };

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
          linkedCustomer = await Customer.updateByUUID(
            linkedCustomer.uuid,
            customerUpdates
          );

          await createChangeLogSafe({
            uuid: await generateUniqueChangeLogUUID(),
            table_name: "customers",
            record_uuid: linkedCustomer.uuid,
            user_uuid: null,
            action: "update",
            summary: "Customer details enriched during email verification",
            changed_fields: customerChangedFields,
            oldData: existingCustomerBeforeUpdate,
            newData: linkedCustomer,
            source: "system",
          });
        }
      }

      if (linkedCustomer?.uuid && verifiedUser.customer_uuid !== linkedCustomer.uuid) {
        const beforeCustomerUuid = verifiedUser.customer_uuid ?? null;
        const verifiedUserBeforeLink = { ...verifiedUser };

        verifiedUser = await User.updateByUUID(verifiedUser.uuid, {
          customer_uuid: linkedCustomer.uuid,
        });

        if (!verifiedUser) {
          throw new ServiceError("Failed to link verified user to customer", 500);
        }

        await createChangeLogSafe({
          uuid: await generateUniqueChangeLogUUID(),
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
          oldData: verifiedUserBeforeLink,
          newData: verifiedUser,
          source: "system",
        });
      }
    }

    return {
      message: "User verified successfully",
      user: verifiedUser,
    };
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw new ServiceError("Token has expired", 400);
    }

    if (err.name === "JsonWebTokenError") {
      throw new ServiceError("Invalid token", 400);
    }

    if (err instanceof ServiceError) throw err;
    throw new ServiceError(err.message || "Verification failed", 400);
  }
};

export const resendVerificationEmailService = async ({
  email,
  actorUserUuid = null,
}) => {
  if (!email) throw new ServiceError("Email is required", 400);

  const user = await User.findByEmail(email);
  if (!user) throw new ServiceError("User not found", 404);

  if (user.is_email_verified) {
    throw new ServiceError("User is already verified", 400);
  }

  const emailToken = jwt.sign(
    { user_uuid: user.uuid, email: user.email, purpose: "email_verification" },
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
    uuid: await generateUniqueChangeLogUUID(),
    table_name: "users",
    record_uuid: user.uuid,
    user_uuid: actorUserUuid,
    action: "update",
    summary: "Verification email resent",
    changed_fields: {
      verification_email_resent: {
        old: false,
        new: true,
      },
    },
    oldData: user,
    newData: {
      ...user,
      verification_email_resent: true,
    },
    source: actorUserUuid ? "dashboard" : "public_form",
  });

  return {
    message: "Verification email sent",
    verifyLink: process.env.NODE_ENV !== "production" ? verifyLink : undefined,
  };
};

export const deleteSupabaseUserService = async ({ authUserId }) => {
  if (!authUserId) {
    throw new ServiceError("Missing authUserId", 400);
  }

  const { data, error } = await supabase().auth.admin.deleteUser(authUserId);

  if (error) {
    throw new ServiceError(error.message, 400);
  }

  return {
    message: `Supabase() user ${authUserId} deleted successfully`,
    data,
  };
};

export const deleteSupabaseAndDBUsersService = async ({
  authUserId,
  actorUserUuid = null,
}) => {
  if (!authUserId) {
    throw new ServiceError("Missing authUserId", 400);
  }

  const user = await User.findByAuthID(authUserId);
  if (!user) {
    throw new ServiceError(`User not found with authUserId: ${authUserId}`, 400);
  }

  const { error: supabaseError } = await supabase().auth.admin.deleteUser(authUserId);

  if (supabaseError) {
    throw new ServiceError(supabaseError.message, 400);
  }

  const userDeleted = await User.hardDeleteFull(user.uuid);
  if (!userDeleted) {
    throw new ServiceError(`User not found with User uuid: ${user.uuid}`, 400);
  }

  await createChangeLogSafe({
    uuid: await generateUniqueChangeLogUUID(),
    table_name: "users",
    record_uuid: user.uuid,
    user_uuid: actorUserUuid,
    action: "delete",
    summary: "User deleted from Supabase() and local DB",
    changed_fields: {
      deleted_record: {
        old: {
          uuid: user.uuid,
          auth_user_id: user.auth_user_id,
          email: user.email,
          role: user.role,
          customer_uuid: user.customer_uuid,
        },
        new: null,
      },
    },
    oldData: user,
    newData: null,
    source: "dashboard",
  });

  return {
    message: `Supabase() user ${authUserId} deleted successfully`,
    data: userDeleted,
  };
};

export const verifyUserService = async ({ authUserId, actorUserUuid = null }) => {
  if (!authUserId) {
    throw new ServiceError("auth_user_id is required", 400);
  }

  const exists = await User.findByAuthID(authUserId);
  if (!exists) {
    throw new ServiceError("User not found", 404);
  }

  const { data: authUser, error: authError } =
    await supabase().auth.admin.updateUserById(authUserId, {
      email_confirm: true,
    });

  if (authError) {
    throw new ServiceError(authError.message, 400);
  }

  const user = await User.markVerified(authUserId);

  await createChangeLogSafe({
    uuid: await generateUniqueChangeLogUUID(),
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
    oldData: exists,
    newData: user,
    source: "dashboard",
  });

  return {
    message: "User email verified successfully",
    user,
    supbaseUser: authUser,
  };
};

export const deleteUserService = async ({ uuid, actorUserUuid = null }) => {
  const existing = await User.findByUUID(uuid, { includeDeleted: true });
  if (!existing) {
    throw new ServiceError("User not found", 404);
  }

  const deleted = await User.softDelete(uuid);

  await createChangeLogSafe({
    uuid: await generateUniqueChangeLogUUID(),
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
    oldData: existing,
    newData: deleted,
    source: "dashboard",
  });

  return { message: "User deleted" };
};

export const getUserByUUIDService = async ({ uuid }) => {
  if (!uuid) throw new ServiceError("UUID is required", 400);

  const user = await User.findByUUID(uuid, { includeDeleted: true });
  if (!user) throw new ServiceError("User not found", 404);

  return user;
};

export const updateUserService = async ({
  uuid,
  updates,
  actorUserUuid = null,
}) => {
  const existing = await User.findByUUID(uuid, { includeDeleted: true });
  if (!existing) {
    throw new ServiceError("User not found", 404);
  }

  const updatedUser = await User.updateByUUID(uuid, updates);

  const changed_fields = {};
  for (const key of Object.keys(updates || {})) {
    if (
      JSON.stringify(existing?.[key] ?? null) !==
      JSON.stringify(updatedUser?.[key] ?? null)
    ) {
      changed_fields[key] = {
        old: existing?.[key] ?? null,
        new: updatedUser?.[key] ?? null,
      };
    }
  }

  if (Object.keys(changed_fields).length > 0) {
    await createChangeLogSafe({
      uuid: await generateUniqueChangeLogUUID(),
      table_name: "users",
      record_uuid: uuid,
      user_uuid: actorUserUuid,
      action: "update",
      summary: "User updated",
      changed_fields,
      oldData: existing,
      newData: updatedUser,
      source: "dashboard",
    });
  }

  return updatedUser;
};

export const hardDeleteFullService = async ({ uuid, actorUserUuid = null }) => {
  if (!uuid) throw new ServiceError("UUID is required", 400);

  const user = await User.findByUUID(uuid);
  if (!user) throw new ServiceError("User not found", 404);

  await UserLogin.deleteByUUID(user.uuid);

  const { data: authUser, error: authError } =
    await supabase().auth.admin.deleteUser(user.auth_user_id);

  if (authError) {
    throw new ServiceError(
      "User deleted from local DB but failed to delete from Supabase() Auth",
      400,
      { originalError: authError.message }
    );
  }

  if (user.customer_uuid) {
    const deletedCustomer = await Customer.delete(user.customer_uuid);
    if (!deletedCustomer) {
      throw new ServiceError("Failed to hard delete customer from local DB", 500);
    }
  }

  const deletedUser = await User.hardDeleteFull(uuid);
  if (!deletedUser) {
    throw new ServiceError("Failed to hard delete user from local DB", 500);
  }

  await createChangeLogSafe({
    uuid: await generateUniqueChangeLogUUID(),
    table_name: "users",
    record_uuid: uuid,
    user_uuid: actorUserUuid,
    action: "delete",
    summary: "User fully hard deleted",
    changed_fields: {
      deleted_record: {
        old: {
          uuid: user.uuid,
          auth_user_id: user.auth_user_id,
          email: user.email,
          customer_uuid: user.customer_uuid,
          role: user.role,
        },
        new: null,
      },
    },
    oldData: user,
    newData: null,
    source: "dashboard",
  });

  return {
    message: "User hard deleted successfully",
    deletedUser,
    supabaseDeletion: authUser,
  };
};

export const getUsersService = async () => {
  const users = await User.findAll();
  if (!users) {
    throw new ServiceError("No users found", 404);
  }
  return { users: users || [] };
};

export const hardDeleteUserLocallyService = async ({
  uuid,
  actorUserUuid = null,
}) => {
  if (!uuid) throw new ServiceError("UUID is required", 400);

  const user = await User.findByUUID(uuid, { includeDeleted: true });
  if (!user) throw new ServiceError("User not found", 404);

  const deletedUser = await User.hardDeleteLocalTable(uuid);

  await createChangeLogSafe({
    uuid: await generateUniqueChangeLogUUID(),
    table_name: "users",
    record_uuid: uuid,
    user_uuid: actorUserUuid,
    action: "delete",
    summary: "User hard deleted from local DB only",
    changed_fields: {
      deleted_record: {
        old: {
          uuid: user.uuid,
          auth_user_id: user.auth_user_id,
          email: user.email,
          role: user.role,
        },
        new: null,
      },
    },
    oldData: user,
    newData: null,
    source: "dashboard",
  });

  return {
    message: "User hard deleted from local DB successfully",
    data: deletedUser,
  };
};

export const getUserByEmailService = async ({ email }) => {
  if (!email) {
    throw new ServiceError("Email is required", 400);
  }

  const user = await User.findByEmail(email);

  if (!user) {
    throw new ServiceError(`User not found by Email: ${email}`, 404);
  }

  return { user };
};

export const deleteUserByEmailService = async ({ email }) => {
  if (!email) {
    throw new ServiceError("Email is required", 400);
  }

  const { data, error } = await supabase().auth.admin.listUsers({ email });
  if (error) throw new ServiceError(error.message, 500);

  const users = data?.users || [];

  if (users.length === 0) {
    throw new ServiceError("User not found", 404);
  }

  const userId = users[0].id;
  await supabase().auth.admin.deleteUser(userId);

  return {
    message: "User deleted successfully",
    data: users,
  };
};

export const refreshTokenService = async ({ refreshToken }) => {
  if (!refreshToken) {
    throw new ServiceError("No refresh token", 401);
  }

  const { data, error } = await supabase().auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error) {
    throw new ServiceError("Invalid refresh token", 401);
  }

  return {
    message: "Token refreshed",
    session: data.session,
  };
};

export const generateResetLinkService = async ({ email }) => {
  const { data, error } = await supabase().auth.api.resetPasswordForEmail(email, {
    redirectTo: `${process.env.CLIENT_URL}/reset-password`,
  });

  if (error) throw new ServiceError(error.message, 400);

  return { resetLink: data.action_link };
};

export const requestPasswordResetService = async ({ email }) => {
  const user = await User.findByEmail(email);
  if (!user) {
    return { success: true };
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  await supabase().from("password_reset_tokens").insert({
    user_id: user.id,
    token_hash: tokenHash,
    expires_at: new Date(Date.now() + 1000 * 60 * 30),
  });

  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  return {
    success: true,
    resetLink,
  };
};

export const resetPasswordService = async ({ token, newPassword }) => {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const { data: record } = await supabase()
    .from("password_reset_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .is("used_at", null)
    .gt("expires_at", new Date())
    .single();

  if (!record) {
    throw new ServiceError("Invalid or expired token", 400);
  }

  await supabase().auth.admin.updateUserById(record.user_id, {
    password: newPassword,
  });

  await supabase()
    .from("password_reset_tokens")
    .update({ used_at: new Date() })
    .eq("id", record.id);

  return { success: true };
};

export const checkCookiesExistsService = async ({ accessToken, refreshToken }) => {
  if (!accessToken || !refreshToken) {
    return { loggedIn: false, status: 401 };
  }

  return { loggedIn: true, status: 200 };
};

export const createUserEmptyEmployeeService = async ({
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
  employeeMobile,
}) => {
  if (!businessEmail) {
    throw new ServiceError("Email is required!", 400);
  }

  const normalizedEmail = businessEmail.trim().toLowerCase();

  const userExists = await User.findByEmail(normalizedEmail);
  if (userExists) {
    throw new ServiceError("Email already exists in DB.", 409);
  }

  const { data: existingUsers } = await supabase().auth.admin.listUsers({
    email: normalizedEmail,
  });

  if (existingUsers?.length) {
    throw new ServiceError("Email already registered in Supabase().", 409);
  }

  const uuid = await generateUniqueUserUUID();
  const finalRole = userRole ?? "employee";

  const user = await User.create({
    auth_user_id: null,
    email: normalizedEmail,
    first_name: employeeFirstName?.toLowerCase() ?? "",
    last_name: employeeLastName?.toLowerCase() ?? "",
    role: finalRole,
    uuid,
  });

  const employeeUuid = await generateUniqueEmployeeUUID();
  const finalEmployeeContract = employeeContract ?? "casual";

  const newEmployee = {
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
    deleted_by_user_uuid: null,
  };

  const newEmployeeAdded = await Employee.create(newEmployee);
  if (!newEmployeeAdded) {
    throw new ServiceError("Failed to create a new employee.", 400);
  }

  const { data: supabaseData, error: supabaseError } =
    await supabase().auth.admin.generateLink({
      type: "invite",
      email: normalizedEmail,
      options: {
        redirectTo: `${process.env.FRONTEND_URL_HAPPY_PROPERTY}/user/set-password`,
      },
    });

  if (supabaseError) {
    throw new ServiceError("Failed to generate invite link", 500);
  }

  const inviteLink = supabaseData.properties.action_link;

  await sendInviteLink({
    to: normalizedEmail,
    firstName: employeeFirstName,
    lastName: employeeLastName,
    inviteLink,
    expiryHours: 24,
  });

  await createChangeLogSafe({
    uuid: await generateUniqueChangeLogUUID(),
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
    oldData: null,
    newData: user,
    source: "dashboard",
  });

  await createChangeLogSafe({
    uuid: await generateUniqueChangeLogUUID(),
    table_name: "employees",
    record_uuid: newEmployeeAdded.uuid,
    user_uuid: createdByUserUUID || null,
    action: "create",
    summary: "Employee record created and invite sent",
    changed_fields: {
      uuid: { old: null, new: newEmployeeAdded.uuid },
      user_uuid: { old: null, new: newEmployeeAdded.user_uuid },
      business_email: { old: null, new: newEmployeeAdded.business_email },
      employee_first_name: {
        old: null,
        new: newEmployeeAdded.employee_first_name,
      },
      employee_last_name: {
        old: null,
        new: newEmployeeAdded.employee_last_name,
      },
      employee_job_title: {
        old: null,
        new: newEmployeeAdded.employee_job_title,
      },
      employee_department: {
        old: null,
        new: newEmployeeAdded.employee_department,
      },
      employee_contract: {
        old: null,
        new: newEmployeeAdded.employee_contract,
      },
    },
    oldData: null,
    newData: newEmployeeAdded,
    source: "dashboard",
  });

  return {
    message: "User and employee created and invite sent successfully",
    userUuid: user.uuid,
    user,
    employee: newEmployeeAdded,
  };
};

export const getUserByAuthUserIdService = async ({ authUserId }) => {
  if (!authUserId) {
    throw new ServiceError("authUserId is required", 400);
  }

  const user = await User.findByAuthID(authUserId);
  if (!user) {
    throw new ServiceError("User not found", 404);
  }

  return user;
};

export { ServiceError };