import { evaluateProductionDeploymentGate } from "@/features/deployment/services/production-deployment-gate-service";

async function main() {
  const result = await evaluateProductionDeploymentGate({});
  if (!result.passed) {
    console.error("Production readiness check failed:");
    for (const blocker of result.blockers) {
      console.error(`  - ${blocker}`);
    }
    process.exit(1);
  }
  console.log("Production readiness check passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
