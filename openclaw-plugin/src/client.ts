import axios from "axios";
import type { AxiosInstance } from "axios";

export function createWeChatClient(apiUrl: string): AxiosInstance {
  return axios.create({
    baseURL: apiUrl,
    timeout: 30_000,
    headers: { "Content-Type": "application/json" },
  });
}

export async function checkLogin(client: AxiosInstance): Promise<boolean> {
  try {
    const res = await client.get("/");
    return Boolean(res.data?.logged_in);
  } catch {
    return false;
  }
}

export async function sendText(
  client: AxiosInstance,
  text: string,
  replyToMessageId?: string,
): Promise<{ messageId: string }> {
  const res = await client.post("/bot/sendMessage", {
    text,
    reply_to_message_id: replyToMessageId,
  });
  const messageId =
    res.data?.result?.message_id ?? String(Date.now());
  return { messageId };
}

export async function sendDocument(
  client: AxiosInstance,
  filePath: string,
  replyToMessageId?: string,
): Promise<{ messageId: string }> {
  const res = await client.post("/bot/sendDocument", {
    document: filePath,
    reply_to_message_id: replyToMessageId,
  });
  const messageId =
    res.data?.result?.message_id ?? String(Date.now());
  return { messageId };
}

export async function getUpdates(
  client: AxiosInstance,
  offset: number,
  limit = 20,
): Promise<{ updates: any[]; nextOffset: number }> {
  const res = await client.get("/bot/getUpdates", {
    params: { offset, limit },
  });
  const updates: any[] = res.data?.result ?? [];
  let nextOffset = offset;
  for (const u of updates) {
    if (u.update_id >= nextOffset) {
      nextOffset = u.update_id + 1;
    }
  }
  return { updates, nextOffset };
}

export async function setWebhook(
  client: AxiosInstance,
  url: string,
): Promise<void> {
  await client.post("/bot/setWebhook", { url });
}

export async function deleteWebhook(client: AxiosInstance): Promise<void> {
  await client.post("/bot/deleteWebhook");
}
