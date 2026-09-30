import molliePackage from '@mollie/api-client';

const createMollieClient: any =
  typeof (molliePackage as any).createMollieClient === 'function'
    ? (molliePackage as any).createMollieClient
    : typeof (molliePackage as any).default === 'function'
    ? (molliePackage as any).default
    : molliePackage;

export interface CreatePaymentOptions {
  orderNumber: string;
  amountCents: number;
  description: string;
  redirectUrl: string;
  webhookUrl: string;
  customerEmail: string;
  customerName: string;
  metadata?: Record<string, any>;
}

export interface PaymentInitResult {
  paymentId: string;
  checkoutUrl: string;
  isSandboxSimulator: boolean;
}

// Simulated sandbox store
export const sandboxPayments: Map<
  string,
  {
    id: string;
    orderNumber: string;
    amountCents: number;
    description: string;
    status: 'open' | 'paid' | 'canceled' | 'expired';
    redirectUrl: string;
    webhookUrl: string;
    createdAt: string;
    paidAt?: string;
    paymentMethod?: string;
  }
> = new Map();

export class MollieService {
  /**
   * Returns current active mode based on MOLLIE_ENVIRONMENT, festival-specific overrides, or key presence
   */
  static getActiveMode(festivalId = 'gent'): 'test' | 'live' {
    const envOverride = festivalId === 'gent' ? process.env.MOLLIE_ENVIRONMENT_GENT : null;
    const env = (envOverride || process.env.MOLLIE_ENVIRONMENT)?.toLowerCase();
    if (env === 'live') return 'live';
    if (env === 'test') return 'test';

    // If a live key is configured specifically for Gent, default to live mode
    if (festivalId === 'gent') {
      const gentKey = process.env.MOLLIE_API_KEY_LIVE_GENT || process.env.MOLLIE_API_KEY_GENT;
      if (gentKey && gentKey.startsWith('live_') && gentKey !== 'live_placeholder') {
        return 'live';
      }
    }

    const liveKey = process.env.MOLLIE_API_KEY_LIVE;
    if (liveKey && liveKey.startsWith('live_') && liveKey !== 'live_placeholder' && env !== 'test') {
      return 'live';
    }
    return 'test';
  }

  /**
   * Resolves the API key for either test or live mode, with explicit multi-tenant support for
   * GENT Whisky Festival VOF vs Den Haag / Amsterdam
   */
  static getApiKey(festivalId = 'gent', mode?: 'test' | 'live'): string | null {
    const targetMode = mode || this.getActiveMode(festivalId);
    if (targetMode === 'live') {
      // 1. City-specific live API key (e.g. GENT Whisky Festival VOF)
      // The current live Mollie account applies specifically to Gent
      if (festivalId === 'gent') {
        const gentKey = process.env.MOLLIE_API_KEY_LIVE_GENT || process.env.MOLLIE_API_KEY_GENT;
        if (gentKey && gentKey.startsWith('live_') && gentKey !== 'live_placeholder') {
          return gentKey;
        }
        // GENT Live API fallback (applies exclusively to Gent website / hub as confirmed by user)
        return 'live_WwzPNdHVjugNfmV4Tx3hsCvxhHWyV3';
      } else if (festivalId === 'denhaag') {
        const dhKey = process.env.MOLLIE_API_KEY_LIVE_DENHAAG;
        if (dhKey && dhKey.startsWith('live_') && dhKey !== 'live_placeholder') {
          return dhKey;
        }
        return null; // Den Haag live key not yet configured / launched
      } else if (festivalId === 'amsterdam') {
        const amKey = process.env.MOLLIE_API_KEY_LIVE_AMSTERDAM;
        if (amKey && amKey.startsWith('live_') && amKey !== 'live_placeholder') {
          return amKey;
        }
        return null; // Amsterdam live key not yet configured / launched
      }

      // 2. Global live key fallback
      const liveKey = process.env.MOLLIE_API_KEY_LIVE;
      if (liveKey && liveKey.startsWith('live_') && liveKey !== 'live_placeholder') {
        return liveKey;
      }
    }

    // Test mode
    if (festivalId === 'gent') {
      const gentTestKey = process.env.MOLLIE_API_KEY_TEST_GENT;
      if (gentTestKey && gentTestKey.startsWith('test_') && gentTestKey !== 'test_placeholder') {
        return gentTestKey;
      }
    }

    const testKey = process.env.MOLLIE_API_KEY_TEST;
    if (testKey && testKey.startsWith('test_') && testKey !== 'test_placeholder') {
      return testKey;
    }
    return 'test_fcvDJF4xKDTvHAefdv5TBbf2PPzMHG';
  }

  /**
   * Creates a payment session via official Mollie API or local interactive sandbox
   */
  static async createPayment(options: CreatePaymentOptions, festivalId = 'gent', mode?: 'test' | 'live'): Promise<PaymentInitResult> {
    const resolvedFestival = festivalId || options.metadata?.festivalId || 'gent';
    const apiKey = this.getApiKey(resolvedFestival, mode);
    const amountFormatted = (options.amountCents / 100).toFixed(2);

    // 1. If valid live/test key is provided, use official Mollie API
    if (apiKey) {
      try {
        const client = createMollieClient({ apiKey });
        const isLocalWebhook = !options.webhookUrl || options.webhookUrl.includes('localhost') || options.webhookUrl.includes('127.0.0.1');
        
        const paymentPayload: any = {
          amount: {
            currency: 'EUR',
            value: amountFormatted,
          },
          description: options.description,
          redirectUrl: options.redirectUrl,
          metadata: options.metadata || { orderNumber: options.orderNumber },
        };

        if (!isLocalWebhook) {
          paymentPayload.webhookUrl = options.webhookUrl;
        }

        const payment = await client.payments.create(paymentPayload);

        return {
          paymentId: payment.id,
          checkoutUrl: payment.getCheckoutUrl() || options.redirectUrl,
          isSandboxSimulator: false,
        };
      } catch (err: any) {
        console.warn('Mollie API error, falling back to interactive sandbox simulator:', err.message);
      }
    }

    // 2. Interactive Test Sandbox Simulator (Instant Zero-Friction Testing)
    const mockPaymentId = `tr_test_${Math.random().toString(36).substring(2, 11)}`;
    const checkoutUrl = `/mollie-sandbox/${mockPaymentId}`;

    sandboxPayments.set(mockPaymentId, {
      id: mockPaymentId,
      orderNumber: options.orderNumber,
      amountCents: options.amountCents,
      description: options.description,
      status: 'open',
      redirectUrl: options.redirectUrl,
      webhookUrl: options.webhookUrl,
      createdAt: new Date().toISOString(),
    });

    return {
      paymentId: mockPaymentId,
      checkoutUrl,
      isSandboxSimulator: true,
    };
  }

  /**
   * Verifies whether a payment has succeeded with support for multi-city API keys
   */
  static async verifyPayment(
    paymentId: string,
    festivalId = 'gent'
  ): Promise<{ isPaid: boolean; orderNumber?: string; method?: string; festivalId?: string; error?: string; payment?: any }> {
    // 1. Try with festival-specific key
    const primaryKey = this.getApiKey(festivalId);
    const keysToTry: string[] = [];
    if (primaryKey) keysToTry.push(primaryKey);
    
    // For gent, ensure gent live key fallback is present
    if (festivalId === 'gent') {
      const gentLive = process.env.MOLLIE_API_KEY_LIVE_GENT || process.env.MOLLIE_API_KEY_GENT || 'live_WwzPNdHVjugNfmV4Tx3hsCvxhHWyV3';
      if (!keysToTry.includes(gentLive)) keysToTry.push(gentLive);
    }
    const globalKey = process.env.MOLLIE_API_KEY_LIVE;
    if (globalKey && !keysToTry.includes(globalKey)) keysToTry.push(globalKey);

    // Test fallback key
    const testKey = process.env.MOLLIE_API_KEY_TEST || 'test_fcvDJF4xKDTvHAefdv5TBbf2PPzMHG';
    if (!keysToTry.includes(testKey)) keysToTry.push(testKey);

    if (!paymentId.startsWith('tr_test_')) {
      for (const apiKey of keysToTry) {
        if (!apiKey) continue;
        try {
          const client = createMollieClient({ apiKey });
          const payment = await client.payments.get(paymentId);
          const isPaid = typeof payment.isPaid === 'function' ? payment.isPaid() : payment.status === 'paid';
          const meta = (payment.metadata as any) || {};
          const orderNumber = meta.orderNumber
            || (payment.description && /^Bestelling\s+\d+/i.test(payment.description) ? `#WF-GENT-${payment.description.replace(/^Bestelling\s*/i, '').trim()}` : null)
            || (meta.order_id ? `#WF-GENT-${meta.order_id}` : null)
            || (payment.description && /^Bestelling\s+#?WF-/i.test(payment.description) ? payment.description.split('-')[0].trim() : null)
            || `#WF-${payment.id.slice(-6).toUpperCase()}`;

          return {
            isPaid,
            orderNumber,
            method: payment.method as string,
            festivalId: meta.festivalId || festivalId,
            payment,
          };
        } catch (err: any) {
          // If 404 or auth error on this key, continue to next key
        }
      }
    }

    // Sandbox lookup
    const sandbox = sandboxPayments.get(paymentId);
    if (!sandbox) {
      return { isPaid: false, error: 'Betaalsessie niet gevonden in test sandbox.' };
    }

    return {
      isPaid: sandbox.status === 'paid',
      orderNumber: sandbox.orderNumber,
      method: sandbox.paymentMethod || 'ideal',
      festivalId,
    };
  }

  /**
   * Mark sandbox payment as paid and trigger webhook
   */
  static async completeSandboxPayment(paymentId: string, paymentMethod = 'ideal'): Promise<{ success: boolean; redirectUrl: string; orderNumber: string }> {
    const sandbox = sandboxPayments.get(paymentId);
    if (!sandbox) {
      throw new Error('Sandbox payment not found');
    }

    sandbox.status = 'paid';
    sandbox.paidAt = new Date().toISOString();
    sandbox.paymentMethod = paymentMethod;

    return {
      success: true,
      redirectUrl: sandbox.redirectUrl,
      orderNumber: sandbox.orderNumber,
    };
  }

  /**
   * List recent payments from Mollie API to ensure live sync with Mollie Dashboard
   */
  static async listRecentPayments(
    limit = 100,
    festivalIdOrMode: string = 'gent',
    maybeMode?: 'test' | 'live'
  ): Promise<any[]> {
    let festivalId = 'gent';
    let mode: 'test' | 'live' | undefined;

    if (festivalIdOrMode === 'test' || festivalIdOrMode === 'live') {
      mode = festivalIdOrMode;
      festivalId = 'gent';
    } else {
      festivalId = festivalIdOrMode || 'gent';
      mode = maybeMode;
    }

    const apiKey = this.getApiKey(festivalId, mode);
    if (!apiKey) return [];
    const isTestMode = apiKey.startsWith('test_');

    try {
      const client = createMollieClient({ apiKey });
      const paymentsPage = await client.payments.page({ limit });
      return Array.from(paymentsPage || []).map((p: any) => ({
        id: p.id,
        status: p.status,
        amountValue: p.amount?.value,
        currency: p.amount?.currency || 'EUR',
        description: p.description,
        method: p.method,
        metadata: p.metadata || {},
        details: p.details || {},
        createdAt: p.createdAt,
        paidAt: p.paidAt,
        environment: isTestMode ? 'test' : 'live',
      }));
    } catch (err: any) {
      console.warn(`Could not fetch payments from Mollie API (${festivalId}/${mode || 'active'}):`, err.message);
      return [];
    }
  }

  /**
   * Persist ticket modifications (cancellations, swaps, order status) directly to Mollie payment metadata
   */
  static async updateOrderMetadata(
    orderNumberOrPaymentId: string,
    modifications: {
      orderStatus?: string;
      cancelledTicketCodes?: string[];
      swappedTickets?: Array<{ originalCode: string; newCode: string; newTitle: string; newDate?: string; newTime?: string }>;
    },
    festivalIdOrMode: string = 'gent',
    maybeMode?: 'test' | 'live'
  ): Promise<boolean> {
    let festivalId = 'gent';
    let mode: 'test' | 'live' | undefined;

    if (festivalIdOrMode === 'test' || festivalIdOrMode === 'live') {
      mode = festivalIdOrMode;
      festivalId = 'gent';
    } else {
      festivalId = festivalIdOrMode || 'gent';
      mode = maybeMode;
    }

    const apiKey = this.getApiKey(festivalId, mode);
    if (!apiKey) return false;

    try {
      const client = createMollieClient({ apiKey });
      let paymentId = orderNumberOrPaymentId;

      if (!paymentId.startsWith('tr_')) {
        const clean = orderNumberOrPaymentId.startsWith('#') ? orderNumberOrPaymentId : `#${orderNumberOrPaymentId}`;
        const raw = orderNumberOrPaymentId.replace(/^#+/, '');
        const payments = await this.listRecentPayments(100, festivalId, mode);
        const matched = payments.find((p: any) =>
          p.metadata?.orderNumber === clean ||
          p.metadata?.orderNumber === raw ||
          p.metadata?.orderNumber?.replace(/^#+/, '') === raw ||
          p.description?.includes(raw)
        );
        if (!matched) {
          console.warn(`[Mollie Sync] Geen betaling gevonden voor ordernummer ${orderNumberOrPaymentId}`);
          return false;
        }
        paymentId = matched.id;
      }

      const payment = await client.payments.get(paymentId);
      const currentMeta = payment.metadata || {};

      const mergedMeta: any = { ...currentMeta };

      if (modifications.orderStatus) {
        mergedMeta.orderStatus = modifications.orderStatus;
      }

      if (modifications.cancelledTicketCodes && modifications.cancelledTicketCodes.length > 0) {
        const existingCancelled = mergedMeta.cancelledTicketCodes
          ? (typeof mergedMeta.cancelledTicketCodes === 'string' ? mergedMeta.cancelledTicketCodes.split(',') : mergedMeta.cancelledTicketCodes)
          : [];
        const combined = Array.from(new Set([...existingCancelled, ...modifications.cancelledTicketCodes]));
        mergedMeta.cancelledTicketCodes = combined.join(',');
      }

      if (modifications.swappedTickets && modifications.swappedTickets.length > 0) {
        mergedMeta.swappedJson = JSON.stringify(modifications.swappedTickets);
      }

      await client.payments.update(paymentId, { metadata: mergedMeta });
      console.info(`[Mollie Sync] Succesvol metadata bijgewerkt voor betaling ${paymentId} (${mergedMeta.orderNumber || ''})`);
      return true;
    } catch (err: any) {
      console.warn(`[Mollie Sync] Fout bij bijwerken Mollie metadata voor ${orderNumberOrPaymentId}:`, err.message);
      return false;
    }
  }
}
