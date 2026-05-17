## Fuel Books frontend

Minimal Next.js frontend that proxies the FastAPI backend via Next route handlers (BFF pattern) and stores the backend access token in an httpOnly cookie.

## Local development

Create your local env file:

```bash
cp .env.example .env.local
```

Then run the dev server:

```bash
npm run dev
```

Open `http://localhost:3000`.
