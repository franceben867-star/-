import { FREE_MODELS } from "./config.js";

async function jsonFetch(url, options) {
  const r = await fetch(url, options);
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = {}; }
  if (!r.ok) throw new Error(`HTTP_${r.status}`);
  return data;
}

export async function openrouter(env, messages, media) {
  const content = media ? [
    {type:"text",text:messages.at(-1)?.content || ""},
    {type:"image_url",image_url:{url:`data:${media.mime};base64,${media.bytes}`}}
  ] : messages.at(-1)?.content || "";
  const all = media ? [...messages.slice(0,-1),{role:"user",content}] : messages;
  const data = await jsonFetch("https://openrouter.ai/api/v1/chat/completions",{
    method:"POST",
    headers:{"content-type":"application/json","authorization":`Bearer ${env.OPENROUTER_API_KEY}`},
    body:JSON.stringify({model:FREE_MODELS.openrouter,messages:all})
  });
  return data.choices?.[0]?.message?.content || "";
}

export async function groq(env, messages) {
  const data = await jsonFetch("https://api.groq.com/openai/v1/chat/completions",{
    method:"POST",
    headers:{"content-type":"application/json","authorization":`Bearer ${env.GROQ_API_KEY}`},
    body:JSON.stringify({model:FREE_MODELS.groq,messages})
  });
  return data.choices?.[0]?.message?.content || "";
}

export async function gemini(env, messages, media) {
  const parts = [{text: messages.at(-1)?.content || ""}];
  if (media) parts.push({inlineData:{mimeType:media.mime,data:media.bytes}});
  const prompt = messages.length > 1
    ? messages.slice(0,-1).map(x=>`${x.role}: ${x.content}`).join("\n") + "\nuser: " + (messages.at(-1)?.content||"")
    : parts[0].text;
  parts[0].text = prompt;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${FREE_MODELS.gemini}:generateContent?key=${env.GEMINI_API_KEY}`;
  const data = await jsonFetch(url,{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({contents:[{role:"user",parts}]})
  });
  return data.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("") || "";
}

export async function route(env, messages, media=null) {
  const order = media ? ["gemini","openrouter"] : ["openrouter","gemini","groq"];
  const errors=[];
  for (const name of order) {
    if (!env[name==="openrouter"?"OPENROUTER_API_KEY":name==="gemini"?"GEMINI_API_KEY":"GROQ_API_KEY"]) continue;
    try {
      const answer = name==="gemini" ? await gemini(env,messages,media) : name==="openrouter" ? await openrouter(env,messages,media) : await groq(env,messages);
      if (answer.trim()) return {provider:name,answer};
    } catch(e) { errors.push(`${name}:${e.message}`); }
  }
  throw new Error("ALL_PROVIDERS_FAILED "+errors.join(" | "));
}
