import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Ruletrade-AI の考え方",
  description:
    "なぜ投資ルールを明確にし、記録しながら投資するのか。Ruletrade-AI のプロダクト哲学をご紹介します。",
};

export default function PhilosophyPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-5 py-12 sm:px-8">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b pb-8">
        <p className="text-sm font-medium text-muted-foreground">
          Ruletrade-AI
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          投資ルールを記録する理由
        </h1>
        <p className="text-base text-muted-foreground">
          感情や勘に頼らない、振り返り可能な投資判断のために
        </p>
      </div>

      {/* Core Philosophy */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">
          明確なルールが、判断の軸になる
        </h2>
        <p className="text-sm leading-7 text-foreground/90">
          Ruletrade-AI
          は、投資する前にルールを明確にし、レビューし、記録するためのアプリです。
          明確なルールは、感情的な売買判断を減らし、なぜその投資判断をしたのかを振り返りやすくします。
          また、長期投資を続けるための軸を持ちやすくし、投資判断と結果を記録することで、経験を勘や記憶だけに頼らない形で蓄積できます。
        </p>
        <p className="text-sm leading-7 text-foreground/90">
          蓄積された記録は、将来の判断をより再現性のあるものに近づけるための材料になります。
          同じ失敗を繰り返さないことは、投資において最も重要な学びの一つです。
        </p>
      </section>

      {/* User Value */}
      <section className="flex flex-col gap-4 rounded-lg border bg-background p-6">
        <h2 className="text-xl font-semibold">
          このアプリでできること
        </h2>
        <ul className="flex flex-col gap-3 text-sm leading-7 text-foreground/90">
          <li className="flex gap-3">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
            <span>
              投資ルールを明確にすることで、感情的な売買判断を減らしやすくする
            </span>
          </li>
          <li className="flex gap-3">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
            <span>
              結果が不利だった場合でも、判断プロセスに納得しやすくする
            </span>
          </li>
          <li className="flex gap-3">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
            <span>
              短期的な価格変動やニュースに振り回されにくくし、投資を続けやすくする
            </span>
          </li>
          <li className="flex gap-3">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
            <span>
              投資判断を記録することで、勘や記憶だけに頼らず、経験を振り返り可能な形で蓄積する
            </span>
          </li>
          <li className="flex gap-3">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
            <span>
              過去のルールと結果を振り返ることで、より再現性のある投資判断を身につけやすくする
            </span>
          </li>
          <li className="flex gap-3">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
            <span>
              リスク許容度、投資期間、好む市場、避けたい判断パターンなど、自分の投資哲学を明確にしやすくする
            </span>
          </li>
          <li className="flex gap-3">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
            <span>
              AI
              の提案を鵜呑みにせず、ユーザーが内容を確認し、承認・改善できる状態を保つ
            </span>
          </li>
        </ul>
      </section>

      {/* Context / Background */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">
          資産形成について考える背景
        </h2>
        <p className="text-sm leading-7 text-foreground/90">
          物価上昇、低金利、老後資金への不安、金融教育の不足などにより、個人が自分の将来に向けた資産形成について考える必要性は高まっています。
        </p>
        <p className="text-sm leading-7 text-foreground/90">
          ただし、このアプリは投資を一律に勧めるものではありません。投資には元本割れを含むリスクがあり、すべての人に同じ判断が適しているわけではありません。
        </p>
        <p className="text-sm leading-7 text-foreground/90">
          Ruletrade-AI
          が支援したいのは、「投資するべきだ」と誘導することではなく、ユーザーが投資を検討する場合に、感情や勘だけに頼らず、自分の状況・リスク許容度・目的に合ったルールを明確にし、記録し、振り返れるようにすることです。
        </p>
      </section>

      {/* AI and User Relationship */}
      <section className="flex flex-col gap-4 rounded-lg border bg-background p-6">
        <h2 className="text-xl font-semibold">
          AI は補助し、判断はユーザーが行う
        </h2>
        <p className="text-sm leading-7 text-foreground/90">
          Ruletrade-AI では、AI
          はルールの作成、レビュー、説明、評価を補助できます。しかし、最終的な承認と実行の主導権は常にユーザーに残ります。
        </p>
        <p className="text-sm leading-7 text-foreground/90">
          AI
          の出力は金融助言ではありません。投資成果を保証するものでもありません。ユーザーは、AI
          の提案を吟味し、自分の状況に合うかどうかを判断したうえで、承認または修正してください。
        </p>
      </section>

      {/* Disclaimer */}
      <section className="flex flex-col gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-6">
        <h2 className="text-base font-semibold text-destructive">
          重要なご注意
        </h2>
        <p className="text-sm leading-7 text-foreground/80">
          本アプリは投資の勧誘、金融商品の売買の勧誘、または特定の金融商品の推奨を目的としたものではありません。
          投資には元本割れを含むリスクが伴います。投資を行う場合は、ご自身の責任と判断において行ってください。
        </p>
        <p className="text-sm leading-7 text-foreground/80">
          アプリ内の情報や AI
          が生成する内容は、参考情報に過ぎず、金融助言、投資助言、または法・税務上のアドバイスを構成するものではありません。
          必要に応じて、税理士、金融機関、またはその他の専門家に相談することを推奨します。
        </p>
      </section>

      {/* Footer navigation */}
      <div className="flex items-center justify-between border-t pt-8">
        <Link
          href="/"
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          トップページに戻る
        </Link>
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          ダッシュボードへ
        </Link>
      </div>
    </main>
  );
}
