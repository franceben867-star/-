import { MAX_HISTORY_MESSAGES } from "./config.js";

export async function loadHistory(env, chatId) {
  const value = await env.MEMORY.get(`chat:${chatId}`);
  return value ? JSON.parse(value) : [];
}

export async function saveHistory(env, chatId, messages) {
  const trimmed = messages.slice(-MAX_HISTORY_MESSAGES);
  await env.MEMORY.put(`chat:${chatId}`, JSON.stringify(trimmed), {expirationTtl: 60*60*24*30});
  return trimmed;
}

export async function clearHistory(env, chatId) {
  await env.MEMORY.delete(`chat:${chatId}`);
}
