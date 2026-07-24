-- ====================================================================
-- FINTECH ENGINE - COMPLETE DATABASE SCHEMA RECONSTRUCTION
-- ====================================================================
-- Run this entire script in the Supabase SQL Editor.

-- 1. CLEANUP (Drop existing if needed to start fresh)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.provision_new_account(uuid, numeric);
DROP FUNCTION IF EXISTS public.resolve_account_id(text);
DROP FUNCTION IF EXISTS public.transfer_funds(uuid, uuid, numeric, text, text, text);
DROP FUNCTION IF EXISTS public.deposit_funds(uuid, numeric);
DROP FUNCTION IF EXISTS public.create_vault(uuid, text);
DROP FUNCTION IF EXISTS public.approve_payment_request(uuid, text);
DROP FUNCTION IF EXISTS public.decline_payment_request(uuid);
DROP FUNCTION IF EXISTS public.issue_virtual_card(uuid);
DROP FUNCTION IF EXISTS public.process_external_webhook(text, text, jsonb);

DROP TABLE IF EXISTS public.payment_requests CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.virtual_cards CASCADE;
DROP TABLE IF EXISTS public.beneficiaries CASCADE;
DROP TABLE IF EXISTS public.scheduled_transfers CASCADE;
DROP TABLE IF EXISTS public.ledger_entries CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 2. CREATE TABLES

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  is_admin boolean DEFAULT false,
  full_name text NOT NULL
);

CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  account_number text UNIQUE NOT NULL,
  account_type text NOT NULL, -- 'checking', 'vault'
  vault_name text,
  balance numeric DEFAULT 0,
  currency text DEFAULT 'USD',
  account_status text DEFAULT 'active',
  daily_transfer_limit numeric DEFAULT 5000,
  target_amount numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  currency text DEFAULT 'USD',
  transaction_type text NOT NULL, -- 'deposit', 'transfer', 'withdrawal', 'payout'
  description text,
  category text,
  reference_id text,
  idempotency_key text UNIQUE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.scheduled_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  receiver_account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  description text,
  category text,
  frequency text NOT NULL, -- 'daily', 'weekly', 'monthly'
  next_run_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.beneficiaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.virtual_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  card_number text UNIQUE NOT NULL,
  expiry text NOT NULL,
  cvv text NOT NULL,
  status text DEFAULT 'active',
  is_frozen boolean DEFAULT false,
  spending_limit numeric DEFAULT 1000,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  ip_address text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  payer_account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  description text,
  status text DEFAULT 'pending', -- 'pending', 'approved', 'declined'
  created_at timestamptz DEFAULT now()
);

-- 3. ENABLE ROW LEVEL SECURITY (RLS)

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.virtual_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

-- 4. CREATE RLS POLICIES

-- Profiles: Users can see their own profile, or admins can see all.
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Accounts: Users can only see and update their own accounts
CREATE POLICY "Users can view own accounts" ON public.accounts FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY "Users can update own accounts" ON public.accounts FOR UPDATE USING (profile_id = auth.uid());

-- Ledger Entries: Users can see entries for their accounts
CREATE POLICY "Users can view own ledger entries" ON public.ledger_entries FOR SELECT USING (
  account_id IN (SELECT id FROM public.accounts WHERE profile_id = auth.uid())
);

-- Scheduled Transfers: Sender or Receiver can view
CREATE POLICY "Users can view own scheduled transfers" ON public.scheduled_transfers FOR SELECT USING (
  sender_account_id IN (SELECT id FROM public.accounts WHERE profile_id = auth.uid()) OR
  receiver_account_id IN (SELECT id FROM public.accounts WHERE profile_id = auth.uid())
);

-- Beneficiaries: Users manage their own beneficiaries
CREATE POLICY "Users manage own beneficiaries" ON public.beneficiaries FOR ALL USING (profile_id = auth.uid());

-- Virtual Cards: Users see cards for their accounts
CREATE POLICY "Users view own virtual cards" ON public.virtual_cards FOR SELECT USING (
  account_id IN (SELECT id FROM public.accounts WHERE profile_id = auth.uid())
);

-- Audit Logs: Users can view their own audit logs, and insert them
CREATE POLICY "Users view own audit logs" ON public.audit_logs FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY "Users can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (profile_id = auth.uid());

-- Payment Requests: Requester or Payer can view
CREATE POLICY "Users can view relevant payment requests" ON public.payment_requests FOR SELECT USING (
  requester_account_id IN (SELECT id FROM public.accounts WHERE profile_id = auth.uid()) OR
  payer_account_id IN (SELECT id FROM public.accounts WHERE profile_id = auth.uid())
);

-- 5. CREATE RPC FUNCTIONS (Bypassing RLS where necessary via SECURITY DEFINER)

CREATE OR REPLACE FUNCTION public.provision_new_account(p_user_id uuid, p_initial_balance numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_account_id uuid;
BEGIN
  INSERT INTO public.accounts (profile_id, account_number, account_type, vault_name, balance, currency, account_status, daily_transfer_limit)
  VALUES (
    p_user_id,
    'ACCT-' || upper(substring(md5(random()::text) from 1 for 8)),
    'checking',
    'Main Checking',
    p_initial_balance,
    'USD',
    'active',
    5000
  ) RETURNING id INTO v_account_id;
  
  IF p_initial_balance > 0 THEN
    INSERT INTO public.ledger_entries (account_id, amount, transaction_type, description)
    VALUES (v_account_id, p_initial_balance, 'deposit', 'Initial Provisioning Balance');
  END IF;
  
  RETURN v_account_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_account_id(identifier text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  resolved_id uuid;
BEGIN
  IF identifier LIKE '%@%' THEN
    SELECT a.id INTO resolved_id
    FROM public.accounts a
    JOIN auth.users u ON u.id = a.profile_id
    WHERE u.email = identifier AND a.account_type = 'checking' LIMIT 1;
  ELSIF identifier ILIKE 'ACCT-%' THEN
    SELECT id INTO resolved_id FROM public.accounts WHERE account_number ILIKE identifier LIMIT 1;
  ELSE
    BEGIN
      resolved_id := identifier::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      resolved_id := null;
    END;
  END IF;
  RETURN resolved_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_funds(p_sender_account_id uuid, p_receiver_account_id uuid, p_amount numeric, p_idempotency_key text, p_description text, p_category text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_balance numeric;
BEGIN
  SELECT balance INTO v_sender_balance FROM public.accounts WHERE id = p_sender_account_id;
  IF v_sender_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient funds';
  END IF;

  IF EXISTS (SELECT 1 FROM public.ledger_entries WHERE idempotency_key = p_idempotency_key) THEN
    RETURN; -- Idempotency: safely return if already executed
  END IF;

  UPDATE public.accounts SET balance = balance - p_amount WHERE id = p_sender_account_id;
  INSERT INTO public.ledger_entries (account_id, amount, transaction_type, description, category, idempotency_key)
  VALUES (p_sender_account_id, -p_amount, 'transfer', p_description, p_category, p_idempotency_key || '-out');

  UPDATE public.accounts SET balance = balance + p_amount WHERE id = p_receiver_account_id;
  INSERT INTO public.ledger_entries (account_id, amount, transaction_type, description, category, idempotency_key)
  VALUES (p_receiver_account_id, p_amount, 'transfer', p_description, p_category, p_idempotency_key || '-in');
END;
$$;

CREATE OR REPLACE FUNCTION public.deposit_funds(p_account_id uuid, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.accounts SET balance = balance + p_amount WHERE id = p_account_id;
  INSERT INTO public.ledger_entries (account_id, amount, transaction_type, description)
  VALUES (p_account_id, p_amount, 'deposit', 'Direct Deposit');
END;
$$;

CREATE OR REPLACE FUNCTION public.create_vault(p_currency text, p_target_amount numeric, p_vault_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_account_id uuid;
BEGIN
  INSERT INTO public.accounts (profile_id, account_number, account_type, vault_name, balance, currency, account_status, target_amount)
  VALUES (
    auth.uid(),
    'VAULT-' || upper(substring(md5(random()::text) from 1 for 8)),
    'vault',
    p_vault_name,
    0,
    p_currency,
    'active',
    p_target_amount
  ) RETURNING id INTO v_account_id;
  
  RETURN v_account_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_payment_request(p_request_id uuid, p_idempotency_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_req RECORD;
BEGIN
  SELECT * INTO v_req FROM public.payment_requests WHERE id = p_request_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  PERFORM public.transfer_funds(
    v_req.payer_account_id, 
    v_req.requester_account_id, 
    v_req.amount, 
    p_idempotency_key, 
    v_req.description, 
    'Payment Request'
  );

  UPDATE public.payment_requests SET status = 'approved' WHERE id = p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_payment_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.payment_requests SET status = 'declined' WHERE id = p_request_id AND status = 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_virtual_card(p_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.virtual_cards (account_id, card_number, expiry, cvv)
  VALUES (
    p_account_id,
    '4000 ' || lpad((random() * 9999)::int::text, 4, '0') || ' ' || lpad((random() * 9999)::int::text, 4, '0') || ' ' || lpad((random() * 9999)::int::text, 4, '0'),
    lpad((extract(month from now()))::int::text, 2, '0') || '/' || (extract(year from now()) + 4)::int::text,
    lpad((random() * 999)::int::text, 3, '0')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.process_external_webhook(p_provider text, p_external_transaction_id text, p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_destination_account_id uuid;
  v_amount numeric;
BEGIN
  IF EXISTS (SELECT 1 FROM public.ledger_entries WHERE reference_id = p_external_transaction_id) THEN
    RAISE EXCEPTION 'Transaction already processed';
  END IF;

  v_destination_account_id := (p_payload->>'destination_account_id')::uuid;
  v_amount := (p_payload->>'amount_cents')::numeric / 100;

  UPDATE public.accounts SET balance = balance + v_amount WHERE id = v_destination_account_id;
  INSERT INTO public.ledger_entries (account_id, amount, transaction_type, description, category, reference_id)
  VALUES (v_destination_account_id, v_amount, 'payout', p_payload->>'description', 'External', p_external_transaction_id);
END;
$$;

-- 6. CREATE THE AUTH TRIGGER (Automated User Onboarding)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name) 
  VALUES (new.id, split_part(new.email, '@', 1));
  
  PERFORM public.provision_new_account(new.id, 0::numeric);

  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- DONE!
