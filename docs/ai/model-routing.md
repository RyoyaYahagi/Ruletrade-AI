# Model Routing

## 目的

機能・taskType・Agent ごとに適切な AI Provider / Model / temperature / token上限 / fallback を選ぶ。Feature Service はモデル名を直接指定せず、`taskType` と必要なら `agentName` を渡すだけで、システムが最適な設定を解決する。

## 基本方針

- Feature Service → `taskType` + `agentName` を渡す
- `resolveAIModelConfig()` → `AIModelConfig` を返す
- `callAi()` → resolved config を使って AI Provider を呼び出す
- ai_run_logs の metadata に routing 結果を保存する

## 型一覧

### AITaskType

```ts
export type AITaskType =
  | "intake_question"
  | "rule_draft_generation"
  | "rule_review"
  | "question_generation"
  | "loop_judgement"
  | "portfolio_review"
  | "watchlist_review"
  | "reflection_review"
  | "memory_summary"
  | "rag_context_summary"
  | "document_summary"
  | "safety_check"
  | "compliance_check"
  | "eval_judge"
  | "embedding";
```

### AIAgentName

```ts
export type AIAgentName =
  | "intake_agent"
  | "rule_builder_agent"
  | "rule_review_agent"
  | "question_generator_agent"
  | "loop_manager_agent"
  | "portfolio_review_agent"
  | "watchlist_review_agent"
  | "memory_agent"
  | "safety_agent"
  | "compliance_agent"
  | "eval_agent";
```

### AIModelCostTier

```ts
export type AIModelCostTier =
  | "free_mock"
  | "cheap"
  | "balanced"
  | "high_quality"
  | "embedding";
```

## モデル選択方針

| taskType                | agentName                  | 方針              | costTier     | temperature |
| ----------------------- | -------------------------- | ----------------- | ------------ | ----------- |
| `intake_question`       | `intake_agent`             | 安い・速い        | cheap        | 0.5         |
| `question_generation`   | `question_generator_agent` | 安い〜中程度      | cheap        | 0.5         |
| `rule_draft_generation` | `rule_builder_agent`       | 構造化出力重視    | balanced     | 0.4         |
| `rule_review`           | `rule_review_agent`        | 品質重視          | balanced     | 0.3         |
| `loop_judgement`        | `loop_manager_agent`       | 安定・温度低め    | cheap        | 0.2         |
| `portfolio_review`      | `portfolio_review_agent`   | balanced以上      | balanced     | 0.3         |
| `watchlist_review`      | `watchlist_review_agent`   | balanced          | balanced     | 0.3         |
| `memory_summary`        | `memory_agent`             | 安い・要約        | cheap        | 0.4         |
| `rag_context_summary`   | `memory_agent`             | untrusted扱い     | cheap        | 0.4         |
| `document_summary`      | `memory_agent`             | 長文要約          | balanced     | 0.3         |
| `safety_check`          | `safety_agent`             | **低temperature** | cheap        | **0.1**     |
| `compliance_check`      | `compliance_agent`         | **低temperature** | cheap        | **0.1**     |
| `eval_judge`            | `eval_agent`               | 高品質            | high_quality | 0.2         |
| `embedding`             | `memory_agent`             | embedding専用     | embedding    | 0           |

## 使用方法

### Feature Service から呼び出す

```ts
import { callAi } from "@/lib/ai/provider-gateway";

const result = await callAi({
  taskType: "rule_review",
  agentName: "rule_review_agent",
  weight: "standard", // fallback（taskType未設定時のみ使用）
  system: "...",
  prompt: "...",
  outputSchema: MySchema,
  userId: user.id,
});
```

### 直接 resolve する

```ts
import { resolveAIModelConfig } from "@/lib/ai/model-config";

const config = resolveAIModelConfig({
  taskType: "safety_check",
  agentName: "safety_agent",
});

console.log(config.model); // "gpt-4.1-mini"
console.log(config.temperature); // 0.1
```

## 設定上書き

環境変数で主要モデルを上書き可能。

```bash
# Provider 全体の変更
AI_PROVIDER=gemini

# Task 別モデルの変更
AI_MODEL_RULE_REVIEW=gpt-4o
AI_MODEL_SAFETY_CHECK=gpt-4.1-mini
```

命名規則: `AI_MODEL_{TASK_TYPEの大文字・スネークケース}`

## Safety / Compliance との関係

Model Routing は「どのモデルを使うか」を決めるだけ。

以下は別レイヤーとして必ず残す:

- Zod Schema validation
- Safety Check (`safety_check` task)
- Compliance Gate (`compliance_check` task)
- unsafe output non-display
- AI Run Logs

重要:

- 高性能モデルを使っても Safety Check は省略しない
- Structured Output 対応モデルを使っても Zod 検証は省略しない
- RAG context は常に untrusted として扱う

## ai_run_logs に残す項目

`withAiRunLogging` の `metadata` として保存:

- `agentName`
- `costTier`
- `fallbackUsed`
- `temperature`
- `maxOutputTokens`

## MVP での妥協

許容する:

- 実モデル名は設定で手動指定
- 最初は Mock Provider 中心
- fallback は型とログ項目だけ
- DB 管理画面は作らない
- 自動最適化はしない

必須:

- taskType ごとの config がある
- agentName を meta に残せる
- Feature Service がモデル名に直接依存しない
- ai_run_logs に provider/model/taskType/agentName を残せる
- Safety / Compliance は低 temperature 方針
