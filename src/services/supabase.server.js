// src/services/supabase.server.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config(); // This makes process.env available

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

export default supabase;
