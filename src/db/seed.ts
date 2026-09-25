import bcrypt from 'bcryptjs';
import { db, queryClient } from './index.js';
import { festivals, users, sessions, ticketTypes } from './schema.js';

export async function runSeed() {
  console.log('🥃 Whiskytix Seeding Starten...');

  try {
    // 1. Seed de 3 steden (Festivals)
    console.log('Seeden van festivals: Den Haag, Gent, Amsterdam...');
    await db.insert(festivals).values([
      {
        id: 'denhaag',
        name: 'International Whisky Festival Den Haag',
        city: 'Den Haag',
        currency: 'EUR',
        supportEmail: 'tickets@whiskyfestival.nl',
      },
      {
        id: 'gent',
        name: 'International Whisky Festival Gent',
        city: 'Gent',
        currency: 'EUR',
        supportEmail: 'tickets@gentwhisky.be',
      },
      {
        id: 'amsterdam',
        name: 'Whisky Weekend Amsterdam',
        city: 'Amsterdam',
        currency: 'EUR',
        supportEmail: 'tickets@whiskyamsterdam.nl',
      },
    ]).onConflictDoNothing();

    // 2. Seed Sessions & Ticket Types voor Den Haag
    console.log('Seeden van sessies en ticket types...');
    const dhSessionVrijdag = await db.insert(sessions).values({
      festivalId: 'denhaag',
      name: 'Vrijdagavond Sessie',
      date: '2026-11-13',
      startTime: '19:00',
      endTime: '23:00',
      capacityMax: 1500,
      capacitySold: 0,
      isActive: true,
    }).onConflictDoNothing().returning();

    const dhSessionZaterdag = await db.insert(sessions).values({
      festivalId: 'denhaag',
      name: 'Zaterdagavond Sessie',
      date: '2026-11-14',
      startTime: '19:00',
      endTime: '23:00',
      capacityMax: 1500,
      capacitySold: 0,
      isActive: true,
    }).onConflictDoNothing().returning();

    // 3. Seed Ticket Types
    await db.insert(ticketTypes).values([
      {
        id: 'ticket-zat-avond',
        festivalId: 'denhaag',
        category: 'entree',
        title: 'Zaterdagavond Entreeticket',
        subtitle: 'Inclusief proefglas en festivalgids',
        priceCents: 4400,
        vatRate: 21,
        totalAvailable: 1500,
        totalSold: 0,
        maxPerOrder: 10,
        isAddon: false,
      },
      {
        id: 'ticket-vrij-avond',
        festivalId: 'denhaag',
        category: 'entree',
        title: 'Vrijdagavond Entreeticket',
        subtitle: 'Inclusief proefglas en festivalgids',
        priceCents: 4400,
        vatRate: 21,
        totalAvailable: 1500,
        totalSold: 0,
        maxPerOrder: 10,
        isAddon: false,
      },
      {
        id: 'ticket-gent-regulier',
        festivalId: 'gent',
        category: 'entree',
        title: 'Gent Regulier Entreeticket',
        subtitle: 'Toegang tot De Oude Vismijn Gent',
        priceCents: 4500,
        vatRate: 21,
        totalAvailable: 1000,
        totalSold: 0,
        maxPerOrder: 10,
        isAddon: false,
      },
      {
        id: 'ticket-ams-regulier',
        festivalId: 'amsterdam',
        category: 'entree',
        title: 'Amsterdam Weekend Entreeticket',
        subtitle: 'Toegang tot Zuiderkerk Amsterdam',
        priceCents: 4750,
        vatRate: 21,
        totalAvailable: 800,
        totalSold: 0,
        maxPerOrder: 10,
        isAddon: false,
      },
    ]).onConflictDoNothing();

    // 4. Seed Superadmin Gebruiker
    console.log('Seeden van beheerder (beheer@whiskyfestival.nl)...');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('whisky2026', salt);

    await db.insert(users).values({
      email: 'beheer@whiskyfestival.nl',
      passwordHash,
      role: 'admin',
      pinCode: '2026',
    }).onConflictDoNothing();

    console.log('✅ Seeding succesvol voltooid!');
  } catch (err: any) {
    console.error('❌ Fout bij seeden:', err.message);
  } finally {
    await queryClient.end();
  }
}

// Draai als direct script
if (process.argv[1]?.includes('seed.ts') || process.argv[1]?.includes('seed.js')) {
  runSeed();
}
