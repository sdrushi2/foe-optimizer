// ─────────────────────────────────────────────────────────────────────────────
//  utils/dispositivo.ts — Dispositivi dove bacchetta e ponte non possono servire
//
//  (25/11/2026, utente) Sul telefono e sul tablet la bacchetta magica e
//  l'indicatore del ponte (LIVE/OFF) non servono mai: si nascondono solo dove
//  siamo SICURI che non possano funzionare, cioè su Android e iOS/iPadOS.
//   - La bacchetta è un preferito (bookmarklet) da cliccare nella scheda del
//     gioco con FoE Helper o Forge Hammer: su Android e iOS FoE si gioca con
//     l'app, e quei due helper non esistono per i browser da telefono.
//   - Il ponte è un'estensione desktop (Chrome/Edge/Opera/Brave/Vivaldi,
//     Firefox in prova).
//  Contano il SISTEMA OPERATIVO, non lo schermo né il touch: un PC Windows
//  touch, un Surface senza tastiera o un Chromebook restano computer (Chrome con
//  estensioni) e vedono tutto. Se un giorno il ponte rispondesse anche da un
//  dispositivo di questi (Firefox per Android accetta estensioni), l'indicatore
//  e la bacchetta tornano: lo decide chi usa questo valore (Testata).
//  Casi:
//   - Android (telefono, tablet, anche con "sito desktop" richiesto: lo dice
//     userAgentData.platform; il testo dello user agent in quel caso finge Linux);
//   - iPhone / iPod;
//   - iPad: in Safari si presenta come un Mac ("Macintosh"), ma un Mac non ha
//     il touch a più dita: Macintosh + maxTouchPoints > 1 = iPad.
// ─────────────────────────────────────────────────────────────────────────────

interface UaData { platform?: string; mobile?: boolean }

function calcola(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const uad = (navigator as Navigator & { userAgentData?: UaData }).userAgentData;
  if (uad && (uad.platform === "Android" || uad.platform === "iOS" || uad.mobile === true)) return true;
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return true;
  if (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1) return true;   // iPad in modalità desktop
  return false;
}

/** true su Android e iOS/iPadOS: niente bacchetta né indicatore del ponte (salvo ponte presente). */
export const senzaEstensioni: boolean = calcola();
