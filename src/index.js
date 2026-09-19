import {sendMessage,getTelegramFile} from "./telegram.js";
import {loadHistory,saveHistory,clearHistory} from "./memory.js";
import {route} from "./providers.js";

const SYSTEM = "You are a helpful multilingual assistant. Answer clearly. If the user writes Arabic, answer Arabic. For study material, preserve important English terms and explain them accurately.";

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("AI Multi Router is running.");
    try {
      const update = await request.json();
      const m = update.message;
      if (!m) return new Response("OK");
      const chatId = m.chat.id;
      const input = m.text || m.caption || "";

      if (input === "/start") {
        await sendMessage(env,chatId,"🤖 AI Multi Router\n\nأرسل سؤالًا، صورة، أو PDF.\n\nالأوامر:\n/models — النماذج\n/clear — مسح الذاكرة\n/translate النص — ترجمة\n/summarize النص — تلخيص\n/help — المساعدة");
        return new Response("OK");
      }
      if (input === "/help") {
        await sendMessage(env,chatId,"📚 أستطيع: المحادثة، تحليل الصور، قراءة PDF، الترجمة، التلخيص، والاحتفاظ بسياق المحادثة.\n\nيمكنك إرسال صورة أو PDF مع سؤال في caption.");
        return new Response("OK");
      }
      if (input === "/models") {
        await sendMessage(env,chatId,"🔀 Router\n• OpenRouter: openrouter/free\n• Gemini: gemini-2.5-flash\n• Groq: openai/gpt-oss-120b\n\nيتم الانتقال تلقائيًا للمزود التالي عند فشل المزود الحالي أو وصوله لحده.");
        return new Response("OK");
      }
      if (input === "/clear") {
        await clearHistory(env,chatId);
        await sendMessage(env,chatId,"🧹 تم مسح ذاكرة المحادثة.");
        return new Response("OK");
      }

      let task = input;
      if (input.startsWith("/translate ")) task = "Translate the following text accurately. Keep technical terms and provide the translation only unless clarification is necessary:\n"+input.slice(11);
      if (input.startsWith("/summarize ")) task = "Summarize the following text accurately in clear bullet points, preserving important terms:\n"+input.slice(11);

      let media=null;
      if (m.photo?.length) {
        media=await getTelegramFile(env,m.photo.at(-1).file_id);
        task = task || "Analyze this image carefully and explain its contents.";
      } else if (m.document) {
        if (m.document.file_size && m.document.file_size > 20*1024*1024) throw new Error("FILE_TOO_LARGE_20MB");
        media=await getTelegramFile(env,m.document.file_id);
        if (media.mime !== "application/pdf") throw new Error("ONLY_PDF_DOCUMENTS_SUPPORTED");
        task = task || "Read this PDF carefully and explain its contents. Extract the important text and structure.";
      }

      if (!task && !media) {
        await sendMessage(env,chatId,"أرسل سؤالًا أو صورة أو PDF.");
        return new Response("OK");
      }

      const history=await loadHistory(env,chatId);
      const messages=[{role:"system",content:SYSTEM},...history,{role:"user",content:task}];
      await sendMessage(env,chatId,"⏳ جاري المعالجة...");
      const result=await route(env,messages,media);
      await saveHistory(env,chatId,[...history,{role:"user",content:task},{role:"assistant",content:result.answer}]);
      await sendMessage(env,chatId,`🤖 ${result.provider}\n\n${result.answer}`);
      return new Response("OK");
    } catch(e) {
      console.error(e);
      let msg="❌ حدث خطأ مؤقتًا. جرّب مرة أخرى.";
      if(e.message==="FILE_TOO_LARGE_20MB") msg="❌ الملف أكبر من 20MB.";
      if(e.message==="ONLY_PDF_DOCUMENTS_SUPPORTED") msg="❌ أرسل ملف PDF أو صورة.";
      if(e.message?.startsWith("ALL_PROVIDERS_FAILED")) msg="❌ كل مزودي الذكاء الاصطناعي غير متاحين حاليًا. جرّب لاحقًا.";
      return new Response(msg,{status:200});
    }
  }
};