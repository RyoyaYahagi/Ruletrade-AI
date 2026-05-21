"use client";

import { useState } from "react";
import { CreateTradingRuleRequest } from "@/schemas/trading/trading-rule-schema";

type WorkbenchStep = "input" | "generating" | "review" | "edit" | "approval";

export function RuleWorkbench() {
  const [step, setStep] = useState<WorkbenchStep>("input");
  const [brief, setBrief] = useState("");
  const [rule, setRule] = useState<CreateTradingRuleRequest | null>(null);

  const handleSubmitBrief = async () => {
    setStep("generating");
    // TODO: Call AI orchestrator to generate rule from brief
    // For now, simulate with a placeholder
    setTimeout(() => {
      setRule({
        name: "Generated Rule",
        description: brief,
        entryConditions: [],
        exitConditions: [],
        riskLimits: {},
        assumptions: [],
        evidence: [],
        warnings: [],
        approvalRequirements: {
          requiresHumanReview: true,
          requiresComplianceCheck: true,
          requiresRiskAssessment: true,
        },
      });
      setStep("review");
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {step === "input" && (
        <section className="rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Strategy Brief</h2>
          <textarea
            className="w-full min-h-[120px] rounded border p-3 text-sm"
            placeholder="Describe your trading strategy: market, timeframe, risk tolerance, goals..."
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
          />
          <button
            className="mt-4 rounded bg-primary px-4 py-2 text-white disabled:opacity-50"
            onClick={handleSubmitBrief}
            disabled={brief.length < 10}
          >
            Generate Rule
          </button>
        </section>
      )}

      {step === "generating" && (
        <section className="rounded-lg border p-6 text-center">
          <p className="text-muted-foreground">AI agents are drafting your rule...</p>
          <div className="mt-4 h-2 w-full rounded bg-muted overflow-hidden">
            <div className="h-full w-2/3 animate-pulse bg-primary" />
          </div>
        </section>
      )}

      {step === "review" && rule && (
        <section className="space-y-4">
          <div className="rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Generated Rule</h2>
            <div className="space-y-2 text-sm">
              <p><strong>Name:</strong> {rule.name}</p>
              <p><strong>Description:</strong> {rule.description}</p>
            </div>
          </div>

          <div className="rounded-lg border p-6">
            <h3 className="font-medium mb-2">Approval Requirements</h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground">
              <li>Human Review: {rule.approvalRequirements.requiresHumanReview ? "Required" : "Not required"}</li>
              <li>Compliance Check: {rule.approvalRequirements.requiresComplianceCheck ? "Required" : "Not required"}</li>
              <li>Risk Assessment: {rule.approvalRequirements.requiresRiskAssessment ? "Required" : "Not required"}</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              className="rounded bg-primary px-4 py-2 text-white"
              onClick={() => setStep("approval")}
            >
              Proceed to Approval
            </button>
            <button
              className="rounded border px-4 py-2"
              onClick={() => setStep("input")}
            >
              Start Over
            </button>
          </div>
        </section>
      )}

      {step === "approval" && (
        <section className="rounded-lg border p-6 text-center">
          <h2 className="text-lg font-semibold mb-2">Approval Boundary</h2>
          <p className="text-sm text-muted-foreground mb-4">
            You are the final decision maker. Review the structured rule before approving.
          </p>
          <div className="flex justify-center gap-3">
            <button className="rounded bg-primary px-4 py-2 text-white">
              Approve Rule
            </button>
            <button
              className="rounded border px-4 py-2"
              onClick={() => setStep("review")}
            >
              Back to Review
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
