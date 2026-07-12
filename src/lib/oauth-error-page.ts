import { loadEnv } from "../config/env";

const env = loadEnv();

export function renderOAuthErrorPage(title: string, message: string): string {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const returnUrl = new URL("/dashboard/workflows", env.FRONTEND_URL).toString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle} — BotFlow</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f1117; color: #e8eaed; margin: 0; min-height: 100vh; display: grid; place-items: center; }
    .card { max-width: 480px; padding: 2rem; background: #1a1d27; border-radius: 12px; border: 1px solid #2a2f3d; }
    h1 { margin: 0 0 0.75rem; font-size: 1.25rem; color: #ff6b6b; }
    p { margin: 0 0 1.5rem; line-height: 1.5; color: #b8bcc8; }
    a { color: #7dd3fc; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${safeTitle}</h1>
    <p>${safeMessage}</p>
    <a href="${returnUrl}">Return to workflows</a>
  </div>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
