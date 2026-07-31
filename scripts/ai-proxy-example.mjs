/**
 * 后端代理示例（Node ESM，零依赖）
 * ---------------------------------------------------------------
 * 作用：把 API Key 留在服务端，前端只访问同源的 /api/ai/chat，
 * 避免密钥暴露在浏览器。
 *
 * 用法：
 *   1. 把真实 Key 放进环境变量：  export OPENAI_API_KEY=sk-xxx
 *   2. node scripts/ai-proxy-example.mjs
 *   3. 工作台设置里：提供者=自定义后端，API Base=http://localhost:8787/api/ai
 *
 * 部署建议：Cloudflare Workers / Vercel Edge / 任意 Node 服务均可，
 * 关键是「服务端持有密钥 + 校验请求 + 限流」，不要把 Key 下发给前端。
 */
import { createServer } from "node:http";

const UPSTREAM = "https://api.openai.com/v1/chat/completions";
const PORT = Number(process.env.PORT || 8787);

const server = createServer(async (req, res) => {
  // 仅开放一个代理端点
  if (req.method !== "POST" || !req.url?.startsWith("/api/ai/chat")) {
    res.writeHead(404).end("not found");
    return;
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    res.writeHead(500).end("OPENAI_API_KEY 未配置");
    return;
  }

  // 简单读取请求体（可按需加大小限制 / 鉴权 / 限流）
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks).toString("utf8");

  try {
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body,
    });
    const text = await upstream.text();
    res.writeHead(upstream.status, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(text);
  } catch (e) {
    res.writeHead(502).end("upstream error: " + String(e));
  }
});

server.listen(PORT, () => {
  console.log(`AI 代理已启动： http://localhost:${PORT}/api/ai/chat`);
});
