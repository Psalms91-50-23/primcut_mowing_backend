import supabase from '../config/db.js';

class Business {
  // Get all businesses
  static async findAll() {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw new Error(`Error fetching businesses: ${error.message}`);
    return data;
  }

  // Find by UUID
  static async findByUUID(uuid) {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('uuid', uuid)
      .maybeSingle();
    if (error) throw new Error(`Error fetching business with UUID ${uuid}: ${error.message}`);
    return data;
  }

// Find by business name
static async findByName(name) {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .ilike('name', name) 
    .maybeSingle(); 
    
  if (error) throw new Error(`Error fetching business with name "${name}": ${error.message}`);
  return data;
}

  // Create a business
  static async create(business) {
    const { data, error } = await supabase
      .from('businesses')
      .insert([business])
      .select()
      .single();
    if (error) throw new Error(`Error creating business: ${error.message}`);
    return data;
  }

  static async findeByEmail(email) {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    if (error) {
        throw new Error(`Error fetching business with email ${email}: ${error.message}`);
    }
    return  data;
  }   

  // Update business by UUID
  static async findByUUIDAndUpdate(uuid, updates) {
    const { data, error } = await supabase
      .from('businesses')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('uuid', uuid)
      .select("*")
      .single();
    if (error) throw new Error(`Error updating business with UUID ${uuid}: ${error.message}`);
    return data;
  }

  // Soft delete
  static async softDelete(uuid) {
    const { data, error } = await supabase
      .from('businesses')
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('uuid', uuid)
      .single();
    if (error) throw new Error(`Error soft deleting business with UUID ${uuid}: ${error.message}`);
    return data;
  }

  // Reinstate
  static async reinstate(uuid) {
    const { data, error } = await supabase
      .from('businesses')
      .update({ deleted_at: null, updated_at: new Date().toISOString() })
      .eq('uuid', uuid)
      .single();
    if (error) throw new Error(`Error reinstating business with UUID ${uuid}: ${error.message}`);
    return data;
  }

  // Hard delete
  static async delete(uuid) {
    const { data, error } = await supabase
      .from('businesses')
      .delete()
      .eq('uuid', uuid)
      .select("*")
      .single();
    if (error) throw new Error(`Error deleting business with UUID ${uuid}: ${error.message}`);
    return data;
  }

  static async findByPhone(phone) {
    const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('mobile_phone', phone)
        .or(`landline_phone.eq.${phone}`)
        .maybeSingle();
    if (error) throw new Error(`Error fetching customer with phone ${phone}: ${error.message}`);
    return data;
  }

}

export default Business;
