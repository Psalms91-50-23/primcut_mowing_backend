import supabase from '../config/db.js';

class Customer {

    //works fine 9/01/2026  
    static async findAll({ includeBusiness = false, isDeleted } = {}) {
        let query;
        
        if (includeBusiness) {
            query = supabase
                .from('customers')
                .select(`
                    *,
                    businesses (
                        id,
                        uuid,
                        name,
                        business_landline_phone,
                        business_mobile_phone,
                        email,
                        address,
                        is_deleted,
                        created_at,
                        updated_at,
                        deleted_at
                    )
                `);
        } else {
            query = supabase
                .from('customers')
                .select('*');
        }
        // OPTIONAL filter
        if (typeof isDeleted === 'boolean') {
            query = query.eq('is_deleted', isDeleted);
        }

        query = query.order('created_at', { ascending: true });

        const { data, error } = await query;

        if (error) {
            throw new Error(`Error fetching customers: ${error.message}`);
        }

        return data;

    }

    static async findByField(field, value) {
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq(field, value);
        if (error) {
            throw new Error(`Error fetching customer with ${field}=${value}: ${error.message}`);
        }
        return  data;
        // return data.length > 0 ? data[0] : null;
    }   

    //works fine 9/01/2026  
    static async findByUUID(uuid) {
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq("uuid", uuid)
            .maybeSingle();

        if (error) {
            throw new Error(`Error fetching customer with ${uuid}: ${error.message}`);
        }

        return data;
    
    }   

    //works fine 9/01/2026  
    static async findById(id) {
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq('id', id)
            .maybeSingle();
            // .single();
        if (error) {
            throw new Error(`Error fetching customer with ID ${id}: ${error.message}`);
        }
        return data;
        
    }

    //works fine
    static async create(customer) {
        const { data, error } = await supabase
            .from('customers')
            .insert([customer])
            .select()
            .maybeSingle();
        if (error) {
            throw new Error(`Error creating customer: ${error.message}`);
        }

        return data;
    }

    //have not tested
    static async findByIdAndUpdate(id, customer) {
        const { data, error } = await supabase
            .from('customers')
            .update({
            ...customer,
            updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .maybeSingle();
        if (error) {
            throw new Error(`Error updating customer with ID ${id}: ${error.message}`);
        }
        return data;
        // return data.length > 0 ? data[0] : null;
    }

     //works fine 9/01/2026 
    static async findByUUIDAndUpdate(uuid, customer) {
        const { data, error } = await supabase
        .from('customers')
        .update({
        ...customer,
        updated_at: new Date().toISOString()
        })
        .eq('uuid', uuid)
        .select()
        .single()
         
        console.log({ data, error }, "in find cust by uuid and update"); // ✅ log after await
        if (error) {
            throw new Error(`Error updating customer with UUID ${uuid}: ${error.message}`);
        }
        return data;
        // return data.length > 0 ? data[0] : null;
    }
    

  //hardcore delete
    static async delete(uuid) {
        const temp = await Customer.findByUUID(uuid);
        if (!temp) {
            throw new Error(`Customer with UUID ${uuid} not found`);
        }
        console.log({temp})
        const { data, error } = await supabase
            .from('customers')
            .delete()
            .eq('uuid', uuid)
            .maybeSingle();
        if (error) {
            throw new Error(`Error deleting customer with UUID ${uuid}: ${error.message}`);
        }
        return {...temp, deleted_at: temp.updated_at }; 
    }   
//works fine 9/01/2026  
    static async softDelete(uuid) {
        const now = new Date().toISOString();
        const { data, error } = await supabase
            .from('customers')
            .update({ deleted_at: now, updated_at: now, is_deleted: true })
            .eq('uuid', uuid)
            .select("*")
            .maybeSingle();
        if (error) {
            throw new Error(`Error soft deleting customer with UUID ${uuid}: ${error.message}`);
        }
        return data;
    }

    static async reinstateCustomer(uuid) {
        const now = new Date().toISOString();
        const { data, error } = await supabase
            .from('customers')
            .update({ deleted_at: null , updated_at: now , is_deleted: false})
            .eq('uuid', uuid)
            .select("*")
            .maybeSingle();
        if (error) {
            throw new Error(`Error reinstating customer with UUID ${uuid}: ${error.message}`);
        }
        return data;
   
    }

    static async findByEmail(email) {
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq('email', email)
            .maybeSingle();

        if (error) {
            throw new Error(`Error fetching customer with email ${email}: ${error.message}`);
        }
        return data;

    }

    static async findByPhone(mobile, landline) {
    // Build OR condition for both columns
        let orCondition = [];
        if (mobile) orCondition.push(`mobile_phone.eq.${mobile}`);
        if (landline) orCondition.push(`landline_phone.eq.${landline}`);

        if (orCondition.length === 0) return null;

        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .or(orCondition.join(','))
            .maybeSingle();

        if (error) throw new Error(`Error fetching customer: ${error.message}`);
        if (!data) return null;

        // Determine which column matched
        let matchedType = null;
        if (mobile && data.mobile_phone === mobile) matchedType = 'mobile';
        else if (landline && data.landline_phone === landline) matchedType = 'landline';

        return { ...data, matchedType };

    }

    // static async findByPhone(phone) {
    //     const { data, error } = await supabase
    //         .from('customers')
    //         .select('*')
    //         .or(`landline_phone.eq.${phone},mobile_phone.eq.${phone}`)
    //         .maybeSingle()
    //         // .single();
    //     if (error) {
    //         throw new Error(`Error fetching customer with phone ${phone}: ${error.message}`);
    //     }
    //     // return data;
    //     return data.length > 0 ? data[0] : null;
    // }       

    static async findByAddress(address) {
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq('address', address)
            .maybeSingle();
        if (error) {
            throw new Error(`Error fetching customer with address ${address}: ${error.message}`);
        }
        return data;
        // return data.length > 0 ? data[0] : null;
    }   

    static async findByName(firstName, lastName) {
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq('first_name', firstName)
            .eq('last_name', lastName)
            .maybeSingle();
        if (error) {
            throw new Error(`Error fetching customer with first name ${firstName} and last name ${lastName}: ${error.message}`);
        }
        return data;
        // return data.length > 0 ? data[0] : null;
    }

    static async findByBusinessUUID(business_uuid) {
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq('business_uuid', business_uuid)
            .maybeSingle();
        if (error) {
            throw new Error(`Error fetching customers with business UUID ${business_uuid}: ${error.message}`);
        }
        return data;
        // return data.length > 0 ? data[0] : null;
    }   

    static async findOneCustomerWithDetails(uuid) {
        if (!uuid) return null;
        let query = supabase
            .from('customers')
            .select(`
                *,
                businesses (*),
                quotes (*),
                jobs (*,
                    invoices (
                        *,
                        payments (*)
                    )
                )
            `)
            .eq("uuid", uuid)
            .maybeSingle();
            // .order('created_at', { ascending: true });

        const { data, error } = await query;

        if (error) {
            throw new Error(`Error fetching customers with details: ${error.message}`);
        }

        return data;
    }
//works fine 11/01/2026
    // static async findAllCustomerWithDetails() {
    //     let query = supabase
    //         .from('customers')
    //         .select(`
    //             *,
    //             businesses (*),
    //             quotes (*),
    //             jobs (*,
    //                 invoices (
    //                     *,
    //                     payments (*)
    //                 )
    //             )
    //         `)
    //         .order('created_at', { ascending: true });

    //     const { data, error } = await query;

    //     if (error) {
    //         throw new Error(`Error fetching customers with details: ${error.message}`);
    //     }

    //     return data;
    // }

    // static async findAllWithDetails({ from = 0, to = 19 }) {
    //     const { data, error, count } = await supabase
    //         .from('customers')
    //         .select(`
    //             *,
    //             businesses (*),
    //             quotes (*),
    //             jobs (*),
    //             invoices (*),
    //             payments (*)
    //         `, { count: 'exact' })
    //         .range(from, to)
    //         .order('created_at', { ascending: true });

    //     if (error) throw new Error(`Error fetching customers: ${error.message}`);

    //     return { data, count };
    // }

    static async findAllWithDetails({ page = 1, pageSize = 20 }) {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const { data, error, count } = await supabase
            .from('customers')
            .select(`
                *,
                businesses (*),
                quotes (*),
                jobs (*,
                    invoices (
                        *,
                        payments (*)
                    )
                )
            `, { count: 'exact' })
            .range(from, to)
            .order('created_at', { ascending: true });

        if (error) throw new Error(`Error fetching customers: ${error.message}`);

        return { data, count };
    }

}

export default Customer;