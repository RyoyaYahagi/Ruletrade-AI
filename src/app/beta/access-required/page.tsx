import { BetaInviteCodeForm } from "@/features/launch/components/beta-invite-code-form";

export default function Page() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center p-6">
      <p className="text-sm font-medium text-muted-foreground">Closed Beta</p>
      <h1 className="mt-2 text-2xl font-bold">
        招待されたユーザーのみ利用できます
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Ruletrade-AIは現在Closed
        Betaです。招待コードを持っている場合は入力してください。
      </p>
      <div className="mt-6">
        <BetaInviteCodeForm />
      </div>
    </main>
  );
}
