import supabase from '../config/db.js';
import crypto from 'crypto';

class UserAccessToken {

  static async create({ user_uuid, expires_at, ip_address, user_agent }) {
    const token = crypto.randomBytes(32).toString('hex');
    const token_hash = crypto.createHash('sha256').update(token).digest('hex');

    const { data, error } = await supabase
      .from('user_access_tokens')
      .insert([{ user_uuid, token_hash, expires_at, ip_address, user_agent }])
      .select('*')
      .single();

    if (error) throw new Error(`Error creating user access token: ${error.message}`);

    return { ...data, token }; // return the plain token to client
  }

  static async findByTokenHash(token) {
    const token_hash = crypto.createHash('sha256').update(token).digest('hex');
    const { data, error } = await supabase
      .from('user_access_tokens')
      .select('*')
      .eq('token_hash', token_hash)
      .maybeSingle();

    if (error) throw new Error(`Error finding token: ${error.message}`);
    return data;
  }

  static async revoke(token) {
    const token_hash = crypto.createHash('sha256').update(token).digest('hex');
    const { data, error } = await supabase
      .from('user_access_tokens')
      .update({ revoked: true })
      .eq('token_hash', token_hash)
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Error revoking token: ${error.message}`);
    return data;
  }

  static async deleteExpired() {
    const { error } = await supabase
      .from('user_access_tokens')
      .delete()
      .lt('expires_at', new Date().toISOString());

    if (error) throw new Error(`Error deleting expired tokens: ${error.message}`);
  }

}

export default UserAccessToken;