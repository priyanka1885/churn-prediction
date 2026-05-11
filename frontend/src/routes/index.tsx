import { createFileRoute } from "@tanstack/react-router";
import { ChurnDashboard } from "@/components/ChurnDashboard";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Churnscope — Customer Churn Prediction Dashboard" },
      {
        name: "description",
        content:
          "Predict customer churn probability with a modern AI-powered dashboard. Input customer details and instantly see retention risk.",
      },
    ],
  }),
});

function Index() {
  return <ChurnDashboard />;
}
