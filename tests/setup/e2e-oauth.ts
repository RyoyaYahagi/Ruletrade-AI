import { createHash } from "node:crypto";

export const e2eOAuth = {
  clientId: "e2e-muse",
  dummySecret: "e2e-oauth-dummy",
  redirectUri: `http://localhost:${process.env.E2E_TEST_PORT ?? "3100"}/?oauth_callback=1`,
  owner: "e2e-owner@example.test",
};

export const e2eOAuthEnv = {
  RULETRADE_OAUTH_CLIENT_ID: e2eOAuth.clientId,
  RULETRADE_OAUTH_CLIENT_SECRET_HASH: createHash("sha256")
    .update(e2eOAuth.dummySecret)
    .digest("hex"),
  RULETRADE_OAUTH_REDIRECT_URIS: e2eOAuth.redirectUri,
  RULETRADE_OAUTH_OWNER_LOGIN: e2eOAuth.owner,
  RULETRADE_OAUTH_SCOPES: "ledger:read ledger:write",
};
