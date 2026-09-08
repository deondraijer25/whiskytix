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

    // 2. Seed Superadmin Gebruiker
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
