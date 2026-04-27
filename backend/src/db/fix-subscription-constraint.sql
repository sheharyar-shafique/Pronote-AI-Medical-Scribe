-- ============================================================
-- SUBSCRIPTION PLAN CONSTRAINT FIX
-- Fixes signup failure caused by CHECK constraint mismatch.
-- Run this in your Supabase SQL Editor.
-- ============================================================

-- Drop the old CHECK constraint on users.subscription_plan
-- (it was 'starter', 'practice', 'enterprise' from the original schema)
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_subscription_plan_check;

-- Drop the old CHECK constraint on subscriptions.plan if it exists  
ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

-- Add updated constraint that matches the actual plan names
-- NULL is allowed for trial users who have not yet subscribed
ALTER TABLE users
  ADD CONSTRAINT users_subscription_plan_check
  CHECK (
    subscription_plan IS NULL OR
    subscription_plan IN (
      'individual_monthly',
      'individual_annual',
      'group_monthly',
      'group_annual',
      -- legacy values kept for existing rows
      'starter', 'practice', 'enterprise'
    )
  );

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_plan_check
  CHECK (
    plan IN (
      'individual_monthly',
      'individual_annual',
      'group_monthly',
      'group_annual',
      -- legacy values
      'starter', 'practice', 'enterprise'
    )
  );

SELECT 'Subscription plan constraints updated successfully!' AS status;
