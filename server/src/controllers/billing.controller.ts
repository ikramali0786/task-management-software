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
import { logActivity } from '../services/audit.service';
import { ProcessedStripeEvent } from '../models/ProcessedStripeEvent.model';
import { sendPaymentFailedEmail } from '../services/email.service';

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
  // Per-seat: one seat per current team member. Guests are read-only and free.
  const seats = Math.max(1, (team.members?.filter((m: any) => !m.isGuest).length) || 1);

  const session = await client.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price, quantity: seats }],
    success_url: `${clientBase()}/app/settings?billing=success`,
    cancel_url: `${clientBase()}/app/settings?billing=cancelled`,
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
    return_url: `${clientBase()}/app/settings?billing=portal`,
  });

  sendSuccess(res, { url: session.url }, 'Portal session created.');
});

/**
 * Keep the Stripe subscription's seat quantity in step with the team's member
 * count. Call fire-and-forget after a member is added or removed. No-op unless
 * the team has an active paid subscription; failures are swallowed.
 */
export const syncTeamSeats = async (teamId: string): Promise<void> => {
  const client = getStripe();
  if (!client) return;
  try {
    const team = await Team.findById(teamId).select('stripeSubscriptionId members planStatus');
    if (!team?.stripeSubscriptionId || team.planStatus !== 'active') return;
    const seats = Math.max(1, (team.members?.filter((m: any) => !m.isGuest).length) || 1);
    const sub = await client.subscriptions.retrieve(team.stripeSubscriptionId);
    const item = sub.items?.data?.[0];
    if (!item || item.quantity === seats) return;
    await client.subscriptions.update(team.stripeSubscriptionId, {
      items: [{ id: item.id, quantity: seats }],
      proration_behavior: 'create_prorations',
    });
    audit('billing.plan.update', { teamId, event: 'seats.sync', seats } as any);
  } catch (err: any) {
    logger.warn(`[billing] seat sync failed for team ${teamId}: ${err?.message}`);
  }
};

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

  // Idempotency — Stripe retries deliveries, so the same event can arrive more
  // than once. Claim the event ID atomically (unique index); a duplicate key
  // error means it was already processed, so ACK without re-running effects.
  try {
    await ProcessedStripeEvent.create({ eventId: event.id, type: event.type });
  } catch (err: any) {
    if (err?.code === 11000) {
      logger.info(`[billing] webhook ${event.type} ${event.id} already processed — skipping`);
      return res.status(200).json({ received: true, duplicate: true });
    }
    // Ledger write failed for another reason (e.g. transient DB error) —
    // continue processing; the handlers below are state-overwrites, not
    // increments, so a rare double-run is safe.
    logger.warn(`[billing] idempotency ledger write failed: ${err?.message}`);
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
      return null;
    }
    Object.assign(team, patch);
    await team.save();
    audit('billing.plan.update', { teamId: team._id.toString(), event: event.type, plan: patch.plan });
    if (patch.plan || patch.planStatus) {
      logActivity({
        teamId: team._id.toString(),
        action: 'billing.updated',
        meta: { plan: patch.plan, status: patch.planStatus, event: event.type },
      });
    }
    return team;
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

    /* ── Dunning ──────────────────────────────────────────────────────────
     * A renewal charge failed. Mark the team past_due (features stay on
     * during Stripe's retry window) and nudge the owner to fix the card.
     * If every retry fails Stripe cancels the subscription, which arrives
     * as customer.subscription.deleted above and downgrades to free. */
    case 'invoice.payment_failed': {
      const inv = event.data.object as Stripe.Invoice;
      const customerId = typeof inv.customer === 'string' ? inv.customer : undefined;
      const subscriptionId =
        typeof (inv as any).subscription === 'string' ? (inv as any).subscription : undefined;
      if (!customerId && !subscriptionId) break;

      const team = await setTeamPlan(null, { planStatus: 'past_due' }, { customerId, subscriptionId });
      if (team) {
        const populated = await Team.findById(team._id).populate('owner', 'email name');
        const ownerEmail = (populated?.owner as any)?.email as string | undefined;
        if (ownerEmail) {
          // Best-effort — never fail the webhook over an email.
          sendPaymentFailedEmail(ownerEmail, team.name, team.plan).catch((err) =>
            logger.warn(`[billing] dunning email failed for team ${team._id}: ${err?.message}`)
          );
        }
      }
      break;
    }

    /* A later charge on the same subscription succeeded — clear past_due. */
    case 'invoice.paid': {
      const inv = event.data.object as Stripe.Invoice;
      const customerId = typeof inv.customer === 'string' ? inv.customer : undefined;
      const subscriptionId =
        typeof (inv as any).subscription === 'string' ? (inv as any).subscription : undefined;
      if (!customerId && !subscriptionId) break;

      const team =
        (subscriptionId && (await Team.findOne({ stripeSubscriptionId: subscriptionId }))) ||
        (customerId && (await Team.findOne({ stripeCustomerId: customerId }))) ||
        null;
      if (team && team.planStatus === 'past_due') {
        await setTeamPlan(team._id.toString(), { planStatus: 'active' });
      }
      break;
    }

    default:
      // Unhandled event types are acknowledged and ignored.
      break;
  }

  res.status(200).json({ received: true });
});
