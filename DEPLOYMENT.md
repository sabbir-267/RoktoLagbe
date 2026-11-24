# Deploying RoktoLagbe for free

| Part | Service | Free tier |
|---|---|---|
| Website (React) | Render **static site** | Fast CDN, never sleeps |
| API + chat (Node, Socket.IO) | Render **web service** | Sleeps after 15 min without visitors; the next visit waits ~1 minute while it wakes |
| Database | MongoDB **Atlas M0** | 512 MB, free forever |

Everything is described in [`render.yaml`](render.yaml), so Render creates both services in one go.

---

## 1. MongoDB Atlas: allow Render to connect

Render's free servers don't have a fixed IP address, so Atlas must accept connections from anywhere (the database password still protects it).

1. Atlas → your project → **Network Access** → **Add IP Address** → **Allow access from anywhere** (`0.0.0.0/0`) → Confirm.
2. Atlas → **Database** → **Connect** → **Drivers** → copy the connection string. Replace `<db_password>` with the real password and put the database name before the `?`:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/rokto_lagbe?retryWrites=true&w=majority`

## 2. Push the code to GitHub

Render deploys from GitHub. The code must be pushed to the branch you will deploy (for example `main`).

## 3. Create the services on Render

1. Sign up at <https://render.com> with your GitHub account (no card needed for free services).
2. **New +** → **Blueprint** → choose the `RoktoLagbe` repository and the branch → **Connect**.
3. Render shows the two services from `render.yaml` and asks for the secret values:

   | Variable | Service | What to enter |
   |---|---|---|
   | `MONGO_URI` | rokto-lagbe-api | The Atlas string from step 1 (required) |
   | `GOOGLE_CLIENT_ID` | rokto-lagbe-api | Your Google OAuth client ID (optional) |
   | `VITE_GOOGLE_CLIENT_ID` | rokto-lagbe | The same Google client ID (optional) |
   | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | rokto-lagbe-api | Email settings (optional, see step 5) |
   | `ANTHROPIC_API_KEY` | rokto-lagbe-api | Leave empty to use the free offline parser and assistant |

   `JWT_SECRET` is generated automatically by Render.
4. **Apply**. The first build takes a few minutes.

## 4. Check the addresses

Render names the services after `render.yaml`:

- Website: `https://rokto-lagbe.onrender.com`
- API: `https://rokto-lagbe-api.onrender.com` (test: open `/api/health`, it should say `"database":"connected"`)

If either name was taken, Render adds a suffix (e.g. `rokto-lagbe-x1y2.onrender.com`). Then fix the two cross-references in the Render dashboard (**Environment** tab) and redeploy:

- API service → `CLIENT_URL` = the website's real address (several allowed, comma-separated)
- Website → `VITE_API_URL` = the API's real address (the site must be **rebuilt** after changing it: **Manual Deploy** → **Clear build cache & deploy**)

## 5. Optional features

**Google sign-in.** Google Cloud Console → APIs & Services → Credentials → your OAuth client → **Authorized JavaScript origins** → add the website address (`https://rokto-lagbe.onrender.com`). Without this, the Google button shows an error on the live site.

**Email** (verification links, password reset by email). Free Render blocks outgoing SMTP ports, so Gmail SMTP cannot work there. Instead the site sends through a tiny Google Apps Script in your Gmail account, over HTTPS (about 100 emails/day free):

1. Sign in to the Gmail account that should send the emails, open <https://script.google.com> → **New project**, delete the sample code and paste [`server/scripts/gmail-relay.gs`](server/scripts/gmail-relay.gs).
2. **Project Settings** (gear) → **Script Properties** → **Add script property**: `RELAY_SECRET` = a long random value (`openssl rand -hex 32`).
3. **Deploy** → **New deployment** → type **Web app**, *Execute as* **Me**, *Who has access* **Anyone** → **Deploy** → authorize (Advanced → Go to project → Allow). Copy the **Web app URL** (ends in `/exec`).
4. Render → rokto-lagbe-api → **Environment**: `EMAIL_RELAY_URL` = that URL, `EMAIL_RELAY_SECRET` = the same random value → **Save, rebuild, and deploy**.

Without email, everything else works, but email verification is required to become a donor.

**SMS password reset** is off in production until an SMS provider is connected (`SMS_ENABLED=true`); users can still reset by email.

**Keeping the API awake.** Free services sleep after 15 minutes. To avoid the one-minute wait, create a free monitor at <https://uptimerobot.com> that opens `https://rokto-lagbe-api.onrender.com/api/health` every 10 minutes. One service running all month stays within Render's free 750 hours.

## 6. After deploying

- Log in with Google as the admin account, or set a password for it in **Account settings**.
- The free plan has no persistent disk: nothing is stored on the server itself (all data is in Atlas), so restarts are safe.
- Each push to the deployed branch redeploys both services automatically.

## Troubleshooting

| Symptom | Fix |
|---|---|
| API deploy fails with "Unsafe or missing configuration" | Read the deploy log; usually `MONGO_URI` is missing or still has `<db_password>` |
| `"database":"disconnected"` or timeouts | Atlas Network Access doesn't allow `0.0.0.0/0` |
| Website loads but every action fails with "Cannot reach the server" | `VITE_API_URL` is wrong, or the site wasn't rebuilt after changing it |
| Browser console shows a CORS error | `CLIENT_URL` on the API doesn't exactly match the website address (no trailing slash) |
| Google button error "origin not allowed" | Add the website address to the OAuth client's Authorized JavaScript origins |
| First page load after a while is slow | The free API was asleep; see "Keeping the API awake" |
