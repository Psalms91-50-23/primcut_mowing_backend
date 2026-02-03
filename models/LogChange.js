import supabase from '../config/db.js'; // your Supabase client

class LogChange {
    static tableName = 'change_logs';

    /**
     * Log a change to the database
     * @param {Object} params
     * @param {string} params.table - table name e.g. 'jobs'
     * @param {string} params.record_uuid - the UUID of the affected record
     * @param {string} params.user_uuid - the user making the change
     * @param {Object} params.oldData - previous values
     * @param {Object} params.newData - new values
     * @param {string} params.action - 'create' | 'update' | 'delete'
     */
    static async create({ table, record_uuid, user_uuid, oldData, newData, action }) {
        // Determine which fields actually changed
        const changedFields = {};
        for (const key in newData) {
            if (JSON.stringify(oldData?.[key]) !== JSON.stringify(newData[key])) {
                changedFields[key] = { old: oldData?.[key] ?? null, new: newData[key] };
            }
        }

        if (Object.keys(changedFields).length === 0) return; // nothing changed

        const { data, error } = await supabase
            .from("change_logs")
            .insert([{
                table_name: table,
                record_uuid,
                user_uuid,
                action,
                changed_fields: changedFields
            }]);

        if (error) throw new Error(`Error logging change: ${error.message}`);
        return data;
    }

    static async findByRecord(table, record_uuid) {
        const { data, error } = await supabase
        .from('change_logs')
        .select('*')
        .eq('table_name', table)
        .eq('record_uuid', record_uuid)
        .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);
        return data;
    }

  // Fetch all changes by a user
  static async findByUser(user_uuid) {
    const { data, error } = await supabase
        .from('change_logs')
        .select('*')
        .eq('user_uuid', user_uuid)
        .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);
        return data;
  }

  // Fetch all changes for a table
  static async findByTable(table_name) {
    const { data, error } = await supabase
      .from('change_logs')
      .select('*')
      .eq('table_name', table_name)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  }

  static async deleteOlderThan(date) {
        const { data, error } = await supabase
            .from('change_logs')
            .delete()
            .lt('created_at', date);

        if (error) throw new Error(error.message);
        return data;
    }
}

export default LogChange;
