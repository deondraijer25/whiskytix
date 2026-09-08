import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { generateQrPngDataUrl } from './qr.service.js';
import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';

export interface TicketPdfOptions {
  ticketCode: string;
  orderNumber?: string;
  attendeeName?: string;
  cityName?: string;
  sessionTitle?: string;
  dateStr?: string;
  timeStr?: string;
  itemNumber?: string;
}

interface FestivalTheme {
  name: string;
  shortName: string;
  venue: string;
  address: string;
  transit: string;
  parking: string;
  established: string;
  edition: string;
  email: string;
  watermark: string;
  datesShort: string;
  defaultMonth: string;
  defaultDay: string;
  year: string;
  pillLocation: string;
  colors: {
    primary: string;       // Main brand accent (Royal Blue for Gent)
    accent: string;        // Gold / warm accent
    charcoal: string;      // Deep charred oak black (#1D1C1A)
    muted: string;         // Secondary muted sage / grey (#7A7268)
    parchment: string;     // Warm vintage cotton paper background (#FAF7F2)
    cardBg: string;        // Pure white card background (#FFFFFF)
    boxBorder: string;     // High-contrast tactile border (#1D1C1A)
    recessedBg: string;    // Recessed info box (#FAF7F2)
    recessedBorder: string;// Soft beige border (#E2D9CC)
    pillBg: string;        // Status pill background (#EBF3FB)
    pillBorder: string;    // Status pill border (#BFDBFE)
  };
}

const FESTIVAL_THEMES: Record<string, FestivalTheme> = {
  gent: {
    name: 'Gents Whisky Festival',
    shortName: 'Whisky Fest Gent',
    venue: 'De Oude Vismijn Gent',
    address: 'Rekelingestraat 5, 9000 Gent (Belgi\u00eb)',
    transit: 'Tram 1 of 4: halte Gravensteen (1 min. lopen)',
    parking: 'Parking Vrijdagmarkt of Sint-Michiels (5-7 min.)',
    established: 'EST. 2004',
    edition: 'Editie 2026',
    email: 'info@whiskyfestival.be',
    watermark: 'GWF',
    datesShort: '2, 3 en 4 Oktober 2026',
    defaultMonth: 'OKT',
    defaultDay: '02',
    year: '2026',
    pillLocation: 'SINT-VEERLEPLEIN 5, GENT',
    colors: {
      primary: '#1E3A8A',        // Gent Royal Blue (--whisky-gold-dark)
      accent: '#CAAC8E',         // Gent Vintage Beige/Gold (--whisky-gold)
      charcoal: '#1D1C1A',       // Charred oak cask black (--text-charcoal)
      muted: '#4C5752',          // Soft dark sage (--text-muted from Gent global.css)
      parchment: '#FAF7F2',      // Warm vintage cotton paper (--bg-parchment)
      cardBg: '#FFFFFF',         // Pure thick cotton white card
      boxBorder: '#1D1C1A',      // 2px solid letterpress border
      recessedBg: '#FAF7F2',     // Recessed meta box background
      recessedBorder: '#DED6C9', // Soft beige border (--border-color from Gent global.css)
      pillBg: '#EBF3FB',         // Status pill light blue (rgba(30, 58, 138, 0.08))
      pillBorder: '#BFDBFE',     // Status pill light blue border (rgba(30, 58, 138, 0.3))
    },
  },
  denhaag: {
    name: 'International Whisky Festival',
    shortName: 'Whisky Fest Den Haag',
    venue: 'Grote Kerk Den Haag',
    address: 'Rond de Grote Kerk 12, 2513 AM Den Haag',
    transit: 'Tram 2, 3 of 6: halte Grote Markt (2 min. lopen)',
    parking: 'Q-Park Grote Markt of Lutherse Burgwal',
    established: 'EST. 2000',
    edition: '25e Jubileum Editie',
    email: 'beheer@whiskyfestival.nl',
    watermark: 'WF',
    datesShort: '13, 14 en 15 November 2026',
    defaultMonth: 'NOV',
    defaultDay: '13',
    year: '2026',
    pillLocation: 'ROND DE GROTE KERK 12, DEN HAAG',
    colors: {
      primary: '#006448',        // Den Haag Pine Green
      accent: '#CAAC8E',         // Champagne Gold
      charcoal: '#171614',       // Charred Oak Charcoal
      muted: '#5A524A',          // Warm Muted Sage
      parchment: '#FAF7F2',      // Warm vintage paper
      cardBg: '#FFFFFF',         // Pure white card
      boxBorder: '#171614',      // Charred oak border
      recessedBg: '#FAF7F2',     // Recessed box
      recessedBorder: '#C1D4CE', // Soft sage border
      pillBg: '#E6F4EA',         // Soft green pill
      pillBorder: '#A8DAB5',     // Soft green border
    },
  },
  amsterdam: {
    name: 'Amsterdam Whisky Festival',
    shortName: 'Whisky Fest Amsterdam',
    venue: 'De Hallen Amsterdam',
    address: 'Hannie Dankbaarpassage 47, 1053 RT Amsterdam',
    transit: 'Tram 7 of 17: halte Ten Katemarkt (2 min.)',
    parking: 'ParkBee De Hallen of Q-Park Europarking',
    established: 'EST. 2025',
    edition: 'Editie 2027',
    email: 'info@whiskyfestival.nl',
    watermark: 'AMS',
    datesShort: 'Zaterdag 16 januari 2027',
    defaultMonth: 'JAN',
    defaultDay: '16',
    year: '2027',
    pillLocation: 'HANNIE DANKBAARPASSAGE 47, AMS',
    colors: {
      primary: '#8C0223',        // Amsterdam Crimson Red
      accent: '#CAAC8E',         // Warm Gold
      charcoal: '#1E1C1A',       // Anthracite Black
      muted: '#4B4642',          // Warm Muted Charcoal
      parchment: '#FAF7F2',      // Warm paper
      cardBg: '#FFFFFF',         // Pure white card
      boxBorder: '#1E1C1A',      // Anthracite border
      recessedBg: '#FAF7F2',     // Recessed box
      recessedBorder: '#E8D5D5', // Soft crimson border
      pillBg: '#FCE8EC',         // Soft red pill
      pillBorder: '#F5B7C2',     // Soft red border
    },
  },
};

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

/**
 * Loads and rasterizes the official festival logo SVG to a high-res PNG buffer
 */
function getFestivalLogoPng(cityKey: string): Buffer | null {
  const possiblePaths = [
    path.join(process.cwd(), 'src', 'assets', 'logos', `logo-${cityKey}.svg`),
    path.join(process.cwd(), 'dist', 'assets', 'logos', `logo-${cityKey}.svg`),
    path.join(process.cwd(), 'public', `logo-${cityKey}.svg`),
    'c:\\Users\\deon_\\Projecten\\Whisky Festivals\\gent\\src\\assets\\Logo\\Logo.svg',
    'c:\\Users\\deon_\\Projecten\\Whisky Festivals\\gent\\src\\assets\\Logo\\FINAL LOGO GENT\\Gent normaal.svg',
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const svgContent = fs.readFileSync(p, 'utf8');
        const resvg = new Resvg(svgContent, { fitTo: { mode: 'height', value: 200 } });
        return Buffer.from(resvg.render().asPng());
      } catch (err) {
        console.error(`Error rasterizing SVG logo for ${cityKey}:`, err);
      }
    }
  }
  return null;
}

export async function generateTicketPdf(options: TicketPdfOptions): Promise<Uint8Array> {
  const {
    ticketCode = '#WF-2026-84387-1',
    orderNumber = 'WF1861',
    attendeeName = 'Deon Draijer',
    cityName = 'gent',
    sessionTitle = 'VIP SESSIE \u2014 VRIJDAG',
    timeStr = '13:30 - 17:30 UUR',
    itemNumber = '1/1',
  } = options;

  // Resolve specific festival branding
  const cityKey = cityName.toLowerCase().includes('gent')
    ? 'gent'
    : cityName.toLowerCase().includes('amsterdam')
    ? 'amsterdam'
    : 'denhaag';

  const theme = FESTIVAL_THEMES[cityKey];

  // Resolve dates per festival and session
  const titleLower = sessionTitle.toLowerCase();
  let month = theme.defaultMonth;
  let day = theme.defaultDay;

  if (cityKey === 'gent') {
    month = 'OKT';
    if (titleLower.includes('vrijdag')) day = '02';
    else if (titleLower.includes('zondag')) day = '04';
    else if (titleLower.includes('zaterdag')) day = '03';
    else day = '02';
  } else if (cityKey === 'denhaag') {
    month = 'NOV';
    if (titleLower.includes('vrijdag')) day = '13';
    else if (titleLower.includes('zondag')) day = '15';
    else if (titleLower.includes('zaterdag')) day = '14';
  } else if (cityKey === 'amsterdam') {
    month = 'JAN';
    day = '16';
  }

  // Generate high-resolution cryptographic HMAC QR code PNG
  const qrDataUrl = await generateQrPngDataUrl({
    ticketCode,
    cityName: cityKey,
    sessionTitle,
    attendeeName,
  }, 400);

  const qrBase64 = qrDataUrl.split(',')[1];
  const qrBytes = Buffer.from(qrBase64, 'base64');

  // Load official festival logo PNG
  const logoBytes = getFestivalLogoPng(cityKey);

  // Create PDF Document (Single Portrait A4: 595.28 x 841.89 pt)
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  // Fonts
  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontHelveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const fontTimesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  // Embed QR Image
  const qrImage = await pdfDoc.embedPng(qrBytes);

  // Embed Logo Image if available
  let logoImage = null;
  if (logoBytes) {
    try {
      logoImage = await pdfDoc.embedPng(logoBytes);
    } catch (e) {
      console.warn('Could not embed logo image:', e);
    }
  }

  // Brand Color Tokens
  const colorPrimary = hexToRgb(theme.colors.primary);
  const colorCharcoal = hexToRgb(theme.colors.charcoal);
  const colorMuted = hexToRgb(theme.colors.muted);
  const colorParchment = hexToRgb(theme.colors.parchment);
  const colorWhite = hexToRgb(theme.colors.cardBg);
  const colorRecessedBg = hexToRgb(theme.colors.recessedBg);
  const colorRecessedBorder = hexToRgb(theme.colors.recessedBorder);
  const colorPillBg = hexToRgb(theme.colors.pillBg);
  const colorPillBorder = hexToRgb(theme.colors.pillBorder);
  const colorGold = hexToRgb(theme.colors.accent);

  // 1. FULL PAGE BACKGROUND: Warm Vintage Cotton Paper (#FAF7F2)
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: colorParchment,
  });

  // Page Margins: 30 pt left and right gives 535.28 pt usable width
  const marginX = 30;
  const contentW = width - marginX * 2; // 535.28 pt

  // =========================================================================
  // 2. TOP FESTIVAL HEADER CARD: Crisp, Official, No Promo Fluff
  // =========================================================================
  const headerH = 56;
  const headerX = marginX;
  const headerY = height - 28 - headerH; // 841.89 - 28 - 56 = 757.89 pt

  // Hard Tactile Drop Shadow (3px offset)
  page.drawRectangle({
    x: headerX + 3,
    y: headerY - 3,
    width: contentW,
    height: headerH,
    color: colorCharcoal,
  });

  // White Card Surface with 2px solid Charcoal Border
  page.drawRectangle({
    x: headerX,
    y: headerY,
    width: contentW,
    height: headerH,
    color: colorWhite,
    borderColor: colorCharcoal,
    borderWidth: 2,
  });

  // Left: Official Circular Full-Color Logo
  let textStartX = headerX + 14;
  if (logoImage) {
    const logoDisplayH = 42;
    const logoDisplayW = (logoImage.width / logoImage.height) * logoDisplayH;
    page.drawImage(logoImage, {
      x: headerX + 10,
      y: headerY + (headerH - logoDisplayH) / 2,
      width: logoDisplayW,
      height: logoDisplayH,
    });
    textStartX = headerX + 10 + logoDisplayW + 12;
  }

  // Festival Title (10 pt bold)
  page.drawText(theme.name.toUpperCase(), {
    x: textStartX,
    y: headerY + 31,
    size: 10,
    font: fontHelveticaBold,
    color: colorCharcoal,
  });

  // Festival Metadata Subtitle (8 pt)
  page.drawText(`${theme.edition}  \u2022  ${theme.venue}  \u2022  ${theme.datesShort}`, {
    x: textStartX,
    y: headerY + 15,
    size: 8,
    font: fontHelvetica,
    color: colorMuted,
  });

  // Right Side: Order Number (10 pt bold) & Status (8 pt)
  const orderRefText = `BESTELLING #${orderNumber}`;
  const orderRefW = fontHelveticaBold.widthOfTextAtSize(orderRefText, 10);
  page.drawText(orderRefText, {
    x: headerX + contentW - 14 - orderRefW,
    y: headerY + 31,
    size: 10,
    font: fontHelveticaBold,
    color: colorPrimary,
  });

  const ticketCountText = `Officieel Toegangsbewijs  \u2022  Volgnr. ${itemNumber}`;
  const ticketCountW = fontHelvetica.widthOfTextAtSize(ticketCountText, 8);
  page.drawText(ticketCountText, {
    x: headerX + contentW - 14 - ticketCountW,
    y: headerY + 15,
    size: 8,
    font: fontHelvetica,
    color: colorMuted,
  });

  // =========================================================================
  // 3. MAIN TICKET CARD: Layout met QR in het Midden Boven
  // =========================================================================
  const cardW = contentW;
  const cardH = 348;
  const cardX = marginX;
  const cardY = headerY - 14 - cardH; // 757.89 - 14 - 348 = 395.89 pt

  // Hard Tactile Drop Shadow (4px offset)
  page.drawRectangle({
    x: cardX + 4,
    y: cardY - 4,
    width: cardW,
    height: cardH,
    color: colorCharcoal,
  });

  // Main Card Body (Pure White, 2px solid black border)
  page.drawRectangle({
    x: cardX,
    y: cardY,
    width: cardW,
    height: cardH,
    color: colorWhite,
    borderColor: colorCharcoal,
    borderWidth: 2,
  });

  // --- STUB AREA (Top section of ticket card: QR in het midden boven, height 160 pt) ---
  const stubH = 160;
  const stubY = cardY + cardH - stubH; // 583.89 pt

  // Stub Background (#FAF7F2 vintage paper)
  page.drawRectangle({
    x: cardX + 2,
    y: stubY,
    width: cardW - 4,
    height: stubH - 2,
    color: colorParchment,
  });

  // Perforated horizontal dashed line (2px dashed #1D1C1A)
  for (let x = cardX + 8; x < cardX + cardW - 8; x += 9) {
    page.drawLine({
      start: { x, y: stubY },
      end: { x: x + 5, y: stubY },
      thickness: 1.75,
      color: colorCharcoal,
    });
  }

  // Label: CONTROLE STUB (8 pt bold)
  const labelStub = 'CONTROLE STUB';
  const labelStubW = fontHelveticaBold.widthOfTextAtSize(labelStub, 8);
  page.drawText(labelStub, {
    x: cardX + (cardW - labelStubW) / 2,
    y: cardY + cardH - 18,
    size: 8,
    font: fontHelveticaBold,
    color: colorMuted,
  });

  // QR Code Box (White with 1.5px solid border and 2px drop shadow, centered)
  const qrBoxSize = 98;
  const qrBoxX = cardX + (cardW - qrBoxSize) / 2;
  const qrBoxY = cardY + cardH - 122;

  page.drawRectangle({
    x: qrBoxX + 2,
    y: qrBoxY - 2,
    width: qrBoxSize,
    height: qrBoxSize,
    color: colorCharcoal,
  });

  page.drawRectangle({
    x: qrBoxX,
    y: qrBoxY,
    width: qrBoxSize,
    height: qrBoxSize,
    color: colorWhite,
    borderColor: colorCharcoal,
    borderWidth: 1.5,
  });

  // Centered QR Code
  const qrImgSize = 88;
  page.drawImage(qrImage, {
    x: qrBoxX + (qrBoxSize - qrImgSize) / 2,
    y: qrBoxY + (qrBoxSize - qrImgSize) / 2,
    width: qrImgSize,
    height: qrImgSize,
  });

  // SCAN BIJ DE DEUR (10 pt bold)
  const labelScan = 'SCAN BIJ DE DEUR';
  const labelScanW = fontHelveticaBold.widthOfTextAtSize(labelScan, 10);
  page.drawText(labelScan, {
    x: cardX + (cardW - labelScanW) / 2,
    y: cardY + cardH - 138,
    size: 10,
    font: fontHelveticaBold,
    color: colorPrimary,
  });

  // Formatted Ticket Code in Charcoal (10 pt bold)
  const formattedCode = ticketCode.startsWith('#') ? ticketCode : `#${ticketCode}`;
  const codeW = fontHelveticaBold.widthOfTextAtSize(formattedCode, 10);
  page.drawText(formattedCode, {
    x: cardX + (cardW - codeW) / 2,
    y: cardY + cardH - 152,
    size: 10,
    font: fontHelveticaBold,
    color: colorCharcoal,
  });

  // --- DETAILS AREA (Bottom section of ticket card, height 188 pt) ---

  // Subdued Watermark (GWF) in HelveticaBold with 3.5% opacity
  page.drawText(theme.watermark, {
    x: cardX + cardW - 120,
    y: cardY + 24,
    size: 70,
    font: fontHelveticaBold,
    color: colorPrimary,
    opacity: 0.035,
  });

  // 1. Date Badge & Org Info Row
  const dateBadgeSize = 42;
  const dateBadgeX = cardX + 20;
  const dateBadgeY = stubY - 52; // 531.89 pt

  page.drawRectangle({
    x: dateBadgeX,
    y: dateBadgeY,
    width: dateBadgeSize,
    height: dateBadgeSize,
    color: colorCharcoal,
    borderColor: colorCharcoal,
    borderWidth: 1.5,
  });

  // Month (Gold, 8 pt bold)
  const monthText = month.toUpperCase();
  const monthW = fontHelveticaBold.widthOfTextAtSize(monthText, 8);
  page.drawText(monthText, {
    x: dateBadgeX + (dateBadgeSize - monthW) / 2,
    y: dateBadgeY + dateBadgeSize - 13,
    size: 8,
    font: fontHelveticaBold,
    color: colorGold,
  });

  // Day (White, 16 pt HelveticaBold - 100% sans-serif!)
  const dayW = fontHelveticaBold.widthOfTextAtSize(day, 16);
  page.drawText(day, {
    x: dateBadgeX + (dateBadgeSize - dayW) / 2,
    y: dateBadgeY + 7,
    size: 16,
    font: fontHelveticaBold,
    color: colorWhite,
  });

  // Org Info next to badge
  const orgX = dateBadgeX + dateBadgeSize + 12;
  page.drawText(`${theme.established}  \u2022  ${theme.edition.toUpperCase()}`, {
    x: orgX,
    y: dateBadgeY + dateBadgeSize - 11,
    size: 8,
    font: fontHelveticaBold,
    color: colorPrimary,
  });

  // Festival Name (10 pt HelveticaBold)
  page.drawText(theme.name, {
    x: orgX,
    y: dateBadgeY + dateBadgeSize - 24,
    size: 10,
    font: fontHelveticaBold,
    color: colorCharcoal,
  });

  // Venue location (8 pt)
  page.drawText(`${theme.venue}  \u2022  ${theme.address}`, {
    x: orgX,
    y: dateBadgeY + dateBadgeSize - 37,
    size: 8,
    font: fontHelvetica,
    color: colorMuted,
  });

  // Status Pill Badge (Top right of session row)
  const pillW = 146;
  const pillH = 22;
  const pillX = cardX + cardW - 20 - pillW;
  const pillY = dateBadgeY + dateBadgeSize - 22;

  page.drawRectangle({
    x: pillX,
    y: pillY,
    width: pillW,
    height: pillH,
    color: colorPillBg,
    borderColor: colorPillBorder,
    borderWidth: 1,
  });

  // Vector checkmark inside status pill
  page.drawLine({
    start: { x: pillX + 11, y: pillY + 10 },
    end: { x: pillX + 14, y: pillY + 7 },
    thickness: 1.5,
    color: colorPrimary,
  });
  page.drawLine({
    start: { x: pillX + 14, y: pillY + 7 },
    end: { x: pillX + 19, y: pillY + 15 },
    thickness: 1.5,
    color: colorPrimary,
  });

  page.drawText('GELDIG TOEGANGSBEWIJS', {
    x: pillX + 25,
    y: pillY + 7,
    size: 8,
    font: fontHelveticaBold,
    color: colorPrimary,
  });

  // 2. Divider line between Org and Session
  const dividerY = dateBadgeY - 10;
  for (let x = cardX + 18; x < cardX + cardW - 18; x += 6) {
    page.drawLine({
      start: { x, y: dividerY },
      end: { x: x + 2.5, y: dividerY },
      thickness: 1,
      color: colorRecessedBorder,
    });
  }

  // 3. Session Title (16 pt HelveticaBold - 100% UNIFORM MET GENTS WHISKY FESTIVAL!)
  const sessionY = dividerY - 19;
  page.drawText(sessionTitle.toUpperCase(), {
    x: cardX + 20,
    y: sessionY,
    size: 16,
    font: fontHelveticaBold,
    color: colorCharcoal,
  });

  // Schedule subtitle (10 pt HelveticaBold)
  const scheduleY = sessionY - 14;
  const dayName = titleLower.includes('vrijdag')
    ? 'VRIJDAG'
    : titleLower.includes('zondag')
    ? 'ZONDAG'
    : titleLower.includes('zaterdag')
    ? 'ZATERDAG'
    : (cityKey === 'amsterdam' ? 'ZATERDAG' : 'VRIJDAG');
  page.drawText(`${dayName} ${day} ${month} ${theme.year}  \u2022  ${timeStr.toUpperCase()}`, {
    x: cardX + 20,
    y: scheduleY,
    size: 10,
    font: fontHelveticaBold,
    color: colorPrimary,
  });

  // 4. Recessed 3-Column Metadata Box (.ticket-meta-trio)
  const metaBoxY = cardY + 28;
  const metaBoxH = 44;
  const metaBoxW = cardW - 40;
  const metaBoxX = cardX + 20;

  page.drawRectangle({
    x: metaBoxX,
    y: metaBoxY,
    width: metaBoxW,
    height: metaBoxH,
    color: colorRecessedBg,
    borderColor: colorRecessedBorder,
    borderWidth: 1,
  });

  // Column 1: Kaarthouder (Label: 8 pt, Value: 10 pt)
  const meta1X = metaBoxX + 14;
  page.drawText('KAARTHOUDER', { x: meta1X, y: metaBoxY + 27, size: 8, font: fontHelveticaBold, color: colorMuted });
  page.drawText(attendeeName, { x: meta1X, y: metaBoxY + 11, size: 10, font: fontHelveticaBold, color: colorCharcoal });

  // Column 2: Locatie (Label: 8 pt, Value: 10 pt)
  const meta2X = metaBoxX + 175;
  page.drawText('LOCATIE', { x: meta2X, y: metaBoxY + 27, size: 8, font: fontHelveticaBold, color: colorMuted });
  page.drawText(theme.venue, { x: meta2X, y: metaBoxY + 11, size: 10, font: fontHelveticaBold, color: colorCharcoal });

  // Column 3: Ticket Code (Label: 8 pt, Value: 10 pt in Gent Royal Blue)
  const meta3X = metaBoxX + 345;
  page.drawText('TICKET CODE', { x: meta3X, y: metaBoxY + 27, size: 8, font: fontHelveticaBold, color: colorMuted });
  page.drawText(formattedCode, { x: meta3X, y: metaBoxY + 11, size: 10, font: fontHelveticaBold, color: colorPrimary });

  // 5. Disclaimer Text (8 pt)
  page.drawText('* Toegang uitsluitend voor personen van 18 jaar en ouder. Legitimatie verplicht bij de entree.', {
    x: cardX + 20,
    y: cardY + 11,
    size: 8,
    font: fontHelveticaOblique,
    color: colorMuted,
  });

  // =========================================================================
  // 4. PRAKTISCHE FESTIVALINFORMATIE (Geen vouwteksten, strak & symmetrisch)
  // =========================================================================
  const infoHeaderY = cardY - 20; // 375.89 pt

  page.drawText('PRAKTISCHE FESTIVALINFORMATIE', {
    x: marginX,
    y: infoHeaderY,
    size: 10,
    font: fontHelveticaBold,
    color: colorCharcoal,
  });

  const orderMetaStr = `Ticket ${itemNumber}  \u2022  Bestelling #${orderNumber}`;
  const orderMetaW = fontHelvetica.widthOfTextAtSize(orderMetaStr, 8);
  page.drawText(orderMetaStr, {
    x: width - marginX - orderMetaW,
    y: infoHeaderY,
    size: 8,
    font: fontHelvetica,
    color: colorMuted,
  });

  page.drawLine({
    start: { x: marginX, y: infoHeaderY - 6 },
    end: { x: width - marginX, y: infoHeaderY - 6 },
    thickness: 1,
    color: colorRecessedBorder,
  });

  // 3 Symmetrische Info Cards (100% gelijke hoogte 175 pt)
  const colGap = 12;
  const colW = (contentW - colGap * 2) / 3; // 170.42 pt
  const colH = 175;
  const colY = infoHeaderY - 14 - colH; // 181.89 pt

  function drawSymmetricCard(x: number, y: number, w: number, h: number) {
    page.drawRectangle({
      x: x + 3,
      y: y - 3,
      width: w,
      height: h,
      color: colorCharcoal,
    });
    page.drawRectangle({
      x,
      y,
      width: w,
      height: h,
      color: colorWhite,
      borderColor: colorCharcoal,
      borderWidth: 2,
    });
  }

  // --- CARD 1: ADRES & PARKEREN ---
  const box1X = marginX;
  drawSymmetricCard(box1X, colY, colW, colH);

  page.drawText('ADRES & PARKEREN', { x: box1X + 12, y: colY + colH - 18, size: 10, font: fontHelveticaBold, color: colorCharcoal });
  page.drawLine({ start: { x: box1X + 12, y: colY + colH - 24 }, end: { x: box1X + colW - 12, y: colY + colH - 24 }, thickness: 0.75, color: colorRecessedBorder });

  page.drawText(theme.venue, { x: box1X + 12, y: colY + colH - 38, size: 8, font: fontHelveticaBold, color: colorCharcoal });
  page.drawText(
    `Adres:\n${theme.address}\n\nOpenbaar Vervoer:\n${theme.transit}\n\nParkeergelegenheid:\n${theme.parking}`,
    {
      x: box1X + 12,
      y: colY + colH - 52,
      size: 8,
      font: fontHelvetica,
      color: colorMuted,
      lineHeight: 11,
    }
  );

  const pill1W = colW - 24;
  const pill1H = 22;
  const pill1Y = colY + 12;

  page.drawRectangle({ x: box1X + 12, y: pill1Y, width: pill1W, height: pill1H, color: colorRecessedBg, borderColor: colorRecessedBorder, borderWidth: 1 });
  const pill1Text = theme.pillLocation;
  const pill1TextW = fontHelveticaBold.widthOfTextAtSize(pill1Text, 8);
  page.drawText(pill1Text, { x: box1X + 12 + (pill1W - pill1TextW) / 2, y: pill1Y + 7, size: 8, font: fontHelveticaBold, color: colorPrimary });

  // --- CARD 2: SCHENKTIJDEN & 18+ ---
  const box2X = box1X + colW + colGap;
  drawSymmetricCard(box2X, colY, colW, colH);

  page.drawText('SCHENKTIJDEN & REGELS', { x: box2X + 12, y: colY + colH - 18, size: 10, font: fontHelveticaBold, color: colorCharcoal });
  page.drawLine({ start: { x: box2X + 12, y: colY + colH - 24 }, end: { x: box2X + colW - 12, y: colY + colH - 24 }, thickness: 0.75, color: colorRecessedBorder });

  page.drawText('Strikte NIX18 Controle', { x: box2X + 12, y: colY + colH - 38, size: 8, font: fontHelveticaBold, color: colorCharcoal });
  page.drawText(
    `Laatste Ronde:\n15 minuten voor einde sessie stopt\nhet inschenken van alle whisky's.\n\nLegitimatiecontrole:\nStrikte 18+ controle bij de entree.\nNeem een geldig paspoort, ID of\nrijbewijs mee.`,
    {
      x: box2X + 12,
      y: colY + colH - 52,
      size: 8,
      font: fontHelvetica,
      color: colorMuted,
      lineHeight: 11,
    }
  );

  page.drawRectangle({ x: box2X + 12, y: pill1Y, width: pill1W, height: pill1H, color: colorRecessedBg, borderColor: colorRecessedBorder, borderWidth: 1 });
  const pill2Text = 'NIX18 GECONTROLEERD';
  const pill2TextW = fontHelveticaBold.widthOfTextAtSize(pill2Text, 8);
  page.drawText(pill2Text, { x: box2X + 12 + (pill1W - pill2TextW) / 2, y: pill1Y + 7, size: 8, font: fontHelveticaBold, color: colorPrimary });

  // --- CARD 3: FESTIVAL SLIJTERIJ ---
  const box3X = box2X + colW + colGap;
  drawSymmetricCard(box3X, colY, colW, colH);

  page.drawText('FESTIVAL SLIJTERIJ', { x: box3X + 12, y: colY + colH - 18, size: 10, font: fontHelveticaBold, color: colorCharcoal });
  page.drawLine({ start: { x: box3X + 12, y: colY + colH - 24 }, end: { x: box3X + colW - 12, y: colY + colH - 24 }, thickness: 0.75, color: colorRecessedBorder });

  page.drawText('Stand 48 in Festivalhal', { x: box3X + 12, y: colY + colH - 38, size: 8, font: fontHelveticaBold, color: colorCharcoal });
  page.drawText(
    `Exclusieve Bottelingen:\nKoop unieke festivalbottelingen en\nfavoriete flessen direct ter plekke.\n\nBetaalmogelijkheden:\nZowel PIN als contant mogelijk.\n\nDrams (Proefmunten):\nVerkrijgbaar bij de festivalkassa`,
    {
      x: box3X + 12,
      y: colY + colH - 52,
      size: 8,
      font: fontHelvetica,
      color: colorMuted,
      lineHeight: 11,
    }
  );

  page.drawRectangle({ x: box3X + 12, y: pill1Y, width: pill1W, height: pill1H, color: colorRecessedBg, borderColor: colorRecessedBorder, borderWidth: 1 });
  const pill3Text = 'STAND 48  \u2022  PIN & CONTANT';
  const pill3TextW = fontHelveticaBold.widthOfTextAtSize(pill3Text, 8);
  page.drawText(pill3Text, { x: box3X + 12 + (pill1W - pill3TextW) / 2, y: pill1Y + 7, size: 8, font: fontHelveticaBold, color: colorPrimary });

  // =========================================================================
  // 5. FOOTER
  // =========================================================================
  const footerLineY = colY - 16;
  page.drawLine({
    start: { x: marginX, y: footerLineY },
    end: { x: width - marginX, y: footerLineY },
    thickness: 1,
    color: colorRecessedBorder,
  });

  page.drawText('INCLUSIEF OFFICIEEL GLENCAIRN PROEFGLAS BIJ BINNENKOMST', {
    x: marginX,
    y: footerLineY - 14,
    size: 8,
    font: fontHelveticaBold,
    color: colorPrimary,
  });

  const emailInfo = `Vragen over uw bestelling? Mail ${theme.email}`;
  const emailW = fontHelvetica.widthOfTextAtSize(emailInfo, 8);
  page.drawText(emailInfo, {
    x: width - marginX - emailW,
    y: footerLineY - 14,
    size: 8,
    font: fontHelvetica,
    color: colorMuted,
  });

  return await pdfDoc.save();
}
