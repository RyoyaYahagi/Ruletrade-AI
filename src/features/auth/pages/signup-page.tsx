import { SignupForm } from "@/features/auth/components/signup-form";

export function SignupPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <p className="text-muted-foreground text-sm font-medium">Ruletrade-AI</p>
      <h1 className="mt-2 text-2xl font-semibold">アカウント作成</h1>
      <p className="text-muted-foreground mt-2 text-sm leading-6">
        投資ルールをユーザーごとに分離して扱うため、アカウントを作成します。
      </p>

      <div className="mt-6">
        <SignupForm />
      </div>
    </main>
  );
}
