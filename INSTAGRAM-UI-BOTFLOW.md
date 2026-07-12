# Instagram UI in BotFlow (popup connect)

After backend deploy, apply frontend patch:

```bash
cd /path/to/frontend
bash /path/to/backend/patches/apply-frontend-instagram.sh .
```

Add to `channels-dashboard.tsx`:

```tsx
import { InstagramChannelsSection } from "@/components/channels/instagram-channels-section";

// below WhatsApp section:
<div className="mt-10 space-y-4">
  <h2 className="text-2xl font-semibold">Instagram</h2>
  <InstagramChannelsSection />
</div>
```

## Flow

1. User clicks **Connect Instagram** in BotFlow
2. Small **popup** opens for Meta login (not full redirect to instagram.com feed)
3. Popup closes automatically
4. BotFlow shows **@username** + **profile picture** card
5. User stays in BotFlow — no link to instagram.com

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/channels/instagram` | Connected account (username, avatar) |
| `DELETE /api/channels/instagram` | Disconnect |
| `GET /api/auth/instagram?token=JWT&popup=1` | Start OAuth in popup |

## Frontend proxy routes needed

```
/api/channels/instagram → backend
/api/auth/instagram → backend (for popup OAuth)
```
