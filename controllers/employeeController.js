import Employee from '../models/Employee.js';
import User from '../models/User.js';
import supabase from '../config/db.js';
import jwt from 'jsonwebtoken';
import { normalizeNZPhone, generatePrefixedId } from '../util/util.js';
import { formatFullName, EMAIL_TOKEN_EXPIRES_IN } from '../util/util.js';
import { verifyEmailLink } from "../lib/email/index.js"

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
    hireDate
   } = req.body;

  if(!user_uuid){
    return res.status(400).json({ message: "User uuid is required!"});
  }

  try {
    
    const user = await User.findByUUID(user_uuid);
    if(!user){
      return res.status(400).json({ message: `No User found with the uuid: ${user_uuid}`});
    }
    let uuid;
    let exists;
    do {
      uuid = generatePrefixedId("E", 8);
      // uuid = generatePrefixedId(8, "E");
      exists = await User.findByUUID(uuid);
    } while (exists);

    const employeeObject = {
      uuid,
      user_uuid: user_uuid,
      job_title: jobTitle ?? "",
      department: department ?? "",
      bank_account: bankAccount ?? "",
      ird_number: irdNumber ?? "",
      tax_code: taxCode ?? "",
      emergency_first_name: emergencyFirstName ?? "",
      emergency_last_name: emergencyLastName ?? "",
      emergency_phone: emergencyPhone ? normalizeNZPhone(emergencyPhone) : "",
      hire_date: hireDate ?? null,
    }
    
    const newEmployee = await Employee.create(employeeObject);
    if(!newEmployee){
      return res.status(400).json({ error: "Failed to create a new employee."});
    }

    return res.stats(200).json({
      message: "New Employee created successfully",
      data: newEmployee
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Internal server error"
    });
  }

}

// Register a new employee
export const createEmployee  = async (req, res) => {

  const { jobTitle, bankAccount, irdNumber, taxcode, department, emergencyContactFirstName, emergencyContactLastName, emergencyContactPhone, userUUID, dateHired } = req.body;

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
      uuid = generatePrefixedId(8, "E");
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
      emergency_contact_phone: emergencyContactPhone ?? null,
      user_uuid: user.uuid,
    };

    // ===== 4️⃣ Create employee record =====
    const employeeAdded = await Employee.create({
      ...employee,
      uuid,
    });

    if (!employeeAdded) throw new Error("Failed to create employee record");

    return res.status(201).json({
      message: 'Employee registered successfully',
      employee:  employeeAdded,
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
        if (!employee) return res.status(404).json({ error: "Employee not found" });
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
    const { user_uuid } = req.params;
    const updateObj = req.body;

    try {
        const updated = await Employee.update(user_uuid, updateObj);
        if (!updated) return res.status(404).json({ error: "Employee not found" });
        return res.json({ message: "Employee updated successfully", updated });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
};

// Delete employee (hard delete)
export const deleteEmployee = async (req, res) => {
    const { user_uuid } = req.params;

    try {
        // Delete employee record
        const deleted = await Employee.hardDelete(user_uuid);

        // Optional: delete user auth and local user
        const user = await User.findByUUID(user_uuid);
        if (user) {
            await supabase.auth.admin.deleteUser(user.auth_user_id).catch(() => {});
            await User.hardDeleteUserLocally(user_uuid).catch(() => {});
        }

        if (!deleted) return res.status(404).json({ error: "Employee not found" });
        return res.json({ message: "Employee deleted successfully", deleted });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
};
