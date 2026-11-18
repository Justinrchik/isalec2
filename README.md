# prjD6 Password Hackathon

This submission contains separate `frontend` and `backend` directories, as required. The browser app and API are deliberately configured to run on **different origins**. Authentication is implemented with Node's built-in `http`, `https`, and `crypto` modules—there are no authentication or JWT packages.

## What is included

- Login as `admin` with the initial password `BCIT12`
- A hand-built, signed HS256 JWT stored in an `HttpOnly`, `Secure` cookie
- A 2.5-hour JWT and cookie lifetime
- Server-side login verification and session verification
- Admin landing page showing team `prjD6`, the current secret, and the browser's live date/time
- Protected Admin Landing, Page 1, and Page 2 routes with navigation and logout
- CORS restricted to the configured frontend origin, bounded request bodies, login throttling, safe security headers, and origin checks for state-changing requests

## Run locally

Use two PowerShell windows from this project folder:

```powershell
node .\backend\server.js
node .\frontend\dev-server.js
```

Open `http://localhost:8080/prjD6/`. The local configuration uses HTTP only because it is a development server. The deployed application must use HTTPS, as described below.

## Deploy it as two HTTPS origins

1. Deploy the contents of `frontend` to a static host at a URL containing `prjD6`, for example `https://app.example.com/prjD6/`.
2. Deploy `backend` to a Node host at a different HTTPS origin containing `prjD6`, for example `https://api.example.com/prjD6/`.
3. Before deploying, edit `frontend/config.js` and set `API_ORIGIN` to the full backend origin and path. Example:

   ```js
   API_ORIGIN: 'https://api.example.com/prjD6'
   ```

4. Set these backend environment variables in the hosting provider, then restart it:

   ```text
   FRONTEND_ORIGIN=https://app.example.com
   JWT_SIGNING_KEY=<a-long-random-private-value>
   ```

   `FRONTEND_ORIGIN` is the origin only—no path and no trailing slash. The Node service listens on the provider's `PORT` automatically. TLS is normally terminated by the host, so the public URL is still HTTPS.
5. Visit the frontend URL, log in with `admin` / `BCIT12`, and verify the landing page.

The frontend and backend examples above are different origins even though they use the same site. Keeping them as sibling subdomains avoids common browser third-party-cookie restrictions while satisfying the assignment's different-origin requirement.

## Five-minute credential change

In the backend host's environment-variable settings, change both values before the attack phase:

```text
ADMIN_PASSWORD=<six-or-fewer-characters>
APP_SECRET_VALUE=<fewer-than-20-characters-with-no-spaces>
```

Restart/redeploy the backend once. Existing JWTs intentionally remain cryptographically valid until their expiration, as the assignment requires. Logout only removes the browser's cookie; it does not revoke previously issued JWTs.

## Submission

Create `prjD6_passwordHackathon.zip` with the `frontend` and `backend` folders at its top level. Do not include local `.env` files or production secrets. Post clickable HTTPS URLs for both deployed applications in Learning Hub.

## Team explanation notes

See [ARCHITECTURE.md](ARCHITECTURE.md) for a concise walkthrough each team member can use to explain the implementation and the main defenses.

