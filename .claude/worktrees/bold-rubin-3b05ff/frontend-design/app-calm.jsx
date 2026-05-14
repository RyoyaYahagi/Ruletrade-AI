/* global React, ReactDOM, DesignCanvas, DCSection, DCArtboard,
   FieldTag, StatusPill, I, FinancialBoundaryNotice */
const { useState } = React;

/* Reuse seed data shape from the dense version */
const C_DRAFT = [
  { id: "thesis", title: "投資仮説", state: "set",
    body: <p style={{ margin: 0 }}>上昇トレンド中の押し目を狙う。<br/>ただし損切り条件と検証結果がないルールは採用しない。</p> },
  { id: "entry", title: "エントリー条件", state: "set",
    body: (<ul className="bullets">
      <li>終値が 50 日移動平均線を上回る</li>
      <li>20 日高値から 8% 以内の押し目を形成</li>
      <li>出来高が 20 日平均以上に回復</li>
    </ul>) },
  { id: "exit", title: "イグジット条件", state: "set",
    body: <ul className="bullets"><li>終値が 20 日移動平均線を 2 営業日連続で下回る</li></ul> },
  { id: "stoploss", title: "損切り条件", state: "unset",
    unsetHint: "想定外の下落で判断がブレないよう、撤退ラインを明文化してください。" },
  { id: "takeprofit", title: "利確条件", state: "vague",
    body: <p style={{ margin: 0 }}>「目標株価に到達したら段階的に利確」とのみ記載。</p>,
    vagueHint: "目標株価の算出根拠 (PER, ターゲット倍率, 期限) を明記してください。" },
  { id: "size", title: "最大投資比率", state: "unset",
    unsetHint: "1 ルールあたりの最大投資比率と、口座資産に対する最大損失率を決めてください。" },
  { id: "addon", title: "買い増し条件", state: "vague",
    body: <p style={{ margin: 0 }}>「含み益が出ていたら追加検討」と記載。</p>,
    vagueHint: "追加条件 (株価, タイミング, 上限ロット) を明文化してください。" },
  { id: "event", title: "決算・イベント対応", state: "vague",
    body: <p style={{ margin: 0 }}>「決算前後は様子を見る」と記載。</p>,
    vagueHint: "決算前後を何営業日除外するかを明文化してください。" },
  { id: "broken", title: "仮説が崩れる条件", state: "set",
    body: <ul className="bullets">
      <li>主要セグメントの売上成長が 2 四半期連続で前年割れ</li>
      <li>50 日移動平均線が下降に転じる</li>
    </ul> },
  { id: "context", title: "前提条件", state: "set",
    body: <ul className="bullets">
      <li>1 ルールあたり口座資産の <strong>1.0%</strong> を最大損失に制限</li>
      <li>同一セクターの同時保有は <strong>3 銘柄</strong> まで</li>
    </ul> },
];

const C_QUESTION = {
  idx: 4, total: 12, category: "撤退ルール · 損切り",
  prompt: "損切り条件をどう決めますか？",
  rationale: "損切り条件がないと、想定外に下がったときに判断がブレやすくなります。最低 1 つは明文化してください。",
  choices: [
    { id: "a", label: "株価が一定ラインを下回ったら撤退" },
    { id: "b", label: "投資仮説が崩れたら撤退" },
    { id: "c", label: "一定期間で成果が出なければ見直す" },
    { id: "d", label: "まだ決められない" },
  ],
};

const C_WARNINGS = [
  { id: "w1", sev: "Blocker", title: "バックテスト未実施",
    detail: "検証期間とサンプル数がないため、承認前に評価が必要です。直近 2 年以上を推奨します。",
    owner: "Backtest Evaluator", target: "Evidence" },
  { id: "w2", sev: "Warning", title: "イベント回避条件が曖昧",
    detail: "決算前後を何営業日除外するかを明文化してください。",
    owner: "Risk Reviewer", target: "決算・イベント対応" },
  { id: "w3", sev: "Warning", title: "損切り条件が未設定",
    detail: "撤退ラインの明文化が必要です。投資仮説が崩れた場合の挙動も併記してください。",
    owner: "Risk Reviewer", target: "損切り条件" },
];

const C_UNRESOLVED = [
  { id: "u1", label: "損切り条件が未設定", field: "損切り条件", state: "unset" },
  { id: "u2", label: "最大投資比率が未設定", field: "最大投資比率", state: "unset" },
  { id: "u3", label: "買い増し条件が曖昧", field: "買い増し条件", state: "vague" },
];

const C_REASONS = [
  "Blocker が 1 件残っています (バックテスト未実施)",
  "「損切り条件」「最大投資比率」が未設定です",
];

/* =========================================================
 * Tabbed main panel
 * ========================================================= */
const TABS = [
  { id: "question", label: "次の質問" },
  { id: "draft",    label: "ルール草案", count: "10" },
  { id: "issues",   label: "未解決項目", count: 3, urgent: true },
  { id: "review",   label: "AIレビュー", count: 3 },
  { id: "evidence", label: "検証証跡" },
];

function CalmQuestion() {
  const [picked, setPicked] = useState(null);
  return (
    <div style={{ padding: "36px 44px", display: "flex", flexDirection: "column", gap: 28 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--muted)" }}>
          <span style={{ fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{C_QUESTION.category}</span>
          <span style={{ color: "var(--faint)" }}>·</span>
          <span>質問 {C_QUESTION.idx} / {C_QUESTION.total}</span>
        </div>
        <h2 className="q-heading" style={{ margin: 0 }}>{C_QUESTION.prompt}</h2>
        <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", lineHeight: 1.75, maxWidth: 620 }}>
          {C_QUESTION.rationale}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 620 }}>
        {C_QUESTION.choices.map((c, i) => (
          <button
            key={c.id}
            className={`choice ${picked === c.id ? "is-selected" : ""}`}
            onClick={() => setPicked(c.id)}
          >
            <span className="choice-radio" />
            <span style={{ flex: 1 }}>{c.label}</span>
            <span className="mono text-xs muted">{String.fromCharCode(65 + i)}</span>
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 620 }}>
        <label className="field-label" style={{ display: "block", marginBottom: 8 }}>
          自由入力 (任意)
        </label>
        <textarea className="textarea" placeholder="自分の言葉で条件を書く" style={{ minHeight: 72 }} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }}>
        <button className="btn btn-primary" disabled={!picked}>回答を保存 <I.ArrowRight /></button>
        <button className="btn">あとで決める</button>
        <div style={{ flex: 1 }} />
        <span className="text-xs muted">この回答は <strong style={{ color: "var(--ink-2)" }}>損切り条件</strong> フィールドに反映されます</span>
      </div>
    </div>
  );
}

function CalmDraft() {
  return (
    <div>
      {C_DRAFT.map(f => (
        <div key={f.id} className="draft-field">
          <div className="draft-field-head">
            <div className="draft-field-title">
              <span>{f.title}</span>
              <FieldTag state={f.state} />
            </div>
            {f.state !== "set" && (
              <button className="btn btn-sm btn-ghost">次に決める <I.ArrowRight /></button>
            )}
          </div>
          <div className="draft-field-body">
            {f.state === "unset" ? (
              <div className="empty-field">
                <I.Alert />
                <div><strong>未設定。</strong> {f.unsetHint}</div>
              </div>
            ) : f.state === "vague" ? (
              <>
                {f.body}
                <div style={{
                  marginTop: 10, fontSize: 13, color: "var(--amber-ink)",
                  background: "var(--amber-50)", border: "1px solid var(--amber-200)",
                  borderRadius: 4, padding: "10px 12px", display: "flex", gap: 8, alignItems: "flex-start",
                  lineHeight: 1.6,
                }}>
                  <I.Alert /> <span>{f.vagueHint}</span>
                </div>
              </>
            ) : f.body}
          </div>
        </div>
      ))}
    </div>
  );
}

function CalmIssues() {
  return (
    <div>
      {C_UNRESOLVED.map((u, i) => (
        <div key={u.id} style={{
          padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)",
          display: "flex", alignItems: "center", gap: 16,
        }}>
          <div className="mono" style={{ width: 24, fontSize: 12, color: "var(--muted-2)" }}>
            {String(i + 1).padStart(2, "0")}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, color: "var(--ink)", marginBottom: 4 }}>{u.label}</div>
            <div className="text-xs muted">ルール草案 · {u.field}</div>
          </div>
          <FieldTag state={u.state} />
          <button className="btn">決める</button>
        </div>
      ))}
    </div>
  );
}

function CalmReview() {
  return (
    <div>
      {C_WARNINGS.map(w => (
        <div key={w.id} className="severity-row">
          <div className={`sev-bar sev-${w.sev.toLowerCase()}`} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span className={`pill ${w.sev === "Blocker" ? "pill-rose" : "pill-amber"}`}>
                <span className="dot" />{w.sev}
              </span>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{w.title}</span>
            </div>
            <div style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.7, marginBottom: 8 }}>
              {w.detail}
            </div>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <span className="text-xs muted">担当: <span style={{ color: "var(--ink-2)" }}>{w.owner}</span></span>
              <span className="text-xs muted">対象: <span className="mono" style={{ color: "var(--ink-2)" }}>{w.target}</span></span>
            </div>
          </div>
          <button className="btn">対応</button>
        </div>
      ))}
    </div>
  );
}

function CalmEvidence() {
  return (
    <div style={{ padding: "32px 36px", display: "flex", flexDirection: "column", gap: 20, alignItems: "flex-start" }}>
      <span className="pill pill-rose"><span className="dot"/>未検証</span>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: "-0.005em" }}>
        まだバックテストが実施されていません
      </h2>
      <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", lineHeight: 1.75, maxWidth: 560 }}>
        バックテストを実施すると、検証期間・サンプル数・最大ドローダウン・信頼度を確認できます。
        検証証跡がないルールは承認できません。
      </p>

      <div className="evidence-grid" style={{ width: "100%", maxWidth: 560, borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)" }}>
        <div className="evidence-cell" style={{ padding: "14px 18px" }}><div className="k">Backtest window</div><div className="v muted">未実施</div></div>
        <div className="evidence-cell" style={{ padding: "14px 18px" }}><div className="k">Sample size</div><div className="v muted">—</div></div>
        <div className="evidence-cell" style={{ padding: "14px 18px" }}><div className="k">Max drawdown</div><div className="v muted">—</div></div>
        <div className="evidence-cell" style={{ padding: "14px 18px" }}><div className="k">Confidence</div><div className="v muted">—</div></div>
      </div>

      <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
        <button className="btn btn-primary">バックテストを開始</button>
        <button className="btn">期間を選択</button>
      </div>
    </div>
  );
}

function CalmHeader() {
  return (
    <header style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
      <div style={{ padding: "14px 28px", display: "flex", alignItems: "center", gap: 14 }}>
        <div className="logomark">R</div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Ruletrade</div>
        <span style={{ color: "var(--faint)" }}>/</span>
        <span className="text-sm muted">ルール設計</span>
        <span style={{ color: "var(--faint)" }}>/</span>
        <span className="text-sm mono" style={{ color: "var(--muted)" }}>session_8f2a</span>
        <div style={{ flex: 1 }} />
        <span className="text-xs muted" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <I.Save /> 2 秒前に自動保存
        </span>
        <button className="btn btn-sm btn-ghost"><I.Clock /> 履歴</button>
      </div>
      <div style={{ padding: "20px 28px 22px", display: "flex", alignItems: "flex-end", gap: 20 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" }}>ソニーグループ</h1>
            <span className="mono" style={{ color: "var(--muted)", fontSize: 15 }}>/ 6758</span>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>東証プライム · 電気機器</div>
        </div>
        <StatusPill status="Blocked" />
      </div>
      <div style={{
        padding: "10px 28px", background: "var(--surface-2)",
        borderTop: "1px solid var(--border-subtle)",
        fontSize: 12, color: "var(--muted)", lineHeight: 1.6,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <I.Info /> AIレビューは投資ルールの抜け漏れ確認を目的としています。特定銘柄の売買を推奨するものではありません。最終判断はユーザー自身が行います。
      </div>
    </header>
  );
}

function CalmWorkbench() {
  const [tab, setTab] = useState("question");

  return (
    <div className="calm" style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <CalmHeader />

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 360px", gap: 28, padding: "28px 36px", minHeight: 0 }}>
        {/* MAIN */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 8, overflow: "hidden", display: "flex", flexDirection: "column",
            flex: 1, minHeight: 0,
          }}>
            <div className="calm-tabs">
              {TABS.map(t => (
                <button
                  key={t.id}
                  className={`calm-tab ${tab === t.id ? "is-active" : ""}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                  {t.count != null && (
                    <span className={`count ${t.urgent ? "rose" : ""}`}>{t.count}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="col-scroll" style={{ flex: 1 }}>
              {tab === "question" && <CalmQuestion />}
              {tab === "draft"    && <CalmDraft />}
              {tab === "issues"   && <CalmIssues />}
              {tab === "review"   && <CalmReview />}
              {tab === "evidence" && <CalmEvidence />}
            </div>
          </div>
        </div>

        {/* RIGHT — minimal summary */}
        <aside className="calm-rail">
          <div className="calm-stat">
            <div className="label">完成度</div>
            <div className="value tabular">72<span className="den">/ 100</span></div>
            <div className="bar" style={{ marginTop: 12 }}><i style={{ width: "72%" }} /></div>
            <div className="sub">承認可能ラインは <strong style={{ color: "var(--ink-2)" }}>80</strong>。あと 8 点。</div>
          </div>

          <div className="calm-stat" style={{ borderColor: "var(--rose-200)", background: "var(--rose-50)" }}>
            <div className="label" style={{ color: "var(--rose-ink)" }}>Blocker</div>
            <div className="value tabular" style={{ color: "var(--rose-ink)" }}>1<span className="den" style={{ color: "var(--rose-ink)", opacity: 0.6 }}>件</span></div>
            <div className="sub" style={{ color: "var(--rose-ink)", opacity: 0.85 }}>バックテスト未実施。承認前に評価が必要です。</div>
            <button className="btn btn-sm" style={{ marginTop: 12, background: "var(--surface)", borderColor: "var(--rose-200)", color: "var(--rose-ink)" }}>
              詳細を開く <I.ArrowRight />
            </button>
          </div>

          <div className="calm-stat">
            <div className="label">未解決項目</div>
            <div className="value tabular">3</div>
            <div className="sub">
              損切り条件 · 最大投資比率 が未設定。<br />
              買い増し条件 が曖昧。
            </div>
          </div>

          <div style={{
            background: "var(--surface)", border: "1px solid var(--border-strong)",
            borderRadius: 8, padding: 18,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <I.Lock />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Human approval boundary</span>
            </div>
            <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>
              最終判断はユーザー自身が行います。承認後は完成版として保存されます。
            </p>
            <div className="approval-reason" style={{ marginBottom: 12, fontSize: 12 }}>
              <I.Alert />
              <div>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>承認できない理由</div>
                <ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>
                  {C_REASONS.map((r, i) => <li key={i} style={{ marginBottom: 2 }}>{r}</li>)}
                </ul>
              </div>
            </div>
            <button className="btn btn-primary" aria-disabled style={{ width: "100%", marginBottom: 6 }}>
              <I.Check /> 完成版として承認
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <button className="btn btn-sm">再レビュー</button>
              <button className="btn btn-sm btn-danger">却下</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* =========================================================
 * Calm mobile — one-thing-at-a-time, large CTA
 * ========================================================= */
function CalmMobile() {
  const [picked, setPicked] = useState(null);
  return (
    <div className="calm" style={{ width: "100%", height: "100%", background: "var(--bg)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>ソニーグループ</div>
            <div className="mono text-xs muted">/ 6758</div>
          </div>
          <StatusPill status="Blocked" />
        </div>
      </div>

      <div className="col-scroll" style={{ flex: 1 }}>
        {/* Hero summary — only essentials */}
        <div className="calm-mobile-section">
          <div className="label" style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>完成度</div>
          <div className="mono tabular" style={{ fontSize: 30, fontWeight: 600, marginTop: 6 }}>
            72<span style={{ color: "var(--muted-2)", fontSize: 16, fontWeight: 400 }}> / 100</span>
          </div>
          <div className="bar" style={{ marginTop: 10 }}><i style={{ width: "72%" }} /></div>
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="pill pill-rose"><span className="dot"/>Blocker 1</span>
            <span className="pill pill-amber"><span className="dot"/>未解決 3</span>
            <span className="pill pill-slate"><span className="dot"/>未検証</span>
          </div>
        </div>

        {/* Focused question */}
        <div className="calm-mobile-section">
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
            次の質問 · 4 / 12
          </div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, lineHeight: 1.5 }}>
            損切り条件をどう決めますか？
          </h2>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.65, margin: "10px 0 14px" }}>
            損切り条件がないと、想定外に下がったときに判断がブレやすくなります。
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {C_QUESTION.choices.map(c => (
              <button key={c.id}
                className={`choice ${picked === c.id ? "is-selected" : ""}`}
                onClick={() => setPicked(c.id)}>
                <span className="choice-radio" />
                <span style={{ flex: 1, fontSize: 13.5 }}>{c.label}</span>
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
            <button className="btn btn-primary">回答を保存</button>
            <button className="btn">あとで決める</button>
          </div>
        </div>

        {/* Compact accordions for the rest */}
        <div className="calm-mobile-section" style={{ padding: 0 }}>
          {[
            { t: "ルール草案", v: "10 項目 · 設定済み 5", k: "draft" },
            { t: "未解決項目", v: "3 件", k: "issues" },
            { t: "AIレビュー", v: "Blocker 1 · Warning 2", k: "review" },
            { t: "検証証跡", v: "未検証", k: "ev" },
          ].map((s, i, a) => (
            <button key={s.k} style={{
              width: "100%", padding: "16px 18px", background: "transparent", border: "none", textAlign: "left",
              borderBottom: i === a.length - 1 ? "none" : "1px solid var(--border-subtle)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{s.t}</div>
                <div className="text-xs muted" style={{ marginTop: 2 }}>{s.v}</div>
              </div>
              <I.ArrowRight />
            </button>
          ))}
        </div>

        {/* Approval as full section */}
        <div className="calm-mobile-section">
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <I.Lock /><span style={{ fontSize: 13, fontWeight: 600 }}>Human approval boundary</span>
          </div>
          <div className="approval-reason" style={{ fontSize: 12, marginBottom: 12 }}>
            <I.Alert />
            <div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>承認できない理由</div>
              <ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>
                {C_REASONS.map((r, i) => <li key={i} style={{ marginBottom: 2 }}>{r}</li>)}
              </ul>
            </div>
          </div>
          <button className="btn btn-primary" aria-disabled style={{ width: "100%" }}>
            <I.Check /> 完成版として承認
          </button>
        </div>

        <div style={{ padding: "0 12px 16px" }}>
          <FinancialBoundaryNotice />
        </div>
      </div>
    </div>
  );
}

/* =========================================================
 * Canvas
 * ========================================================= */
function App() {
  return (
    <DesignCanvas
      title="Ruletrade-AI · Calm density"
      subtitle="2-column / tabbed / 単一タスク集中型"
    >
      <DCSection id="d" title="Desktop · 1 main + summary rail" defaultExpanded>
        <DCArtboard id="calm-desk" label="Calm · Rule session" width={1440} height={920} background="#f7f6f2">
          <CalmWorkbench />
        </DCArtboard>
      </DCSection>

      <DCSection id="m" title="Mobile · 単一タスク集中型" defaultExpanded>
        <DCArtboard id="calm-mob" label="Calm · Mobile" width={390} height={1180} background="#f7f6f2">
          <CalmMobile />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
