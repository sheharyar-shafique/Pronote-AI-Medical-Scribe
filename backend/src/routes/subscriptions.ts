import { Router, Response } from 'express';
import { supabase } from '../lib/supabase.js';
import { stripe, STRIPE_PRICES } from '../lib/stripe.js';
import { paypalEnabled, createSubscription as createPayPalSubscription, cancelSubscription as cancelPayPalSubscription, PAYPAL_PLANS } from '../lib/paypal.js';
import { createCheckoutSchema } from '../types/schemas.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/subscriptions - Get current subscription
router.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('subscription_status, subscription_plan, trial_ends_at, stripe_customer_id')
      .eq('id', req.user!.id)
      .single();

    if (userError) throw userError;

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', req.user!.id)
      .eq('status', 'active')
      .single();

    res.json({
      status: user.subscription_status,
      plan: user.subscription_plan,
      trialEndsAt: user.trial_ends_at,
      subscription: subscription ? {
        id: subscription.id,
        stripeSubscriptionId: subscription.stripe_subscription_id,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      } : null,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/subscriptions/create-checkout - Create Stripe Checkout Session
router.post('/create-checkout', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (!stripe) {
      throw new AppError('Payment processing not configured', 503);
    }

    const data = createCheckoutSchema.parse(req.body);

    // Get or create Stripe customer
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('email, stripe_customer_id')
      .eq('id', req.user!.id)
      .single();

    if (userError) throw userError;

    let customerId = user.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: req.user!.id,
        },
      });
      customerId = customer.id;

      // Save customer ID
      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', req.user!.id);
    }

    const priceId = STRIPE_PRICES[data.plan as keyof typeof STRIPE_PRICES];

    if (!priceId) {
      throw new AppError('Invalid plan selected', 400);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: data.successUrl,
      cancel_url: data.cancelUrl,
      metadata: {
        userId: req.user!.id,
        plan: data.plan,
      },
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    next(error);
  }
});

// POST /api/subscriptions/create-paypal-checkout - Create PayPal Subscription
router.post('/create-paypal-checkout', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (!paypalEnabled) {
      throw new AppError('PayPal payment processing not configured', 503);
    }

    const data = createCheckoutSchema.parse(req.body);

    const planId = PAYPAL_PLANS[data.plan as keyof typeof PAYPAL_PLANS];

    if (!planId) {
      throw new AppError('Invalid plan selected', 400);
    }

    const { subscriptionId, approvalUrl } = await createPayPalSubscription(
      planId,
      req.user!.id,
      data.successUrl,
      data.cancelUrl
    );

    // Store pending PayPal subscription
    await supabase
      .from('users')
      .update({ paypal_subscription_id: subscriptionId })
      .eq('id', req.user!.id);

    res.json({ subscriptionId, url: approvalUrl });
  } catch (error) {
    next(error);
  }
});

// POST /api/subscriptions/create-portal - Create Stripe Customer Portal Session
router.post('/create-portal', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (!stripe) {
      throw new AppError('Payment processing not configured', 503);
    }

    const { returnUrl } = req.body;

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', req.user!.id)
      .single();

    if (userError) throw userError;

    if (!user.stripe_customer_id) {
      throw new AppError('No subscription found', 400);
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: returnUrl || process.env.FRONTEND_URL,
    });

    res.json({ url: session.url });
  } catch (error) {
    next(error);
  }
});

// POST /api/subscriptions/cancel - Cancel subscription
router.post('/cancel', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { provider } = req.body; // 'stripe' or 'paypal'

    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id, paypal_subscription_id, payment_provider')
      .eq('user_id', req.user!.id)
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      throw new AppError('No active subscription found', 404);
    }

    const paymentProvider = provider || subscription.payment_provider;

    if (paymentProvider === 'paypal' && subscription.paypal_subscription_id) {
      if (!paypalEnabled) {
        throw new AppError('PayPal payment processing not configured', 503);
      }
      await cancelPayPalSubscription(subscription.paypal_subscription_id, 'Customer requested cancellation');
      
      // Update local record
      await supabase
        .from('subscriptions')
        .update({ cancel_at_period_end: true })
        .eq('paypal_subscription_id', subscription.paypal_subscription_id);
    } else if (subscription.stripe_subscription_id) {
      if (!stripe) {
        throw new AppError('Stripe payment processing not configured', 503);
      }
      // Cancel at period end
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: true,
      });

      // Update local record
      await supabase
        .from('subscriptions')
        .update({ cancel_at_period_end: true })
        .eq('stripe_subscription_id', subscription.stripe_subscription_id);
    } else {
      throw new AppError('No valid subscription found', 404);
    }

    res.json({ message: 'Subscription will be canceled at the end of the billing period' });
  } catch (error) {
    next(error);
  }
});

// POST /api/subscriptions/reactivate - Reactivate a canceled subscription
router.post('/reactivate', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (!stripe) {
      throw new AppError('Payment processing not configured', 503);
    }

    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', req.user!.id)
      .single();

    if (subError || !subscription) {
      throw new AppError('No subscription found', 404);
    }

    // Reactivate subscription
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: false,
    });

    // Update local record
    await supabase
      .from('subscriptions')
      .update({ 
        cancel_at_period_end: false,
        status: 'active',
      })
      .eq('stripe_subscription_id', subscription.stripe_subscription_id);

    await supabase
      .from('users')
      .update({ subscription_status: 'active' })
      .eq('id', req.user!.id);

    res.json({ message: 'Subscription reactivated successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /api/subscriptions/plans - Get available plans
router.get('/plans', async (_req: AuthenticatedRequest, res: Response) => {
  res.json([
    {
      id: 'individual_annual',
      name: 'PronoteAI Individual Annual',
      price: 300,
      period: 'year',
      pricePerMonth: 25,
      description: 'Perfect for individual practitioners',
      features: [
        'Unlimited clinical notes',
        'All note templates',
        'Audio recording & upload',
        'AI-powered transcription',
        'Basic EHR export',
        'Email support',
        'Unlimited audio retention',
      ],
    },
    {
      id: 'group_monthly',
      name: 'Pronote Group Monthly',
      price: 40,
      period: 'month',
      pricePerMonth: 40,
      description: 'Best for small practices & teams',
      features: [
        'Everything in Individual',
        'Up to 5 team members',
        'Custom templates',
        'Priority support',
        'Advanced analytics',
        'EHR integrations',
        'Team management dashboard',
      ],
      highlighted: true,
    },
    {
      id: 'group_annual',
      name: 'Pronote Group Annual',
      price: 460,
      period: 'year',
      pricePerMonth: 38.33,
      originalPrice: 480,
      description: 'Best value for growing organizations',
      features: [
        'Everything in Group Monthly',
        'Annual billing discount',
        'Unlimited team members',
        'Custom AI training',
        'Dedicated success manager',
        'HIPAA BAA included',
        'Custom integrations',
        'SLA guarantees',
      ],
    },
  ]);
});

export default router;
