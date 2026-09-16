/**
 * Asynchrone Background Worker: Voorraad Vrijgave & Expired Orders
 * Controleert elke minuut op orders met status 'pending' waarvan de 15-minuten hold timer is verstreken.
 */

import { OrdersRepository } from './orders.repository.js';
import { db, checkDbConnection } from '../../db/index.js';
import * as schema from '../../db/schema.js';
import { eq, and, lt } from 'drizzle-orm';

let cleanupInterval: any = null;

export function startStockCleanupWorker(intervalMs = 60000): void {
  if (cleanupInterval) return;

  console.info('🕒 Whiskytix Stock Cleanup Worker gestart (elke 60 sec)...');

  cleanupInterval = setInterval(async () => {
    try {
      await runStockCleanup();
    } catch (err: any) {
      console.warn('Fout in stock cleanup worker:', err.message);
    }
  }, intervalMs);
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
        console.info(`[Stock Cleanup] Order ${order.orderNumber} is verlopen na 15 min. Voorraad vrijgegeven.`);

        // Update DB if connected
        try {
          const dbStatus = await checkDbConnection();
          if (dbStatus.ok) {
            await db.update(schema.orders)
              .set({ status: 'expired' })
              .where(eq(schema.orders.orderNumber, order.orderNumber));
          }
        } catch (e: any) {
          // ignore
        }
      }
    }
  }

  return { expiredCount };
}
