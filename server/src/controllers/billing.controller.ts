import { Request, Response } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { env } from '../config/env';
import { Team } from '../models/Team.model';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { audit } from '../utils/logger';
import logger from '../utils/logger';
import { PLAN_RANK, type Plan } from '../config/plans';

// ── Stripe client ────────────────────────────────────────────────────────────
// Lazily resolved so the app boots without Stripe configured. Every billing
// endpoint 503s with a clear message when keys are absent, and the webhook
// no-ops — mirroring the email service's "degrade gracefully" pattern.
let stripe: Stripe | null = null;
const getStripe = (): Stripe | null => {
  if (!env.STRIPE_SECRET_KEY) return null;
  if (!stripe) stripe = new Stripe(env.STRIPE_SECRET_KEY);
  return stripe;
};

export const isBillingConfigured = (): boolean =>
  Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_PRO_MONTHLY);

const clientBase = () => env.CLIENT_URL.replace(/\/$/, '');

// Resolve the Stripe price ID for a tier + interval (yearly falls back to monthly).
const priceFor = (plan: 'pro' | 'business', interval: 'monthly' | 'yearly'): string => {
  if (plan === 'business') {
    return (interval === 'yearly' && env.STRIPE_PRICE_BUSINESS_YEARLY) || env.STRIPE_PRICE_BUSINESS_MONTHLY;
  }
  return (interval === 'yearly' && env.STRIPE_PRICE_PRO_YEARLY) || env.STRIPE_PRICE_PRO_MONTHLY;
};

/** Map a Stripe price ID back to the plan tier it represents. */
const planForPrice = (priceId?: string | null): Plan => {
  if (!priceId) return 'pro';
  if (priceId === env.STRIPE_PRICE_BUSINESS_MONTHLY || priceId === env.STRIPE_PRICE_BUSINESS_YEARLY) {
    return 'business';
  }
  return 'pro';
};

// Only the team owner manages billing.
const requireOwner = async (teamId: string, userId: string) => {
  const team = await Team.findById(teamId).populate('owner', 'email name');
  if (!team) throw new ApiError(404, 'Team not found.');
  if (team.owner._id.toString() !== userId) {
    throw new ApiError(403, 'Only the team owner can manage billing.');
  }
  return team;
};

/* ── POST /api/billing/:teamId/checkout ──────────────────────────────────────
 * Create a Stripe Checkout Session for the Pro subscription. */
export const createCheckoutSession = asyncHandler(async (req: Request, res: Response) => {
  const client = getStripe();
  if (!client || !isBillingConfigured()) {
    throw new ApiError(503, 'Billing is not configured yet. Please try again later.', {
      code: 'BILLING_NOT_CONFIGURED',
    });
  }

  const schema = z.object({
    plan: z.enum(['pro', 'business']).default('pro'),
    interval: z.enum(['monthly', 'yearly']).default('monthly'),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, 'Invalid plan or interval.');
  const { plan, interval } = parsed.data;

  const team = await requireOwner(req.params.teamId, req.user!._id.toString());

  // Block buying a tier the team already holds at an equal-or-higher level
  // (downgrades/cancellations go through the Customer Portal instead).
  if (team.planStatus === 'active' && PLAN_RANK[team.plan] >= PLAN_RANK[plan]) {
    throw new ApiError(409, `This team is already on the ${team.plan} plan.`);
  }

  const price = priceFor(plan, interval);
  if (!price) {
    throw new ApiError(503, `The ${plan} plan isn't available for purchase yet.`, {
      code: 'BILLING_NOT_CONFIGURED',
    });
  }

  const ownerEmail = (team.owner as any)?.email as string | undefined;
  // Per-seat: one seat per current team member.
  const seats = Math.max(1, team.members?.length || 1);

  const session = await client.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price, quantity: seats }],
    success_url: `${clientBase()}/settings?billing=success`,
    cancel_url: `${clientBase()}/settings?billing=cancelled`,
    client_reference_id: team._id.toString(),
    allow_promotion_codes: true,
    // Reuse an existing customer if we have one; otherwise prefill the email.
    ...(team.stripeCustomerId
      ? { customer: team.stripeCustomerId }
      : ownerEmail
      ? { customer_email: ownerEmail }
      : {}),
    metadata: { teamId: team._id.toString(), plan },
    subscription_data: { metadata: { teamId: team._id.toString(), plan } },
  });

  sendSuccess(res, { url: session.url }, 'Checkout session created.');
});

/* ── POST /api/billing/:teamId/portal ────────────────────────────────────────
 * Create a Stripe Customer Portal session to manage/cancel the subscription. */
export const createPortalSession = asyncHandler(async (req: Request, res: Response) => {
  const client = getStripe();
  if (!client) {
    throw new ApiError(503, 'Billing is not configured yet.', { code: 'BILLING_NOT_CONFIGURED' });
  }

  const team = await requireOwner(req.params.teamId, req.user!._id.toString());
  if (!team.stripeCustomerId) {
    throw new ApiError(400, 'No billing account exists for this team yet.');
  }

  const session = await client.billingPortal.sessions.create({
    customer: team.stripeCustomerId,
    return_url: `${clientBase()}/settings?billing=portal`,
  });

  sendSuccess(res, { url: session.url }, 'Portal session created.');
});

/* ── POST /api/billing/webhook ───────────────────────────────────────────────
 * Stripe webhook — the source of truth for plan state. Mounted in app.ts with a
 * raw body parser BEFORE express.json so the signature can be verified. */
export const handleStripeWebhook = asyncHandler(async (req: Request, res: Response) => {
  const client = getStripe();
  if (!client || !env.STRIPE_WEBHOOK_SECRET) {
    // Not configured — acknowledge so Stripe doesn't retry forever.
    return res.status(200).json({ received: true, ignored: true });
  }

  const sig = req.headers['stripe-signature'];
  let event: Stripe.Event;
  try {
    event = client.webhooks.constructEvent(
      req.body as Buffer,
      sig as string,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    logger.warn(`[billing] webhook signature verification failed: ${err?.message}`);
    return res.status(400).send(`Webhook Error: ${err?.message}`);
  }

  const setTeamPlan = async (
    teamId: string | undefined | null,
    patch: Partial<{
      plan: Plan;
      planStatus: 'active' | 'past_due' | 'canceled';
      stripeCustomerId: string | null;
      stripeSubscriptionId: string | null;
      currentPeriodEnd: Date | null;
    }>,
    fallback?: { customerId?: string; subscriptionId?: string }
  ) => {
    let team = teamId ? await Team.findById(teamId) : null;
    if (!team && fallback?.subscriptionId) {
      team = await Team.findOne({ stripeSubscriptionId: fallback.subscriptionId });
    }
    if (!team && fallback?.customerId) {
      team = await Team.findOne({ stripeCustomerId: fallback.customerId });
    }
    if (!team) {
      logger.warn(`[billing] webhook ${event.type}: no team matched`);
      return;
    }
    Object.assign(team, patch);
    await team.save();
    audit('billing.plan.update', { teamId: team._id.toString(), event: event.type, plan: patch.plan });
  };

  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object as Stripe.Checkout.Session;
      const sub =
        typeof s.subscription === 'string' ? await client.subscriptions.retrieve(s.subscription) : null;
      const tier = (s.metadata?.plan as Plan) || planForPrice(sub?.items?.data?.[0]?.price?.id);
      await setTeamPlan(s.metadata?.teamId || s.client_reference_id, {
        plan: tier,
        planStatus: 'active',
        stripeCustomerId: typeof s.customer === 'string' ? s.customer : null,
        stripeSubscriptionId: typeof s.subscription === 'string' ? s.subscription : null,
        currentPeriodEnd: sub ? new Date((sub as any).current_period_end * 1000) : null,
      });
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const active = sub.status === 'active' || sub.status === 'trialing';
      const tier = (sub.metadata?.plan as Plan) || planForPrice(sub.items?.data?.[0]?.price?.id);
      await setTeamPlan(
        sub.metadata?.teamId,
        {
          plan: active ? tier : 'free',
          planStatus: sub.status === 'past_due' ? 'past_due' : active ? 'active' : 'canceled',
          stripeSubscriptionId: sub.id,
          stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : null,
          currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
        },
        { subscriptionId: sub.id, customerId: typeof sub.customer === 'string' ? sub.customer : undefined }
      );
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await setTeamPlan(
        sub.metadata?.teamId,
        { plan: 'free', planStatus: 'canceled', stripeSubscriptionId: null },
        { subscriptionId: sub.id, customerId: typeof sub.customer === 'string' ? sub.customer : undefined }
      );
      break;
    }

    default:
      // Unhandled event types are acknowledged and ignored.
      break;
  }

  res.status(200).json({ received: true });
});
