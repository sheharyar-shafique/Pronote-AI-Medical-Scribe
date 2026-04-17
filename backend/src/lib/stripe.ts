import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn('⚠️ Stripe secret key not configured. Payment features will be disabled.');
}

export const stripe = stripeSecretKey 
  ? new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' })
  : null;

export const STRIPE_PRICES = {
  individual_annual: process.env.STRIPE_INDIVIDUAL_ANNUAL_PRICE_ID || 'price_1SzS7dDXB0wGVl1wDrTojxoO',
  group_monthly: process.env.STRIPE_GROUP_MONTHLY_PRICE_ID || 'price_1SzSDSDXB0wGVl1wjWa5py0A',
  group_annual: process.env.STRIPE_GROUP_ANNUAL_PRICE_ID || 'price_1SzSG6DXB0wGVl1wMoEzFUnm',
};

export const STRIPE_PRODUCTS = {
  individual_annual: 'prod_TxMrAkvlkwX5LY',
  group_monthly: 'prod_TxMx51VKfPwZ9L',
  group_annual: 'prod_TxN084b7QJSFiM',
};
