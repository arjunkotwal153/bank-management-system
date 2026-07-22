import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

async function run() {
  const { data, error } = await supabase.rpc('resolve_account_id', {
    identifier: 'arjunkotwal153@gmail.com'
  });
  console.log('Resolve Result:', data);
  console.log('Resolve Error:', error);
}

run();
