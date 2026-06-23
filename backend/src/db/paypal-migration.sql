-- PayPal Integration Migration
-- Run this in your Supabase SQL Editor to add PayPal support

-- Add PayPal subscription ID to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS paypal_subscription_id VARCHAR(255);

-- Add PayPal fields to subscriptions table
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS paypal_subscription_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(50) DEFAULT 'stripe' CHECK (payment_provider IN ('stripe', 'paypal'));

-- Create index for PayPal subscription lookup
CREATE INDEX IF NOT EXISTS idx_users_paypal_subscription ON users(paypal_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_paypal ON subscriptions(paypal_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider ON subscriptions(payment_provider);

-- Update existing subscriptions to have stripe as provider
UPDATE subscriptions SET payment_provider = 'stripe' WHERE payment_provider IS NULL;
