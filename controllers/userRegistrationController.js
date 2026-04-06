import crypto from "crypto";
import { supabase } from "../config/db.js";
import User from "../models/User.js";
import Customer from "../models/Customer.js";
import Employee from "../models/Employee.js";
import PendingUserRegistration from "../models/PendingUserRegistration.js";
import {
  formatFullName,
  generatePrefixedId,
  generateUniqueChangeLogUUID,
} from "../util/util.js";
import verifyEmailLink from "../lib/email/verifyEmailLink.js";
import { createChangeLogSafe } from "../util/createChangeLogSafe.js";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PENDING_REGISTRATION_EXPIRES_MINUTES = 60;
const privilegedAllowedRoles = ["admin", "employee", "customer", "owner"];

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function makeRegistrationToken() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * STEP 1 - PUBLIC
 * Public self-registration.
 * Always creates pending CUSTOMER registration only.
 */
export const requestUserRegistration = async (req, res) => {
  const { email, firstName, lastName } = req.body;

  const normalizedEmail = email?.trim().toLowerCase();
  const normalizedFirstName = firstName?.trim();
  const normalizedLastName = lastName?.trim();
  const finalRole = "customer";

  let pendingRegistration = null;
  let completeLink = null;
  let rawToken = null;

  if (!normalizedEmail) {
    return res.status(400).json({ error: "Email is required" });
  }

  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  if (!normalizedFirstName) {
    return res.status(400).json({ error: "First name is required" });
  }

  if (!normalizedLastName) {
    return res.status(400).json({ error: "Last name is required" });
  }

  try {
    const existingLocalUser = await User.findByEmail(normalizedEmail);
    if (existingLocalUser) {
      return res.status(409).json({ error: "Email already registered locally" });
    }

    const { data: authUsersData, error: authUsersError } =
      await supabase().auth.admin.listUsers();

    if (authUsersError) {
      throw new Error(authUsersError.message);
    }

    const existingAuthUser = authUsersData?.users?.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );

    if (existingAuthUser) {
      return res.status(409).json({ error: "Email already registered in auth" });
    }

    const existingPending =
      await PendingUserRegistration.findActiveByEmail(normalizedEmail);

    if (existingPending) {
      return res.status(409).json({
        error: "An active registration invite already exists for this email",
      });
    }

    rawToken = makeRegistrationToken();
    const tokenHash = hashToken(rawToken);

    let pendingUUID;
    let exists;

    do {
      pendingUUID = generatePrefixedId("UP", 7);
      exists = await PendingUserRegistration.findByUUID(pendingUUID);
    } while (exists);

    const expiresAt = new Date(
      Date.now() + PENDING_REGISTRATION_EXPIRES_MINUTES * 60 * 1000
    ).toISOString();

    pendingRegistration = await PendingUserRegistration.create({
      uuid: pendingUUID,
      email: normalizedEmail,
      first_name: normalizedFirstName,
      last_name: normalizedLastName,
      role: finalRole,
      customer_uuid: null,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    completeLink = `${process.env.CLIENT_URL}/complete-registration?token=${rawToken}`;

    try {
      await verifyEmailLink({
        to: normalizedEmail,
        name: formatFullName(normalizedFirstName, normalizedLastName),
        verifyLink: completeLink,
        expiryMinutes: PENDING_REGISTRATION_EXPIRES_MINUTES,
      });
    } catch (emailErr) {
      if (pendingRegistration?.uuid) {
        try {
          await PendingUserRegistration.softDeleteByUUID(pendingRegistration.uuid);
        } catch (cleanupErr) {
          console.error(
            "FAILED TO ROLLBACK PENDING REGISTRATION AFTER EMAIL FAILURE",
            cleanupErr
          );
        }
      }

      if (process.env.NODE_ENV !== "production") {
        return res.status(500).json({
          error: "Failed to send registration email",
          details: emailErr.message,
          completeLink,
          token: rawToken,
        });
      }

      return res.status(500).json({
        error: "Failed to send registration email",
      });
    }

    const response = {
      message: "Registration email sent successfully",
      pending_registration_uuid: pendingRegistration.uuid,
    };

    if (process.env.NODE_ENV !== "production") {
      response.completeLink = completeLink;
      response.token = rawToken;
    }

    return res.status(201).json(response);
  } catch (err) {
    if (pendingRegistration?.uuid) {
      try {
        await PendingUserRegistration.softDeleteByUUID(pendingRegistration.uuid);
      } catch (cleanupErr) {
        console.error("FAILED TO ROLLBACK PENDING REGISTRATION", cleanupErr);
      }
    }

    const response = { error: err.message };

    if (process.env.NODE_ENV !== "production" && completeLink && rawToken) {
      response.completeLink = completeLink;
      response.token = rawToken;
    }

    return res.status(500).json(response);
  }
};

/**
 * STEP 1B - PROTECTED
 * Admin/owner invite flow for privileged or non-customer roles.
 */
export const requestPrivilegedUserRegistration = async (req, res) => {
  const actorUserUuid = req.user?.uuid || null;
  const actorRole = req.user?.role || null;
  const actorFullName = req.user
    ? formatFullName(req.user.first_name || "", req.user.last_name || "")
    : "Happy Property Team";

  const { email, firstName, lastName, role, customerUuid } = req.body;

  const normalizedEmail = email?.trim().toLowerCase();
  const normalizedFirstName = firstName?.trim();
  const normalizedLastName = lastName?.trim();
  const finalRole = role?.trim();

  let pendingRegistration = null;
  let completeLink = null;
  let rawToken = null;

  if (!normalizedEmail) {
    return res.status(400).json({ error: "Email is required" });
  }

  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  if (!normalizedFirstName) {
    return res.status(400).json({ error: "First name is required" });
  }

  if (!normalizedLastName) {
    return res.status(400).json({ error: "Last name is required" });
  }

  if (!finalRole) {
    return res.status(400).json({ error: "Role is required" });
  }

  if (!privilegedAllowedRoles.includes(finalRole)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  if (actorRole === "admin" && finalRole === "owner") {
    return res.status(403).json({ error: "Admins cannot invite owners" });
  }

  try {
    let resolvedCustomer = null;

    if (customerUuid) {
      resolvedCustomer = await Customer.findByUUID(customerUuid);
      if (!resolvedCustomer) {
        return res.status(400).json({ error: "Invalid customer UUID" });
      }
    }

    const existingLocalUser = await User.findByEmail(normalizedEmail);
    if (existingLocalUser) {
      return res.status(409).json({ error: "Email already registered locally" });
    }

    const { data: authUsersData, error: authUsersError } =
      await supabase().auth.admin.listUsers();

    if (authUsersError) {
      throw new Error(authUsersError.message);
    }

    const existingAuthUser = authUsersData?.users?.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );

    if (existingAuthUser) {
      return res.status(409).json({ error: "Email already registered in auth" });
    }

    const existingPending =
      await PendingUserRegistration.findActiveByEmail(normalizedEmail);

    if (existingPending) {
      return res.status(409).json({
        error: "An active registration invite already exists for this email",
      });
    }

    rawToken = makeRegistrationToken();
    const tokenHash = hashToken(rawToken);

    let pendingUUID;
    let exists;

    do {
      pendingUUID = generatePrefixedId("UP", 7);
      exists = await PendingUserRegistration.findByUUID(pendingUUID);
    } while (exists);

    const expiresAt = new Date(
      Date.now() + PENDING_REGISTRATION_EXPIRES_MINUTES * 60 * 1000
    ).toISOString();

    pendingRegistration = await PendingUserRegistration.create({
      uuid: pendingUUID,
      email: normalizedEmail,
      first_name: normalizedFirstName,
      last_name: normalizedLastName,
      role: finalRole,
      customer_uuid: resolvedCustomer?.uuid ?? customerUuid ?? null,
      invited_by_user_uuid: actorUserUuid,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    completeLink = `${process.env.CLIENT_URL}/complete-registration?token=${rawToken}`;

    await verifyEmailLink({
      to: normalizedEmail,
      name: formatFullName(normalizedFirstName, normalizedLastName),
      verifyLink: completeLink,
      expiryMinutes: PENDING_REGISTRATION_EXPIRES_MINUTES,
      role: finalRole,
      invitedBy: actorFullName,
    });

    await createChangeLogSafe({
      uuid: await generateUniqueChangeLogUUID(),
      table_name: "pending_user_registrations",
      record_uuid: pendingRegistration.uuid,
      user_uuid: actorUserUuid,
      action: "create",
      summary: `Pending ${finalRole} registration created by ${actorFullName}`,
      changed_fields: {
        email: normalizedEmail,
        first_name: normalizedFirstName,
        last_name: normalizedLastName,
        role: finalRole,
        customer_uuid: pendingRegistration.customer_uuid ?? null,
        invited_by_user_uuid: actorUserUuid,
        invited_by_name: actorFullName,
        expires_at: expiresAt,
      },
      oldData: null,
      newData: pendingRegistration,
      source: "dashboard",
    });

    const response = {
      message: "Privileged registration email sent successfully",
      pending_registration_uuid: pendingRegistration.uuid,
      pending_registration: pendingRegistration,
    };

    if (process.env.NODE_ENV !== "production") {
      response.completeLink = completeLink;
      response.token = rawToken;
    }

    return res.status(201).json(response);
  } catch (err) {
    if (pendingRegistration?.uuid) {
      try {
        await PendingUserRegistration.softDeleteByUUID(pendingRegistration.uuid);
      } catch (cleanupErr) {
        console.error(
          "FAILED TO ROLLBACK PRIVILEGED PENDING REGISTRATION",
          cleanupErr
        );
      }
    }

    const response = { error: err.message };

    if (process.env.NODE_ENV !== "production" && completeLink && rawToken) {
      response.completeLink = completeLink;
      response.token = rawToken;
    }

    return res.status(400).json(response);
  }
};

/**
 * STEP 2
 * Frontend calls this after user clicks email link and submits password.
 * This creates Supabase auth user + local DB user only after confirmation.
 */
export const completeUserRegistration = async (req, res) => {
  const { token, password } = req.body;

  const actorUserUuid = req.user?.uuid || null;

  let authUser = null;
  let user = null;
  let resolvedCustomer = null;
  let createdEmployee = null;
  let customerCreated = false;
  let createdCustomerUuid = null;

  if (!token) {
    return res.status(400).json({ error: "Token is required" });
  }

  if (!password) {
    return res.status(400).json({ error: "Password is required" });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  try {
    const tokenHash = hashToken(token);
    const pending = await PendingUserRegistration.findByTokenHash(tokenHash);

    if (!pending) {
      return res.status(400).json({ error: "Invalid or already used token" });
    }

    if (new Date(pending.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: "Registration token has expired" });
    }

    const normalizedEmail = pending.email.trim().toLowerCase();
    const firstName = pending.first_name;
    const lastName = pending.last_name;
    const finalRole = pending.role || "customer";
    const customerUuid = pending.customer_uuid || null;

    const existingLocalUser = await User.findByEmail(normalizedEmail);
    if (existingLocalUser) {
      return res.status(409).json({ error: "User already exists locally" });
    }

    const { data: authUsersData, error: authUsersError } =
      await supabase().auth.admin.listUsers();

    if (authUsersError) {
      throw new Error(authUsersError.message);
    }

    const existingAuthUser = authUsersData?.users?.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );

    if (existingAuthUser) {
      return res.status(409).json({ error: "Email already registered in auth" });
    }

    const { data, error: authError } = await supabase().auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
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

    if (finalRole === "customer") {
      if (customerUuid) {
        resolvedCustomer = await Customer.findByUUID(customerUuid);
        if (!resolvedCustomer) {
          throw new Error("Linked customer UUID no longer exists");
        }
      }

      if (!resolvedCustomer) {
        resolvedCustomer = await Customer.findByEmail(normalizedEmail);
      }

      if (!resolvedCustomer) {
        let newCustomerUUID;
        let customerExists;

        do {
          newCustomerUUID = generatePrefixedId("C", 8);
          customerExists = await Customer.findByUUID(newCustomerUUID);
        } while (customerExists);

        resolvedCustomer = await Customer.create({
          uuid: newCustomerUUID,
          first_name: firstName,
          last_name: lastName,
          email: normalizedEmail,
          created_via: "self_signup",
        });

        if (!resolvedCustomer) {
          throw new Error("Failed to create associated customer record");
        }

        customerCreated = true;
        createdCustomerUuid = resolvedCustomer.uuid;

        await createChangeLogSafe({
          uuid: await generateUniqueChangeLogUUID(),
          table_name: "customers",
          record_uuid: resolvedCustomer.uuid,
          user_uuid: actorUserUuid,
          action: "create",
          summary: "Customer created during user registration",
          changed_fields: {
            email: normalizedEmail,
            first_name: firstName,
            last_name: lastName,
            created_via: "self_signup",
          },
          oldData: null,
          newData: resolvedCustomer,
          source: "system",
        });
      } else {
        try {
          await Customer.updateByUUID(resolvedCustomer.uuid, {
            first_name: resolvedCustomer.first_name || firstName,
            last_name: resolvedCustomer.last_name || lastName,
          });
        } catch (e) {
          console.error("Customer update during registration skipped:", e.message);
        }
      }
    }

    user = await User.create({
      auth_user_id: authUser.id,
      email: normalizedEmail,
      first_name: firstName,
      last_name: lastName,
      role: finalRole,
      uuid: userUUID,
      customer_uuid: finalRole === "customer" ? resolvedCustomer?.uuid ?? null : null,
    });

    await createChangeLogSafe({
      uuid: await generateUniqueChangeLogUUID(),
      table_name: "users",
      record_uuid: user.uuid,
      user_uuid: actorUserUuid,
      action: "create",
      summary: "User account created from registration",
      changed_fields: {
        email: normalizedEmail,
        role: finalRole,
        first_name: firstName,
        last_name: lastName,
        auth_user_id: authUser.id,
      },
      oldData: null,
      newData: user,
      source: "system",
    });

    if (["admin", "employee", "owner"].includes(finalRole)) {
      const existingEmployee = await Employee.findByUserUUID(user.uuid);

      if (!existingEmployee) {
        let employeeUUID;
        let employeeExists;

        do {
          employeeUUID = generatePrefixedId("E", 8);
          employeeExists = await Employee.findByUUID?.(employeeUUID);
        } while (employeeExists);

        createdEmployee = await Employee.create({
          uuid: employeeUUID,
          user_uuid: user.uuid,
          employee_first_name: firstName,
          employee_last_name: lastName,
          employee_email: normalizedEmail,
        });

        if (!createdEmployee) {
          throw new Error("Failed to create employee record");
        }

        await createChangeLogSafe({
          uuid: await generateUniqueChangeLogUUID(),
          table_name: "employees",
          record_uuid: createdEmployee.uuid,
          user_uuid: actorUserUuid,
          action: "create",
          summary: `Employee profile created for ${finalRole} user`,
          changed_fields: {
            user_uuid: user.uuid,
            employee_email: normalizedEmail,
            employee_first_name: firstName,
            employee_last_name: lastName,
          },
          oldData: null,
          newData: createdEmployee,
          source: "system",
        });
      }
    }

    await PendingUserRegistration.markUsed(pending.uuid);

    return res.status(201).json({
      message: "User registration completed successfully",
      user,
      employee: createdEmployee || null,
    });
  } catch (err) {
    if (createdEmployee?.uuid) {
      try {
        await Employee.hardDelete(createdEmployee.uuid);
      } catch (cleanupErr) {
        console.error("FAILED TO ROLLBACK EMPLOYEE", cleanupErr);
      }
    }

    if (user?.uuid) {
      try {
        await User.hardDeleteLocalTable(user.uuid);
      } catch (cleanupErr) {
        console.error("FAILED TO ROLLBACK LOCAL USER", cleanupErr);
      }
    }

    if (authUser?.id) {
      try {
        await supabase().auth.admin.deleteUser(authUser.id);
      } catch (cleanupErr) {
        console.error("FAILED TO ROLLBACK AUTH USER", cleanupErr);
      }
    }

    if (customerCreated && createdCustomerUuid) {
      try {
        await Customer.deleteByUUID(createdCustomerUuid);
      } catch (cleanupErr) {
        console.error("FAILED TO ROLLBACK CUSTOMER", cleanupErr);
      }
    }

    return res.status(400).json({ error: err.message });
  }
};

/**
 * Optional endpoint:
 * frontend can call this when user opens the link before showing password form
 */
export const validatePendingRegistrationToken = async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: "Token is required" });
  }

  try {
    const tokenHash = hashToken(token);
    const pending = await PendingUserRegistration.findByTokenHash(tokenHash);

    if (!pending) {
      return res.status(400).json({ error: "Invalid or already used token" });
    }

    if (new Date(pending.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: "Registration token has expired" });
    }

    return res.status(200).json({
      message: "Token is valid",
      registration: {
        email: pending.email,
        first_name: pending.first_name,
        last_name: pending.last_name,
        role: pending.role,
      },
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};