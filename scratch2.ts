import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

async function run() {
  const { data, error } = await supabase.from('accounts').select('*').limit(1);
  if (error) {
    console.log(error);
  } else {
    console.log(Object.keys(data[0] || {}));
  }
}
run();
