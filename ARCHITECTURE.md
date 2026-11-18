# Architecture and verbal-verification notes

## Request flow

```text
Browser frontend (HTTPS origin A)
  POST /prjD6/api/login  -- credentials, credentials: include -->
Node API (HTTPS origin B)
  <-- Set-Cookie: prjD6_auth=<signed JWT>; HttpOnly; Secure --

Browser frontend
  GET /prjD6/api/session -- cookie attached by browser --> Node API
  <-- team + current server secret --
```

The frontend never receives or stores the JWT in JavaScript. It uses `fetch(..., { credentials: 'include' })`, so the browser attaches the cookie only to the API request. On every page load, the frontend calls `/api/session`; that is why an authenticated user can refresh or navigate without logging in again.

## JWT implementation

`backend/auth.js` builds an HS256 JWT without a library:

1. JSON-encode a fixed header and claims (`sub`, `team`, `iat`, `exp`, and a random `jti`).
2. Base64url-encode the header and claims.
3. Create an HMAC-SHA256 signature with the private `JWT_SIGNING_KEY` using Node `crypto`.
4. Join the three pieces with dots.

For verification, the API parses the three parts, recomputes the HMAC, compares signatures with `timingSafeEqual`, validates the header and claims, and rejects expired tokens. The token's lifetime is 9,000 seconds (2.5 hours), and the cookie's `Max-Age` is exactly the same.

## Why the secret is not inside the token

The session endpoint reads `APP_SECRET_VALUE` from the backend configuration after validating the JWT. This allows the secret to change during Phase 2 while previously issued JWTs remain valid until expiration, matching the assignment rule. The token proves the user authenticated; it does not cache the secret.

## Defense choices

- `HttpOnly` prevents JavaScript from reading the authentication cookie.
- `Secure` prevents the cookie being sent on HTTP in production.
- CORS allows credentials only from the exact configured frontend origin, never `*`.
- POST requests also require a matching `Origin` header, limiting cross-site form/CSRF-style requests.
- Login request bodies are small and bounded; requests are throttled per IP to make brute force less practical.
- JSON responses, CSP, clickjacking, MIME-sniffing, referrer, and cache-control headers reduce common browser risks.
- Password comparisons use a constant-time comparison. The password and signing key should be provider environment variables, not committed to source control.

## Important limitations to understand

No application is unattackable. This project deliberately keeps the required behavior that JWTs remain valid after logout and password changes, so an attacker who steals a valid cookie/token can use it until its expiration. HTTPS, a strong unique signing key, browser cookie protection, restrictive CORS, and not exposing server secrets are the primary mitigations.

