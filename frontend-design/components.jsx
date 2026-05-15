/* global React */
const { useState, useMemo, useCallback, useEffect } = React;

/* =========================================================
 * Tiny inline icons (stroke, 16px, currentColor)
 * ========================================================= */
const I = {
  Lock: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
      <rect x="3" y="7" width="10" height="7" rx="1.2" /><path d="M5 7V5a3 3 0 0 1 6 0v2" />
    </svg>
  ),
  Info: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
      <circle cx="8" cy="8" r="6.5" /><path d="M8 7.2v3.6" /><circle cx="8" cy="5.2" r="0.7" fill="currentColor" stroke="none"/>
    </svg>
  ),
  Check: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="M3.5 8.5l3 3 6-6.5" /></svg>
  ),
  X: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><path d="M4 4l8 8M12 4l-8 8" /></svg>
  ),
  Alert: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
      <path d="M8 2L1.5 13.5h13L8 2z" /><path d="M8 6v3.5" /><circle cx="8" cy="11.5" r="0.7" fill="currentColor" stroke="none"/>
    </svg>
  ),
  Edit: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
      <path d="M3 13l1-3 7-7 2 2-7 7-3 1z" />
    </svg>
  ),
  Plus: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><path d="M8 3v10M3 8h10"/></svg>
  ),
  Save: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
      <circle cx="8" cy="8" r="6.5" /><path d="M5.5 8.2l1.8 1.8L11 6" />
    </svg>
  ),
  Clock: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
      <circle cx="8" cy="8" r="6.5" /><path d="M8 4.5V8l2.5 1.5" />
    </svg>
  ),
  ArrowRight: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
      <path d="M3.5 8h9M9 4.5L12.5 8 9 11.5" />
    </svg>
  ),
  ChevronDown: (p) => (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="M3.5 6l4.5 4 4.5-4" /></svg>
  ),
  Search: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
      <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/>
    </svg>
  ),
  Dot: (p) => (
    <svg viewBox="0 0 8 8" width="8" height="8" {...p}><circle cx="4" cy="4" r="3" fill="currentColor"/></svg>
  ),
};

/* =========================================================
 * Status pill (header)
 * ========================================================= */
function StatusPill({ status }) {
  const map = {
    Draft:      { cls: "pill-slate",   label: "Draft" },
    "In review":{ cls: "pill-indigo",  label: "In review" },
    Blocked:    { cls: "pill-rose",    label: "Blocked" },
    Approved:   { cls: "pill-emerald", label: "Approved" },
    Rejected:   { cls: "pill-slate",   label: "Rejected" },
  };
  const m = map[status] || map.Draft;
  return (
    <span className={`pill ${m.cls}`}>
      <span className="dot" /> {m.label}
    </span>
  );
}

/* =========================================================
 * RuleSessionHeader — top chrome (logo, status, score, save)
 * ========================================================= */
function RuleSessionHeader({ ticker, name, status, score, savedAt }) {
  return (
    <header>
      <div className="app-header">
        <div className="tool-row" style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="logomark">R</div>
            <div style={{ fontWeight: 600, fontSize: 13, letterSpacing: "-0.005em" }}>Ruletrade</div>
            <span className="text-xs muted" style={{ marginLeft: 2 }}>/ ルール設計</span>
          </div>

          <div style={{ width: 1, height: 22, background: "var(--border)" }} />

          <div className="crumb">
            <span className="muted">Workspaces</span>
            <span className="sep">/</span>
            <span className="muted">Personal</span>
            <span className="sep">/</span>
            <span style={{ color: "var(--ink)" }}>Rules</span>
            <span className="sep">/</span>
            <span className="mono" style={{ color: "var(--muted-2)", fontSize: 12 }}>session_8f2a</span>
          </div>

          <div style={{ flex: 1 }} />

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="text-xs muted" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <I.Save /> {savedAt} に自動保存
            </span>
            <div style={{ width: 1, height: 18, background: "var(--border)" }} />
            <button className="btn btn-sm btn-ghost">
              <I.Clock /> 履歴
            </button>
            <button className="btn btn-sm">
              <I.Edit /> ルールIDをコピー
            </button>
          </div>
        </div>
      </div>

      <div className="subheader">
        <div className="subhead-row">
          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: "-0.005em" }}>{name}</h1>
                <span className="mono" style={{ color: "var(--muted)", fontSize: 13 }}>/ {ticker}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="text-xs muted">東証プライム</span>
                <span className="text-xs" style={{ color: "var(--faint)" }}>·</span>
                <span className="text-xs muted">電気機器</span>
                <span className="text-xs" style={{ color: "var(--faint)" }}>·</span>
                <span className="text-xs muted mono">JPY 13,420 <span style={{ color: "var(--muted-2)" }}>+0.6%</span></span>
              </div>
            </div>
          </div>

          <div style={{ flex: 1 }} />

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <span className="text-xs muted" style={{ letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600 }}>完成度</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="mono tabular" style={{ fontWeight: 600, fontSize: 14 }}>{score}<span style={{ color: "var(--muted-2)", fontWeight: 400 }}> / 100</span></span>
                <div className="bar" style={{ width: 80 }}><i style={{ width: `${score}%` }} /></div>
              </div>
            </div>

            <div style={{ width: 1, height: 32, background: "var(--border)" }} />

            <StatusPill status={status} />
          </div>
        </div>

        {/* Disclaimer strip */}
        <div className="disclaimer">
          <span className="icon"><I.Info /></span>
          <span>
            AIレビューは投資ルールの抜け漏れ確認を目的としています。特定銘柄の売買を推奨するものではありません。最終判断はユーザー自身が行います。
          </span>
        </div>
      </div>
    </header>
  );
}

/* =========================================================
 * QuestionCard — left column
 * ========================================================= */
function QuestionCard({ question, onAnswer, onDefer }) {
  const [picked, setPicked] = useState(null);
  const [free, setFree] = useState("");

  const submit = () => {
    if (!picked && !free.trim()) return;
    onAnswer({ choice: picked, free: free.trim() });
    setPicked(null); setFree("");
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3>次の質問 · {question.idx} / {question.total}</h3>
        <span className="text-xs muted">残り {question.total - question.idx + 1} 問</span>
      </div>

      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
            {question.category}
          </div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, lineHeight: 1.5, letterSpacing: "0.005em" }}>
            {question.prompt}
          </h2>
        </div>

        <div style={{
          background: "var(--surface-2)", border: "1px solid var(--border-subtle)",
          borderLeft: "2px solid var(--ink-2)", borderRadius: 4,
          padding: "10px 12px", fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)" }}>なぜ必要か</span>
          </div>
          {question.rationale}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {question.choices.map((c, i) => (
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

        <div>
          <label className="field-label" style={{ display: "block", marginBottom: 6 }}>
            自由入力 (任意)
          </label>
          <textarea
            className="textarea"
            placeholder="自分の言葉で条件を書く。例: 終値が直近20日安値を下回ったら撤退。"
            value={free}
            onChange={(e) => setFree(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4 }}>
          <button className="btn btn-primary" onClick={submit} disabled={!picked && !free.trim()}>
            回答を保存 <I.ArrowRight />
          </button>
          <button className="btn" onClick={onDefer}>
            あとで決める
          </button>
          <div style={{ flex: 1 }} />
          <span className="text-xs muted">回答は <span className="kbd">⌘</span> <span className="kbd">↵</span></span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
 * RuleDraftField + RuleDraftView — center column
 * ========================================================= */
function FieldTag({ state }) {
  if (state === "set")   return <span className="tag tag-set">設定済み</span>;
  if (state === "vague") return <span className="tag tag-vague">曖昧</span>;
  return <span className="tag tag-unset">未設定</span>;
}

function RuleDraftField({ id, title, state, body, unsetHint, vagueHint, onFocusQuestion }) {
  return (
    <div className="draft-field" id={`field-${id}`}>
      <div className="draft-field-head">
        <div className="draft-field-title">
          <span>{title}</span>
          <FieldTag state={state} />
        </div>
        <div className="draft-field-actions">
          <button className="btn btn-sm btn-ghost" title="編集"><I.Edit /></button>
          {state !== "set" && (
            <button className="btn btn-sm" onClick={() => onFocusQuestion && onFocusQuestion(id)}>
              次に決める <I.ArrowRight />
            </button>
          )}
        </div>
      </div>

      <div className="draft-field-body">
        {state === "unset" ? (
          <div className="empty-field">
            <I.Alert />
            <div>
              <strong>未設定。</strong> {unsetHint}
            </div>
          </div>
        ) : state === "vague" ? (
          <>
            {body}
            <div style={{
              marginTop: 8, fontSize: 12, color: "var(--amber-ink)",
              background: "var(--amber-50)", border: "1px solid var(--amber-200)",
              borderRadius: 4, padding: "8px 10px", display: "flex", gap: 8, alignItems: "flex-start"
            }}>
              <I.Alert /> <span>{vagueHint}</span>
            </div>
          </>
        ) : body}
      </div>
    </div>
  );
}

function RuleDraftView({ draft, onFocusQuestion }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>ルール草案 · v0.4</h3>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span className="text-xs muted">10項目中 <span className="mono">{draft.filter(f => f.state === "set").length}</span> 設定済み</span>
          <button className="btn btn-sm btn-ghost"><I.Plus /> 項目を追加</button>
        </div>
      </div>
      <div>
        {draft.map(f => (
          <RuleDraftField key={f.id} {...f} onFocusQuestion={onFocusQuestion} />
        ))}
      </div>
    </div>
  );
}

/* =========================================================
 * CompletionScoreCard — right column
 * ========================================================= */
function CompletionScoreCard({ score, breakdown }) {
  const r = 32, c = 2 * Math.PI * r;
  const off = c - (score / 100) * c;
  return (
    <div className="rail-section">
      <div className="card-header">
        <h3>Completion Score</h3>
        <span className="text-xs muted">前回 +6</span>
      </div>
      <div className="card-body" style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <div className="score-ring">
          <svg>
            <circle cx="38" cy="38" r={r} stroke="var(--bg-2)" strokeWidth="6" fill="none" />
            <circle cx="38" cy="38" r={r} stroke="var(--ink)" strokeWidth="6" fill="none"
              strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
          </svg>
          <div className="label">
            <div>
              <div className="num">{score}</div>
              <div className="den">/ 100</div>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
          完成度が 80 以上で承認可能になります。<br />
          残り 3 項目を埋めれば 80 を超える見込みです。
        </div>
      </div>
      <div style={{ borderTop: "1px solid var(--border-subtle)" }}>
        {breakdown.map((b, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "7px 14px", borderBottom: i === breakdown.length - 1 ? "none" : "1px solid var(--border-subtle)",
            fontSize: 12.5
          }}>
            <span style={{ color: "var(--ink-2)" }}>{b.label}</span>
            <span className="mono tabular" style={{ color: b.score === b.max ? "var(--emerald-ink)" : "var(--muted)" }}>
              {b.score} / {b.max}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
 * QualityChecksList (未解決項目)
 * ========================================================= */
function QualityChecksList({ items, onFocus }) {
  return (
    <div className="rail-section">
      <div className="card-header">
        <h3>未解決項目 · {items.length}</h3>
        <button className="btn btn-sm btn-ghost">並び替え <I.ChevronDown /></button>
      </div>
      <div>
        {items.map((it, i) => (
          <div key={it.id} className="unresolved-row">
            <div className="left">
              <span className="leader mono">{String(i + 1).padStart(2, "0")}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "var(--ink)" }}>{it.label}</div>
                <div className="text-xs muted">{it.field}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <FieldTag state={it.state} />
              <button className="btn btn-sm" onClick={() => onFocus && onFocus(it.id)}>決める</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
 * WarningList — AIレビュー
 * ========================================================= */
function WarningList({ items }) {
  return (
    <div className="rail-section">
      <div className="card-header">
        <h3>AIレビュー</h3>
        <span className="text-xs muted">{items.filter(i => i.sev === "Blocker").length} Blocker · {items.filter(i => i.sev === "Warning").length} Warning · {items.filter(i => i.sev === "Info").length} Info</span>
      </div>
      <div>
        {items.map((w) => (
          <div key={w.id} className="severity-row">
            <div className={`sev-bar sev-${w.sev.toLowerCase()}`} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                <span className={`pill ${w.sev === "Blocker" ? "pill-rose" : w.sev === "Warning" ? "pill-amber" : "pill-slate"}`}>
                  <span className="dot" />{w.sev}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{w.title}</span>
              </div>
              <div className="text-sm ink-2" style={{ lineHeight: 1.6 }}>{w.detail}</div>
              <div style={{ display: "flex", gap: 12, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span className="text-xs muted">担当: <span style={{ color: "var(--ink-2)" }}>{w.owner}</span></span>
                <span className="text-xs muted">対象: <span className="mono" style={{ color: "var(--ink-2)" }}>{w.target}</span></span>
                <span className="text-xs muted">{w.time}</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <button className="btn btn-sm">対応</button>
              <button className="btn btn-sm btn-ghost">却下</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
 * EvidenceSummary — 検証証跡
 * ========================================================= */
function EvidenceSummary({ evidence }) {
  const verified = evidence.verified;
  return (
    <div className="rail-section">
      <div className="card-header">
        <h3>検証証跡</h3>
        {verified
          ? <span className="pill pill-emerald"><span className="dot"/>検証済み</span>
          : <span className="pill pill-rose"><span className="dot"/>未検証</span>}
      </div>
      <div className="evidence-grid">
        <div className="evidence-cell">
          <div className="k">Backtest window</div>
          <div className={`v ${verified ? "" : "muted"}`}>{verified ? evidence.window : "未実施"}</div>
        </div>
        <div className="evidence-cell">
          <div className="k">Sample size</div>
          <div className={`v ${verified ? "" : "muted"}`}>{verified ? evidence.sample : "—"}</div>
        </div>
        <div className="evidence-cell">
          <div className="k">Max drawdown</div>
          <div className={`v ${verified ? "" : "muted"}`}>{verified ? evidence.dd : "—"}</div>
        </div>
        <div className="evidence-cell">
          <div className="k">Confidence</div>
          <div className={`v ${verified ? "" : "muted"}`}>{verified ? evidence.confidence : "—"}</div>
        </div>
      </div>
      <div className="card-body tight" style={{ borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ flex: 1, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.55 }}>
          {verified
            ? "直近の検証期間とサンプル数を確認してください。"
            : "バックテストを実施するまで承認できません。"}
        </div>
        <button className="btn btn-sm">{verified ? "再実行" : "バックテストを開始"}</button>
      </div>
    </div>
  );
}

/* =========================================================
 * ApprovalBoundaryPanel — 承認境界
 * ========================================================= */
function ApprovalBoundaryPanel({ canApprove, disabledReasons, status, onApprove, onReject, onRevise }) {
  return (
    <div className="rail-section" style={{ borderColor: "var(--border-strong)" }}>
      <div className="card-header" style={{ background: "var(--surface-2)" }}>
        <h3 style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <I.Lock /> Human approval boundary
        </h3>
        <StatusPill status={status} />
      </div>
      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p className="text-sm ink-2" style={{ margin: 0, lineHeight: 1.6 }}>
          最終判断はユーザー自身が行います。承認すると、このルール草案は完成版として保存され、以降は編集できません。
        </p>

        {!canApprove && (
          <div className="approval-reason">
            <I.Alert />
            <div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>承認できない理由</div>
              <ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>
                {disabledReasons.map((r, i) => <li key={i} style={{ marginBottom: 2 }}>{r}</li>)}
              </ul>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button
            className="btn btn-primary"
            aria-disabled={!canApprove}
            onClick={() => canApprove && onApprove && onApprove()}
            style={{ gridColumn: "1 / -1" }}
            title={canApprove ? "完成版として承認" : disabledReasons[0]}
          >
            <I.Check /> 完成版として承認
          </button>
          <button className="btn" onClick={onRevise}>
            再レビューを依頼
          </button>
          <button className="btn btn-danger" onClick={onReject}>
            <I.X /> 却下
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4, borderTop: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", marginTop: 8 }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50%", background: "var(--ink-2)",
              color: "#fff", fontSize: 10, display: "grid", placeItems: "center", border: "2px solid var(--surface)"
            }}>YK</div>
          </div>
          <div className="text-xs muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
            承認者: 自分 (Yuki K.) · 全責任は承認者に帰属します
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
 * FinancialBoundaryNotice — small footer notice
 * ========================================================= */
function FinancialBoundaryNotice() {
  return (
    <div style={{
      fontSize: 11, color: "var(--muted)", lineHeight: 1.55,
      padding: "10px 14px", border: "1px solid var(--border-subtle)",
      borderRadius: 4, background: "var(--surface-2)"
    }}>
      Ruletrade-AI は投資ルールの設計を支援するワークベンチです。
      売買の指示・推奨は行いません。生成された内容は不完全な場合があります。
      実際の取引は、ご自身の判断と責任において行ってください。
    </div>
  );
}

/* expose */
Object.assign(window, {
  I, StatusPill, RuleSessionHeader, QuestionCard, RuleDraftField, RuleDraftView,
  CompletionScoreCard, QualityChecksList, WarningList, EvidenceSummary,
  ApprovalBoundaryPanel, FinancialBoundaryNotice, FieldTag,
});
