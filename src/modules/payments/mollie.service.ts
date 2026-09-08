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
  private static getApiKey(): string | null {
    const key = process.env.MOLLIE_API_KEY_TEST || process.env.MOLLIE_API_KEY_LIVE;
    if (key && key.startsWith('test_') && key !== 'test_placeholder') {
      return key;
    }
    return null;
  }

  /**
   * Creates a payment session via official Mollie API or local interactive sandbox
   */
  static async createPayment(options: CreatePaymentOptions): Promise<PaymentInitResult> {
    const apiKey = this.getApiKey();
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
   * Verifies whether a payment has succeeded
   */
  static async verifyPayment(
    paymentId: string
  ): Promise<{ isPaid: boolean; orderNumber?: string; method?: string; error?: string }> {
    const apiKey = this.getApiKey();

    if (apiKey && !paymentId.startsWith('tr_test_')) {
      try {
        const client = createMollieClient({ apiKey });
        const payment = await client.payments.get(paymentId);
        return {
          isPaid: payment.isPaid(),
          orderNumber: (payment.metadata as any)?.orderNumber,
          method: payment.method as string,
        };
      } catch (err: any) {
        return { isPaid: false, error: err.message };
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
  static async listRecentPayments(limit = 25): Promise<any[]> {
    const apiKey = this.getApiKey();
    if (!apiKey) return [];

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
        createdAt: p.createdAt,
        paidAt: p.paidAt,
      }));
    } catch (err: any) {
      console.warn('Could not fetch payments from Mollie API:', err.message);
      return [];
    }
  }
}
