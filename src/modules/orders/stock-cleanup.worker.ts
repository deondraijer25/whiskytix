/**
 * Asynchrone Background Worker: Voorraad Vrijgave & Expired Orders
 * Controleert elke minuut op orders met status 'pending' waarvan de 15-minuten hold timer is verstreken.
 */

import { OrdersRepository } from './orders.repository.js';
import { ConscriboService } from '../conscribo/conscribo.service.js';
import { db, checkDbConnection } from '../../db/index.js';
import * as schema from '../../db/schema.js';
import { eq, and, lt } from 'drizzle-orm';

let cleanupInterval: any = null;

export function startStockCleanupWorker(intervalMs = 60000): void {
  // On Vercel Serverless, /api/cron/stock-cleanup handles periodic cleanup
  if (process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined) {
    return;
  }
  if (cleanupInterval) return;

  console.info('🕒 Whiskytix Stock Cleanup Worker gestart (elke 60 sec)...');

  cleanupInterval = setInterval(async () => {
    try {
      await runStockCleanup();
    } catch (err: any) {
      console.warn('Fout in stock cleanup worker:', err.message);
    }
  }, intervalMs);

  if (cleanupInterval && typeof cleanupInterval.unref === 'function') {
    cleanupInterval.unref();
  }
}

export function stopStockCleanupWorker(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

export async function runStockCleanup(): Promise<{ expiredCount: number }> {
  const now = new Date();
  const allOrders = OrdersRepository.listOrders();
  let expiredCount = 0;

  for (const order of allOrders) {
    if (order.status === 'pending') {
      const expiresAtDate = new Date(order.expiresAt);
      if (!isNaN(expiresAtDate.getTime()) && expiresAtDate < now) {
        order.status = 'expired';
        expiredCount++;
        await ConscriboService.releaseClaimByOrderNumber(order.orderNumber);
        console.info(`[Stock Cleanup] Order ${order.orderNumber} is verlopen na 15 min. Voorraad vrijgegeven.`);

        // Update DB if connected (ONLY if still 'pending' in DB — never overwrite 'paid'!)
        try {
          const dbStatus = await checkDbConnection();
          if (dbStatus.ok) {
            await db.update(schema.orders)
              .set({ status: 'expired' })
              .where(and(eq(schema.orders.orderNumber, order.orderNumber), eq(schema.orders.status, 'pending')));
          }
        } catch (e: any) {
          // ignore
        }
      }
    }
  }

  // Also expire any pending orders in Supabase DB across serverless instances
  try {
    const dbStatus = await checkDbConnection();
    if (dbStatus.ok) {
      const expiredDbRows = await db
        .update(schema.orders)
        .set({ status: 'expired' })
        .where(and(eq(schema.orders.status, 'pending'), lt(schema.orders.expiresAt, now)))
        .returning({ orderNumber: schema.orders.orderNumber });

      for (const row of expiredDbRows) {
        expiredCount++;
        await ConscriboService.releaseClaimByOrderNumber(row.orderNumber);
      }
    }
  } catch (e: any) {
    // ignore
  }

  return { expiredCount };
}
