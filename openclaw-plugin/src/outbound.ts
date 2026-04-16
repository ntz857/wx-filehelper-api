import type { ChannelOutboundAdapter } from "openclaw/plugin-sdk/core";
import { resolveWeChatAccount } from "./accounts.js";
import { createWeChatClient, sendText, sendDocument } from "./client.js";

export const wechatOutbound: ChannelOutboundAdapter = {
  deliveryMode: "direct",
  textChunkLimit: 4000,

  sendText: async ({ cfg, to, text, accountId, replyToId }) => {
    const account = resolveWeChatAccount({ cfg, accountId });
    const client = createWeChatClient(account.apiUrl);
    const result = await sendText(client, text, replyToId ?? undefined);
    return { channel: "wechat-filehelper", ...result };
  },

  sendMedia: async ({ cfg, to, text, mediaUrl, accountId, replyToId }) => {
    const account = resolveWeChatAccount({ cfg, accountId });
    const client = createWeChatClient(account.apiUrl);

    // Send caption text first if provided
    if (text?.trim()) {
      await sendText(client, text, replyToId ?? undefined);
    }

    // Send file if URL/path provided
    if (mediaUrl) {
      const result = await sendDocument(client, mediaUrl, replyToId ?? undefined);
      return { channel: "wechat-filehelper", ...result };
    }

    return { channel: "wechat-filehelper", messageId: String(Date.now()) };
  },
};
