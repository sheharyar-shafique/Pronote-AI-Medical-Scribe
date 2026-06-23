import { paypalEnabled, PAYPAL_PLANS, createProduct, createBillingPlan } from './paypal.js';

let initialized = false;

export async function initializePayPalPlans(): Promise<void> {
  if (!paypalEnabled) {
    console.log('ℹ️  PayPal not configured — payment features disabled.');
    return;
  }

  if (initialized) return;

  // Check if all plan IDs are already real (non-empty)
  const hasRealPlanIds =
    PAYPAL_PLANS.individual_annual &&
    PAYPAL_PLANS.group_monthly &&
    PAYPAL_PLANS.group_annual;

  if (hasRealPlanIds) {
    console.log('✅ PayPal plans already configured via env vars.');
    initialized = true;
    return;
  }

  console.log('🔧 Auto-creating PayPal products and billing plans...');

  try {
    // Step 1: Create a single product
    const productId = await createProduct(
      'Pronote AI Medical Scribe',
      'AI-powered clinical documentation platform for healthcare professionals'
    );
    console.log(`✅ PayPal product created: ${productId}`);

    // Step 2: Create all 3 billing plans in parallel
    const [individualAnnualId, groupMonthlyId, groupAnnualId] = await Promise.all([
      createBillingPlan(productId, 'Pronote Individual Annual', '300', 'YEAR'),
      createBillingPlan(productId, 'Pronote Group Monthly', '40', 'MONTH'),
      createBillingPlan(productId, 'Pronote Group Annual', '460', 'YEAR'),
    ]);

    // Step 3: Update the shared PAYPAL_PLANS object so all routes use real IDs
    PAYPAL_PLANS.individual_annual = individualAnnualId;
    PAYPAL_PLANS.group_monthly = groupMonthlyId;
    PAYPAL_PLANS.group_annual = groupAnnualId;

    initialized = true;

    console.log('✅ PayPal billing plans ready:', {
      individual_annual: individualAnnualId,
      group_monthly: groupMonthlyId,
      group_annual: groupAnnualId,
    });
    console.log('');
    console.log('💡 Save these to Render environment variables to skip auto-creation next time:');
    console.log(`   PAYPAL_INDIVIDUAL_ANNUAL_PLAN_ID=${individualAnnualId}`);
    console.log(`   PAYPAL_GROUP_MONTHLY_PLAN_ID=${groupMonthlyId}`);
    console.log(`   PAYPAL_GROUP_ANNUAL_PLAN_ID=${groupAnnualId}`);
    console.log('');
  } catch (error) {
    console.error('❌ Failed to initialize PayPal plans:', error);
    // Don't throw — app still works, PayPal checkout just won't work
  }
}
