This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Testing

| Command | What it runs |
|---|---|
| `npm test` | Vitest + Testing Library, once |
| `npm run test:watch` | the same, in watch mode |
| `npm run test:cov` | the same with coverage; thresholds in `vitest.config.mts` gate CI |
| `npm run test:e2e` | Playwright smoke run (builds the app and starts it on port 3100) |

Unit and component specs live next to the code they cover as `*.test.ts(x)`
and run in jsdom. The Playwright specs live in `e2e/` and drive a real
production build in Chromium; every `/api/v1` call is intercepted in the specs
(`e2e/api-mock.ts`), so no backend, Postgres or Redis is needed. The first
`npm run test:e2e` on a machine needs `npx playwright install chromium`.

The suite pins `TZ=America/Los_Angeles`: flight times come back as local
wall-clock strings that must never be UTC-normalised, and a UTC runner would
hide a regression there.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
