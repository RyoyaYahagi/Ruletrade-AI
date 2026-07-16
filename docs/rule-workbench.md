# Rule Generation Workbench

## Overview

The workbench supports the user as the final decision maker while AI agents draft and organize rule proposals.

## Workflow

1. **Input** — User submits a strategy brief
2. **Generating** — AI orchestrator processes the brief
3. **Review** — Structured rule is displayed with sections:
   - Entry conditions
   - Exit conditions
   - Risk limits
   - Assumptions
   - Evidence
   - Warnings
4. **Edit** — User can modify the structured rule
5. **Approval** — Explicit approval boundary before activation

## 初心者向け質問ウィザード

銘柄別ルールの初期質問は固定カタログの10問です。

1. 保有目的
2. 考える期間
3. 投資仮説の材料
4. 投資仮説の下書き確認
5. 仮説の破れ条件
6. 下落時の見直し条件
7. 上昇時の見直し条件
8. 最大保有比率
9. 決算前後の扱い
10. ルールの見直し周期

投資仮説以外の質問には「まだ決めていない」があり、入力例と短い解説を見て
設定を適用するか、質問を `skipped` にして後で決められます。パーセント項目は
プリセットを先に表示し、必要な場合だけスライダーで調整します。

仮説の下書きと破れ条件候補だけにAIを使います。生成できない場合は、固定の一般的な
確認項目に切り替えたことを回答時の `answer_json.breakerSource` に記録します。

## Agent Workflow

```
Orchestrator → Generator → Reviewer → Evaluator → Explanation Writer
```

## UI Sections

| Section | Content |
|---------|---------|
| User Intent | Original strategy brief |
| Generated Rule | Structured data from agents |
| Review Warnings | Risk review output |
| Evidence | Supporting data |
| Unresolved Items | Blockers requiring attention |
| Approval Boundary | Final user confirmation |

## Future Work

- Connect to actual AI orchestrator endpoint
- Real-time agent status updates
- Inline editing of structured fields
- Side-by-side comparison of versions
