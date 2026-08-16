# Gmail (Google) Sign-In Setup

CyraCode already has a Google sign-in button on the login page under
"or continue with". It only appears once a Google OAuth Client ID is configured.

## 1. Create a Google OAuth Client ID

1. Go to https://console.cloud.google.com/apis/credentials
2. Create/select a project, then **Create Credentials → OAuth client ID**.
3. Application type: **Web application**.
4. Add your app origin under **Authorized JavaScript origins**:
   - `http://localhost:5173` (local dev)
   - your production origin (e.g. `https://app.cyracode.com`)
5. Click **Create** and copy the Client ID (starts with `...apps.googleusercontent.com`).

## 2. Configure the frontend

Open `frontend/.env` and paste the Client ID:

```
VITE_GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
```

Restart the Vite dev server. The button now appears and lets users sign in with Gmail.
If the email already has a CyraCode account it signs in; otherwise a new account is created.

## 3. (Optional) Harden the backend

The backend accepts the Google token at `POST /auth/google`. By default it skips
audience validation. To verify the token's audience, set the same Client ID in
`backend/.env`:

```
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
```

## 4. Google Maps key

`frontend/.env` also has `VITE_GOOGLE_MAPS_API_KEY` for the interactive map picker.
Without it the picker falls back to an address-only mode; Google sign-in is unaffected.
