import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

async function run() {
  const { data, error } = await supabase.from('ledger_entries').select('*').limit(1);
  if (error) {
    console.error('Error fetching ledger_entries:', error);
  } else {
    console.log('ledger_entries columns:', Object.keys(data[0] || {}));
  }
  
  // also fetch from information_schema via RPC if available, or just fetch transactions to see.
  // Wait, if it fails because of RLS we can't see schema. Let's look for a different way.
}

run();
