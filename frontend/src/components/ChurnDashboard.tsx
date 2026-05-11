import { useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Settings2,
} from "lucide-react";
import {
  RadialBar,
  RadialBarChart,
  PolarAngleAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type FormState = {
  tenure: number;
  monthlyCharges: number;
  totalCharges: number;
  contract: string;
  paymentMethod: string;
  internetService: string;
  techSupport: string;
  gender: string;
  seniorCitizen: string;
};

type PredictionResult = {
  probability: number; // 0..1
  prediction: "churn" | "retain";
  drivers?: { name: string; impact: number }[];
};

const DEFAULT_API = "https://churn-prediction-22c7.onrender.com/predict";

const initialForm: FormState = {
  tenure: 12,
  monthlyCharges: 70,
  totalCharges: 840,
  contract: "Month-to-month",
  paymentMethod: "Electronic check",
  internetService: "Fiber optic",
  techSupport: "No",
  gender: "Female",
  seniorCitizen: "No",
};

function classifyRisk(p: number) {
  if (p >= 0.66) return { label: "High Risk", tone: "destructive" as const };
  if (p >= 0.33) return { label: "Medium Risk", tone: "warning" as const };
  return { label: "Low Risk", tone: "success" as const };
}

function mockPredict(form: FormState): PredictionResult {
  // Lightweight heuristic for offline preview
  let score = 0.2;
  if (form.contract === "Month-to-month") score += 0.25;
  if (form.contract === "Two year") score -= 0.15;
  if (form.tenure < 12) score += 0.2;
  if (form.tenure > 48) score -= 0.15;
  if (form.monthlyCharges > 80) score += 0.1;
  if (form.techSupport === "No") score += 0.08;
  if (form.paymentMethod === "Electronic check") score += 0.07;
  if (form.internetService === "Fiber optic") score += 0.05;
  if (form.seniorCitizen === "Yes") score += 0.05;
  score = Math.max(0.02, Math.min(0.98, score));
  return {
    probability: score,
    prediction: score >= 0.5 ? "churn" : "retain",
    drivers: [
      { name: "Contract", impact: form.contract === "Month-to-month" ? 0.25 : -0.15 },
      { name: "Tenure", impact: form.tenure < 12 ? 0.2 : -0.1 },
      { name: "Monthly Charges", impact: form.monthlyCharges > 80 ? 0.1 : -0.05 },
      { name: "Tech Support", impact: form.techSupport === "No" ? 0.08 : -0.05 },
      { name: "Payment", impact: form.paymentMethod === "Electronic check" ? 0.07 : -0.03 },
    ],
  };
}

export function ChurnDashboard() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [apiUrl, setApiUrl] = useState<string>(DEFAULT_API);
  const [draftUrl, setDraftUrl] = useState<string>(DEFAULT_API);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function buildFeatures(f: FormState): Record<string, number> | null {
    const tenure = Number(f.tenure);
    const monthlyCharges = Number(f.monthlyCharges);
    const totalCharges = Number(f.totalCharges);

    if (
      !Number.isFinite(tenure) ||
      !Number.isFinite(monthlyCharges) ||
      !Number.isFinite(totalCharges) ||
      !f.contract ||
      !f.paymentMethod ||
      !f.internetService ||
      !f.techSupport ||
      !f.gender
    ) {
      return null;
    }

    const avgChargePerMonth = tenure > 0 ? totalCharges / tenure : monthlyCharges;

    return {
      TotalCharges: totalCharges,
      AvgChargePerMonth: avgChargePerMonth,
      tenure: tenure,
      MonthlyCharges: monthlyCharges,
      "Contract_Month-to-month": f.contract === "Month-to-month" ? 1 : 0,
      OnlineSecurity_No: 1,
      "PaymentMethod_Electronic check": f.paymentMethod === "Electronic check" ? 1 : 0,
      TechSupport_No: f.techSupport === "No" ? 1 : 0,
      gender: f.gender === "Male" ? 1 : 0,
      PaperlessBilling: 1,
      "InternetService_Fiber optic": f.internetService === "Fiber optic" ? 1 : 0,
      Partner: 0,
      "Contract_Two year": f.contract === "Two year" ? 1 : 0,
      OnlineBackup_No: 1,
      Dependents: 0,
    };
  }

  async function handlePredict() {
    if (loading) return; // guard against double clicks

    const features = buildFeatures(form);
    const valid =
      features !== null &&
      Object.values(features).every((v) => typeof v === "number" && Number.isFinite(v));

    if (!valid || !features) {
      toast.error("Please complete the form before predicting.");
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features }),
        signal: controller.signal,
      });

      if (!res.ok) {
        setResult(mockPredict(form));
        toast.error("Prediction failed, please try again");
        return;
      }

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        setResult(mockPredict(form));
        toast.error("Prediction failed, please try again");
        return;
      }

      const probability =
        typeof data?.probability === "number"
          ? data.probability
          : typeof data?.churn_probability === "number"
            ? data.churn_probability
            : null;

      if (probability === null || !Number.isFinite(probability)) {
        setResult(mockPredict(form));
        toast.error("Prediction failed, please try again");
        return;
      }

      setResult({
        probability: probability > 1 ? probability / 100 : probability,
        prediction:
          data.prediction === "churn" || data.prediction === 1 || probability >= 0.5
            ? "churn"
            : "retain",
        drivers: Array.isArray(data.drivers) ? data.drivers : undefined,
      });
      toast.success("Prediction received");
    } catch {
      setResult(mockPredict(form));
      toast.error("Prediction failed, please try again");
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }

  const risk = result ? classifyRisk(result.probability) : null;
  const gaugeData = [
    {
      name: "risk",
      value: result ? Math.round(result.probability * 100) : 0,
      fill:
        risk?.tone === "destructive"
          ? "var(--color-destructive)"
          : risk?.tone === "warning"
            ? "var(--color-warning)"
            : risk?.tone === "success"
              ? "var(--color-success)"
              : "var(--color-primary)",
    },
  ];

  const driverData =
    result?.drivers?.map((d) => ({
      name: d.name,
      impact: Math.round(d.impact * 100),
    })) ?? [];

  return (
    <div className="min-h-screen px-4 py-8 sm:px-8 lg:px-12">
      <Toaster theme="dark" position="top-right" richColors />
      <div className="mx-auto max-w-7xl">
        <Header apiUrl={apiUrl} draftUrl={draftUrl} setDraftUrl={setDraftUrl} setApiUrl={setApiUrl} />

        <section className="mt-8 grid gap-6 lg:grid-cols-5">
          <FormCard
            form={form}
            update={update}
            onSubmit={handlePredict}
            loading={loading}
          />

          <div className="space-y-6 lg:col-span-3">
            <ResultCard result={result} loading={loading} gaugeData={gaugeData} risk={risk} />
            <div className="grid gap-6 md:grid-cols-2">
              <DriversCard driverData={driverData} hasResult={!!result} />
              <InsightsCard result={result} form={form} />
            </div>
          </div>
        </section>

        <footer className="mt-12 text-center text-xs text-muted-foreground">
          Connected to <span className="text-foreground/80">{apiUrl}</span>
        </footer>
      </div>
    </div>
  );
}

function Header({
  apiUrl,
  draftUrl,
  setDraftUrl,
  setApiUrl,
}: {
  apiUrl: string;
  draftUrl: string;
  setDraftUrl: (v: string) => void;
  setApiUrl: (v: string) => void;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div
          className="flex size-12 items-center justify-center rounded-2xl"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
        >
          <Activity className="size-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Churnscope
          </h1>
          <p className="text-sm text-muted-foreground">
            Real-time customer retention intelligence
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary/5 text-primary">
          <Sparkles className="size-3" />
          ML-powered
        </Badge>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary" size="sm" className="gap-2">
              <Settings2 className="size-4" />
              API
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Flask API endpoint</DialogTitle>
              <DialogDescription>
                URL of your <code>POST /predict</code> endpoint. Expected JSON response:{" "}
                <code>{`{ "probability": 0.72, "prediction": "churn" }`}</code>
              </DialogDescription>
            </DialogHeader>
            <Input
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              placeholder="http://localhost:5000/predict"
            />
            <DialogFooter>
              <Button onClick={() => { setApiUrl(draftUrl); toast.success("API endpoint updated"); }}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
}

function FormCard({
  form,
  update,
  onSubmit,
  loading,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  return (
    <Card
      className="lg:col-span-2"
      style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-elegant)" }}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-5 text-primary" />
          Customer profile
        </CardTitle>
        <CardDescription>Provide details to estimate churn risk.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Gender"
            value={form.gender}
            onChange={(v) => update("gender", v)}
            options={["Female", "Male"]}
          />
          <SelectField
            label="Senior Citizen"
            value={form.seniorCitizen}
            onChange={(v) => update("seniorCitizen", v)}
            options={["No", "Yes"]}
          />
        </div>

        <SliderField
          label="Tenure (months)"
          value={form.tenure}
          min={0}
          max={72}
          step={1}
          onChange={(v) => update("tenure", v)}
        />
        <SliderField
          label="Monthly Charges ($)"
          value={form.monthlyCharges}
          min={10}
          max={150}
          step={1}
          onChange={(v) => {
            update("monthlyCharges", v);
            update("totalCharges", Math.round(v * form.tenure));
          }}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label="Total Charges ($)"
            value={form.totalCharges}
            onChange={(v) => update("totalCharges", v)}
          />
          <SelectField
            label="Contract"
            value={form.contract}
            onChange={(v) => update("contract", v)}
            options={["Month-to-month", "One year", "Two year"]}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Internet Service"
            value={form.internetService}
            onChange={(v) => update("internetService", v)}
            options={["DSL", "Fiber optic", "No"]}
          />
          <SelectField
            label="Tech Support"
            value={form.techSupport}
            onChange={(v) => update("techSupport", v)}
            options={["No", "Yes"]}
          />
        </div>

        <SelectField
          label="Payment Method"
          value={form.paymentMethod}
          onChange={(v) => update("paymentMethod", v)}
          options={[
            "Electronic check",
            "Mailed check",
            "Bank transfer (automatic)",
            "Credit card (automatic)",
          ]}
        />

        <Button
          onClick={onSubmit}
          disabled={loading}
          className="w-full gap-2 text-base font-semibold"
          size="lg"
          style={{
            background: "var(--gradient-primary)",
            color: "var(--primary-foreground)",
            boxShadow: "var(--shadow-glow)",
          }}
        >
          {loading ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              Predicting…
            </>
          ) : (
            <>
              <Sparkles className="size-5" />
              Predict churn
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function ResultCard({
  result,
  loading,
  gaugeData,
  risk,
}: {
  result: PredictionResult | null;
  loading: boolean;
  gaugeData: { name: string; value: number; fill: string }[];
  risk: { label: string; tone: "destructive" | "warning" | "success" } | null;
}) {
  const pct = result ? Math.round(result.probability * 100) : 0;

  return (
    <Card
      className="overflow-hidden"
      style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-elegant)" }}
    >
      <CardHeader>
        <CardTitle>Churn probability</CardTitle>
        <CardDescription>
          {result
            ? "Likelihood this customer will churn within the next billing cycle."
            : "Submit the form to generate a prediction."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid items-center gap-6 md:grid-cols-2">
          <div className="relative h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="70%"
                outerRadius="100%"
                data={gaugeData}
                startAngle={220}
                endAngle={-40}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background={{ fill: "var(--color-secondary)" }} dataKey="value" cornerRadius={20} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-bold tracking-tight tabular-nums">
                {loading ? "…" : `${pct}%`}
              </span>
              <span className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                churn risk
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {result && risk ? (
              <>
                <Badge
                  className="gap-1.5 px-3 py-1 text-sm"
                  style={{
                    backgroundColor: `var(--color-${risk.tone})`,
                    color: `var(--color-${risk.tone}-foreground)`,
                  }}
                >
                  {risk.tone === "success" ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <AlertTriangle className="size-4" />
                  )}
                  {risk.label}
                </Badge>
                <h3 className="text-2xl font-semibold leading-tight">
                  {result.prediction === "churn"
                    ? "Likely to churn"
                    : "Likely to stay"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {result.prediction === "churn"
                    ? "Consider proactive outreach with retention incentives, contract upgrades, or service support."
                    : "Customer profile suggests strong retention. Continue nurturing engagement."}
                </p>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Stat
                    icon={<TrendingUp className="size-4" />}
                    label="Retain"
                    value={`${100 - pct}%`}
                    tone="success"
                  />
                  <Stat
                    icon={<TrendingDown className="size-4" />}
                    label="Churn"
                    value={`${pct}%`}
                    tone="destructive"
                  />
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                No prediction yet. Fill the customer profile and click{" "}
                <span className="text-foreground">Predict churn</span>.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DriversCard({
  driverData,
  hasResult,
}: {
  driverData: { name: string; impact: number }[];
  hasResult: boolean;
}) {
  return (
    <Card style={{ background: "var(--gradient-card)" }}>
      <CardHeader>
        <CardTitle className="text-base">Top contributing factors</CardTitle>
        <CardDescription>Positive values increase churn risk.</CardDescription>
      </CardHeader>
      <CardContent className="h-[260px]">
        {hasResult && driverData.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={driverData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis
                type="category"
                dataKey="name"
                stroke="var(--color-muted-foreground)"
                fontSize={11}
                width={110}
              />
              <Tooltip
                cursor={{ fill: "var(--color-secondary)", opacity: 0.4 }}
                contentStyle={{
                  backgroundColor: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="impact" radius={[0, 6, 6, 0]} fill="var(--color-primary)" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState text="Run a prediction to see drivers." />
        )}
      </CardContent>
    </Card>
  );
}

function InsightsCard({ result, form }: { result: PredictionResult | null; form: FormState }) {
  const recommendations: string[] = [];
  if (result) {
    if (form.contract === "Month-to-month")
      recommendations.push("Offer a discounted 1-year contract upgrade.");
    if (form.techSupport === "No")
      recommendations.push("Bundle complimentary tech support for 3 months.");
    if (form.tenure < 12) recommendations.push("Trigger early-tenure loyalty rewards.");
    if (form.paymentMethod === "Electronic check")
      recommendations.push("Promote autopay with a small monthly credit.");
    if (!recommendations.length) recommendations.push("Maintain current engagement cadence.");
  }

  return (
    <Card style={{ background: "var(--gradient-card)" }}>
      <CardHeader>
        <CardTitle className="text-base">Recommended actions</CardTitle>
        <CardDescription>Tailored retention plays for this customer.</CardDescription>
      </CardHeader>
      <CardContent>
        {result ? (
          <ul className="space-y-3 text-sm">
            {recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  {i + 1}
                </span>
                <span className="text-foreground/90">{r}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState text="Recommendations appear after prediction." />
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "success" | "destructive";
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/40 p-3">
      <div
        className="flex items-center gap-1.5 text-xs"
        style={{ color: `var(--color-${tone})` }}
      >
        {icon}
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-[180px] items-center justify-center rounded-lg border border-dashed border-border/60 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
        <span className="text-sm font-medium tabular-nums">{value}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0] ?? 0)}
      />
    </div>
  );
}
