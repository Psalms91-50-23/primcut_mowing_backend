import supabase from '../config/db.js';

class Job {
  // Get all jobs
  static async findAll() {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw new Error(`Error fetching jobs: ${error.message}`);
    return data;
  }

  // Find job by UUID
  static async findByUUID(uuid) {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('uuid', uuid)
      .maybeSingle();
    if (error) throw new Error(`Error fetching job with UUID ${uuid}: ${error.message}`);
    return data;
  }

  // Create a job
  static async createFromQuote({ quote, uuid, scheduled_at, is_recurring, recurrence_interval, recurrence_frequency, recurrence_end_date }) {
        const { data, error } = await supabase
            .from('jobs')
            .insert([{
                uuid,
                customer_uuid: quote.customer_uuid,
                quote_uuid: quote.uuid,
                services: quote.services,          // JSON array ✔
                total_amount: quote.total_amount,
                scheduled_at: scheduled_at ? new Date(scheduled_at).toISOString() : null,
                is_recurring,
                recurrence_interval,
                recurrence_frequency,
                recurrence_end_date: recurrence_end_date ?? null,
                status: 'scheduled',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])
            .select('*')
            .single();

        if (error) throw new Error(`Error creating job: ${error.message}`);
        return data;
    }

    static async updateByUUID(uuid, updates) {
        const { data, error } = await supabase
            .from('jobs')
            .update(updates)
            .eq("uuid", uuid)
            .select('*')
            .maybeSingle();

        if (error) throw new Error(`Error updating job: ${error.message}`);
        return data;
    }

    static async deleteByUUID(uuid) {
        const { data, error } = await supabase
            .from('jobs')
            .delete()
            .eq("uuid", uuid)
            .select('*')
            .maybeSingle();

        if (error) throw new Error(`Error deleting job: ${error.message}`);
        return data;
    }

    static async findOneByQuoteUUID(quote_uuid) {
        const { data, error } = await supabase
            .from('jobs')
            .select('*')
            .eq('quote_uuid', quote_uuid)
            .maybeSingle();

        if (error) throw new Error(`Error fetching job with quote UUID ${quote_uuid}: ${error.message}`);
        return data;
    }

}



export default Job;