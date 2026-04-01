// models/UserLogin.js
import { supabase } from '../config/db.js'; // your supabase() client

class UserLogin {

  static tableName = 'user_logins';

  /**
   * Create a new login record
   * @param {Object} params
   * @param {string} params.uuid - pre-generated 9-char UUID
   * @param {string} params.user_uuid - references users.uuid
   * @param {string} params.ip_address
   * @param {string} params.user_agent
   * @param {boolean} params.success
   * @returns inserted record
   */
  
  static async create({ uuid, user_uuid, ip_address, user_agent, success }) {
    const now = new Date().toISOString();

    const { data, error } = await supabase()
      .from(this.tableName)
      .insert([{
        uuid,
        user_uuid,
        ip_address,
        user_agent,
        success,
        created_at: now
      }])
      .select('*')
      .maybeSingle();

    if (error) throw new Error(error.message);

    return data;
  }

  /**
   * Find a login record by UUID
   * @param {string} uuid
   */
  static async findByUUID(uuid) {
    const { data, error } = await supabase()
        .from(this.tableName)
        .select('*')
        .eq('uuid', uuid)
        .maybeSingle();

    if (error) return null;
    return data;
  }

  /**
   * Get recent logins for a user
   * @param {string} user_uuid
   * @param {number} limit
   */
  static async findRecentByUser(user_uuid, limit = 10) {
    const { data, error } = await supabase()
      .from(this.tableName)
      .select('*')
      .eq('user_uuid', user_uuid)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return [];
    return data;
  }

  static async deleteByUUID(uuid) {
    const { data, error } = await supabase()
      .from(this.tableName)
      .delete()
      .eq('uuid', uuid);

    if (error) throw new Error(error.message);
    return data;
  }

}

export default UserLogin;
