"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  signInAnonymously,
  signInWithPassword,
} from "@/features/auth/services/auth-client-service";

type AuthMode = "password" | "guest";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingMode, setLoadingMode] = useState<AuthMode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoadingMode("password");
    setErrorMessage(null);

    const { error } = await signInWithPassword({ email, password });

    setLoadingMode(null);

    if (error) {
      setErrorMessage(
        "ログインに失敗しました。メールアドレスとパスワードを確認してください。",
      );
      return;
    }

    window.location.href = "/dashboard";
  }

  async function handleGuestLogin() {
    setLoadingMode("guest");
    setErrorMessage(null);

    const { error } = await signInAnonymously();

    setLoadingMode(null);

    if (error) {
      setErrorMessage(
        "ゲストログインに失敗しました。時間をおいてもう一度お試しください。",
      );
      return;
    }

    window.location.href = "/dashboard";
  }

  const isLoading = loadingMode !== null;

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
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>

      {errorMessage ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isLoading}>
        {loadingMode === "password" ? "ログイン中..." : "ログイン"}
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        <span>または</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={isLoading}
        onClick={() => void handleGuestLogin()}
      >
        {loadingMode === "guest" ? "ゲストログイン中..." : "ゲストで試す"}
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
