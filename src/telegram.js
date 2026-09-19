function getBotToken(env) {
  return env.BOT_TOKEN || env.TELEGRAM_BOT_TOKEN;
}

export async function tg(env, method, body = {}) {
  const token = getBotToken(env);
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN_MISSING");

  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: {"content-type":"application/json"},
    body: JSON.stringify(body)
  });

  const data = await r.json();
  if (!r.ok || !data.ok) throw new Error(`TELEGRAM_${method}_${r.status}`);
  return data.result;
}

export async function sendMessage(env, chatId, text) {
  const chunks = [];
  for (let i=0;i<text.length;i+=4000) chunks.push(text.slice(i,i+4000));

  for (const chunk of chunks) {
    await tg(env,"sendMessage",{
      chat_id:chatId,
      text:chunk,
      disable_web_page_preview:true
    });
  }
}

export async function getTelegramFile(env, fileId) {
  const token = getBotToken(env);
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN_MISSING");

  const file = await tg(env,"getFile",{file_id:fileId});
  const r = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);

  if (!r.ok) throw new Error("TELEGRAM_FILE_DOWNLOAD_FAILED");

  const buf = await r.arrayBuffer();
  if (buf.byteLength > 20*1024*1024) throw new Error("FILE_TOO_LARGE_20MB");

  const bytes = new Uint8Array(buf);
  let binary = "";
  const step = 0x8000;

  for (let i=0;i<bytes.length;i+=step) {
    binary += String.fromCharCode(...bytes.subarray(i,i+step));
  }

  return {
    bytes:btoa(binary),
    mime:guessMime(file.file_path)
  };
}

function guessMime(path="") {
  const ext = path.split(".").pop().toLowerCase();
  return ({
    pdf:"application/pdf",
    jpg:"image/jpeg",
    jpeg:"image/jpeg",
    png:"image/png",
    webp:"image/webp",
    gif:"image/gif"
  })[ext] || "application/octet-stream";
}