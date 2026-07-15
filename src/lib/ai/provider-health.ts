import "server-only";

export type HealthAiProvider =
  | "mock"
  | "openai"
  | "gemini"
  | "codex-app-server";

export type ProviderHealth = {
  provider: HealthAiProvider;
  consecutiveFailures: number;
  lastFailureAt: number | null;
  circuitOpenUntil: number | null;
  totalCalls: number;
  totalFailures: number;
  latencies: number[]; // ms, keep last N
};

const MAX_LATENCY_HISTORY = 20;
const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_OPEN_DURATION_MS = 30_000;

const healthStore = new Map<HealthAiProvider, ProviderHealth>();

function getInitialHealth(provider: HealthAiProvider): ProviderHealth {
  return {
    provider,
    consecutiveFailures: 0,
    lastFailureAt: null,
    circuitOpenUntil: null,
    totalCalls: 0,
    totalFailures: 0,
    latencies: [],
  };
}

export function getProviderHealth(provider: HealthAiProvider): ProviderHealth {
  return healthStore.get(provider) ?? getInitialHealth(provider);
}

export function recordProviderSuccess(
  provider: HealthAiProvider,
  latencyMs: number,
): void {
  const health = getProviderHealth(provider);
  health.totalCalls++;
  health.consecutiveFailures = 0;
  health.circuitOpenUntil = null;
  health.latencies.push(latencyMs);
  if (health.latencies.length > MAX_LATENCY_HISTORY) {
    health.latencies.shift();
  }
  healthStore.set(provider, health);
}

export function recordProviderFailure(provider: HealthAiProvider): void {
  const health = getProviderHealth(provider);
  health.totalCalls++;
  health.totalFailures++;
  health.consecutiveFailures++;
  health.lastFailureAt = Date.now();
  if (health.consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD) {
    health.circuitOpenUntil = Date.now() + CIRCUIT_OPEN_DURATION_MS;
  }
  healthStore.set(provider, health);
}

export function isCircuitOpen(provider: HealthAiProvider): boolean {
  const health = getProviderHealth(provider);
  if (!health.circuitOpenUntil) return false;
  if (Date.now() < health.circuitOpenUntil) return true;
  // Auto half-open: reset consecutive failures when cooldown expires
  health.consecutiveFailures = 0;
  health.circuitOpenUntil = null;
  healthStore.set(provider, health);
  return false;
}

function getAverageLatency(health: ProviderHealth): number {
  if (health.latencies.length === 0) return 1000; // default assumption 1s
  const sum = health.latencies.reduce((a, b) => a + b, 0);
  return sum / health.latencies.length;
}

function getErrorRate(health: ProviderHealth): number {
  if (health.totalCalls === 0) return 0;
  return health.totalFailures / health.totalCalls;
}

export type ProviderScore = {
  provider: HealthAiProvider;
  score: number;
  isAvailable: boolean;
};

export function calculateProviderScores(
  candidates: HealthAiProvider[],
): ProviderScore[] {
  return candidates.map((provider) => {
    const health = getProviderHealth(provider);
    const open = isCircuitOpen(provider);
    if (open) {
      return { provider, score: 0, isAvailable: false };
    }

    const latency = getAverageLatency(health);
    const errorRate = getErrorRate(health);
    const successRate = 1 - errorRate;

    // Latency penalty: higher latency = lower score
    const latencyPenalty = Math.min(latency / 5000, 0.8);
    // Error penalty: weigh errors heavily
    const errorPenalty = Math.min(errorRate * 3, 0.9);
    // Base score from success rate
    let score = Math.max(0.01, successRate - latencyPenalty - errorPenalty);

    // Deprioritize mock provider unless it's the only option
    if (provider === "mock" && candidates.length > 1) {
      score *= 0.1;
    }

    return { provider, score: Math.max(0.01, score), isAvailable: true };
  });
}

export function pickBestProvider(
  candidates: HealthAiProvider[],
): HealthAiProvider | null {
  const scores = calculateProviderScores(candidates);
  const available = scores.filter((s) => s.isAvailable);
  if (available.length === 0) return null;

  // Weighted random selection based on score
  const totalScore = available.reduce((sum, s) => sum + s.score, 0);
  let random = Math.random() * totalScore;
  for (const s of available) {
    random -= s.score;
    if (random <= 0) return s.provider;
  }
  return available[available.length - 1].provider;
}

export function getOrderedProvidersForFallback(
  candidates: HealthAiProvider[],
): HealthAiProvider[] {
  const scores = calculateProviderScores(candidates);
  return scores
    .filter((s) => s.isAvailable)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.provider);
}
