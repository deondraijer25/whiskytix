# Whiskytix — Master Architectuur & Scherm-voor-Scherm Implementatieplan
*De Definitieve Blauwdruk voor het Nieuwe Whiskytix Project*

---

## 1. Executive Overview & Doelstelling

**Whiskytix** is het centrale, op maat gemaakte ticketing-, betaal- en toegangscontroleplatform voor de drie Weeske Whisky Festivals:
1. **Den Haag** (Grote Kerk — Est. 2000)
2. **Gent** (De Oude Vismijn — Est. 2004)
3. **Amsterdam** (Zuiderkerk — Est. 2025)

Het platform opereert als een **onafhankelijke centrale service** (`tickets.whiskyfestival.nl`) waar de drie frontend websites via beveiligde API's mee communiceren.

```
+---------------------------------------------------------------------------------------+
|                                    WHISKYTIX PLATFORM                                 |
|                                                                                       |
|   +--------------------------+  +--------------------------+  +-------------------+   |
|   | 1. Publieke API Engine   |  | 2. Admin Cockpit         |  | 3. Scanner PWA    |   |
|   | - Fastify REST Server    |  | - /admin/login           |  | - /scan           |   |
|   | - Mollie API & Webhooks  |  | - 3-Steden Dashboard     |  | - Camera Scanner  |   |
|   | - 15-min. Voorraad Lock  |  | - Bestellingen & Vouchers|  | - Offline Sync    |   |
|   | - PDF Vector Generator   |  | - Live Deurmonitor       |  | - Audio / Haptic  |   |
|   +--------------------------+  +--------------------------+  +-------------------+   |
|                                              |                                        |
|                     +------------------------v------------------------+               |
|                     | Supabase PostgreSQL Database (Met RLS & ACID)  |               |
|                     +-------------------------------------------------+               |
+---------------------------------------------------------------------------------------+
```

---

## 2. Sitemap & URL Routing Structuur

Het systeem kent een kristalheldere navigatiehiërarchie:

| Route | Toegangsrol | Doel van het Scherm |
| :--- | :--- | :--- |
| **`/admin/login`** | Publiek / Beveiligd | Inlogscherm voor beheerder & festivalorganisatie |
| **`/admin`** | Administrator | **Het Hoofddashboard:** 3-Steden Cockpit met omzet, trends en live stats |
| **`/admin/orders`** | Administrator | Zoeken naar kopers, orders inzien, e-tickets opnieuw mailen, annuleren |
| **`/admin/inventory`** | Administrator | Zaalcapaciteit per sessie beheren, masterclasses en uitverkocht-status |
| **`/admin/coupons`** | Administrator | Vouchers aanmaken (`WS-LID-2026`, actiecodes, percentages/bedragen) |
| **`/admin/guestlist`** | Administrator | Binnen 10 sec. gratis gasten-/standhouderskaarten aanmaken en mailen |
| **`/admin/door`** | Administrator | Live deurmonitor tijdens festivaldagen: instroomgrafiek en dubbel-scan alerts |
| **`/scan`** | Deurscanner (PIN) | Ultra-snelle mobiele camera-scanner voor vrijwilligers aan de kerkdeur |
| **`/api/checkout/initiate`** | Publieke API | Ontvangt winkelmandje van de websites en maakt Mollie betaalsessie aan |
| **`/api/webhooks/mollie`** | Mollie Service | Verwerkt betalingen, maakt `#WF-XXXXX` tickets aan en triggert mail |
| **`/api/scanner/manifest`** | Scanner API | Levert de 180 KB offline dataset van de sessie aan de telefoons |

---

## 3. Scherm-voor-Scherm Specificatie & Wireframes

### Scherm 1: De Login Pagina (`/admin/login`)
*Het eerste scherm dat de beheerder ziet. Luxe, betrouwbare uitstraling in festivalstijl (warm donker eikenhout en goud).*

```
+-----------------------------------------------------------------------------------+
|                                                                                   |
|                                   [ WHISKYTIX ]                                   |
|                        International Whisky Festival Cockpit                      |
|                                                                                   |
|            +---------------------------------------------------------+            |
|            |  INLOGGEN BEHEERDERSOMGEVING                            |            |
|            |  Veilige toegang tot Den Haag, Gent en Amsterdam        |            |
|            |                                                         |            |
|            |  E-mailadres:                                           |            |
|            |  [ beheer@whiskyfestival.nl                           ] |            |
|            |                                                         |            |
|            |  Wachtwoord:                                            |            |
|            |  [ •••••••••••••••••••••••••                    [Toon] ] |            |
|            |                                                         |            |
|            |  [X] Onthoud deze browser op dit apparaat               |            |
|            |                                                         |            |
|            |  +---------------------------------------------------+  |            |
|            |  |              INLOGGEN OP COCKPIT ->               |  |            |
|            |  +---------------------------------------------------+  |            |
|            |                                                         |            |
|            |  Wachtwoord vergeten? Neem contact op met de beheerder. |            |
|            +---------------------------------------------------------+            |
|                                                                                   |
|                         Beveiligd met Supabase Auth & RLS                         |
+-----------------------------------------------------------------------------------+
```
* **Beveiligingsfeatures op dit scherm:**
  - Rate-limiting (max. 5 pogingen per minuut om brute-force wachtwoordraden te blokkeren).
  - CSRF-token bescherming.
  - Na succesvolle login wordt een beveiligde JWT-sessiecookie (HttpOnly, Secure, SameSite) geplaatst en wordt de beheerder direct doorgestuurd naar `/admin`.

---

### Scherm 2: Het Hoofdscherm na Inloggen (`/admin` — 3-Steden Cockpit)
*Zodra de admin inlogt, ziet hij in één oogopslag de financiële en operationele status van alle 3 de festivals.*

```
====================================================================================================
 🥃 WHISKYTIX COCKPIT                                  [Festival: ALLE (3)]  [👤 Deon Draijer | Uitloggen]
 [Overzicht]   [Bestellingen]   [Zaalcapaciteit]   [Kortingscodes]   [Gastenlijst]   [Live Deurmonitor]
====================================================================================================

 FINANCIEEL OVERZICHT (TOTAAL OVER ALLE 3 FESTIVALS)
 +-------------------------+ +-------------------------+ +-------------------------+ +-------------------------+
 | TOTALE BRUTO OMZET      | | TOTAAL TICKETS VERKOCHT | | ACTIEVE BESTELLINGEN    | | GEMIDDELDE ORDERWAARDE  |
 | € 592.550,00            | | 10.350 / 13.550 (76.4%) | | 4.120 orders            | | € 143,82                |
 +-------------------------+ +-------------------------+ +-------------------------+ +-------------------------+

 ACTIEVE FESTIVAL EDITIES (KLIK OP EEN STAD VOOR DETAILS)
 --------------------------------------------------------------------------------------------------
 [1] DEN HAAG (25e Editie)          [2] AMSTERDAM                      [3] GENT
     13, 14 en 15 Nov 2026              2, 3 en 4 Okt 2026                 20, 21 en 22 Mrt 2027
     Locatie: Grote Kerk Den Haag       Locatie: Zuiderkerk Amsterdam      Locatie: De Oude Vismijn Gent
     Status:  🟢 KAARTVERKOOP LIVE      Status:  🟢 KAARTVERKOOP LIVE      Status:  🟡 VROEGBOEKING OPEN
     ------------------------------     ------------------------------     ------------------------------
     Omzet:       € 284.350,00          Omzet:       € 195.800,00          Omzet:       € 112.400,00
     Tickets:     4.850 / 5.850 (83%)   Tickets:     3.400 / 4.200 (81%)   Tickets:     2.100 / 3.500 (60%)
     VIP Vrijdag: UITVERKOCHT (850)     VIP Vrijdag: Bijna vol (92%)       VIP Vrijdag: 540 / 750 (72%)
     [Beheer Den Haag ->]               [Beheer Amsterdam ->]              [Beheer Gent ->]

 --------------------------------------------------------------------------------------------------
 RECENTE BESTELLINGEN (REALTIME MOLLIE TRANSACTIES)
 +-------------+----------------------+-------------+-------------------+----------+-----------+------------+
 | Order #     | Klantnaam            | Stad        | Aantal Items      | Bedrag   | Status    | Actie      |
 +-------------+----------------------+-------------+-------------------+----------+-----------+------------+
 | #WF-84392   | Pieter van Mechelen  | Gent        | 2x Regulier Zondag| € 110,00 | 🟢 Betaald| [Details]  |
 | #WF-84391   | Robert-Jan Bakker    | Den Haag    | 2x VIP + Tram 14u | € 188,00 | 🟢 Betaald| [Details]  |
 | #WF-84390   | Dennis Mulder        | Amsterdam   | 4x Entree Vrijdag | € 220,00 | 🟢 Betaald| [Details]  |
 | #WF-84389   | Marc Kalse           | Den Haag    | 1x Festivalfles   | €  79,50 | 🟡 In afw.| [Details]  |
 +-------------+----------------------+-------------+-------------------+----------+-----------+------------+
```

---

### Scherm 3: Bestellingen & Klantenbeheer (`/admin/orders`)
*Hier lost de beheerder alle klantvragen in seconden op.*

* **Zoekbalk bovenaan:** Typ naam, e-mailadres, telefoonnummer of `#WF-XXXXX`.
* **Order Detail Drawer (klikt op een bestelling):**
  - **Klantgegevens:** Naam, e-mail, telefoon, aankoopdatum.
  - **Bestelde Tickets:**
    - Ticket 1: `#WF-2026-84387-1` — *VIP Sessie Vrijdag (Deon Draijer)* — Status: **Geldig**
    - Ticket 2: `#WF-2026-84387-2` — *VIP Sessie Vrijdag (Gast van Deon)* — Status: **Geldig**
    - Ticket 3: `#WF-2026-84387-3` — *Haagsche Whiskytram 14:00 uur* — Status: **Geldig**
  - **Drie Snelle Knoppen:**
    1. ✉️ **"Verstuur Tickets Opnieuw per E-mail"** (Triggert direct een nieuwe mail via Resend).
    2. 📄 **"Download Alle E-Tickets (PDF)"** (Download direct de officiële printklare PDF).
    3. 🔄 **"Annuleren / Restitueren"** (Geeft voorraad direct terug en start optioneel Mollie refund).

---

### Scherm 4: Sessies & Capaciteit (`/admin/inventory`)
*Voorkomt teleurstellingen en overboekingen.*

* Overzicht per festivaldag (Vrijdag, Zaterdagmiddag, Zaterdagavond, Zondag).
* Per sessie een live voortgangsbalk:
  - `VIP Sessie Vrijdag: 850 / 850 (100%)` -> Schakelaar: **[UITVERKOCHT]** (Automatisch gelockt).
  - `Entree Vrijdagavond: 720 / 1.250 (57.6%)` -> Knop: `[Capaciteit Wijzigen]`.
* Masterclasses overzicht (20 tot 30 plaatsen per zaal): direct zien welke proeverij vol zit.

---

### Scherm 5: Kortingscodes & Vouchers (`/admin/coupons`)
*Beheer van acties en de Whisky Society leden.*

* **Knop: "+ Nieuwe Kortingscode Aanmaken":**
  - Code: `WS-LID-2026` of `EARLYBIRD-DH`.
  - Type: Percentage (bijv. `10%`) of Vast Bedrag (bijv. `€ 5,00`).
  - Toepassen op: *Alle Festivals* óf specifiek *Den Haag*.
  - Limiet: Maximaal 200 keer te gebruiken.
  - Geldig van / tot: Datumkiezer.
* **Tabel:** Zien hoe vaak een code al gebruikt is en hoeveel totale korting ermee is vergeven.

---

### Scherm 6: Live Deurmonitor (`/admin/door`)
*Draait op een laptop/tablet van de organisatie tijdens het festival.*

* **Grote Realtime Teller:** `1.042 / 1.250 bezoekers binnen (83.3%)`.
* **Instroom per kwartier grafiek:** Visualiseert de piekdrukte (bijv. 180 mensen tussen 13:00 en 13:15 uur).
* **Live Scan Feed:** Scrollende lijst van alle scans met poort en vrijwilligersnaam.
* **Duplicaat & Fraude Alert:** Bij een dubbele scan knippert het scherm rood en klinkt een zacht waarschuwingsgeluid met de details van de scanner en de poort.

---

### Scherm 7: De Deurscanner PWA (`/scan`)
*Draait op de smartphone van de vrijwilliger aan de kerkdeur.*

```
+-------------------------------------------------------+
|  🥃 WHISKYTIX SCANNER                [☁️ Online] [🔋] |
|  Grote Kerk Den Haag - Deur 1 (Hoofdingang)          |
|-------------------------------------------------------|
|                                                       |
|             +---------------------------+             |
|             |                           |             |
|             |      CAMERA SCAN-VENSTER  |             |
|             |      [ Richt op QR-code ] |             |
|             |                           |             |
|             +---------------------------+             |
|                                                       |
|             [ 💡 Zaklamp Aan/Uit ]                    |
|                                                       |
|  STATISTIEKEN DEZE SCANNER:                           |
|  Scans vandaag: 342 tickets                           |
|                                                       |
|  +-------------------------------------------------+  |
|  |           [🔍 Handmatig Zoeken op Naam/Code]    |  |
|  +-------------------------------------------------+  |
+-------------------------------------------------------+
```

* **Directe Feedback:**
  - 🟢 **GROEN (Hoge 'BEEP' + korte trilling):** *"GELDIG: Deon Draijer — VIP Sessie Vrijdag"*.
  - 🔴 **ROOD (Lage 'ZOEM' + dubbele lange trilling):** *"AL GESCAND om 13:14 uur bij Deur 1"*.
  - 🟠 **ORANJE (Waarschuwingstoon):** *"VERKEERDE SESSIE: Dit ticket is voor Zaterdag!"*.

---

## 4. Chronologisch Uitrolplan (Stap-voor-Stap Roadmap)

Wanneer we in de nieuwe chat van `whiskytix` beginnen, volgen we deze exacte chronologische fasering:

### FASE 1: De Kern, Database & Beveiliging (Stap 1 t/m 3)
* **Stap 1: Supabase PostgreSQL Connectie & Migraties**
  - Database tabellen provisionen via Drizzle ORM ([`src/db/schema.ts`](file:///c:/Users/deon_/Projecten/whiskytix/src/db/schema.ts)).
  - RLS (Row Level Security) activeren en atomic stock locks inrichten.
* **Stap 2: Authenticatie & Login Scherm (`/admin/login`)**
  - Inlogformulier bouwen met sessie-beveiliging en rate-limiting.
* **Stap 3: Het 3-Steden Cockpit Dashboard (`/admin`)**
  - De centrale overzichtskaarten voor Den Haag, Gent en Amsterdam renderen met realtime Supabase data.

### FASE 2: Mollie Betaalflow & Voorraadbeveiliging (Stap 4 t/m 6)
* **Stap 4: Fastify Checkout Endpoints (`/api/checkout/initiate`)**
  - Server-side prijsberekening, kortingscode validatie en 15-minuten voorraadreservering.
* **Stap 5: Mollie Webhook Handler (`/api/webhooks/mollie`)**
  - Idempotente webhook verwerking (voorkomt dubbele tickets) en orderstatus updates.
* **Stap 6: Koppeling met de Bestaande Festivalwinkels**
  - De winkelwagen drawer van Den Haag, Gent en Amsterdam koppelen aan de nieuwe Whiskytix API.

### FASE 3: Ticket Generatie, Mail & Scannen (Stap 7 t/m 9)
* **Stap 7: `@pdf-lib` Vintage Ticket & QR Generator**
  - Het prachtige vintage ticket met unieke cryptografische HMAC QR-code (#WF-XXXXX reeks) vector-perfect renderen.
* **Stap 8: E-mail Service (Resend / Postmark)**
  - Automatische bevestigingsmail met PDF bijlagen sturen naar de koper.
* **Stap 9: Scanner PWA (`/scan`) met Offline Caching**
  - Camera Barcode Detection API, IndexedDB persistent caching en het 3-laags Blackout Protocol.

### FASE 4: Live Testen & Go-Live (Stap 10)
* **Stap 10: Integrale Verificatie**
  - Testbetaling via Mollie Test Modus (iDEAL & Bancontact).
  - Test-scan bij de deur in zowel Online als Vliegtuigmodus (Offline).
  - Oplevering en overdracht naar live kaartverkoop.
