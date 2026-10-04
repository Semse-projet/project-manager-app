export type ConnectPayoutPresentation = {
  ready: boolean;
  label: string;
  detail: string;
};

export function connectPayoutPresentation(
  status: string | null | undefined,
  loaded: boolean,
  platformFeeRate: number,
): ConnectPayoutPresentation {
  if (!loaded) {
    return {
      ready: false,
      label: "Verificando cuenta",
      detail: "Los cobros automáticos no se consideran habilitados hasta confirmar el estado de Stripe Connect.",
    };
  }

  if (status === "active") {
    return {
      ready: true,
      label: "Cobros automáticos habilitados",
      detail: `Cuenta activa. Fee de plataforma: ${(platformFeeRate * 100).toFixed(2)}%.`,
    };
  }

  const statusContext = status
    ? `Estado actual: ${status}.`
    : "No hay una cuenta Stripe Connect asociada.";
  return {
    ready: false,
    label: "Cobros automáticos bloqueados",
    detail: `${statusContext} Completa el onboarding para habilitarlos. SEMSE no redirige el payout a una cuenta compartida.`,
  };
}
