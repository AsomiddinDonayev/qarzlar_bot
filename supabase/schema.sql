-- Nasiya Daftari — Multi-Tenant SaaS Schema
-- Run in Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.businesses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  phone         VARCHAR(20)  NOT NULL,
  card_number   VARCHAR(16),
  trial_ends_at TIMESTAMPTZ  NOT NULL DEFAULT (now() + interval '3 days'),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE public.users (
  telegram_id BIGINT      PRIMARY KEY,
  business_id UUID        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  role        VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'manager')),
  full_name   VARCHAR(255),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.households (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID         NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE public.customers (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  household_id   UUID          REFERENCES public.households(id) ON DELETE SET NULL,
  name           VARCHAR(255)  NOT NULL,
  phone          VARCHAR(20),
  max_debt_limit NUMERIC(12,0) NOT NULL DEFAULT 1000000,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE public.debts (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID          NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount      NUMERIC(12,0) NOT NULL CHECK (amount > 0),
  note        TEXT,
  due_date    DATE,
  status      VARCHAR(20)   NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE public.payments (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  debt_id      UUID          NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  amount_paid  NUMERIC(12,0) NOT NULL CHECK (amount_paid > 0),
  payment_type VARCHAR(20)   CHECK (payment_type IN ('cash', 'card')),
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE public.notebook_photos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  image_url   TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX idx_users_business_id        ON public.users (business_id);
CREATE INDEX idx_households_business_id   ON public.households (business_id);
CREATE INDEX idx_customers_business_id    ON public.customers (business_id);
CREATE INDEX idx_customers_household_id   ON public.customers (household_id);
CREATE INDEX idx_debts_business_id        ON public.debts (business_id);
CREATE INDEX idx_debts_customer_id        ON public.debts (customer_id);
CREATE INDEX idx_debts_status             ON public.debts (business_id, status) WHERE status = 'pending';
CREATE INDEX idx_debts_due_date           ON public.debts (due_date) WHERE status = 'pending';
CREATE INDEX idx_payments_business_id     ON public.payments (business_id);
CREATE INDEX idx_payments_debt_id         ON public.payments (debt_id);
CREATE INDEX idx_notebook_photos_business ON public.notebook_photos (business_id);

-- ---------------------------------------------------------------------------
-- RLS Helper: resolve business_id from JWT telegram_id claim
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auth_business_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT business_id
  FROM public.users
  WHERE telegram_id = NULLIF(
    current_setting('request.jwt.claims', true)::json->>'telegram_id', ''
  )::bigint
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role
  FROM public.users
  WHERE telegram_id = NULLIF(
    current_setting('request.jwt.claims', true)::json->>'telegram_id', ''
  )::bigint
  LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- Trigger: auto-mark debt as paid when fully covered by payments
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_debt_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total_paid  NUMERIC;
  v_debt_amount NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount_paid), 0) INTO v_total_paid
  FROM public.payments WHERE debt_id = NEW.debt_id;

  SELECT amount INTO v_debt_amount
  FROM public.debts WHERE id = NEW.debt_id;

  IF v_total_paid >= v_debt_amount THEN
    UPDATE public.debts SET status = 'paid' WHERE id = NEW.debt_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payments_check_debt_paid
AFTER INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.check_debt_paid();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.businesses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebook_photos ENABLE ROW LEVEL SECURITY;

-- businesses: owner can read/update their own
CREATE POLICY businesses_select ON public.businesses FOR SELECT TO authenticated
  USING (id = public.auth_business_id());
CREATE POLICY businesses_update ON public.businesses FOR UPDATE TO authenticated
  USING (id = public.auth_business_id() AND public.auth_role() = 'owner')
  WITH CHECK (id = public.auth_business_id());

-- users: see own business members; only owner can insert/delete
CREATE POLICY users_select ON public.users FOR SELECT TO authenticated
  USING (business_id = public.auth_business_id());
CREATE POLICY users_insert ON public.users FOR INSERT TO authenticated
  WITH CHECK (business_id = public.auth_business_id() AND public.auth_role() = 'owner');
CREATE POLICY users_delete ON public.users FOR DELETE TO authenticated
  USING (business_id = public.auth_business_id() AND public.auth_role() = 'owner');

-- households
CREATE POLICY households_select ON public.households FOR SELECT TO authenticated
  USING (business_id = public.auth_business_id());
CREATE POLICY households_insert ON public.households FOR INSERT TO authenticated
  WITH CHECK (business_id = public.auth_business_id());
CREATE POLICY households_update ON public.households FOR UPDATE TO authenticated
  USING (business_id = public.auth_business_id())
  WITH CHECK (business_id = public.auth_business_id());
CREATE POLICY households_delete ON public.households FOR DELETE TO authenticated
  USING (business_id = public.auth_business_id() AND public.auth_role() = 'owner');

-- customers
CREATE POLICY customers_select ON public.customers FOR SELECT TO authenticated
  USING (business_id = public.auth_business_id());
CREATE POLICY customers_insert ON public.customers FOR INSERT TO authenticated
  WITH CHECK (business_id = public.auth_business_id());
CREATE POLICY customers_update ON public.customers FOR UPDATE TO authenticated
  USING (business_id = public.auth_business_id())
  WITH CHECK (business_id = public.auth_business_id());
CREATE POLICY customers_delete ON public.customers FOR DELETE TO authenticated
  USING (business_id = public.auth_business_id() AND public.auth_role() = 'owner');

-- debts
CREATE POLICY debts_select ON public.debts FOR SELECT TO authenticated
  USING (business_id = public.auth_business_id());
CREATE POLICY debts_insert ON public.debts FOR INSERT TO authenticated
  WITH CHECK (business_id = public.auth_business_id());
CREATE POLICY debts_update ON public.debts FOR UPDATE TO authenticated
  USING (business_id = public.auth_business_id())
  WITH CHECK (business_id = public.auth_business_id());
CREATE POLICY debts_delete ON public.debts FOR DELETE TO authenticated
  USING (business_id = public.auth_business_id() AND public.auth_role() = 'owner');

-- payments
CREATE POLICY payments_select ON public.payments FOR SELECT TO authenticated
  USING (business_id = public.auth_business_id());
CREATE POLICY payments_insert ON public.payments FOR INSERT TO authenticated
  WITH CHECK (business_id = public.auth_business_id());
CREATE POLICY payments_delete ON public.payments FOR DELETE TO authenticated
  USING (business_id = public.auth_business_id() AND public.auth_role() = 'owner');

-- notebook_photos: owner only
CREATE POLICY photos_select ON public.notebook_photos FOR SELECT TO authenticated
  USING (business_id = public.auth_business_id());
CREATE POLICY photos_insert ON public.notebook_photos FOR INSERT TO authenticated
  WITH CHECK (business_id = public.auth_business_id() AND public.auth_role() = 'owner');
CREATE POLICY photos_delete ON public.notebook_photos FOR DELETE TO authenticated
  USING (business_id = public.auth_business_id() AND public.auth_role() = 'owner');
