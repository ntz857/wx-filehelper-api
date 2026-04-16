export type WeChatFileHelperConfig = {
  enabled?: boolean;
  apiUrl?: string;
  /** Polling interval in milliseconds for getUpdates */
  pollInterval?: number;
  /** DM security policy */
  dmPolicy?: "open" | "allowlist";
  allowFrom?: (string | number)[];
};

export type ResolvedWeChatAccount = {
  accountId: string;
  enabled: boolean;
  configured: boolean;
  apiUrl: string;
  pollInterval: number;
  config: WeChatFileHelperConfig;
};

export type WeChatSendResult = {
  messageId: string;
};
