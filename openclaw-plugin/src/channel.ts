import type { ChannelPlugin, ChannelMeta } from "openclaw/plugin-sdk/core";
import {
  DEFAULT_ACCOUNT_ID,
} from "openclaw/plugin-sdk/core";
import {
  resolveWeChatAccount,
  listWeChatAccountIds,
  resolveDefaultAccountId,
} from "./accounts.js";
import { monitorWeChatProvider } from "./monitor.js";
import { wechatOutbound } from "./outbound.js";
import { createWeChatClient, sendText } from "./client.js";
import type { ResolvedWeChatAccount, WeChatFileHelperConfig } from "./types.js";

const meta: ChannelMeta = {
  id: "wechat-filehelper",
  label: "WeChat FileHelper",
  selectionLabel: "WeChat FileHelper (微信文件助手)",
  docsLabel: "wechat-filehelper",
  blurb: "Connect OpenClaw to WeChat via FileHelper API.",
  order: 80,
};

export const wechatFilehelperPlugin: ChannelPlugin<ResolvedWeChatAccount> = {
  id: "wechat-filehelper",
  meta,

  capabilities: {
    chatTypes: ["direct"],
    polls: false,
    threads: false,
    media: true,
    reactions: false,
    edit: false,
    reply: true,
  },

  agentPrompt: {
    messageToolHints: () => [
      "- WeChat FileHelper: omit `target` to reply to current conversation. Only supports direct messages via FileHelper.",
    ],
  },

  configSchema: {
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        enabled: { type: "boolean" },
        apiUrl: {
          type: "string",
          description: "WeChat FileHelper API URL",
          default: "http://localhost:23051",
        },
        pollInterval: {
          type: "integer",
          minimum: 500,
          description: "Polling interval in milliseconds",
          default: 2000,
        },
        dmPolicy: { type: "string", enum: ["open", "allowlist"] },
        allowFrom: {
          type: "array",
          items: { oneOf: [{ type: "string" }, { type: "number" }] },
        },
      },
    },
  },

  config: {
    listAccountIds: (cfg) => listWeChatAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveWeChatAccount({ cfg, accountId }),
    defaultAccountId: () => resolveDefaultAccountId(),
    isConfigured: (account) => account.configured,
    describeAccount: (account) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      apiUrl: account.apiUrl,
    }),
  },

  setup: {
    resolveAccountId: () => DEFAULT_ACCOUNT_ID,
    applyAccountConfig: ({ cfg }) => ({
      ...cfg,
      channels: {
        ...cfg.channels,
        "wechat-filehelper": {
          ...(cfg.channels?.["wechat-filehelper"] as WeChatFileHelperConfig),
          enabled: true,
        },
      },
    }),
  },

  onboarding: {
    async run({ cfg, prompter }) {
      await prompter.note(
        [
          "WeChat FileHelper channel connects OpenClaw to WeChat via the FileHelper API.",
          "",
          "Prerequisites:",
          "1. Start the wx-filehelper-api server: python main.py",
          "2. Scan QR code to login WeChat",
          "3. Default API URL: http://localhost:23051",
        ].join("\n"),
        "WeChat FileHelper Setup",
      );

      const existingSection = (cfg.channels?.["wechat-filehelper"] ?? {}) as WeChatFileHelperConfig;
      const currentUrl = existingSection.apiUrl ?? "http://localhost:23051";

      const apiUrl = await prompter.text({
        message: "WeChat FileHelper API URL",
        placeholder: "http://localhost:23051",
        initialValue: currentUrl,
        validate: (value: string) => {
          const v = (value ?? "").trim();
          if (!v) return "API URL is required";
          if (!v.startsWith("http")) return "Must start with http:// or https://";
          return undefined;
        },
      });

      const url = String(apiUrl ?? currentUrl).trim() || currentUrl;

      const dmPolicy = await prompter.select({
        message: "DM security policy",
        options: [
          { value: "open", label: "Open — accept all messages" },
          { value: "allowlist", label: "Allowlist — only approved senders" },
        ],
        initialValue: existingSection.dmPolicy ?? "open",
      });

      const updatedCfg = {
        ...cfg,
        channels: {
          ...cfg.channels,
          "wechat-filehelper": {
            ...existingSection,
            enabled: true,
            apiUrl: url,
            dmPolicy: dmPolicy ?? "open",
          },
        },
      };

      return updatedCfg;
    },
  },

  outbound: wechatOutbound,

  gateway: {
    startAccount: async (ctx) => {
      const account = resolveWeChatAccount({ cfg: ctx.cfg, accountId: ctx.accountId });
      ctx.setStatus({ accountId: ctx.accountId });
      ctx.log?.info(`starting wechat-filehelper[${ctx.accountId}] (api: ${account.apiUrl})`);
      return monitorWeChatProvider({
        config: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
        accountId: ctx.accountId,
      });
    },
  },
};
