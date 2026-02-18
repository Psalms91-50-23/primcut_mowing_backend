import supabase from '../config/db.js';

class User {

  // Get all non-deleted users
  static async findAll() {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return data;
  }

  static async findAllIncludingDeleted() {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return data;
  }

  // Find user by internal UUID
  static async findByUUID(uuid) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('uuid', uuid)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw new Error(`Error fetching user with UUID ${uuid}: ${error.message}`);

    return data;
  }

  static async findByUUIDIncludingDeleted(uuid) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('uuid', uuid)
      .maybeSingle();

    if (error) throw new Error(`Error fetching user with UUID ${uuid}: ${error.message}`);
    return data;
  }

  // Find user by Supabase Auth ID
  static async findByAuthID(auth_user_id) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', auth_user_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw new Error(`Error fetching user with auth id${auth_user_id}: ${error.message}`);
    return data;
  }

  // Find user by email
  static async findByEmail(email) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw new Error(`Error fetching user with email ${email}: ${error.message}`);

    return data;
  }

  // Create a new user (register)
  static async create({ auth_user_id, email, first_name, last_name, role = 'customer', customer_uuid = null, uuid }) {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('users')
        .insert([{
          uuid,
          auth_user_id,
          email,
          first_name,
          last_name,
          role,
          customer_uuid,
          created_at: now,
          updated_at: now,
          email_verification_sent_at: now
        }])
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      
      return data;
  }

   // Mark user as verified (app-specific)
  static async markVerified(auth_user_id) {
    // const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('users')
      .update({
        email_verified_at: new Date().toISOString(),
        is_email_verified: true,
        updated_at: new Date().toISOString()
      })
      .eq('auth_user_id', auth_user_id)
      .select('*')
      .single();

      if (error) throw new Error(error.message);

      return data;
  }
  
  // Update user fields by UUID
  static async updateByUUID(uuid, updates) {
    const { data, error } = await supabase
      .from('users')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('uuid', uuid)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  // Soft delete
  static async softDelete(uuid) {
    const { error } = await supabase
      .from('users')
      .update({ deleted_at: new Date().toISOString() })
      .eq('uuid', uuid);

    if (error) throw new Error(error.message);
    return true;
  }

    static async hardDeleteFull(uuid) {
    // 1️⃣ Find the user first
        const user = await this.findByUUID(uuid);
        if (!user) throw new Error("User not found");

        // 2️⃣ Delete from Supabase Auth
        await supabase.auth.admin.deleteUser(user.auth_user_id);

        // 3️⃣ Delete from local table
        const { data, error } = await supabase
            .from('users')
            .delete()
            .eq('uuid', uuid)
            .select('*')
            .single();

        if (error) throw new Error(error.message);
        return data;

    }

    static async hardDeleteLocalTable(uuid) {
      const { data, error } = await supabase
        .from('users')
        .delete()
        .eq('uuid', uuid)
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return data;  
      
    }

  static async findByAuthUserId(authUserId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', authUserId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  }

}

export default User;