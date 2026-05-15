/* global React, ReactDOM, DesignCanvas, DCSection, DCArtboard,
   RuleSessionHeader, QuestionCard, RuleDraftView, RuleDraftField, FieldTag,
   CompletionScoreCard, QualityChecksList, WarningList, EvidenceSummary,
   ApprovalBoundaryPanel, FinancialBoundaryNotice, StatusPill, I */
const { useState, useMemo, useCallback } = React;

/* =========================================================
 * Seed data — Blocked / Sony 6758 / completion 72
 * ========================================================= */
const SEED_DRAFT = [
  {
    id: "thesis",
    title: "投資仮説",
    state: "set",
    body: (
      <p style={{ margin: 0 }}>
        上昇トレンド中の押し目を狙う。
        <br />
        ただし損切り条件と検証結果がないルールは採用しない。
      </p>
    ),
  },
  {
    id: "entry",
    title: "エントリー条件",
    state: "set",
    body: (
      <ul className="bullets">
        <li>終値が 50 日移動平均線を上回る</li>
        <li>20 日高値から 8% 以内の押し目を形成</li>
        <li>出来高が 20 日平均以上に回復</li>
      </ul>
    ),
  },
  {
    id: "exit",
    title: "イグジット条件",
    state: "set",
    body: (
      <ul className="bullets">
        <li>終値が 20 日移動平均線を 2 営業日連続で下回る</li>
      </ul>
    ),
  },
  {
    id: "stoploss",
    title: "損切り条件",
    state: "unset",
    unsetHint:
      "想定外の下落で判断がブレないよう、撤退ラインを明文化してください。",
  },
  {
    id: "takeprofit",
    title: "利確条件",
    state: "vague",
    body: (
      <p style={{ margin: 0 }}>
        「目標株価に到達したら段階的に利確」とのみ記載。
        <span className="muted"> 具体的な水準が未定義です。</span>
      </p>
    ),
    vagueHint:
      "目標株価の算出根拠 (PER, ターゲット倍率, 期限) を明記してください。",
  },
  {
    id: "size",
    title: "最大投資比率",
    state: "unset",
    unsetHint:
      "1 ルールあたりの最大投資比率と、口座資産に対する最大損失率を決めてください。",
  },
  {
    id: "addon",
    title: "買い増し条件",
    state: "vague",
    body: <p style={{ margin: 0 }}>「含み益が出ていたら追加検討」と記載。</p>,
    vagueHint: "追加条件 (株価, タイミング, 上限ロット) を明文化してください。",
  },
  {
    id: "event",
    title: "決算・イベント対応",
    state: "vague",
    body: <p style={{ margin: 0 }}>「決算前後は様子を見る」と記載。</p>,
    vagueHint: "決算前後を何営業日除外するかを明文化してください。",
  },
  {
    id: "broken",
    title: "仮説が崩れる条件",
    state: "set",
    body: (
      <ul className="bullets">
        <li>主要セグメントの売上成長が 2 四半期連続で前年割れ</li>
        <li>50 日移動平均線が下降に転じる</li>
      </ul>
    ),
  },
  {
    id: "context",
    title: "前提条件",
    state: "set",
    body: (
      <ul className="bullets">
        <li>
          1 ルールあたり口座資産の <strong>1.0%</strong> を最大損失に制限
        </li>
        <li>
          同一セクターの同時保有は <strong>3 銘柄</strong> まで
        </li>
      </ul>
    ),
  },
];

const QUESTIONS = [
  {
    idx: 4,
    total: 12,
    category: "撤退ルール · 損切り",
    prompt: "損切り条件をどう決めますか？",
    rationale:
      "損切り条件がないと、想定外に下がったときに判断がブレやすくなります。最低 1 つは明文化してください。",
    choices: [
      { id: "a", label: "株価が一定ラインを下回ったら撤退" },
      { id: "b", label: "投資仮説が崩れたら撤退" },
      { id: "c", label: "一定期間で成果が出なければ見直す" },
      { id: "d", label: "まだ決められない" },
    ],
    forField: "stoploss",
  },
];

const WARNINGS = [
  {
    id: "w1",
    sev: "Blocker",
    title: "バックテスト未実施",
    detail:
      "検証期間とサンプル数がないため、承認前に評価が必要です。直近 2 年以上を推奨します。",
    owner: "Backtest Evaluator",
    target: "Evidence",
    time: "3 分前",
  },
  {
    id: "w2",
    sev: "Warning",
    title: "イベント回避条件が曖昧",
    detail:
      "決算前後を何営業日除外するかを明文化してください。現状「様子を見る」のみ。",
    owner: "Risk Reviewer",
    target: "決算・イベント対応",
    time: "3 分前",
  },
  {
    id: "w3",
    sev: "Warning",
    title: "損切り条件が未設定",
    detail:
      "撤退ラインの明文化が必要です。投資仮説が崩れた場合の挙動も併記してください。",
    owner: "Risk Reviewer",
    target: "損切り条件",
    time: "5 分前",
  },
  {
    id: "w4",
    sev: "Info",
    title: "セクター集中の確認",
    detail:
      "現在の保有 2 銘柄が同一セクターです。ルール採用後に上限 3 銘柄に到達します。",
    owner: "Portfolio Reviewer",
    target: "前提条件",
    time: "12 分前",
  },
];

const UNRESOLVED = [
  {
    id: "u1",
    label: "損切り条件が未設定",
    field: "ルール草案 · 損切り条件",
    state: "unset",
  },
  {
    id: "u2",
    label: "最大投資比率が未設定",
    field: "ルール草案 · 最大投資比率",
    state: "unset",
  },
  {
    id: "u3",
    label: "買い増し条件が曖昧",
    field: "ルール草案 · 買い増し条件",
    state: "vague",
  },
  {
    id: "u4",
    label: "決算前後の除外日数が曖昧",
    field: "ルール草案 · 決算・イベント対応",
    state: "vague",
  },
  {
    id: "u5",
    label: "利確の目標水準が曖昧",
    field: "ルール草案 · 利確条件",
    state: "vague",
  },
];

const SCORE_BREAKDOWN = [
  { label: "投資仮説 / エントリー", score: 25, max: 25 },
  { label: "撤退 / 損切り", score: 8, max: 25 },
  { label: "資金管理 / リスク制限", score: 14, max: 25 },
  { label: "検証証跡", score: 0, max: 15 },
  { label: "ガバナンス", score: 25, max: 10 },
];

const EVIDENCE = {
  verified: false,
  window: "2022-01-01 〜 2024-12-31",
  sample: "84 trades",
  dd: "-12.4%",
  confidence: "Medium",
};

const SESSION = {
  ticker: "6758",
  name: "ソニーグループ",
  status: "Blocked",
  score: 72,
  savedAt: "2 秒前",
};

const DISABLED_REASONS = [
  "Blocker が 1 件残っています (バックテスト未実施)",
  "バックテスト未実施のため承認できません",
  "「損切り条件」「最大投資比率」が未設定です",
];

/* =========================================================
 * Three-column desktop workbench
 * ========================================================= */
function DesktopWorkbench() {
  const [activeQ, setActiveQ] = useState(QUESTIONS[0]);
  const [toast, setToast] = useState(null);

  const handleAnswer = (a) => {
    setToast(`回答を保存しました (${a.choice || "自由入力"})`);
    setTimeout(() => setToast(null), 2400);
  };
  const handleDefer = () => {
    setToast("「あとで決める」に保存しました");
    setTimeout(() => setToast(null), 2000);
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
      }}
    >
      <RuleSessionHeader {...SESSION} />

      {/* Tab/sub-nav */}
      <div
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          padding: "0 20px",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div className="tabs">
          <button className="tab is-active">ルール設計</button>
          <button className="tab">検証</button>
          <button className="tab">承認履歴</button>
          <button className="tab">権限</button>
        </div>
        <div style={{ flex: 1 }} />
        <span className="text-xs muted">セッション開始: 2026/05/14 10:42</span>
        <button className="btn btn-sm btn-ghost">
          <I.Search /> 質問を検索
        </button>
      </div>

      {/* 3-column body */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "380px 1fr 400px",
          gap: 16,
          padding: 16,
          background: "var(--bg)",
          minHeight: 0,
        }}
      >
        {/* LEFT — Next question */}
        <div
          className="col-scroll"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            paddingRight: 2,
          }}
        >
          <QuestionCard
            question={activeQ}
            onAnswer={handleAnswer}
            onDefer={handleDefer}
          />

          <div className="card">
            <div className="card-header">
              <h3>質問キュー</h3>
              <span className="text-xs muted">9 件</span>
            </div>
            <div>
              {[
                {
                  t: "最大投資比率を口座資産の何 % にしますか？",
                  c: "資金管理",
                },
                { t: "決算前後を何営業日除外しますか？", c: "イベント対応" },
                { t: "買い増しはどの条件で行いますか？", c: "ポジション管理" },
                { t: "バックテストの期間とサンプル数は？", c: "検証" },
              ].map((q, i) => (
                <div
                  key={i}
                  className="unresolved-row"
                  style={{ alignItems: "flex-start" }}
                >
                  <div className="left">
                    <span className="leader mono">
                      {String(i + 5).padStart(2, "0")}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: "var(--ink-2)", fontSize: 13 }}>
                        {q.t}
                      </div>
                      <div className="text-xs muted">{q.c}</div>
                    </div>
                  </div>
                  <button className="btn btn-sm btn-ghost">
                    <I.ArrowRight />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <FinancialBoundaryNotice />
        </div>

        {/* CENTER — Draft */}
        <div
          className="col-scroll"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            paddingRight: 2,
          }}
        >
          <RuleDraftView draft={SEED_DRAFT} onFocusQuestion={() => {}} />
        </div>

        {/* RIGHT — Review / Evidence / Approval */}
        <div className="col-scroll" style={{ paddingRight: 2 }}>
          <CompletionScoreCard
            score={SESSION.score}
            breakdown={SCORE_BREAKDOWN}
          />
          <QualityChecksList items={UNRESOLVED} />
          <WarningList items={WARNINGS} />
          <EvidenceSummary evidence={EVIDENCE} />
          <ApprovalBoundaryPanel
            canApprove={false}
            disabledReasons={DISABLED_REASONS}
            status={SESSION.status}
          />
        </div>
      </div>

      {toast && (
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--ink)",
            color: "#fafaf7",
            padding: "8px 14px",
            borderRadius: 6,
            fontSize: 13,
            boxShadow: "0 6px 24px rgba(0,0,0,0.18)",
            zIndex: 50,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <I.Check /> {toast}
        </div>
      )}
    </div>
  );
}

/* =========================================================
 * Mobile stacked
 * ========================================================= */
function MobileWorkbench() {
  const [open, setOpen] = useState({
    draft: true,
    unresolved: true,
    ai: true,
    ev: true,
  });
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const SectionToggle = ({ title, count, k, sub, badge }) => (
    <button
      onClick={() => toggle(k)}
      style={{
        width: "100%",
        background: "var(--surface)",
        border: "none",
        borderBottom: "1px solid var(--border-subtle)",
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        textAlign: "left",
      }}
    >
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--ink)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {title}{" "}
          {count != null && (
            <span className="mono text-xs muted">· {count}</span>
          )}
          {badge}
        </div>
        {sub && (
          <div className="text-xs muted" style={{ marginTop: 2 }}>
            {sub}
          </div>
        )}
      </div>
      <I.ChevronDown
        style={{
          transform: open[k] ? "rotate(0)" : "rotate(-90deg)",
          transition: "transform 160ms",
        }}
      />
    </button>
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Top app bar */}
      <div
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          padding: "10px 14px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            className="logomark"
            style={{ width: 26, height: 26, fontSize: 12 }}
          >
            R
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>
              {SESSION.name}
            </div>
            <div className="text-xs muted mono">
              / {SESSION.ticker} · 東証プライム
            </div>
          </div>
          <StatusPill status={SESSION.status} />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8,
          }}
        >
          <div
            style={{
              padding: "8px 10px",
              border: "1px solid var(--border-subtle)",
              borderRadius: 4,
            }}
          >
            <div
              className="text-xs muted"
              style={{
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              完成度
            </div>
            <div
              className="mono tabular"
              style={{ fontWeight: 600, fontSize: 14, marginTop: 2 }}
            >
              72
              <span style={{ color: "var(--muted-2)", fontWeight: 400 }}>
                {" "}
                / 100
              </span>
            </div>
            <div className="bar" style={{ marginTop: 4 }}>
              <i style={{ width: "72%" }} />
            </div>
          </div>
          <div
            style={{
              padding: "8px 10px",
              border: "1px solid var(--border-subtle)",
              borderRadius: 4,
            }}
          >
            <div
              className="text-xs muted"
              style={{
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              未解決
            </div>
            <div
              className="mono tabular"
              style={{
                fontWeight: 600,
                fontSize: 14,
                marginTop: 2,
                color: "var(--rose-ink)",
              }}
            >
              5
            </div>
            <div className="text-xs muted" style={{ marginTop: 2 }}>
              項目
            </div>
          </div>
          <div
            style={{
              padding: "8px 10px",
              border: "1px solid var(--border-subtle)",
              borderRadius: 4,
            }}
          >
            <div
              className="text-xs muted"
              style={{
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              保存
            </div>
            <div
              className="text-sm"
              style={{
                marginTop: 2,
                color: "var(--ink-2)",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <I.Save /> 2 秒前
            </div>
          </div>
        </div>

        <div
          className="disclaimer"
          style={{
            padding: "8px 10px",
            borderRadius: 4,
            border: "1px solid var(--border-subtle)",
            background: "var(--surface-2)",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <span className="icon">
            <I.Info />
          </span>
          <span>
            AIレビューは抜け漏れ確認用です。特定銘柄の売買を推奨するものではありません。
          </span>
        </div>
      </div>

      {/* Body — scrollable */}
      <div className="col-scroll" style={{ flex: 1 }}>
        {/* 次の質問 */}
        <div
          style={{
            background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <SectionToggle title="次の質問" k="q" sub="撤退ルール · 損切り" />
          <div
            style={{
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.5 }}>
              損切り条件をどう決めますか？
            </div>
            <div
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border-subtle)",
                borderLeft: "2px solid var(--ink-2)",
                borderRadius: 4,
                padding: "8px 10px",
                fontSize: 12,
                color: "var(--ink-2)",
                lineHeight: 1.55,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "var(--muted)",
                  marginBottom: 2,
                }}
              >
                なぜ必要か
              </div>
              損切り条件がないと、想定外の下落で判断がブレやすくなります。
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {QUESTIONS[0].choices.map((c, i) => (
                <button key={c.id} className="choice">
                  <span className="choice-radio" />
                  <span style={{ flex: 1, fontSize: 13 }}>{c.label}</span>
                </button>
              ))}
            </div>
            <textarea
              className="textarea"
              placeholder="自由入力 (任意)"
              style={{ minHeight: 56 }}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <button className="btn btn-primary">回答を保存</button>
              <button className="btn">あとで決める</button>
            </div>
          </div>
        </div>

        {/* ルール草案 */}
        <div
          style={{
            background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <SectionToggle
            title="ルール草案"
            k="draft"
            count="10"
            sub="v0.4 · 設定済み 5 / 10"
          />
          {open.draft && (
            <div>
              {SEED_DRAFT.map((f) => (
                <div
                  key={f.id}
                  style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 6,
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600 }}>
                        {f.title}
                      </span>
                      <FieldTag state={f.state} />
                    </div>
                    {f.state !== "set" && <I.ArrowRight />}
                  </div>
                  {f.state === "unset" ? (
                    <div className="text-xs muted">{f.unsetHint}</div>
                  ) : (
                    <div
                      style={{
                        fontSize: 12.5,
                        color: "var(--ink-2)",
                        lineHeight: 1.55,
                      }}
                    >
                      {f.body}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 未解決項目 */}
        <div
          style={{
            background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <SectionToggle
            title="未解決項目"
            k="unresolved"
            count={UNRESOLVED.length}
          />
          {open.unresolved &&
            UNRESOLVED.map((u, i) => (
              <div key={u.id} className="unresolved-row">
                <div className="left">
                  <span className="leader mono">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <div style={{ fontSize: 13 }}>{u.label}</div>
                    <div className="text-xs muted">{u.field}</div>
                  </div>
                </div>
                <FieldTag state={u.state} />
              </div>
            ))}
        </div>

        {/* AIレビュー */}
        <div
          style={{
            background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <SectionToggle
            title="AIレビュー"
            k="ai"
            sub={`${WARNINGS.filter((w) => w.sev === "Blocker").length} Blocker · ${WARNINGS.filter((w) => w.sev === "Warning").length} Warning · ${WARNINGS.filter((w) => w.sev === "Info").length} Info`}
          />
          {open.ai &&
            WARNINGS.map((w) => (
              <div
                key={w.id}
                className="severity-row"
                style={{ gridTemplateColumns: "auto 1fr" }}
              >
                <div className={`sev-bar sev-${w.sev.toLowerCase()}`} />
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 3,
                    }}
                  >
                    <span
                      className={`pill ${w.sev === "Blocker" ? "pill-rose" : w.sev === "Warning" ? "pill-amber" : "pill-slate"}`}
                    >
                      <span className="dot" />
                      {w.sev}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {w.title}
                    </span>
                  </div>
                  <div className="text-xs ink-2" style={{ lineHeight: 1.55 }}>
                    {w.detail}
                  </div>
                  <div className="text-xs muted" style={{ marginTop: 4 }}>
                    担当: {w.owner}
                  </div>
                </div>
              </div>
            ))}
        </div>

        {/* 検証証跡 */}
        <div
          style={{
            background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <SectionToggle
            title="検証証跡"
            k="ev"
            badge={
              <span className="pill pill-rose" style={{ marginLeft: 6 }}>
                <span className="dot" />
                未検証
              </span>
            }
          />
          {open.ev && (
            <>
              <div className="evidence-grid">
                <div className="evidence-cell">
                  <div className="k">Backtest window</div>
                  <div className="v muted">未実施</div>
                </div>
                <div className="evidence-cell">
                  <div className="k">Sample size</div>
                  <div className="v muted">—</div>
                </div>
                <div className="evidence-cell">
                  <div className="k">Max drawdown</div>
                  <div className="v muted">—</div>
                </div>
                <div className="evidence-cell">
                  <div className="k">Confidence</div>
                  <div className="v muted">—</div>
                </div>
              </div>
              <div
                style={{
                  padding: 12,
                  borderTop: "1px solid var(--border-subtle)",
                }}
              >
                <button className="btn" style={{ width: "100%" }}>
                  バックテストを開始
                </button>
              </div>
            </>
          )}
        </div>

        {/* Approval */}
        <div
          style={{
            background: "var(--surface)",
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <I.Lock />
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              Human approval boundary
            </span>
          </div>
          <div className="approval-reason">
            <I.Alert />
            <div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>
                承認できない理由
              </div>
              <ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>
                {DISABLED_REASONS.map((r, i) => (
                  <li key={i} style={{ marginBottom: 2 }}>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <button
            className="btn btn-primary"
            aria-disabled
            style={{ width: "100%" }}
          >
            <I.Check /> 完成版として承認
          </button>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <button className="btn">再レビュー</button>
            <button className="btn btn-danger">却下</button>
          </div>
          <FinancialBoundaryNotice />
        </div>
      </div>

      {/* Bottom safe-area persistent action */}
      <div
        style={{
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span className="pill pill-rose">
          <span className="dot" />
          承認 Disabled
        </span>
        <div className="text-xs muted" style={{ flex: 1, lineHeight: 1.4 }}>
          Blocker 1 件 · 未設定 2 件
        </div>
        <button className="btn btn-primary btn-sm">
          次の質問へ <I.ArrowRight />
        </button>
      </div>
    </div>
  );
}

/* =========================================================
 * Compose canvas
 * ========================================================= */
function App() {
  return (
    <DesignCanvas
      title="Ruletrade-AI · /rules/[sessionId]"
      subtitle="投資ルール設計ワークベンチ — Blocked / Sony 6758 / 完成度 72"
    >
      <DCSection
        id="desktop"
        title="Desktop · 3-column workbench"
        defaultExpanded
      >
        <DCArtboard
          id="desk-1"
          label="Rule session · Blocked"
          width={1440}
          height={1040}
          background="#f6f5f1"
        >
          <DesktopWorkbench />
        </DCArtboard>
      </DCSection>

      <DCSection
        id="mobile"
        title="Mobile · stacked view (no horizontal scroll)"
        defaultExpanded
      >
        <DCArtboard
          id="mob-1"
          label="Rule session · Mobile"
          width={390}
          height={1240}
          background="#f6f5f1"
        >
          <MobileWorkbench />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
