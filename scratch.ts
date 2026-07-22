import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

async function run() {
  const { data, error } = await supabase.from('transactions').select('*').limit(1);
  if (error) {
    console.error('Error fetching transactions:', error);
  } else {
    console.log('Transactions columns:', Object.keys(data[0] || {}));
  }
}

run();
