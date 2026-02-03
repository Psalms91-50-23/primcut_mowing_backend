import supabase from '../config/db.js';

class JobRecurrence {
    // Create a new recurrence
    static async create({ uuid, job_uuid, scheduled_at, status = 'scheduled', is_completed = false, completed_date = null }) {
        const { data, error } = await supabase
            .from('job_recurrences')
            .insert([{
                uuid,
                job_uuid,
                scheduled_at,
                status,
                is_completed,
                completed_date,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])
            .select('*')
            .single();

        if (error) throw new Error(`Error creating job recurrence: ${error.message}`);
        return data;
    }

    // Fetch all recurrences for a given job
    static async findByJob(job_uuid) {
        const { data, error } = await supabase
            .from('job_recurrences')
            .select('*')
            .eq('job_uuid', job_uuid)
            .order('scheduled_at', { ascending: true });

        if (error) throw new Error(`Error fetching recurrences: ${error.message}`);
        return data;
    }

    // Fetch a single recurrence by UUID
    static async findByUUID(uuid) {
        const { data, error } = await supabase
            .from('job_recurrences')
            .select('*')
            .eq('uuid', uuid)
            .single();

        if (error) throw new Error(`Error fetching job recurrence: ${error.message}`);
        return data;
    }

    // Update a recurrence (status, completed, date, etc.)
    static async update(uuid, updates = {}) {
        updates.updated_at = new Date().toISOString();
        const { data, error } = await supabase
            .from('job_recurrences')
            .update(updates)
            .eq('uuid', uuid)
            .select('*')
            .single();

        if (error) throw new Error(`Error updating job recurrence: ${error.message}`);
        return data;
    }

    // Mark a recurrence as completed
    static async markCompleted(uuid) {
        return this.update(uuid, {
            is_completed: true,
            completed_date: new Date().toISOString(),
            status: 'completed'
        });
    }

    // Mark a recurrence as missed
    static async markMissed(uuid) {
        return this.update(uuid, {
            status: 'missed',
            updated_at: new Date().toISOString()
        });
    }

    // Delete a recurrence (soft delete or hard delete)
    static async delete(uuid, soft = true) {
        if (soft) {
            return this.update(uuid, { status: 'deleted' });
        } else {
            const { data, error } = await supabase
                .from('job_recurrences')
                .delete()
                .eq('uuid', uuid);

            if (error) throw new Error(`Error deleting job recurrence: ${error.message}`);
            return data;
        }
    }
}

export default JobRecurrence;
