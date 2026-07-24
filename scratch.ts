import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

async function run() {
  console.log('Creating Test User 1...');
  const res1 = await supabase.auth.signUp({
    email: 'testuser1@example.com',
    password: 'Password123!',
  });
  console.log('User 1:', res1.data?.user?.email, res1.error?.message || 'Success');

  console.log('Creating Test User 2...');
  const res2 = await supabase.auth.signUp({
    email: 'testuser2@example.com',
    password: 'Password123!',
  });
  console.log('User 2:', res2.data?.user?.email, res2.error?.message || 'Success');

  // Let's deposit some money into their accounts so you can request payments from them
  if (res1.data?.user?.id) {
    const { data: accounts1 } = await supabase.from('accounts').select('id').eq('profile_id', res1.data.user.id);
    if (accounts1 && accounts1[0]) {
      await supabase.rpc('deposit_funds', { p_account_id: accounts1[0].id, p_amount: 5000 });
      console.log('Deposited $5000 to User 1');
    }
  }

  if (res2.data?.user?.id) {
    const { data: accounts2 } = await supabase.from('accounts').select('id').eq('profile_id', res2.data.user.id);
    if (accounts2 && accounts2[0]) {
      await supabase.rpc('deposit_funds', { p_account_id: accounts2[0].id, p_amount: 5000 });
      console.log('Deposited $5000 to User 2');
    }
  }
}

run();
