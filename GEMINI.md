# Whiskytix Design System & Styling Guide

Deze stijlgids is bindend voor alle frontend componenten, pagina's, modals, dropdowns en formulieren in Whiskytix.

## 1. Typografie & Lettertypen
- **Primaire UI Font**: Altijd `Plus Jakarta Sans` (`font-sans`).
- **Headings & Body**: Zorg dat `body` en alle containers `font-sans` overerven.
- **Geen onbedoeld monospace**: Gebruik `font-mono` **uitsluitend** voor verificatiehashes, raw QR payloads of database UUID's. Gebruik **nooit** `font-mono` voor e-mailadressen, gebruikersnamen, formuliervelden of reguliere statuslabels in popups en navigatie.
- **Display Font**: `Rye` (`font-display`) uitsluitend decoratief voor whisky-vintage koppen waar expliciet gewenst.

## 2. Kleurenpalet (Heritage Festival Palette)
- **Deep Emerald (Merkkleur)**: `#006448` (knoppen, actieve tabs, accents)
- **Parchment Background (Licht)**: `#FAF7F2` (hoofdachtergrond met subtiel dot-patroon)
- **Card Warm White**: `#FCFAF7` (kaarten, popups, modals, dropdowns)
- **Charcoal Ink (Tekst & Harde randen)**: `#1D1C1A` (primaire tekst, 2px borders, slagschaduwen)
- **Muted Sage / Text**: `#4c5752` (subtitels, secundaire labels)
- **Border Sage**: `#c1d4ce` (subtiele dividers, secundaire randen)
- **Border Dark**: `#8ba198` (badges, tags)
- **Whisky Gold**: `#caac8e` en `#e4d5c4` (accenten, highlights, avatar badges)

## 3. Tactiele Letterpress Knoppen & Kaarten (Den Haag Stijl)
- **Knoppen**:
  - Altijd voelbare 2px ink-rand: `border-2 border-[#1D1C1A]`
  - Harde retro schaduw: `shadow-[2px_2px_0px_rgba(29,28,26,0.9)]` (of `4px 4px` voor grote CTA's)
  - Hover-effect: lichte translatie met schaduwbehoud
- **Kaarten & Modals**:
  - Achtergrond: `#FCFAF7`
  - Stevige rand: `border-2 border-[#1D1C1A]` of `border-[#c1d4ce]`
  - Hoeken: consistent afgerond (`rounded` of `rounded-lg`)

## 4. Popups, Dropdowns & Modals
- **Consistente container**:
  - Achtergrond: `#FCFAF7`
  - Rand: `border-2 border-[#1D1C1A]`
  - Schaduw: `shadow-xl` of tactiele offset schaduw
- **Typografie in popups**:
  - Identiek font: `font-sans` met normale letterspacing voor namen en e-mails
  - Subtitels: `text-[#4c5752] text-xs` of `text-[10px]`
  - Rolbadges: `bg-[#d8e7e2] text-[#006448] uppercase tracking-wider text-[9px] font-extrabold border border-[#8ba198]`
- **Acties**:
  - Actieve menu-items: `bg-[#d8e7e2] text-[#006448]`
  - Gevaarlijke acties (zoals uitloggen of verwijderen): `text-red-800 hover:bg-red-50`

## 5. Schoonheid & Rust (Geen overbodige ruis)
- Geen onnodige gradients tenzij specifiek gevraagd.
- Geen rommelige voetnoten of overtollige badges op inlog- en formulierpagina's.
- Responsief: popups en formulieren moeten altijd binnen het scherm passen zonder ongewenste verticale overflows op laptops.
