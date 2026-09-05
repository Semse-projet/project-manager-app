import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { CardField, useStripe } from "@stripe/stripe-react-native";
import type { PayoutMethodType, WorkerPayoutMethodView } from "@semse/schemas";
import { fetchPayoutMethod, savePayoutMethod } from "../../api/payoutMethod";
import { isStripeConfigured } from "../../config/stripe";
import { useTheme } from "../../theme/theme";

const PAYOUT_TYPES: { id: PayoutMethodType; label: string; hint: string }[] = [
  { id: "bank_account", label: "Cuenta bancaria", hint: "ACH o transferencia directa" },
  { id: "debit_card", label: "Tarjeta de débito", hint: "Depósito instantáneo" },
  { id: "paypal", label: "PayPal", hint: "Recibe en tu cuenta PayPal" },
  { id: "zelle", label: "Zelle", hint: "Transferencia en minutos" },
  { id: "cashapp", label: "Cash App", hint: "Recibe en tu $cashtag" },
];

function validate(type: PayoutMethodType, bankName: string, routing: string, account: string, email: string): string | null {
  if (type === "bank_account") {
    if (!bankName.trim()) return "Ingresa el nombre del banco.";
    if (routing.length !== 9) return "El routing number debe tener 9 dígitos.";
    if (!account.trim()) return "Ingresa el número de cuenta.";
  }
  if (type === "paypal" && !email.includes("@")) return "Email de PayPal inválido.";
  if (type === "zelle" && email.trim().length < 5) return "Teléfono o email de Zelle requerido.";
  if (type === "cashapp" && !email.startsWith("$")) return "El $cashtag debe empezar con $.";
  return null;
}

export default function PayoutMethodScreen() {
  const theme = useTheme();
  const styles = buildStyles(theme);

  if (!isStripeConfigured()) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>
          El método de cobro no está disponible todavía — falta configurar Stripe en este entorno.
        </Text>
      </View>
    );
  }

  return <PayoutMethodForm theme={theme} styles={styles} />;
}

function PayoutMethodForm({ theme, styles }: { theme: ReturnType<typeof useTheme>; styles: ReturnType<typeof buildStyles> }) {
  const stripe = useStripe();
  const [current, setCurrent] = useState<WorkerPayoutMethodView | null>(null);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<PayoutMethodType>("bank_account");
  const [bankName, setBankName] = useState("");
  const [routing, setRouting] = useState("");
  const [account, setAccount] = useState("");
  const [email, setEmail] = useState("");
  const [cardComplete, setCardComplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const method = await fetchPayoutMethod();
      setCurrent(method);
      if (method) {
        setType(method.type);
        setBankName(method.bankName ?? "");
        setEmail(method.email ?? "");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar tu método de cobro.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleSave() {
    const validationError = validate(type, bankName, routing, account, email);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (type === "debit_card" && !cardComplete) {
      setError("Completa los datos de la tarjeta.");
      return;
    }
    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      let stripeToken: string | undefined;
      let last4: string | undefined;

      if (type === "bank_account") {
        const result = await stripe.createToken({
          type: "BankAccount",
          country: "US",
          currency: "usd",
          routingNumber: routing,
          accountNumber: account,
          accountHolderType: "Individual",
        });
        if (result.error || !result.token) {
          setError(result.error?.message ?? "No se pudo verificar la cuenta bancaria.");
          setSaving(false);
          return;
        }
        stripeToken = result.token.id;
        last4 = result.token.bankAccount?.last4 ?? undefined;
      } else if (type === "debit_card") {
        const result = await stripe.createToken({ type: "Card" });
        if (result.error || !result.token) {
          setError(result.error?.message ?? "No se pudo verificar la tarjeta.");
          setSaving(false);
          return;
        }
        stripeToken = result.token.id;
        last4 = result.token.card?.last4;
      }

      const saved = await savePayoutMethod({
        type,
        bankName: type === "bank_account" ? bankName.trim() : undefined,
        stripeToken,
        last4,
        email: ["paypal", "zelle", "cashapp"].includes(type) ? email.trim() : undefined,
      });
      setCurrent(saved);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el método de cobro.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.brand} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {current ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Método actual: {current.label}</Text>
          {current.bankName ? <Text style={styles.cardMeta}>{current.bankName}</Text> : null}
          {current.last4 ? <Text style={styles.cardMeta}>Terminada en {current.last4}</Text> : null}
          {current.email ? <Text style={styles.cardMeta}>{current.email}</Text> : null}
        </View>
      ) : null}

      <Text style={styles.label}>Tipo de método de cobro</Text>
      <View style={styles.chipGrid}>
        {PAYOUT_TYPES.map((t) => (
          <Pressable
            key={t.id}
            style={[styles.typeCard, type === t.id && styles.typeCardSelected]}
            onPress={() => { setType(t.id); setError(null); }}
          >
            <Text style={[styles.typeLabel, type === t.id && styles.typeLabelSelected]}>{t.label}</Text>
            <Text style={styles.typeHint}>{t.hint}</Text>
          </Pressable>
        ))}
      </View>

      {type === "bank_account" ? (
        <>
          <Text style={styles.label}>Banco</Text>
          <TextInput style={styles.input} value={bankName} onChangeText={setBankName} placeholder="Nombre del banco" placeholderTextColor={theme.colors.faint} />
          <Text style={styles.label}>Routing number (9 dígitos)</Text>
          <TextInput
            style={styles.input}
            value={routing}
            onChangeText={(v) => setRouting(v.replace(/\D/g, "").slice(0, 9))}
            placeholder="000000000"
            placeholderTextColor={theme.colors.faint}
            keyboardType="number-pad"
            maxLength={9}
          />
          <Text style={styles.label}>Número de cuenta</Text>
          <TextInput
            style={styles.input}
            value={account}
            onChangeText={(v) => setAccount(v.replace(/\D/g, "").slice(0, 17))}
            placeholder="Hasta 17 dígitos"
            placeholderTextColor={theme.colors.faint}
            keyboardType="number-pad"
          />
          <Text style={styles.hint}>
            Tu número de cuenta se verifica directo con Stripe desde tu teléfono — nunca pasa por nuestros servidores, solo guardamos los últimos 4 dígitos.
          </Text>
        </>
      ) : null}

      {type === "debit_card" ? (
        <>
          <Text style={styles.label}>Datos de la tarjeta</Text>
          <CardField
            postalCodeEnabled={false}
            onCardChange={(details) => setCardComplete(details.complete)}
            style={styles.cardField}
          />
          <Text style={styles.hint}>
            El número de tarjeta lo procesa Stripe directamente en tu teléfono — nunca llega a nuestros servidores.
          </Text>
        </>
      ) : null}

      {["paypal", "zelle", "cashapp"].includes(type) ? (
        <>
          <Text style={styles.label}>
            {type === "paypal" ? "Email de PayPal" : type === "cashapp" ? "$Cashtag" : "Teléfono o email de Zelle"}
          </Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder={type === "paypal" ? "tu@email.com" : type === "cashapp" ? "$TuCashTag" : "+1 305 555 0000"}
            placeholderTextColor={theme.colors.faint}
            autoCapitalize="none"
          />
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={[styles.button, saving && styles.buttonDisabled]} onPress={() => void handleSave()} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{saved ? "✅ Guardado" : "Guardar método de cobro"}</Text>}
      </Pressable>
    </ScrollView>
  );
}

function buildStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { padding: theme.spacing.lg, gap: theme.spacing.sm },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: theme.spacing.lg },
    label: { fontSize: 12, fontWeight: "700", color: theme.colors.muted, textTransform: "uppercase", marginTop: theme.spacing.sm },
    input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 12, fontSize: 14, color: theme.colors.ink, backgroundColor: theme.colors.surface },
    hint: { fontSize: 11, color: theme.colors.muted, marginTop: 4 },
    error: { color: theme.colors.error, fontSize: 13, marginTop: theme.spacing.sm },
    card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border, gap: 4, marginBottom: theme.spacing.sm },
    cardTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.ink },
    cardMeta: { fontSize: 12, color: theme.colors.muted },
    chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    typeCard: { width: "48%", borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 12 },
    typeCardSelected: { borderColor: theme.colors.brand, backgroundColor: theme.colors.brandDim },
    typeLabel: { fontSize: 13, fontWeight: "700", color: theme.colors.ink },
    typeLabelSelected: { color: theme.colors.brand },
    typeHint: { fontSize: 10, color: theme.colors.faint, marginTop: 2 },
    cardField: { height: 50, marginVertical: 4 },
    button: { backgroundColor: theme.colors.brand, borderRadius: theme.radius.md, padding: 12, alignItems: "center", marginTop: theme.spacing.lg },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: "#fff", fontWeight: "700" },
  });
}
