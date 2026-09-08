import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import * as schema from './schema.js';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/whiskytix';

// 1. PostgreSQL connection client (with connection pooling)
export const queryClient = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// 2. Drizzle ORM instance with typed schema
export const db = drizzle(queryClient, { schema });

// 3. Supabase Admin Client (Service Role - full access to auth, storage, database)
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'placeholder';

export const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// 4. Supabase Public Client (Anon key)
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// 5. Connection health check
export async function checkDbConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    await queryClient`SELECT 1`;
    return { ok: true, message: 'Database connectie succesvol (PostgreSQL / Supabase).' };
  } catch (error: any) {
    return { ok: false, message: `Database connectie mislukt: ${error.message}` };
  }
}
