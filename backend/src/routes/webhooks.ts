import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';
import { stripe } from '../lib/stripe.js';
import { paypalEnabled, verifyWebhookSignature, PayPalWebhookEvent, getSubscription } from '../lib/paypal.js';
import Stripe from 'stripe';

const router = Router();

// POST /api/webhooks/stripe - Handle Stripe webhooks
router.post('/stripe', async (req: Request, res: Response) => {
  if (!stripe) {
    console.warn('Stripe not configured, ignoring webhook');
    res.status(200).json({ received: true });
    return;
  }

  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('Stripe webhook secret not configured');
    res.status(500).json({ error: 'Webhook secret not configured' });
    return;
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    res.status(400).json({ error: 'Webhook signature verification failed' });
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan;

  if (!userId || !plan) {
    console.error('Missing metadata in checkout session');
    return;
  }

  // Update user subscription status
  await supabase
    .from('users')
    .update({
      subscription_status: 'active',
      subscription_plan: plan,
      stripe_customer_id: session.customer as string,
    })
    .eq('id', userId);

  console.log(`Checkout completed for user ${userId}, plan: ${plan}`);
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  // Find user by Stripe customer ID
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user) {
    console.error('User not found for customer:', customerId);
    return;
  }

  // Map Stripe status to our status
  let status: 'active' | 'inactive' | 'trial' = 'inactive';
  if (subscription.status === 'active') status = 'active';
  else if (subscription.status === 'trialing') status = 'trial';

  // Update or create subscription record
  await supabase
    .from('subscriptions')
    .upsert({
      user_id: user.id,
      stripe_subscription_id: subscription.id,
      plan: getPlanFromPriceId(subscription.items.data[0]?.price.id),
      status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
    }, { onConflict: 'stripe_subscription_id' });

  // Update user status
  await supabase
    .from('users')
    .update({ subscription_status: status })
    .eq('id', user.id);

  console.log(`Subscription updated for user ${user.id}, status: ${status}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  // Find user by Stripe customer ID
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user) {
    console.error('User not found for customer:', customerId);
    return;
  }

  // Update subscription record
  await supabase
    .from('subscriptions')
    .update({ status: 'canceled' })
    .eq('stripe_subscription_id', subscription.id);

  // Update user status
  await supabase
    .from('users')
    .update({ 
      subscription_status: 'inactive',
      subscription_plan: null,
    })
    .eq('id', user.id);

  console.log(`Subscription canceled for user ${user.id}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user) return;

  // Update subscription status to past_due
  await supabase
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('user_id', user.id);

  console.log(`Payment failed for user ${user.id}`);
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user) return;

  // Ensure subscription is active
  await supabase
    .from('users')
    .update({ subscription_status: 'active' })
    .eq('id', user.id);

  await supabase
    .from('subscriptions')
    .update({ status: 'active' })
    .eq('user_id', user.id);

  console.log(`Payment succeeded for user ${user.id}`);
}

function getPlanFromPriceId(priceId: string): string {
  const priceMap: Record<string, string> = {
    'price_1SzS7dDXB0wGVl1wDrTojxoO': 'individual_annual',
    'price_1SzSDSDXB0wGVl1wjWa5py0A': 'group_monthly',
    'price_1SzSG6DXB0wGVl1wMoEzFUnm': 'group_annual',
  };
  return priceMap[priceId] || 'individual_annual';
}

// ==================== PayPal Webhooks ====================

// POST /api/webhooks/paypal - Handle PayPal webhooks
router.post('/paypal', async (req: Request, res: Response) => {
  if (!paypalEnabled) {
    console.warn('PayPal not configured, ignoring webhook');
    res.status(200).json({ received: true });
    return;
  }

  const webhookId = process.env.PAYPAL_WEBHOOK_ID;

  if (!webhookId) {
    console.error('PayPal webhook ID not configured');
    res.status(500).json({ error: 'Webhook ID not configured' });
    return;
  }

  try {
    // Verify webhook signature
    const headers: Record<string, string> = {
      'paypal-auth-algo': req.headers['paypal-auth-algo'] as string,
      'paypal-cert-url': req.headers['paypal-cert-url'] as string,
      'paypal-transmission-id': req.headers['paypal-transmission-id'] as string,
      'paypal-transmission-sig': req.headers['paypal-transmission-sig'] as string,
      'paypal-transmission-time': req.headers['paypal-transmission-time'] as string,
    };

    const isValid = await verifyWebhookSignature(
      webhookId,
      headers,
      typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    );

    if (!isValid) {
      console.error('PayPal webhook signature verification failed');
      res.status(400).json({ error: 'Webhook signature verification failed' });
      return;
    }

    const event = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as PayPalWebhookEvent;

    switch (event.event_type) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await handlePayPalSubscriptionActivated(event);
        break;

      case 'BILLING.SUBSCRIPTION.CANCELLED':
        await handlePayPalSubscriptionCancelled(event);
        break;

      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        await handlePayPalSubscriptionSuspended(event);
        break;

      case 'BILLING.SUBSCRIPTION.EXPIRED':
        await handlePayPalSubscriptionExpired(event);
        break;

      case 'PAYMENT.SALE.COMPLETED':
        await handlePayPalPaymentCompleted(event);
        break;

      default:
        console.log(`Unhandled PayPal event type: ${event.event_type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('PayPal webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

async function handlePayPalSubscriptionActivated(event: PayPalWebhookEvent) {
  const subscription = event.resource;
  const userId = subscription.custom_id;

  if (!userId) {
    console.error('Missing user ID in PayPal subscription');
    return;
  }

  // Get plan from subscription
  const plan = getPlanFromPayPalPlanId(subscription.plan_id);

  // Update user subscription status
  await supabase
    .from('users')
    .update({
      subscription_status: 'active',
      subscription_plan: plan,
      paypal_subscription_id: subscription.id,
    })
    .eq('id', userId);

  // Create or update subscription record
  await supabase
    .from('subscriptions')
    .upsert({
      user_id: userId,
      paypal_subscription_id: subscription.id,
      plan,
      status: 'active',
      payment_provider: 'paypal',
      current_period_start: subscription.create_time,
      current_period_end: subscription.billing_info?.next_billing_time || null,
    }, { onConflict: 'paypal_subscription_id' });

  console.log(`PayPal subscription activated for user ${userId}, plan: ${plan}`);
}

async function handlePayPalSubscriptionCancelled(event: PayPalWebhookEvent) {
  const subscription = event.resource;
  const userId = subscription.custom_id;

  if (!userId) {
    // Try to find user by PayPal subscription ID
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('paypal_subscription_id', subscription.id)
      .single();

    if (!user) {
      console.error('User not found for PayPal subscription:', subscription.id);
      return;
    }

    await updateUserSubscriptionStatus(user.id, 'inactive', subscription.id);
    return;
  }

  await updateUserSubscriptionStatus(userId, 'inactive', subscription.id);
  console.log(`PayPal subscription cancelled for user ${userId}`);
}

async function handlePayPalSubscriptionSuspended(event: PayPalWebhookEvent) {
  const subscription = event.resource;
  const userId = subscription.custom_id;

  if (!userId) {
    console.error('Missing user ID in PayPal subscription');
    return;
  }

  await supabase
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('paypal_subscription_id', subscription.id);

  console.log(`PayPal subscription suspended for user ${userId}`);
}

async function handlePayPalSubscriptionExpired(event: PayPalWebhookEvent) {
  const subscription = event.resource;
  const userId = subscription.custom_id;

  if (!userId) {
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('paypal_subscription_id', subscription.id)
      .single();

    if (user) {
      await updateUserSubscriptionStatus(user.id, 'inactive', subscription.id);
    }
    return;
  }

  await updateUserSubscriptionStatus(userId, 'inactive', subscription.id);
  console.log(`PayPal subscription expired for user ${userId}`);
}

async function handlePayPalPaymentCompleted(event: PayPalWebhookEvent) {
  // Payment completed, ensure subscription is active
  const subscriptionId = (event.resource as any).billing_agreement_id;
  
  if (subscriptionId) {
    const subscription = await getSubscription(subscriptionId);
    if (subscription.custom_id) {
      await supabase
        .from('users')
        .update({ subscription_status: 'active' })
        .eq('id', subscription.custom_id);
    }
  }
}

async function updateUserSubscriptionStatus(userId: string, status: 'active' | 'inactive', subscriptionId: string) {
  await supabase
    .from('subscriptions')
    .update({ status: status === 'inactive' ? 'canceled' : status })
    .eq('paypal_subscription_id', subscriptionId);

  await supabase
    .from('users')
    .update({
      subscription_status: status,
      subscription_plan: status === 'inactive' ? null : undefined,
    })
    .eq('id', userId);
}

function getPlanFromPayPalPlanId(planId: string): 'starter' | 'practice' | 'enterprise' {
  const starterPlanId = process.env.PAYPAL_STARTER_PLAN_ID;
  const practicePlanId = process.env.PAYPAL_PRACTICE_PLAN_ID;
  const enterprisePlanId = process.env.PAYPAL_ENTERPRISE_PLAN_ID;

  if (planId === starterPlanId) return 'starter';
  if (planId === practicePlanId) return 'practice';
  if (planId === enterprisePlanId) return 'enterprise';
  
  return 'practice'; // Default fallback
}

export default router;
