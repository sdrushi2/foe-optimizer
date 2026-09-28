import { useEffect, useRef } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";

/**
 * Chiusura dei modali che non chiedono di confermare nulla (guide, info, import,
 * elenchi): tasto Esc finché il modale è aperto, e click sullo SFONDO solo se
 * anche la PRESSIONE è iniziata sullo sfondo.
 *
 * Perché non un semplice `onClick={onClose}` sull'overlay: selezionando del
 * testo dentro il riquadro e rilasciando il mouse fuori, il browser manda il
 * click all'antenato comune di pressione e rilascio — cioè proprio all'overlay —
 * e il modale si chiudeva a metà selezione (bug corretto settembre 2026). Lo
 * `stopPropagation` sul riquadro interno non basta: quel click non passa mai dal
 * riquadro.
 *
 * Restituisce gli handler da applicare all'elemento overlay. Un modale che non
 * deve chiudersi col click sullo sfondo può non usarli: resta solo l'Esc.
 * Da NON usare per i modali che richiedono un'azione esplicita (es. avvisi con
 * un unico pulsante che esegue una pulizia): lì l'Esc salterebbe l'azione.
 */
export function useModalDismiss(isOpen: boolean, onClose: () => void) {
  const pressStartedOnBackdrop = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      pressStartedOnBackdrop.current = event.target === event.currentTarget;
    },
    onClick: (event: ReactMouseEvent<HTMLElement>) => {
      const startedOnBackdrop = pressStartedOnBackdrop.current;
      pressStartedOnBackdrop.current = false;
      if (startedOnBackdrop && event.target === event.currentTarget) onClose();
    },
  };
}
