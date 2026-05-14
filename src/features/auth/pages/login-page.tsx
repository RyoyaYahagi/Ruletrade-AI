import { LoginForm } from "@/features/auth/components/login-form";

export function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <p className="text-muted-foreground text-sm font-medium">Ruletrade-AI</p>
      <h1 className="mt-2 text-2xl font-semibold">ログイン</h1>
      <p className="text-muted-foreground mt-2 text-sm leading-6">
        投資ルールの作成・レビュー環境にログインします。
      </p>

      <div className="mt-6">
        <LoginForm />
      </div>
    </main>
  );
}
