export interface FestivalCatalogItem {
  id: string;
  city: 'gent' | 'denhaag' | 'amsterdam';
  category: 'entree' | 'masterclass' | 'special';
  title: string;
  dateStr: string;
  timeStr: string;
  originalPriceEur: number;
  location: string;
  description?: string;
}

export const FESTIVAL_CATALOG: FestivalCatalogItem[] = [
  // --- GENT (De Oude Vismijn • 2, 3 & 4 okt 2026) ---
  {
    id: 'gent-entree-vrijdagavond',
    city: 'gent',
    category: 'entree',
    title: 'Entree Vrijdagavond',
    dateStr: 'Vrijdag 2 oktober 2026',
    timeStr: '19:00 - 23:00 uur',
    originalPriceEur: 42.50,
    location: 'De Oude Vismijn, Gent',
    description: 'Officiële opening van het Gents Whisky Festival met proefglas & gids.'
  },
  {
    id: 'gent-entree-zaterdagmiddag',
    city: 'gent',
    category: 'entree',
    title: 'Entree Zaterdagmiddag',
    dateStr: 'Zaterdag 3 oktober 2026',
    timeStr: '13:00 - 17:00 uur',
    originalPriceEur: 42.50,
    location: 'De Oude Vismijn, Gent',
    description: 'Populaire middagsessie in De Oude Vismijn.'
  },
  {
    id: 'gent-entree-zaterdagavond',
    city: 'gent',
    category: 'entree',
    title: 'Entree Zaterdagavond',
    dateStr: 'Zaterdag 3 oktober 2026',
    timeStr: '19:00 - 23:00 uur',
    originalPriceEur: 42.50,
    location: 'De Oude Vismijn, Gent',
    description: 'Sfeervolle zaterdagavondproeverij met internationale distilleerders.'
  },
  {
    id: 'gent-entree-zondagmiddag',
    city: 'gent',
    category: 'entree',
    title: 'Entree Zondagmiddag',
    dateStr: 'Zondag 4 oktober 2026',
    timeStr: '13:00 - 17:00 uur',
    originalPriceEur: 42.50,
    location: 'De Oude Vismijn, Gent',
    description: 'Ontspannen zondagmiddagsessie met zeldzame drams.'
  },
  {
    id: 'gent-mc-dada-chapel-vrijdag',
    city: 'gent',
    category: 'masterclass',
    title: 'Dada Chapel Distillery Masterclass',
    dateStr: 'Vrijdag 2 oktober 2026',
    timeStr: '20:00 - 20:45 uur',
    originalPriceEur: 20.00,
    location: 'MC-Ruimte (De Oude Vismijn)',
    description: 'Lokale biologische distillatiekunst en experimentele vatmonsters.'
  },
  {
    id: 'gent-mc-cvh-whisky-zaterdag',
    city: 'gent',
    category: 'masterclass',
    title: 'CVH Whisky Masterclass',
    dateStr: 'Zaterdag 3 oktober 2026',
    timeStr: '12:15 - 13:00 uur',
    originalPriceEur: 20.00,
    location: 'MC-Ruimte (De Oude Vismijn)',
    description: 'Zeldzame Schotse single cask selecties met CVH specialist.'
  },
  {
    id: 'gent-mc-dada-chapel-zaterdag',
    city: 'gent',
    category: 'masterclass',
    title: 'Dada Chapel Distillery Masterclass (Middag)',
    dateStr: 'Zaterdag 3 oktober 2026',
    timeStr: '13:45 - 14:30 uur',
    originalPriceEur: 20.00,
    location: 'MC-Ruimte (De Oude Vismijn)',
    description: 'Middagsessie met Gentse distillatie-innovatie en proeverij.'
  },
  {
    id: 'gent-mc-fettercairn-zaterdag',
    city: 'gent',
    category: 'masterclass',
    title: 'Fettercairn Single Malt Masterclass',
    dateStr: 'Zaterdag 3 oktober 2026',
    timeStr: '15:00 - 15:45 uur',
    originalPriceEur: 20.00,
    location: 'MC-Ruimte (De Oude Vismijn)',
    description: 'Highland single malts en de unieke koperen koelring-techniek.'
  },
  {
    id: 'gent-mc-bowmore-zaterdag',
    city: 'gent',
    category: 'masterclass',
    title: 'Bowmore Islay Single Malt Masterclass',
    dateStr: 'Zaterdag 3 oktober 2026',
    timeStr: '19:30 - 20:15 uur',
    originalPriceEur: 20.00,
    location: 'MC-Ruimte (De Oude Vismijn)',
    description: 'Legendarische Islay turf & sherry cask drams uit No. 1 Vaults.'
  },
  {
    id: 'gent-mc-belgian-owl-zondag',
    city: 'gent',
    category: 'masterclass',
    title: 'Belgian Owl Distillery Masterclass',
    dateStr: 'Zondag 4 oktober 2026',
    timeStr: '13:30 - 14:15 uur',
    originalPriceEur: 20.00,
    location: 'MC-Ruimte (De Oude Vismijn)',
    description: 'Belgische terroir whisky van topniveau met Etienne Bouillon.'
  },
  {
    id: 'gent-mc-glenfiddich-zondag',
    city: 'gent',
    category: 'masterclass',
    title: 'Glenfiddich & The Balvenie Tasting',
    dateStr: 'Zondag 4 oktober 2026',
    timeStr: '15:00 - 15:45 uur',
    originalPriceEur: 20.00,
    location: 'MC-Ruimte (De Oude Vismijn)',
    description: 'Vergelijk twee iconische Dufftown zuster-distilleerderijen.'
  },

  // --- DEN HAAG (Grote Kerk • 13, 14 & 15 nov 2026) ---
  {
    id: 'dh-entree-vrijdag-vip',
    city: 'denhaag',
    category: 'special',
    title: 'VIP Sessie - Vrijdagmiddag',
    dateStr: 'Vrijdag 13 november 2026',
    timeStr: '13:00 - 17:00 uur',
    originalPriceEur: 79.50,
    location: 'Grote Kerk, Den Haag',
    description: 'Exclusieve openingssessie met zeldzame tastings en VIP lounge.'
  },
  {
    id: 'dh-entree-vrijdagavond',
    city: 'denhaag',
    category: 'entree',
    title: 'Entree Vrijdagavond',
    dateStr: 'Vrijdag 13 november 2026',
    timeStr: '19:00 - 23:00 uur',
    originalPriceEur: 55.00,
    location: 'Grote Kerk, Den Haag',
    description: 'Vrijdagavond festivaltoegang inclusief festivalglas en gids.'
  },
  {
    id: 'dh-entree-zaterdagmiddag',
    city: 'denhaag',
    category: 'entree',
    title: 'Entree Zaterdagmiddag',
    dateStr: 'Zaterdag 14 november 2026',
    timeStr: '13:00 - 17:00 uur',
    originalPriceEur: 55.00,
    location: 'Grote Kerk, Den Haag',
    description: 'De grote zaterdagmiddagproeverij in de historische Grote Kerk.'
  },
  {
    id: 'dh-entree-zaterdagavond',
    city: 'denhaag',
    category: 'entree',
    title: 'Entree Zaterdagavond',
    dateStr: 'Zaterdag 14 november 2026',
    timeStr: '19:00 - 23:00 uur',
    originalPriceEur: 55.00,
    location: 'Grote Kerk, Den Haag',
    description: 'Avondsfeer, honderden whisky’s en live Schotse doedelzakken.'
  },
  {
    id: 'dh-entree-zaterdag-vip',
    city: 'denhaag',
    category: 'special',
    title: 'VIP Toegang Zaterdag',
    dateStr: 'Zaterdag 14 november 2026',
    timeStr: '13:00 - 17:00 uur',
    originalPriceEur: 79.50,
    location: 'Grote Kerk, Den Haag',
    description: 'Zaterdag VIP arrangement met exclusieve pourings.'
  },
  {
    id: 'dh-entree-zondagmiddag',
    city: 'denhaag',
    category: 'entree',
    title: 'Entree Zondagmiddag',
    dateStr: 'Zondag 15 november 2026',
    timeStr: '13:00 - 17:00 uur',
    originalPriceEur: 55.00,
    location: 'Grote Kerk, Den Haag',
    description: 'Gemoedelijke zondag met alle standhouders en tastings.'
  },
  {
    id: 'dh-mc-macallan-inc',
    city: 'denhaag',
    category: 'masterclass',
    title: 'The Macallan Exclusive (Inc. Torenklim)',
    dateStr: 'Zaterdag 14 november 2026',
    timeStr: '14:00 - 16:00 uur',
    originalPriceEur: 77.50,
    location: 'Grote Kerk Toren & Tasting Room',
    description: 'Sherry Cask Single Malts inclusief torenbeklimming.'
  },
  {
    id: 'dh-mc-macallan-ex',
    city: 'denhaag',
    category: 'masterclass',
    title: 'The Macallan Exclusive Tasting',
    dateStr: 'Zaterdag 14 november 2026',
    timeStr: '19:30 - 20:30 uur',
    originalPriceEur: 70.00,
    location: 'Grote Kerk Tasting Room',
    description: 'Zeldzame Macallan bottelingen in intieme setting.'
  },
  {
    id: 'dh-mc-teeling',
    city: 'denhaag',
    category: 'masterclass',
    title: 'Teeling Irish Whiskey Masterclass',
    dateStr: 'Vrijdag 13 november 2026',
    timeStr: '20:00 - 20:45 uur',
    originalPriceEur: 20.00,
    location: 'Grote Kerk Tasting Room',
    description: 'Dublin’s craft renaissance en bekroonde single pot still whiskeys.'
  },
  {
    id: 'dh-mc-intro',
    city: 'denhaag',
    category: 'masterclass',
    title: 'Whisky Introductie Tasting',
    dateStr: 'Zaterdag 14 november 2026',
    timeStr: '13:30 - 14:15 uur',
    originalPriceEur: 7.50,
    location: 'Nutshuis Spaarkamer',
    description: 'Basis nosing & tasting voor beginnende whiskyliefhebbers.'
  },
  {
    id: 'dh-special-tram',
    city: 'denhaag',
    category: 'special',
    title: 'Whiskytram Historische Rit & Tasting',
    dateStr: 'Zondag 15 november 2026',
    timeStr: '14:00 - 15:30 uur',
    originalPriceEur: 45.00,
    location: 'Historische Tram Den Haag',
    description: 'Rijdende whiskyproeverij door historisch Den Haag en Scheveningen.'
  },

  // --- AMSTERDAM (Zuiderkerk • 16 jan 2027) ---
  {
    id: 'ams-entree-zaterdagmiddag',
    city: 'amsterdam',
    category: 'entree',
    title: 'Weekend Entree Zaterdagmiddag',
    dateStr: 'Zaterdag 16 januari 2027',
    timeStr: '13:00 - 17:00 uur',
    originalPriceEur: 47.50,
    location: 'Zuiderkerk, Amsterdam',
    description: 'Opening van het Amsterdamse Whisky Festival.'
  },
  {
    id: 'ams-entree-zaterdagavond',
    city: 'amsterdam',
    category: 'entree',
    title: 'Weekend Entree Zaterdagavond',
    dateStr: 'Zaterdag 16 januari 2027',
    timeStr: '18:30 - 22:30 uur',
    originalPriceEur: 47.50,
    location: 'Zuiderkerk, Amsterdam',
    description: 'Zaterdagavondproeverij in de monumentale Zuiderkerk.'
  },
  {
    id: 'ams-entree-vip',
    city: 'amsterdam',
    category: 'special',
    title: 'VIP Exclusief Weekend Ticket',
    dateStr: 'Zaterdag 16 januari 2027',
    timeStr: '13:00 - 17:00 uur',
    originalPriceEur: 75.00,
    location: 'Zuiderkerk, Amsterdam',
    description: 'VIP toegang met exclusieve lounge en vintage tasting.'
  },
  {
    id: 'ams-mc-vintage',
    city: 'amsterdam',
    category: 'masterclass',
    title: 'Vintage & Rare Single Malts Masterclass',
    dateStr: 'Zaterdag 16 januari 2027',
    timeStr: '15:00 - 16:00 uur',
    originalPriceEur: 25.00,
    location: 'Zuiderkerk Tasting Room',
    description: 'Exclusieve proeverij van oude en zeldzame vatgebottelde whisky’s.'
  },
];

export function getFestivalCatalog(city: 'gent' | 'denhaag' | 'amsterdam'): FestivalCatalogItem[] {
  return FESTIVAL_CATALOG.filter((item) => item.city === city);
}
