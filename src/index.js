const TELEGRAM_API = "https://api.telegram.org";
const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models";

const SYSTEM_INSTRUCTION = `You are a helpful Arabic/English educational AI assistant inside Telegram.
For educational material, preserve the original English text when present, then provide accurate Arabic translation,
clear explanation, important terminology and abbreviations (write the full form), useful tables, an important summary,
and direct and indirect questions. Do not invent text that is not present in an uploaded document.
When the user asks for translation, translate faithfully. When the user asks for explanation, explain simply and accurately.
Format answers for Telegram using readable headings and Markdown-compatible plain text.`;

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (request.method === "GET") {
        return json({ ok: true, service: "telegram-gemini-bot" });
      }

      if (url.pathname !== "/webhook" || request.method !== "POST") {
        return new Response("Not Found", { status: 404 });
      }

      // Optional Telegram webhook authentication. If configured, Telegram must send this header.
      if (env.TELEGRAM_WEBHOOK_SECRET) {
        const supplied = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
        if (supplied !== env.TELEGRAM_WEBHOOK_SECRET) {
          return new Response("Unauthorized", { status: 401 });
        }
      }

      if (!env.TELEGRAM_BOT_TOKEN || !env.GEMINI_API_KEY) {
        return json({ ok: false, error: "Required secrets are not configured." }, 500);
      }

      const update = await request.json();
      const message = update.message;
      if (!message) return json({ ok: true });

      const chatId = message.chat?.id;
      if (!chatId) return json({ ok: true });

      if (message.text?.startsWith("/start")) {
        await sendTelegram(env, chatId,
          "🤖 أهلاً بك!\n\nأرسل نصًا أو صورة أو PDF وسأساعدك في الترجمة والشرح والتلخيص والأسئلة والجداول والمصطلحات.");
        return json({ ok: true });
      }

      if (message.text) {
        const answer = await askGemini(env, [
          { text: SYSTEM_INSTRUCTION },
          { text: message.text }
        ]);
        await sendTelegram(env, chatId, answer);
        return json({ ok: true });
      }

      const media = getMedia(message);
      if (!media) {
        await sendTelegram(env, chatId, "أرسل نصًا أو صورة أو ملف PDF.");
        return json({ ok: true });
      }

      await sendTelegram(env, chatId, "⏳ جارٍ قراءة الملف وتحليله...");

      const telegramFile = await getTelegramFile(env, media.fileId);
      const fileBytes = await downloadTelegramFile(env, telegramFile.file_path);

      // Telegram downloads are converted to base64 and sent as inline multimodal data.
      // Gemini's generateContent endpoint supports text, images and PDF input.
      const base64 = bytesToBase64(fileBytes);
      const answer = await askGemini(env, [
        { text: SYSTEM_INSTRUCTION },
        { text: media.prompt },
        { inlineData: { mimeType: media.mimeType, data: base64 } }
      ]);

      await sendTelegram(env, chatId, answer);
      return json({ ok: true });
    } catch (error) {
      console.error("BOT_ERROR", error?.message || error);
      return json({ ok: false }, 200);
    }
  }
};

function getMedia(message) {
  if (message.photo?.length) {
    const photo = message.photo[message.photo.length - 1];
    return {
      fileId: photo.file_id,
      mimeType: "image/jpeg",
      prompt: message.caption || "حلل هذه الصورة واشرح محتواها بالعربية، مع الحفاظ على النص الإنجليزي المهم."
    };
  }

  if (message.document) {
    const mime = message.document.mime_type || "";
    if (mime === "application/pdf" || message.document.file_name?.toLowerCase().endsWith(".pdf")) {
      return {
        fileId: message.document.file_id,
        mimeType: "application/pdf",
        prompt: message.caption || "اقرأ ملف PDF كاملًا قدر الإمكان، ثم ترجمه واشرحه ونظمه مع المصطلحات والاختصارات والجداول والتلخيص والأسئلة."
      };
    }
  }

  return null;
}

async function askGemini(env, parts) {
  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  const endpoint = `${GEMINI_API}/${encodeURIComponent(model)}:generateContent`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": env.GEMINI_API_KEY
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }]
      },
      contents: [{
        role: "user",
        parts
      }],
      generationConfig: {
        temperature: 0.2
      }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("GEMINI_ERROR", response.status, detail);
    throw new Error("Gemini request failed");
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map(part => part.text || "")
    .join("")
    .trim();

  return text || "لم أتمكن من استخراج إجابة من Gemini.";
}

async function getTelegramFile(env, fileId) {
  const response = await fetch(
    `${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`
  );
  if (!response.ok) throw new Error("Telegram getFile failed");
  const data = await response.json();
  if (!data.ok || !data.result?.file_path) throw new Error("Telegram file path missing");
  return data.result;
}

async function downloadTelegramFile(env, filePath) {
  const response = await fetch(
    `${TELEGRAM_API}/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`
  );
  if (!response.ok) throw new Error("Telegram file download failed");
  return new Uint8Array(await response.arrayBuffer());
}

async function sendTelegram(env, chatId, text) {
  // Telegram text messages have a practical size limit; split long educational answers.
  const chunks = splitText(text || "لا توجد إجابة.");
  for (const chunk of chunks) {
    const response = await fetch(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        disable_web_page_preview: true
      })
    });
    if (!response.ok) console.error("TELEGRAM_SEND_ERROR", await response.text());
  }
}

function splitText(text, max = 3900) {
  const chunks = [];
  let rest = String(text);
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n", max);
    if (cut < Math.floor(max * 0.5)) cut = max;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n+/, "");
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function bytesToBase64(bytes) {
  let binary = "";
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) {
    binary += String.fromCharCode(...bytes.subarray(i, i + size));
  }
  return btoa(binary);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
