"use client";

import { useEffect, useState } from "react";

const MODAL_SELECTOR = '[aria-modal="true"]';

/**
 * `true` mientras haya un diálogo modal montado en el documento (`aria-modal="true"`).
 *
 * Lo usan los widgets flotantes (FAB del chat de agentes, mascota de Prometeo) para
 * ocultarse y no tapar los botones de confirmación de un modal: tienen el mismo
 * z-index que los fondos de modal y, al montarse después, se pintaban por encima.
 */
export function useModalOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = () => setOpen(document.querySelector(MODAL_SELECTOR) !== null);
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-modal"] });
    return () => observer.disconnect();
  }, []);

  return open;
}
