// Using built-in fetch (Node.js 18+)

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox'; // 'sandbox' or 'live'

const PAYPAL_BASE_URL = PAYPAL_MODE === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
  console.warn('⚠️ PayPal credentials not configured. PayPal payment features will be disabled.');
}

export const paypalEnabled = !!(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET);

export const PAYPAL_PLANS: Record<string, string> = {
  individual_annual: process.env.PAYPAL_INDIVIDUAL_ANNUAL_PLAN_ID || '',
  group_monthly: process.env.PAYPAL_GROUP_MONTHLY_PLAN_ID || '',
  group_annual: process.env.PAYPAL_GROUP_ANNUAL_PLAN_ID || '',
};

// Get PayPal access token
async function getAccessToken(): Promise<string> {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get PayPal access token: ${error}`);
  }

  const data = await response.json() as { access_token: string };
  return data.access_token;
}

// Create a subscription
export async function createSubscription(
  planId: string,
  userId: string,
  returnUrl: string,
  cancelUrl: string
): Promise<{ subscriptionId: string; approvalUrl: string }> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      plan_id: planId,
      custom_id: userId, // Store our user ID for webhook reference
      application_context: {
        brand_name: 'Pronote',
        locale: 'en-US',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create PayPal subscription: ${error}`);
  }

  const data = await response.json() as {
    id: string;
    links: Array<{ rel: string; href: string }>;
  };

  const approvalLink = data.links.find(link => link.rel === 'approve');
  
  return {
    subscriptionId: data.id,
    approvalUrl: approvalLink?.href || '',
  };
}

// Get subscription details
export async function getSubscription(subscriptionId: string): Promise<PayPalSubscription> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get PayPal subscription: ${error}`);
  }

  return response.json() as Promise<PayPalSubscription>;
}

// Cancel a subscription
export async function cancelSubscription(subscriptionId: string, reason?: string): Promise<void> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reason: reason || 'Customer requested cancellation',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to cancel PayPal subscription: ${error}`);
  }
}

// Suspend a subscription
export async function suspendSubscription(subscriptionId: string, reason?: string): Promise<void> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}/suspend`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reason: reason || 'Subscription suspended',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to suspend PayPal subscription: ${error}`);
  }
}

// Reactivate a subscription
export async function activateSubscription(subscriptionId: string, reason?: string): Promise<void> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}/activate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reason: reason || 'Subscription reactivated',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to activate PayPal subscription: ${error}`);
  }
}

// Verify webhook signature
export async function verifyWebhookSignature(
  webhookId: string,
  headers: Record<string, string>,
  body: string
): Promise<boolean> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: webhookId,
      webhook_event: JSON.parse(body),
    }),
  });

  if (!response.ok) {
    return false;
  }

  const data = await response.json() as { verification_status: string };
  return data.verification_status === 'SUCCESS';
}

// Create a PayPal product (catalog item)
export async function createProduct(name: string, description: string): Promise<string> {
  const accessToken = await getAccessToken();
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/catalogs/products`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `pronote-product-${Date.now()}`,
    },
    body: JSON.stringify({ name, description, type: 'SERVICE', category: 'SOFTWARE' }),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create PayPal product: ${error}`);
  }
  const data = await response.json() as { id: string };
  return data.id;
}

// Create a PayPal billing plan
export async function createBillingPlan(
  productId: string,
  name: string,
  price: string,
  intervalUnit: 'MONTH' | 'YEAR'
): Promise<string> {
  const accessToken = await getAccessToken();
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/plans`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `pronote-plan-${name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      product_id: productId,
      name,
      status: 'ACTIVE',
      billing_cycles: [{
        frequency: { interval_unit: intervalUnit, interval_count: 1 },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: { fixed_price: { value: price, currency_code: 'USD' } },
      }],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3,
      },
    }),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create PayPal billing plan: ${error}`);
  }
  const data = await response.json() as { id: string };
  return data.id;
}

// Types
export interface PayPalSubscription {
  id: string;
  plan_id: string;
  status: 'APPROVAL_PENDING' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';
  custom_id?: string;
  subscriber?: {
    email_address: string;
    name?: {
      given_name: string;
      surname: string;
    };
  };
  billing_info?: {
    next_billing_time: string;
    last_payment?: {
      amount: {
        currency_code: string;
        value: string;
      };
      time: string;
    };
  };
  create_time: string;
  update_time: string;
}

export interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource_type: string;
  resource: PayPalSubscription & {
    custom_id?: string;
  };
  create_time: string;
}
