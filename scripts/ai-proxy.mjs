#!/usr/bin/env node
/**
 * 个人项目工作台 · AI 代理（零依赖 Node 服务）
 * ----------------------------------------------------------------
 * 作用：把 AI 密钥留在服务端，前端只访问自己的域名，避免密钥暴露在浏览器。
 * 前端在「设置 → AI 服务」选择 provider=custom、apiBase=http://localhost:8787/v1
 * 即可走本代理；provider=mock 时前端完全不调用本服务。
 *
 * 运行：
 *   AI_API_KEY=sk-xxx node scripts/ai-proxy.mjs
 *   # 或写成 .env 后用 dotenv 之类加载（本脚本不强制依赖任何库）
 *
 * 支持：
 *   - POST /v1/chat/completions ：透传 OpenAI 兼容请求（含多图 image_url）
 *   - GET  /                     ：健康检查与配置信息
 *   - CORS 预检（OPTIONS）
 */

import http from "node:http";

// ---------- 配置（环境变量，启动时集中校验） ----------
const config = {
  port: Number(process.env.PORT || 8787),
  // 上游兼容 OpenAI 的 /chat/completions 基址
  upstreamBase: (process.env.AI_BASE || "https://api.openai.com/v1").replace(/\/$/, ""),
  apiKey: process.env.AI_API_KEY || "",
  model: process.env.AI_MODEL || "gpt-4o-mini",
  // 允许的前端来源（开发用 Vite 默认 5173）
  allowOrigin: process.env.ALLOW_ORIGIN || "http://localhost:5173",
  timeoutMs: Number(process.env.AI_TIMEOUT || 60000),
};

// 非致命缺失：允许启动，但请求会在缺少密钥时返回明确错误
if (!config.apiKey) {
  console.warn(
    "[ai-proxy] 警告：未设置 AI_API_KEY，代理已启动但每次 AI 请求会返回 500。请通过环境变量注入密钥。"
  );
}

// ---------- 结构化日志 ----------
function log(level, msg, meta = {}) {
  console.log(
    JSON.stringify({ ts: new Date().toISOString(), level, msg, ...meta })
  );
}

// ---------- CORS ----------
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", config.allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

// ---------- 转发 chat/completions ----------
async function handleChatCompletions(req, res) {
  if (!config.apiKey) {
    return sendJson(res, 500, {
      error: "AI_API_KEY 未配置，代理无法转发请求。请在服务端环境变量中设置后重启。",
    });
  }

  // 读取请求体
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 30 * 1024 * 1024) {
      return sendJson(res, 413, { error: "请求体过大（>30MB），已拒绝。" });
    }
    chunks.push(chunk);
  }
  const rawBody = Buffer.concat(chunks).toString("utf8");

  // 确保使用服务端 model（覆盖客户端误填），并记录图片数量用于日志
  let parsed = {};
  try {
    parsed = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return sendJson(res, 400, { error: "请求体不是合法 JSON。" });
  }
  const imageCount = (parsed.messages || [])
    .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
    .filter((p) => p && p.type === "image_url").length;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  const requestId = Math.random().toString(36).slice(2, 10);
  log("info", "forward chat/completions", { requestId, imageCount, model: config.model });

  try {
    const upstream = await fetch(`${config.upstreamBase}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ ...parsed, model: config.model }),
      signal: controller.signal,
    });

    const text = await upstream.text();
    clearTimeout(timer);
    log("info", "upstream responded", { requestId, status: upstream.status });

    res.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
    });
    res.end(text);
  } catch (e) {
    clearTimeout(timer);
    log("error", "upstream failed", { requestId, message: String(e?.message || e) });
    return sendJson(res, 502, {
      error: "上游 AI 服务调用失败：" + String(e?.message || e),
    });
  }
}

// ---------- 路由 ----------
const server = http.createServer(async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${config.port}`);
  if (req.method === "GET" && url.pathname === "/") {
    return sendJson(res, 200, {
      status: "ok",
      service: "workbench-ai-proxy",
      upstreamBase: config.upstreamBase,
      model: config.model,
      hasKey: Boolean(config.apiKey),
      note: "POST /v1/chat/completions 转发到上游；前端 provider=custom、apiBase=http://<host>:<port>/v1 即可使用。",
    });
  }

  if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
    return handleChatCompletions(req, res);
  }

  return sendJson(res, 404, { error: "Not Found" });
});

// ---------- 优雅关闭 ----------
function shutdown(signal) {
  log("info", "shutting down", { signal });
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

server.listen(config.port, () => {
  log("info", "ai-proxy listening", {
    port: config.port,
    upstreamBase: config.upstreamBase,
    allowOrigin: config.allowOrigin,
  });
});
