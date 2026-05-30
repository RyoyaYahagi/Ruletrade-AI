"use client";

import type { paths } from "@/generated/openapi-types";

type HttpMethod = "get" | "post" | "patch" | "put" | "delete";

async function typedFetch<Path extends keyof paths, Method extends HttpMethod>(
  path: Path,
  method: Method,
  options?: {
    body?: Method extends "post" | "patch" | "put"
      ? paths[Path][Method] extends {
          requestBody?: { content?: { "application/json"?: infer B } };
        }
        ? B
        : never
      : never;
  },
): Promise<
  | {
      data: paths[Path][Method] extends {
        responses: { 200: { content: { "application/json": infer R } } };
      }
        ? R
        : paths[Path][Method] extends {
              responses: { 201: { content: { "application/json": infer R } } };
            }
          ? R
          : never;
      error: null;
    }
  | {
      data: null;
      error: { code: string; message: string; requestId: string };
    }
> {
  const response = await fetch(path as string, {
    method: method.toUpperCase(),
    credentials: "include",
    headers: options?.body ? { "Content-Type": "application/json" } : undefined,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  const json = await response.json();

  if (!response.ok || json.ok === false) {
    return {
      data: null,
      error: json.error ?? {
        code: "INTERNAL_ERROR",
        message: "Unknown error",
        requestId: "",
      },
    };
  }

  return { data: json, error: null };
}

export const apiClient = {
  GET: <Path extends keyof paths>(path: Path) => typedFetch(path, "get"),
  POST: <Path extends keyof paths>(
    path: Path,
    body: NonNullable<Parameters<typeof typedFetch<Path, "post">>[2]>["body"],
  ) => typedFetch(path, "post", { body }),
  PATCH: <Path extends keyof paths>(
    path: Path,
    body: NonNullable<Parameters<typeof typedFetch<Path, "patch">>[2]>["body"],
  ) => typedFetch(path, "patch", { body }),
  DELETE: <Path extends keyof paths>(path: Path) => typedFetch(path, "delete"),
};
