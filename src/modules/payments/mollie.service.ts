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
   * Returns current active mode based on city-specific MOLLIE_ENVIRONMENT_<CITY>, global MOLLIE_ENVIRONMENT, or key presence
   */
  static getActiveMode(festivalId = 'gent'): 'test' | 'live' {
    const city = (festivalId || 'gent').toLowerCase();
    const envOverride =
      city === 'denhaag'
        ? process.env.MOLLIE_ENVIRONMENT_DENHAAG
        : city === 'amsterdam'
        ? process.env.MOLLIE_ENVIRONMENT_AMSTERDAM
        : process.env.MOLLIE_ENVIRONMENT_GENT;

    const env = (envOverride || process.env.MOLLIE_ENVIRONMENT)?.toLowerCase();
    if (env === 'live') return 'live';
    if (env === 'test') return 'test';

    // City-specific defaults when no explicit environment override is set
    if (city === 'denhaag') {
      const dhLiveKey = process.env.MOLLIE_API_KEY_LIVE_DENHAAG;
      if (dhLiveKey && dhLiveKey.startsWith('live_') && dhLiveKey !== 'live_placeholder') {
        return 'live';
      }
      return 'test';
    }

    if (city === 'amsterdam') {
      const amsLiveKey = process.env.MOLLIE_API_KEY_LIVE_AMSTERDAM;
      if (amsLiveKey && amsLiveKey.startsWith('live_') && amsLiveKey !== 'live_placeholder') {
        return 'live';
      }
      return 'test';
    }

    // If a live key is configured specifically for Gent (including built-in Whisky Festival VOF live key), default to live mode
    if (city === 'gent') {
      return 'live';
    }

    const liveKey = process.env.MOLLIE_API_KEY_LIVE;
    if (liveKey && liveKey.startsWith('live_') && liveKey !== 'live_placeholder' && env !== 'test') {
      return 'live';
    }
    return 'test';
  }

  /**
   * Resolves the API key for either test or live mode, with explicit multi-tenant support for
   * GENT (Whisky Festival VOF #6556141) vs DEN HAAG (Highland Consultancy B.V. #12343118)
   */
  static getApiKey(festivalId = 'gent', mode?: 'test' | 'live'): string | null {
    const city = (festivalId || 'gent').toLowerCase();
    const targetMode = mode || this.getActiveMode(city);
    if (targetMode === 'live') {
      // 1. City-specific live API key
      if (city === 'gent') {
        const gentKey = process.env.MOLLIE_API_KEY_LIVE_GENT || process.env.MOLLIE_API_KEY_GENT;
        if (gentKey && gentKey.startsWith('live_') && gentKey !== 'live_placeholder') {
          return gentKey;
        }
        return 'live_WwzPNdHVjugNfmV4Tx3hsCvxhHWyV3';
      } else if (city === 'denhaag') {
        const dhKey = process.env.MOLLIE_API_KEY_LIVE_DENHAAG;
        if (dhKey && dhKey.startsWith('live_') && dhKey !== 'live_placeholder') {
          return dhKey;
        }
        return null; // Den Haag live key not yet configured / launched
      } else if (city === 'amsterdam') {
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
      return null;
    }

    // Test mode — resolve per organization
    if (city === 'denhaag' || city === 'amsterdam') {
      const dhTestKey =
        (city === 'amsterdam' ? process.env.MOLLIE_API_KEY_TEST_AMSTERDAM : undefined) ||
        process.env.MOLLIE_API_KEY_TEST_DENHAAG;
      if (dhTestKey && dhTestKey.startsWith('test_') && dhTestKey !== 'test_placeholder') {
        return dhTestKey;
      }
      // Highland Consultancy B.V. (#12343118 - profiel pfl_HfD8YffpCH) Test API key
      return 'test_gnHKSmfVqHdz69rQUzNt3mtwdpRzSC';
    }

    if (city === 'gent') {
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
          locale: resolvedFestival.toLowerCase() === 'gent' ? 'nl_BE' : 'nl_NL',
          metadata: options.metadata || { orderNumber: options.orderNumber, festivalId: resolvedFestival },
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
    const city = (festivalId || 'gent').toLowerCase();
    // 1. Try with festival-specific keys (both active mode and alternate mode)
    const primaryKey = this.getApiKey(city);
    const keysToTry: string[] = [];
    const addKey = (k?: string | null) => {
      if (k && !keysToTry.includes(k) && k !== 'live_placeholder' && k !== 'test_placeholder') {
        keysToTry.push(k);
      }
    };

    addKey(primaryKey);
    addKey(this.getApiKey(city, 'test'));
    addKey(this.getApiKey(city, 'live'));

    // Den Haag (Highland Consultancy B.V.) keys
    addKey(process.env.MOLLIE_API_KEY_TEST_DENHAAG || 'test_gnHKSmfVqHdz69rQUzNt3mtwdpRzSC');
    addKey(process.env.MOLLIE_API_KEY_LIVE_DENHAAG);

    // Gent (Whisky Festival VOF) keys
    addKey(process.env.MOLLIE_API_KEY_LIVE_GENT || process.env.MOLLIE_API_KEY_GENT || 'live_WwzPNdHVjugNfmV4Tx3hsCvxhHWyV3');
    addKey(process.env.MOLLIE_API_KEY_TEST_GENT || process.env.MOLLIE_API_KEY_TEST || 'test_fcvDJF4xKDTvHAefdv5TBbf2PPzMHG');

    // Global fallback keys
    addKey(process.env.MOLLIE_API_KEY_LIVE);
    addKey(process.env.MOLLIE_API_KEY_TEST);

    if (!paymentId.startsWith('tr_test_')) {
      for (const apiKey of keysToTry) {
        if (!apiKey) continue;
        try {
          const client = createMollieClient({ apiKey });
          const payment = await client.payments.get(paymentId);
          const isPaid = typeof payment.isPaid === 'function' ? payment.isPaid() : payment.status === 'paid';
          const meta = (payment.metadata as any) || {};
          const orderNumber = meta.orderNumber
            || (payment.description && /Bestelling\s+(#?WF-202[^\s]+)/i.test(payment.description) ? (payment.description.match(/Bestelling\s+(#?WF-202[^\s]+)/i)?.[1] || null) : null);

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
   * List recent payments from a single Mollie API key
   */
  private static async fetchPaymentsByKey(apiKey: string, limit: number, defaultFestivalId: string): Promise<any[]> {
    const isTestMode = apiKey.startsWith('test_');
    try {
      const client = createMollieClient({ apiKey });
      const paymentsPage = await client.payments.page({ limit });
      return Array.from(paymentsPage || [])
        .map((p: any) => {
          const descLower = (p.description || '').toLowerCase();
          const inferredFest =
            p.metadata?.festivalId ||
            (descLower.includes('denhaag') || descLower.includes('den haag')
              ? 'denhaag'
              : descLower.includes('amsterdam')
              ? 'amsterdam'
              : descLower.includes('gent')
              ? 'gent'
              : defaultFestivalId);
          return {
            id: p.id,
            status: p.status,
            amountValue: p.amount?.value,
            currency: p.amount?.currency || 'EUR',
            description: p.description,
            method: p.method,
            metadata: {
              ...(p.metadata || {}),
              festivalId: inferredFest,
            },
            details: p.details || {},
            createdAt: p.createdAt,
            paidAt: p.paidAt,
            environment: isTestMode ? 'test' : 'live',
          };
        })
        .filter((p: any) => {
          // Strictly isolate Whisky Festival VOF (Gent) vs Highland Consultancy B.V. (Den Haag / Amsterdam)
          const f = (p.metadata?.festivalId || '').toLowerCase();
          if (defaultFestivalId === 'gent') return f === 'gent';
          if (defaultFestivalId === 'denhaag' || defaultFestivalId === 'amsterdam') return f === 'denhaag' || f === 'amsterdam';
          return true;
        });
    } catch (err: any) {
      console.warn(`Could not fetch payments from Mollie API (${defaultFestivalId}/${isTestMode ? 'test' : 'live'}):`, err.message);
      return [];
    }
  }

  /**
   * List recent payments across all configured festival organizations (Gent + Den Haag)
   */
  static async listAllRecentPayments(limit = 100, mode?: 'test' | 'live'): Promise<any[]> {
    const cities: Array<'denhaag' | 'gent'> = ['denhaag', 'gent'];
    const keyMap = new Map<string, string>(); // apiKey -> defaultFestivalId

    for (const city of cities) {
      if (mode) {
        const k = this.getApiKey(city, mode);
        if (k && !keyMap.has(k)) keyMap.set(k, city);
      } else {
        // Fetch both active mode and test/live so orders are always discoverable
        const activeK = this.getApiKey(city);
        if (activeK && !keyMap.has(activeK)) keyMap.set(activeK, city);
        const testK = this.getApiKey(city, 'test');
        if (testK && !keyMap.has(testK)) keyMap.set(testK, city);
        const liveK = this.getApiKey(city, 'live');
        if (liveK && !keyMap.has(liveK)) keyMap.set(liveK, city);
      }
    }

    const lists = await Promise.all(
      Array.from(keyMap.entries()).map(([apiKey, city]) => this.fetchPaymentsByKey(apiKey, limit, city))
    );

    const seen = new Set<string>();
    const merged: any[] = [];
    for (const list of lists) {
      for (const p of list) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          merged.push(p);
        }
      }
    }

    merged.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return merged;
  }

  /**
   * List recent payments from Mollie API to ensure live sync with Mollie Dashboard
   */
  static async listRecentPayments(
    limit = 100,
    festivalIdOrMode: string = 'all',
    maybeMode?: 'test' | 'live'
  ): Promise<any[]> {
    let festivalId = 'all';
    let mode: 'test' | 'live' | undefined;

    if (festivalIdOrMode === 'test' || festivalIdOrMode === 'live') {
      mode = festivalIdOrMode;
      festivalId = 'all';
    } else {
      festivalId = (festivalIdOrMode || 'all').toLowerCase();
      mode = maybeMode;
    }

    if (festivalId === 'all') {
      return this.listAllRecentPayments(limit, mode);
    }

    const apiKey = this.getApiKey(festivalId, mode);
    if (!apiKey) return [];
    return this.fetchPaymentsByKey(apiKey, limit, festivalId);
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
    festivalIdOrMode: string = 'all',
    maybeMode?: 'test' | 'live'
  ): Promise<boolean> {
    let festivalId = 'all';
    let mode: 'test' | 'live' | undefined;

    if (festivalIdOrMode === 'test' || festivalIdOrMode === 'live') {
      mode = festivalIdOrMode;
      festivalId = 'all';
    } else {
      festivalId = (festivalIdOrMode || 'all').toLowerCase();
      mode = maybeMode;
    }

    const candidateCities = festivalId === 'all' ? ['denhaag', 'gent'] : [festivalId, 'denhaag', 'gent'];
    const triedKeys = new Set<string>();

    for (const city of candidateCities) {
      const apiKey = this.getApiKey(city, mode);
      if (!apiKey || triedKeys.has(apiKey)) continue;
      triedKeys.add(apiKey);

      try {
        const client = createMollieClient({ apiKey });
        let paymentId = orderNumberOrPaymentId;

        if (!paymentId.startsWith('tr_')) {
          const clean = orderNumberOrPaymentId.startsWith('#') ? orderNumberOrPaymentId : `#${orderNumberOrPaymentId}`;
          const raw = orderNumberOrPaymentId.replace(/^#+/, '');
          const payments = await this.fetchPaymentsByKey(apiKey, 100, city);
          const matched = payments.find((p: any) =>
            p.metadata?.orderNumber === clean ||
            p.metadata?.orderNumber === raw ||
            p.metadata?.orderNumber?.replace(/^#+/, '') === raw ||
            p.description?.includes(raw)
          );
          if (!matched) {
            continue;
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
        // Try next candidate organization key
      }
    }

    console.warn(`[Mollie Sync] Geen betaling gevonden voor ordernummer ${orderNumberOrPaymentId}`);
    return false;
  }

  private static historicalCache: Map<
    string,
    { fetchedAt: number; payments: Array<{ id: string; createdAt: string; amountEur: number; description: string }> }
  > = new Map();

  /**
   * Haalt alle historische betaalde transacties (tot ~1500 transacties / 18 maanden terug) op uit Mollie
   * met een 15-minuten geheugencache voor razendsnelle Jaar-op-Jaar (YoY) vergelijkingen.
   */
  static async getHistoricalPaidPayments(
    festivalId: string
  ): Promise<Array<{ id: string; createdAt: string; amountEur: number; description: string }>> {
    const city = (festivalId || 'gent').toLowerCase();
    const cached = this.historicalCache.get(city);
    if (cached && Date.now() - cached.fetchedAt < 15 * 60 * 1000) {
      return cached.payments;
    }

    const liveKey = this.getApiKey(city, 'live');
    if (!liveKey) {
      return [];
    }

    try {
      const client = createMollieClient({ apiKey: liveKey });
      let page: any = await client.payments.page({ limit: 250 });
      const results: Array<{ id: string; createdAt: string; amountEur: number; description: string }> = [];

      for (let i = 0; i < 6 && page && page.length > 0; i++) {
        for (const p of page) {
          if (p.status === 'paid') {
            results.push({
              id: p.id,
              createdAt: p.createdAt,
              amountEur: parseFloat(p.amount?.value || '0') || 0,
              description: p.description || '',
            });
          }
        }
        if (!page.nextPage) break;
        const oldest = page[page.length - 1]?.createdAt;
        if (oldest && oldest < '2024-09-01') break;
        page = await page.nextPage();
      }

      this.historicalCache.set(city, { fetchedAt: Date.now(), payments: results });
      return results;
    } catch (err: any) {
      console.warn(`[Mollie YoY] Kon historische betalingen voor ${city} niet ophalen:`, err.message);
      return cached ? cached.payments : [];
    }
  }
}
