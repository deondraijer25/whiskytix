# 🥃 Whiskytix — Ticketing & Door Scanning Platform

Proprietary multi-city ticketing, payment & access control engine voor de **Weeske Whisky Festivals**:
- **Den Haag** (Grote Kerk, Est. 2000)
- **Gent** (De Oude Vismijn, Est. 2004)
- **Amsterdam** (Zuiderkerk, Est. 2025)

## 📌 Architectuur & Documentatie
De volledige blauwdruk, databaseschema's en het offline scanning 'Blackout Protocol' zijn te vinden in:
👉 [ARCHITECTURE.md](./ARCHITECTURE.md)

## 🚀 Snelle Start
1. Installeer dependencies:
   `ash
   npm install
   `
2. Kopieer omgevingsvariabelen:
   `ash
   cp .env.example .env
   `
3. Start ontwikkelserver:
   `ash
   npm run dev
   `

## 📂 Mappenstructuur
- src/db/: Supabase & Drizzle ORM schema's, migraties en connectie
- src/modules/checkout/: Mollie API integratie, webhook handler, 15-minuten voorraadvergrendeling
- src/modules/tickets/: Cryptografische QR code minting, @pdf-lib vector generator (#WF-XXXXX reeks)
- src/modules/scanner/: Offline-first PWA scanner engine, IndexedDB synchronisatie, geluid/haptische feedback
- src/modules/admin/: Multi-city 3-events dashboard, capaciteitsbeheer, kortingscodes, CSV export
- src/api/: Fastify REST API endpoints voor de festivalwebsites
