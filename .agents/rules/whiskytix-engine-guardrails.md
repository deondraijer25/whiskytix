---
trigger: always_on
description: Strikte richtlijnen en kwaliteitscontroles voor het Whiskytix ticketing platform (orders, tickets, admin cockpit, Mollie en build lifecycle).
---

# Whiskytix Ticketing & Scanning Platform Guardrails

Bij het ontwikkelen, uitbreiden of debuggen van de Whiskytix backend en het admin dashboard gelden de volgende verplichte regels:

## 1. Chronologische Order Sortering (Nieuwste Altijd Bovenaan)
- Bestellingen moeten in ELKE weergave (zowel in de backend API als in de frontend React tabellen en streams) **altijd chronologisch aflopend** gesorteerd worden op aanmaakdatum (`createdAt`).
- Gebruik altijd de parser invariant:
  ```typescript
  orders.sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime() || 0;
    const timeB = new Date(b.createdAt).getTime() || 0;
    return timeB - timeA;
  });
  ```
- Een nieuw geplaatste bestelling moet ALTIJD op rij #1 (bovenaan) verschijnen.

## 2. 1-op-1 Multi-Ticket Expansie Invariant
- **Geen Geaggregeerde Ticket Rijen:**
  - Wanneer een klant N tickets koopt (bijvoorbeeld 6x Entreeticket Vrijdag), MOETEN er exact N unieke e-tickets gegenereerd en getoond worden: `#WF-YYYY-XXXXX-1` t/m `#WF-YYYY-XXXXX-N`.
  - Het is ten strengste verboden om bij multi-ticket bestellingen slechts 0 of 1 ticketbadge te tonen met de tekst "Geen individuele toegangskaarten voor deze bestelling".
- **Individuele PDF Download & HMAC Beveiliging:**
  - Elk individueel ticket krijgt een eigen HMAC signature (`qrPayloadHash`), geldige status (`valid`), en een directe werkende PDF endpoint link:
    `/api/tickets/:ticketCode/pdf?city=:city&name=:name&title=:title&orderNumber=:orderNumber`
- **Fallback Expansie:**
  - Als een order uit de database of store wordt geladen zonder vooraf gegenereerde tickets (bijv. sync via webhook), moet de accessor de tickets automatisch dynamisch expanderen op basis van het aantal in `itemsSummary` (`/(\d+)x/`) of het orderbedrag.

## 3. Dual-Build & TypeScript Server Lifecycle
- Whiskytix bestaat uit een Vite client en een Fastify TypeScript backend:
  - `npm run build` voert altijd uit: `vite build && tsc -p tsconfig.server.json`.
- **TypeScript Enum Strictness:**
  - Vaste velden zoals `ticket.status` (`'valid' | 'checked_in' | 'cancelled'`) en `order.city` (`'denhaag' | 'amsterdam' | 'gent'`) vereisen strikte literal types. Gebruik expliciete type assertions om build errors bij `tsc` te voorkomen.
- **Server Herstart:**
  - Na elke backend wijziging moet de server gehercompileerd worden met `npx tsc -p tsconfig.server.json` en herstart met `node dist/index.js`.

## 4. Resilient Mollie Synchronisatie
- In serverless of lokale fallback modi waarin orders tussen herstarts in een JSON store (`.data/orders-store.json`) worden bewaard, zorgt `MollieService.listRecentPayments()` voor live synchronisatie.
- Bij het inlezen van betalingen zonder volledige metadata:
  - Bepaal automatisch het type ticket en aantal aan de hand van het bedrag (€ 44 = 1 ticket, € 259,50 = 6 tickets, etc.).
  - Ken altijd de juiste klantnaam en festival toe zodat de admin cockpit nooit lege of corrupte rijen toont.
