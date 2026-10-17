"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "../../../../lib/language-context";
import { acceptInvitation, previewInvitation } from "../../../semse-api";

const COPY = {
  es: {
    title: "Invitación a una empresa",
    invited: (company: string) => `${company} te invitó como trabajador.`,
    accept: "Aceptar invitación",
    done: "Listo. Ya formas parte de la empresa.",
    invalid: "Esta invitación no es válida, venció o es para otra cuenta."
  },
  en: {
    title: "Company invitation",
    invited: (company: string) => `${company} invited you as a worker.`,
    accept: "Accept invitation",
    done: "Done. You are now part of the company.",
    invalid: "This invitation is invalid, expired, or meant for another account."
  }
} as const;

function AcceptInvitation() {
  const { language } = useLanguage();
  const c = COPY[language];
  const token = useSearchParams().get("token") ?? "";
  const [company, setCompany] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "invalid" | "done">("loading");

  useEffect(() => {
    if (token.length < 10) {
      setState("invalid");
      return;
    }
    previewInvitation(token)
      .then((preview) => {
        setCompany(preview.companyName);
        setState("ready");
      })
      .catch(() => setState("invalid"));
  }, [token]);

  async function accept() {
    try {
      await acceptInvitation(token);
      setState("done");
    } catch {
      setState("invalid");
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, display: "grid", gap: 16 }}>
      <h1>{c.title}</h1>
      {state === "ready" && company ? (
        <>
          <p>{c.invited(company)}</p>
          <button onClick={() => void accept()} style={{ minHeight: 44 }}>
            {c.accept}
          </button>
        </>
      ) : null}
      {state === "done" ? <p role="status">{c.done}</p> : null}
      {state === "invalid" ? <p role="alert">{c.invalid}</p> : null}
    </main>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={null}>
      <AcceptInvitation />
    </Suspense>
  );
}
