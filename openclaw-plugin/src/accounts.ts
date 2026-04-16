import type { ClawdbotConfig } from "openclaw/plugin-sdk/core";
import type { ResolvedWeChatAccount, WeChatFileHelperConfig } from "./types.js";

const DEFAULT_API_URL = "http://localhost:23051";
const DEFAULT_POLL_INTERVAL = 2000;
const DEFAULT_ACCOUNT_ID = "default";

export function resolveWeChatAccount(opts: {
  cfg: ClawdbotConfig;
  accountId?: string | null;
}): ResolvedWeChatAccount {
  const section = opts.cfg.channels?.["wechat-filehelper"] as
    | WeChatFileHelperConfig
    | undefined;

  const apiUrl = section?.apiUrl ?? DEFAULT_API_URL;
  const pollInterval = section?.pollInterval ?? DEFAULT_POLL_INTERVAL;

  return {
    accountId: opts.accountId ?? DEFAULT_ACCOUNT_ID,
    enabled: section?.enabled !== false,
    configured: Boolean(apiUrl),
    apiUrl,
    pollInterval,
    config: section ?? {},
  };
}

export function listWeChatAccountIds(_cfg: ClawdbotConfig): string[] {
  return [DEFAULT_ACCOUNT_ID];
}

export function resolveDefaultAccountId(): string {
  return DEFAULT_ACCOUNT_ID;
}
