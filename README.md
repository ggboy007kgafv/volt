# Volt — Energy in Motion

Cinematic single-page brand site for the Volt energy drink: scroll-driven 4K frame
sequences, a liquid-glass navigation, a product lineup with interactive ratings,
and a customer-review section with an interactive fizz background.

## Stack

- React + TypeScript, bundled with Vite
- Tailwind CSS v4, React Bits components (GlassSurface, GooeyNav, MaskedHeading, CountUp)
- Canvas-based scroll film sequences (hero / sequence / about / strike frame sets)

## Development

```bash
npm install
npm run dev        # dev server on :3000
npm run build      # production build → dist/public
npm run check      # typecheck
```

## Deploy

Hosted on Vercel (free). Every push to `main` auto-deploys to production:

https://volt-energy-hero-full-source.vercel.app

Manual redeploy from the CLI:

```bash
npx vercel --prod
```
