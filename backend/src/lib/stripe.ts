import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();

if (!stripeSecretKey) {
  console.warn('⚠️ Stripe secret key not configured. Payment features will be disabled.');
}

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' })
  : null;

export const STRIPE_PRICES = {
  individual_monthly: process.env.STRIPE_INDIVIDUAL_MONTHLY_PRICE_ID || '',
  individual_annual:  process.env.STRIPE_INDIVIDUAL_ANNUAL_PRICE_ID  || '',
  group_monthly:      process.env.STRIPE_GROUP_MONTHLY_PRICE_ID      || '',
  group_annual:       process.env.STRIPE_GROUP_ANNUAL_PRICE_ID       || '',
};

export const STRIPE_PRODUCTS = {
  individual_monthly: process.env.STRIPE_INDIVIDUAL_MONTHLY_PRODUCT_ID || '',
  individual_annual:  process.env.STRIPE_INDIVIDUAL_ANNUAL_PRODUCT_ID  || '',
  group_monthly:      process.env.STRIPE_GROUP_MONTHLY_PRODUCT_ID      || '',
  group_annual:       process.env.STRIPE_GROUP_ANNUAL_PRODUCT_ID       || '',
};
