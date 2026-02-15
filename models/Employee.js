import supabase from '../config/db.js';

export default class Employee {

    // Find employee by user_uuid
    static async findByUserUUID(user_uuid) {
        if (!user_uuid) throw new Error("User UUID is required");

        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .eq("user_uuid", user_uuid)
            .maybeSingle();

        if (error) throw new Error(`Error fetching employee with user_uuid ${user_uuid}: ${error.message}`);
        return data;
    }

    // Create employee
    static async create(employeeObj) {
        if (!employeeObj || !employeeObj.user_uuid) {
            throw new Error("Employee object with user_uuid is required");
        }

        const { data, error } = await supabase
            .from('employees')
            .insert([employeeObj])
            .select("*")
            .maybeSingle();

        if (error) throw new Error(`Error creating employee for user_uuid ${employeeObj.user_uuid}: ${error.message}`);
        return data;
    }

    // Update employee
    static async update(user_uuid, updateObj) {
        if (!user_uuid) throw new Error("User UUID is required");
        if (!updateObj) throw new Error("Update object is required");

        const { data, error } = await supabase
            .from('employees')
            .update(updateObj)
            .eq("user_uuid", user_uuid)
            .select("*")
            .maybeSingle();

        if (error) throw new Error(`Error updating employee ${user_uuid}: ${error.message}`);
        return data;
    }

    // Hard delete employee
    static async hardDelete(user_uuid) {
        if (!user_uuid) throw new Error("User UUID is required");

        const { data, error } = await supabase
            .from('employees')
            .delete()
            .eq("user_uuid", user_uuid)
            .select("*")
            .maybeSingle();

        if (error) throw new Error(`Error deleting employee ${user_uuid}: ${error.message}`);
        return data;
    }

    // List all employees
    static async list() {
        const { data, error } = await supabase
            .from('employees')
            .select(`*, users:first_name,last_name,email`)
            .eq('users.role', 'employee');

        if (error) throw new Error(`Error fetching employees: ${error.message}`);
        return data;
    }
}
