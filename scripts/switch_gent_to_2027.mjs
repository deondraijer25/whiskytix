// scripts/switch_gent_to_2027.mjs
// Whiskytix helper om na 4 oktober 2026 de PDF service en orders repo terug te zetten naar 2027

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1. pdf.service.ts
const pdfServiceFile = path.resolve(__dirname, '../src/modules/tickets/pdf.service.ts');
if (fs.existsSync(pdfServiceFile)) {
  let content = fs.readFileSync(pdfServiceFile, 'utf8');
  content = content.replace(/edition: '25e Editie',/g, "edition: '26e Editie',");
  content = content.replace(/datesShort: '2, 3 en 4 Oktober 2026',/g, "datesShort: '1, 2 en 3 Oktober 2027',");
  content = content.replace(/year: '2026',/g, "year: '2027',");
  content = content.replace(/defaultDay: '02',/g, "defaultDay: '01',");
  content = content.replace(/year = year \|\| '2026';/g, "year = year || '2027';");
  content = content.replace(
    `    if (!day) {
      if (dayName === 'VRIJDAG') day = '02';
      else if (dayName === 'ZATERDAG') day = '03';
      else if (dayName === 'ZONDAG') day = '04';
      else day = '02';
    }`,
    `    if (!day) {
      if (dayName === 'VRIJDAG') day = '01';
      else if (dayName === 'ZATERDAG') day = '02';
      else if (dayName === 'ZONDAG') day = '03';
      else day = '01';
    }`
  );
  fs.writeFileSync(pdfServiceFile, content, 'utf8');
  console.log('✓ pdf.service.ts bijgewerkt naar 2027');
}

// 2. orders.repository.ts
const ordersRepoFile = path.resolve(__dirname, '../src/modules/orders/orders.repository.ts');
if (fs.existsSync(ordersRepoFile)) {
  let content = fs.readFileSync(ordersRepoFile, 'utf8');
  content = content.replace(/Zondag 4 oktober 2026/g, 'Zondag 3 oktober 2027');
  content = content.replace(/Vrijdag 2 oktober 2026/g, 'Vrijdag 1 oktober 2027');
  content = content.replace(/Afhalen Festival \(2-4 okt 2026\)/g, 'Afhalen Festival (1-3 okt 2027)');
  content = content.replace(/Zaterdag 3 oktober 2026/g, 'Zaterdag 2 oktober 2027');
  fs.writeFileSync(ordersRepoFile, content, 'utf8');
  console.log('✓ orders.repository.ts bijgewerkt naar 2027');
}

console.log('Whiskytix switch naar 2027 voltooid.');
