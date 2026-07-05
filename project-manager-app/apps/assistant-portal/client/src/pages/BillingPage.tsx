import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { PageTransition } from "@/components/PageTransition";
import { Check, CreditCard, ExternalLink, Loader2, Sparkles, Crown } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearch } from "wouter";

export default function BillingPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const success = params.get("success");
  const canceled = params.get("canceled");

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (success === "true") {
      setSuccessMessage("Tu suscripción ha sido activada correctamente.");
      // Clean URL params
      window.history.replaceState({}, "", "/billing");
    }
    if (canceled === "true") {
      setSuccessMessage(null);
      window.history.replaceState({}, "", "/billing");
    }
  }, [success, canceled]);

  const { data: plans, isLoading: plansLoading } = trpc.billing.plans.useQuery();
  const { data: subscription, isLoading: subLoading } = trpc.billing.subscription.useQuery();
  const { data: payments, isLoading: paymentsLoading } = trpc.billing.payments.useQuery();

  const checkoutMutation = trpc.billing.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, "_blank");
      }
    },
  });

  const portalMutation = trpc.billing.createPortalSession.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, "_blank");
      }
    },
  });

  const handleSubscribe = (planKey: string) => {
    if (planKey === "pro" || planKey === "team") {
      checkoutMutation.mutate({ planKey });
    }
  };

  const handleManageSubscription = () => {
    portalMutation.mutate();
  };

  const getPlanIcon = (key: string) => {
    switch (key) {
      case "free": return <CreditCard className="h-6 w-6" />;
      case "pro": return <Sparkles className="h-6 w-6" />;
      case "team": return <Crown className="h-6 w-6" />;
      default: return <CreditCard className="h-6 w-6" />;
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("es-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(timestamp));
  };

  if (plansLoading || subLoading) {
    return (
      <PageTransition>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-8 p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Facturación</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona tu suscripción y revisa tu historial de pagos.
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <Card className="border-green-500/50 bg-green-500/10">
            <CardContent className="pt-6">
              <p className="text-green-600 dark:text-green-400 font-medium">
                {successMessage}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Current Subscription Status */}
        {subscription && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Suscripción Activa</CardTitle>
              <CardDescription>Tu plan actual y estado de la suscripción</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="default" className="text-sm px-3 py-1">
                  {subscription.planKey?.toUpperCase() || "PRO"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {subscription.currentPeriodEnd
                    ? `Próxima renovación: ${formatDate(subscription.currentPeriodEnd)}`
                    : ""}
                </span>
                {subscription.cancelAtPeriodEnd && (
                  <Badge variant="destructive" className="text-xs">
                    Se cancela al final del período
                  </Badge>
                )}
              </div>
              <Button
                variant="outline"
                onClick={handleManageSubscription}
                disabled={portalMutation.isPending}
              >
                {portalMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Gestionar Suscripción
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Plans Grid */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Planes Disponibles</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans?.map((plan) => {
              const isCurrentPlan = subscription?.planKey === plan.key;
              const isFreePlan = plan.key === "free";
              const isPopular = plan.key === "pro";

              return (
                <Card
                  key={plan.key}
                  className={`relative flex flex-col ${
                    isPopular ? "border-primary shadow-lg scale-[1.02]" : ""
                  } ${isCurrentPlan ? "ring-2 ring-primary" : ""}`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground px-3">
                        Popular
                      </Badge>
                    </div>
                  )}
                  {isCurrentPlan && (
                    <div className="absolute -top-3 right-4">
                      <Badge variant="secondary" className="px-3">
                        Plan Actual
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="text-center pb-2">
                    <div className="mx-auto mb-2 p-3 rounded-full bg-muted w-fit">
                      {getPlanIcon(plan.key)}
                    </div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>

                  <CardContent className="flex-1">
                    <div className="text-center mb-6">
                      <span className="text-4xl font-bold">
                        {plan.price === 0 ? "Gratis" : `$${plan.price / 100}`}
                      </span>
                      {plan.interval && (
                        <span className="text-muted-foreground">/{plan.interval === "month" ? "mes" : "año"}</span>
                      )}
                    </div>

                    <ul className="space-y-3">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>

                  <CardFooter>
                    {isFreePlan ? (
                      <Button variant="outline" className="w-full" disabled>
                        {!subscription ? "Plan Actual" : "Plan Base"}
                      </Button>
                    ) : isCurrentPlan ? (
                      <Button variant="outline" className="w-full" disabled>
                        Plan Actual
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        variant={isPopular ? "default" : "outline"}
                        onClick={() => handleSubscribe(plan.key)}
                        disabled={checkoutMutation.isPending}
                      >
                        {checkoutMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Suscribirse
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Payment History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Historial de Pagos</CardTitle>
            <CardDescription>
              Tus últimas transacciones y recibos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {paymentsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : payments && payments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Recibo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{formatDate(payment.created)}</TableCell>
                      <TableCell>{payment.description || "Pago de suscripción"}</TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(payment.amount, payment.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={payment.status === "succeeded" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {payment.status === "succeeded" ? "Completado" : payment.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {payment.receiptUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(payment.receiptUrl!, "_blank")}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No hay pagos registrados aún.</p>
                <p className="text-sm mt-1">Los pagos aparecerán aquí una vez que te suscribas a un plan.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
