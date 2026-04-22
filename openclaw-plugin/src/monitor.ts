import { createPluginRuntimeStore } from "openclaw/plugin-sdk/compat";
import type { ClawdbotConfig } from "openclaw/plugin-sdk/core";
import { resolveWeChatAccount } from "./accounts.js";
import { createWeChatClient, getUpdates, checkLogin } from "./client.js";

// Runtime store — same pattern as Feishu plugin
const { setRuntime: setWeChatRuntime, getRuntime: getWeChatRuntime } =
  createPluginRuntimeStore<any>("WeChat FileHelper runtime not initialized");
export { setWeChatRuntime, getWeChatRuntime };

export type MonitorWeChatOpts = {
  config?: ClawdbotConfig;
  runtime?: any;
  abortSignal?: AbortSignal;
  accountId?: string;
};

export async function monitorWeChatProvider(opts: MonitorWeChatOpts = {}): Promise<void> {
  const cfg = opts.config;
  if (!cfg) {
    throw new Error("Config is required for WeChat FileHelper monitor");
  }

  const log = opts.runtime?.log ?? console.log;
  const error = opts.runtime?.error ?? console.error;
  const account = resolveWeChatAccount({ cfg, accountId: opts.accountId });

  if (!account.enabled || !account.configured) {
    throw new Error(`WeChat FileHelper account "${account.accountId}" not configured or disabled`);
  }

  const client = createWeChatClient(account.apiUrl);

  // Verify login status
  const loggedIn = await checkLogin(client);
  if (!loggedIn) {
    log(`[wechat-filehelper] WARNING: WeChat not logged in at ${account.apiUrl}`);
  } else {
    log(`[wechat-filehelper] Connected to WeChat API at ${account.apiUrl}`);
  }

  // Skip all historical messages on startup — only process new ones
  let offset = 0;
  try {
    const { updates, nextOffset } = await getUpdates(client, 0);
    offset = nextOffset;
    log(`[wechat-filehelper] Skipped ${updates.length} historical messages, starting from offset ${offset}`);
  } catch (err) {
    log(`[wechat-filehelper] Failed to fetch initial offset: ${String(err)}`);
  }

  const processedIds = new Set<string>();

  while (!opts.abortSignal?.aborted) {
    try {
      const { updates, nextOffset } = await getUpdates(client, offset);
      offset = nextOffset;

      for (const update of updates) {
        const message = update.message;
        if (!message) continue;

        const msgId = String(message.message_id);
        if (processedIds.has(msgId)) continue;

        // Filter out bot's own replies (sent_ prefix = outgoing messages)
        if (msgId.startsWith("sent_")) continue;

        processedIds.add(msgId);

        // In WeChat FileHelper, all messages appear as is_from_bot=true
        // because it's a self-chat channel. Don't skip based on this flag.

        const text = message.text ?? "";
        if (!text.trim()) continue;

        log(`[wechat-filehelper] Received message: ${text.slice(0, 80)}`);

        try {
          const core = getWeChatRuntime();
          const senderId = "filehelper-user";

          // Resolve agent routing
          const route = core.channel.routing.resolveAgentRoute({
            cfg,
            channel: "wechat-filehelper",
            accountId: account.accountId,
            peer: { kind: "direct", id: senderId },
          });

          // Format the message body
          const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(cfg);
          const body = core.channel.reply.formatAgentEnvelope({
            channel: "WeChat",
            from: senderId,
            timestamp: new Date(message.date ? message.date * 1000 : Date.now()),
            envelope: envelopeOptions,
            body: text,
          });

          // Build inbound context
          const ctxPayload = core.channel.reply.finalizeInboundContext({
            Body: body,
            BodyForAgent: text,
            RawBody: text,
            CommandBody: text,
            From: senderId,
            To: "filehelper",
            SessionKey: route.sessionKey,
            AccountId: account.accountId,
            ChatType: "direct",
            SenderName: "WeChat User",
            SenderId: senderId,
            Provider: "wechat-filehelper",
            Surface: "wechat-filehelper",
            MessageSid: msgId,
            Timestamp: Date.now(),
            WasMentioned: true,
            CommandAuthorized: true,
          });

          // Create reply dispatcher using SDK helper (same pattern as Feishu)
          const { sendText: clientSendText } = await import("./client.js");
          const replyClient = createWeChatClient(account.apiUrl);

          const { dispatcher, replyOptions, markDispatchIdle } =
            core.channel.reply.createReplyDispatcherWithTyping({
              responsePrefix: undefined,
              responsePrefixContextProvider: undefined,
              humanDelay: core.channel.reply.resolveHumanDelayConfig(cfg, route.agentId),
              onReplyStart: () => {},
              deliver: async (payload: any, info: any) => {
                const replyText = payload?.text ?? payload?.body ?? "";
                if (replyText.trim()) {
                  await clientSendText(replyClient, replyText);
                  log(`[wechat-filehelper] Sent reply (${info?.kind ?? "unknown"}): ${replyText.slice(0, 80)}`);
                }
              },
              onError: async (err: any) => {
                error(`[wechat-filehelper] Reply error: ${String(err)}`);
              },
              onIdle: async () => {},
              onCleanup: () => {},
            });

          const finalReplyOptions = {
            ...replyOptions,
            channel: "wechat-filehelper",
            accountId: account.accountId,
          };

          // Dispatch to agent
          await core.channel.reply.withReplyDispatcher({
            dispatcher,
            onSettled: () => { markDispatchIdle?.(); },
            run: () =>
              core.channel.reply.dispatchReplyFromConfig({
                ctx: ctxPayload,
                cfg,
                dispatcher,
                replyOptions: finalReplyOptions,
              }),
          });

          log(`[wechat-filehelper] Dispatch complete for message: ${msgId}`);
        } catch (dispatchErr) {
          error(`[wechat-filehelper] Dispatch error: ${String(dispatchErr)}`);
        }
      }
    } catch (err) {
      if (opts.abortSignal?.aborted) break;
      log(`[wechat-filehelper] Poll error: ${String(err)}`);
    }

    // Wait before next poll
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, account.pollInterval);
      opts.abortSignal?.addEventListener("abort", () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
    });

    // Prevent memory leak from processedIds
    if (processedIds.size > 5000) {
      const entries = [...processedIds];
      entries.splice(0, entries.length - 1000);
      processedIds.clear();
      entries.forEach((id) => processedIds.add(id));
    }
  }

  log(`[wechat-filehelper] Monitor stopped`);
}
