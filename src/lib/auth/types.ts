export type AppUser = {
  id: string;
  email: string | null;
  app_metadata: {
    role: string;
    provider?: string;
  };
  user_metadata: Record<string, unknown>;
  aud: "authenticated";
  created_at: string;
};
