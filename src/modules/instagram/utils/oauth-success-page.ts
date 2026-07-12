function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJsString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

export function renderOAuthSuccessPage(options: {
  frontendUrl: string;
  username: string;
  profilePictureUrl?: string | null;
  popup?: boolean;
}): string {
  const { frontendUrl, username, profilePictureUrl, popup } = options;
  const safeUsername = escapeHtml(username);
  const avatar = profilePictureUrl
    ? `<img src="${escapeHtml(profilePictureUrl)}" alt="${safeUsername}" class="avatar" />`
    : `<div class="avatar placeholder">IG</div>`;
  const channelsUrl = new URL('/dashboard/channels?instagram=connected', frontendUrl).toString();

  const popupScript = popup
    ? `<script>
  (function () {
    var payload = {
      type: 'botflow:instagram-connected',
      username: '${escapeJsString(username)}',
      profilePictureUrl: ${profilePictureUrl ? `'${escapeJsString(profilePictureUrl)}'` : 'null'}
    };
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(payload, '${escapeJsString(frontendUrl)}');
      }
    } catch (e) {}
    setTimeout(function () { window.close(); }, 400);
  })();
</script>`
    : `<meta http-equiv="refresh" content="1;url=${escapeHtml(channelsUrl)}" />
       <p><a href="${escapeHtml(channelsUrl)}">Continue to BotFlow</a></p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Instagram Connected — BotFlow</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f1117; color: #e8eaed; margin: 0; min-height: 100vh; display: grid; place-items: center; }
    .card { max-width: 420px; padding: 2rem; background: #1a1d27; border-radius: 16px; border: 1px solid #2a2f3d; text-align: center; }
    h1 { margin: 0 0 0.5rem; font-size: 1.25rem; color: #34d399; }
    p { margin: 0; color: #b8bcc8; line-height: 1.5; }
    .avatar { width: 72px; height: 72px; border-radius: 999px; object-fit: cover; margin: 1rem auto; border: 2px solid rgba(236,72,153,0.35); }
    .avatar.placeholder { display: grid; place-items: center; background: linear-gradient(135deg,#ec4899,#8b5cf6); color: white; font-weight: 700; }
    .username { margin-top: 0.75rem; font-weight: 600; color: #fff; }
    a { color: #7dd3fc; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Instagram Connected</h1>
    ${avatar}
    <p class="username">@${safeUsername}</p>
    <p>${popup ? 'Returning to BotFlow…' : 'Redirecting to your dashboard…'}</p>
  </div>
  ${popupScript}
</body>
</html>`;
}
