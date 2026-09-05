"use client";

import { useEffect } from "react";

/**
 * Registra `/sw.js` en toda la app.
 *
 * Antes solo se registraba desde `usePushNotifications`, es decir unicamente si
 * el usuario activaba las notificaciones. Sin un service worker registrado el
 * navegador no ofrece instalar la app, asi que el registro tiene que ser global.
 *
 * Registrar el mismo script en el mismo scope es idempotente: no duplica nada
 * con el registro que ya hace el hook de push.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Tras `load` para no competir por ancho de banda con la carga inicial.
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Un fallo aqui solo significa que no habra instalacion ni fallback
        // offline; la app funciona igual, no hay que romper el render.
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
