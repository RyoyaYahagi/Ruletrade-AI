"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signUpWithPassword } from "@/features/auth/services/auth-client-service";

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsLoading(true);
    setMessage(null);
    setErrorMessage(null);

    const { error } = await signUpWithPassword({ email, password });

    setIsLoading(false);

    if (error) {
      setErrorMessage(
        "アカウント作成に失敗しました。入力内容を確認してください。",
      );
      return;
    }

    setMessage("アカウントを作成しました。Todayへ移動します。");
    router.replace("/today");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block text-sm font-medium">
        メールアドレス
        <Input
          className="mt-1.5"
          type="email"
          value={email}
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>

      <label className="block text-sm font-medium">
        パスワード
        <Input
          className="mt-1.5"
          type="password"
          value={password}
          autoComplete="new-password"
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>

      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
          {message}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "作成中..." : "アカウント作成"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        既にアカウントがある場合は{" "}
        <Link className="font-medium text-foreground underline" href="/login">
          ログイン
        </Link>
        してください。
      </p>
    </form>
  );
}
