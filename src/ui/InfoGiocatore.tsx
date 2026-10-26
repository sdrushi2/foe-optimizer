// ─────────────────────────────────────────────────────────────────────────────
//  ui/InfoGiocatore.tsx — Gruppo "Giocatore" del nastro (FoE Optimizer 2.0)
//
//  Primo gruppo del nastro nelle schede della città (Città, Inventario,
//  Alleati, Planner con la città selezionata): avatar, nome, era e ID
//  del giocatore della città selezionata (o del giocatore visitato; la città
//  visitata si riconosce dall'occhio nel selettore, qui solo nel suggerimento). Prende il
//  posto della vecchia riga "avatar + era" sopra la tabella. Colori del nastro.
//  In modo S (nastro stretto) resta solo l'avatar, con tutto nel suggerimento.
// ─────────────────────────────────────────────────────────────────────────────

import type { ModoGruppo } from "./ribbon/Ribbon";
import { t, type UiLang } from "../data/ui-strings";

export interface DatiGiocatore {
  nome: string;
  /** URL dell'avatar (già validato); null = avatar sconosciuto. */
  avatar: string | null;
  era: string | null;
  id: number | null;
  visitata: boolean;
  /** 2.0: giocatore letto da un file JSON (Planner): l'avatar non c'è per costruzione. */
  daJson?: boolean;
}

/** Avatar generico di FoE (stesso della 1.x) quando manca quello vero. */
const AVATAR_SCONOSCIUTO = "https://foezz.innogamescdn.com/assets/shared/avatars/portrait_unknown-9d9c1d859.jpg";

export function BloccoGiocatore({ g, modo, uiLang }: { g: DatiGiocatore; modo: ModoGruppo; uiLang: UiLang }) {
  const dettagli = g.id !== null ? `ID ${g.id}` : "";
  const titolo = [g.nome, g.era, dettagli, g.visitata ? t("r2VisitedCity", uiLang) : null].filter(Boolean).join("\n");
  const avatar = (
    <img src={g.avatar ?? AVATAR_SCONOSCIUTO} alt=""
      title={g.avatar ? undefined : t(g.daJson ? "r2AvatarJson" : "avatarOutdatedTitle", uiLang)}
      className={`h-12 w-12 shrink-0 rounded-md border object-cover ${g.avatar ? "border-slate-600" : "border-slate-700 opacity-50"}`} />
  );
  if (modo === "S") return <span title={titolo}>{avatar}</span>;
  return (
    <div className="flex items-center gap-2.5" title={titolo}>
      {avatar}
      <div className="flex min-w-0 flex-col gap-1 leading-none">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-100">
          <span className="max-w-[160px] truncate">{g.nome}</span>
        </span>
        {g.era && <span className="text-[11px] text-sky-300">{g.era}</span>}
        <span className="font-mono text-[11px] text-slate-400">{dettagli || "—"}</span>
      </div>
    </div>
  );
}
