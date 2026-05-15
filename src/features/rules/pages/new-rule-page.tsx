import { NewRuleForm } from "@/features/rules/components/new-rule-form";

export function NewRulePage() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold">新しい投資ルールを作る</h1>

      <p className="mt-2 text-sm text-muted-foreground">
        まずは銘柄コードや銘柄名を入力してください。
        AIが質問しながら、買い方・損切り・利確・最大投資比率を整理します。
      </p>

      <div className="mt-6">
        <NewRuleForm />
      </div>
    </main>
  );
}
