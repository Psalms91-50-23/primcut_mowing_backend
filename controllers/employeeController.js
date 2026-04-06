import Employee from "../models/Employee.js";
import User from "../models/User.js";
import { supabase } from "../config/db.js";
import {
  normalizeNZPhone,
  generatePrefixedId,
  generateUniqueChangeLogUUID,
} from "../util/util.js";
import { createChangeLogSafe } from "../util/createChangeLogSafe.js";

const EmployeeFormType = {
  jobTitle: "",
  department: "",
  bankAccount: "",
  irdNumber: "",
  taxCode: "",
  emergencyFirstName: "",
  emergencyLastName: "",
  emergencyPhone: "",
  hireDate: "",
};

export const createEmployeeLinkToUser = async (req, res) => {
  const actorUserUuid = req.user?.uuid || null;
  const { user_uuid } = req.params;

  const {
    jobTitle,
    department,
    bankAccount,
    irdNumber,
    taxCode,
    emergencyFirstName,
    emergencyLastName,
    emergencyPhone,
    hireDate,
  } = req.body;

  if (!user_uuid) {
    return res.status(400).json({ message: "User uuid is required!" });
  }

  try {
    const user = await User.findByUUID(user_uuid);
    if (!user) {
      return res
        .status(400)
        .json({ message: `No User found with the uuid: ${user_uuid}` });
    }

    const existingEmployee = await Employee.findByUserUUID(user_uuid);
    if (existingEmployee) {
      return res
        .status(400)
        .json({ error: "Employee already exists for this user." });
    }

    let uuid;
    let exists;

    do {
      uuid = generatePrefixedId("E", 8);
      exists = await Employee.findByUUID(uuid);
    } while (exists);

    const employeeObject = {
      uuid,
      user_uuid,
      job_title: jobTitle ?? "",
      department: department ?? "",
      bank_account: bankAccount ?? "",
      ird_number: irdNumber ?? "",
      tax_code: taxCode ?? "",
      emergency_first_name: emergencyFirstName ?? "",
      emergency_last_name: emergencyLastName ?? "",
      emergency_phone: emergencyPhone ? normalizeNZPhone(emergencyPhone) : "",
      hire_date: hireDate ?? null,
    };

    const newEmployee = await Employee.create(employeeObject);
    if (!newEmployee) {
      return res.status(400).json({ error: "Failed to create a new employee." });
    }

    await createChangeLogSafe({
      uuid: await generateUniqueChangeLogUUID(),
      table_name: "employees",
      record_uuid: newEmployee.uuid,
      user_uuid: actorUserUuid,
      action: "create",
      summary: "Employee created and linked to user.",
      changed_fields: {
        uuid: { old: null, new: newEmployee.uuid },
        user_uuid: { old: null, new: newEmployee.user_uuid },
        job_title: { old: null, new: newEmployee.job_title ?? "" },
        department: { old: null, new: newEmployee.department ?? "" },
        bank_account: { old: null, new: newEmployee.bank_account ?? "" },
        ird_number: { old: null, new: newEmployee.ird_number ?? "" },
        tax_code: { old: null, new: newEmployee.tax_code ?? "" },
        emergency_first_name: {
          old: null,
          new: newEmployee.emergency_first_name ?? "",
        },
        emergency_last_name: {
          old: null,
          new: newEmployee.emergency_last_name ?? "",
        },
        emergency_phone: {
          old: null,
          new: newEmployee.emergency_phone ?? "",
        },
        hire_date: { old: null, new: newEmployee.hire_date ?? null },
      },
      oldData: null,
      newData: newEmployee,
      source: "dashboard",
    });

    return res.status(200).json({
      message: "New Employee created successfully",
      data: newEmployee,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

// Register a new employee
export const createEmployee = async (req, res) => {
  const actorUserUuid = req.user?.uuid || null;

  const {
    jobTitle,
    bankAccount,
    irdNumber,
    taxcode,
    department,
    emergencyContactFirstName,
    emergencyContactLastName,
    emergencyContactPhone,
    userUUID,
    dateHired,
  } = req.body;

  if (!userUUID) {
    return res.status(400).json({ error: "userUUID is required" });
  }

  let user;

  try {
    user = await User.findByUUID(userUUID);
    if (!user) throw new Error("User not found");

    const existingEmployee = await Employee.findByUserUUID(userUUID);
    if (existingEmployee) {
      throw new Error("Employee already exists for this user");
    }

    let uuid;
    let exists;

    do {
      uuid = generatePrefixedId("E", 8);
      exists = await Employee.findByUUID(uuid);
    } while (exists);

    const employee = {
      job_title: jobTitle ?? null,
      bank_account_number: bankAccount ?? null,
      ird_number: irdNumber ?? null,
      tax_code: taxcode ?? null,
      department: department ?? null,
      hire_date: dateHired ?? null,
      emergency_contact_first_name: emergencyContactFirstName ?? null,
      emergency_contact_last_name: emergencyContactLastName ?? null,
      emergency_contact_phone: emergencyContactPhone
        ? normalizeNZPhone(emergencyContactPhone)
        : null,
      user_uuid: user.uuid,
    };

    const employeeAdded = await Employee.create({
      ...employee,
      uuid,
    });

    if (!employeeAdded) throw new Error("Failed to create employee record");

    await createChangeLogSafe({
      uuid: await generateUniqueChangeLogUUID(),
      table_name: "employees",
      record_uuid: employeeAdded.uuid,
      user_uuid: actorUserUuid,
      action: "create",
      summary: "Employee registered successfully.",
      changed_fields: {
        uuid: { old: null, new: employeeAdded.uuid },
        user_uuid: { old: null, new: employeeAdded.user_uuid },
        job_title: { old: null, new: employeeAdded.job_title ?? null },
        bank_account_number: {
          old: null,
          new: employeeAdded.bank_account_number ?? null,
        },
        ird_number: { old: null, new: employeeAdded.ird_number ?? null },
        tax_code: { old: null, new: employeeAdded.tax_code ?? null },
        department: { old: null, new: employeeAdded.department ?? null },
        hire_date: { old: null, new: employeeAdded.hire_date ?? null },
        emergency_contact_first_name: {
          old: null,
          new: employeeAdded.emergency_contact_first_name ?? null,
        },
        emergency_contact_last_name: {
          old: null,
          new: employeeAdded.emergency_contact_last_name ?? null,
        },
        emergency_contact_phone: {
          old: null,
          new: employeeAdded.emergency_contact_phone ?? null,
        },
      },
      oldData: null,
      newData: employeeAdded,
      source: "dashboard",
    });

    return res.status(201).json({
      message: "Employee registered successfully",
      employee: employeeAdded,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

// Get one employee by user_uuid
export const getEmployee = async (req, res) => {
  const { user_uuid } = req.params;

  try {
    const employee = await Employee.findByUserUUID(user_uuid);
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    return res.json(employee);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

// List all employees
export const listEmployees = async (req, res) => {
  try {
    const employees = await Employee.list();
    return res.json(employees);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

// Update employee
export const updateEmployee = async (req, res) => {
  const actorUserUuid = req.user?.uuid || null;
  const { user_uuid } = req.params;
  const updateObj = req.body;

  try {
    const existingEmployee = await Employee.findByUserUUID(user_uuid);
    if (!existingEmployee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const normalizedUpdateObj = { ...updateObj };

    if (normalizedUpdateObj.emergency_phone) {
      normalizedUpdateObj.emergency_phone = normalizeNZPhone(
        normalizedUpdateObj.emergency_phone
      );
    }

    if (normalizedUpdateObj.emergency_contact_phone) {
      normalizedUpdateObj.emergency_contact_phone = normalizeNZPhone(
        normalizedUpdateObj.emergency_contact_phone
      );
    }

    const updated = await Employee.update(user_uuid, normalizedUpdateObj);
    if (!updated) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const changedFields = {};

    for (const key of Object.keys(normalizedUpdateObj)) {
      changedFields[key] = {
        old: existingEmployee[key] ?? null,
        new: updated[key] ?? normalizedUpdateObj[key] ?? null,
      };
    }

    if (Object.keys(changedFields).length > 0) {
      await createChangeLogSafe({
        uuid: await generateUniqueChangeLogUUID(),
        table_name: "employees",
        record_uuid: existingEmployee.uuid,
        user_uuid: actorUserUuid,
        action: "update",
        summary: "Employee updated successfully.",
        changed_fields: changedFields,
        oldData: existingEmployee,
        newData: updated,
        source: "dashboard",
      });
    }

    return res.json({ message: "Employee updated successfully", updated });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

// Delete employee (hard delete)
export const deleteEmployee = async (req, res) => {
  const actorUserUuid = req.user?.uuid || null;
  const { user_uuid } = req.params;

  try {
    const existingEmployee = await Employee.findByUserUUID(user_uuid);
    if (!existingEmployee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const user = await User.findByUUID(user_uuid);

    const deleted = await Employee.hardDelete(user_uuid);

    if (user) {
      await supabase().auth.admin.deleteUser(user.auth_user_id).catch(() => {});
      await User.hardDeleteUserLocally(user_uuid).catch(() => {});
    }

    await createChangeLogSafe({
      uuid: await generateUniqueChangeLogUUID(),
      table_name: "employees",
      record_uuid: existingEmployee.uuid,
      user_uuid: actorUserUuid,
      action: "delete",
      summary: "Employee deleted successfully.",
      changed_fields: {
        deleted_record: {
          old: existingEmployee,
          new: null,
        },
      },
      oldData: existingEmployee,
      newData: null,
      source: "dashboard",
    });

    if (user) {
      await createChangeLogSafe({
        uuid: await generateUniqueChangeLogUUID(),
        table_name: "users",
        record_uuid: user.uuid,
        user_uuid: actorUserUuid,
        action: "delete",
        summary: "Linked user deleted during employee deletion.",
        changed_fields: {
          deleted_record: {
            old: user,
            new: null,
          },
        },
        oldData: user,
        newData: null,
        source: "dashboard",
      });
    }

    return res.json({
      message: "Employee deleted successfully",
      deleted,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};