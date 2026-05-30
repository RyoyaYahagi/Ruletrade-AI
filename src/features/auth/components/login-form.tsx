"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signInWithPassword } from "@/features/auth/services/auth-client-service";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsLoading(true);
    setErrorMessage(null);

    const { error } = await signInWithPassword({ email, password });

    setIsLoading(false);

    if (error) {
      setErrorMessage(
        "ログインに失敗しました。メールアドレスとパスワードを確認してください。",
      );
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
      <label className="block text-sm font-medium">
        メールアドレス
        <Input
          className="mt-1.5"
          type="email"
          value={email}
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          data-testid="login-email-input"
        />
      </label>

      <label className="block text-sm font-medium">
        パスワード
        <Input
          className="mt-1.5"
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
          required
          data-testid="login-password-input"
        />
      </label>

      {errorMessage ? (
        <p data-testid="login-error-message" className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isLoading} data-testid="login-submit-button">
        {isLoading ? "ログイン中..." : "ログイン"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        アカウントがない場合は{" "}
        <Link className="font-medium text-foreground underline" href="/signup">
          作成
        </Link>
        できます。
      </p>
    </form>
  );
}
