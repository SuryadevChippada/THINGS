# THINGS

A personal archive of small things I make on the internet.

Not a portfolio, not a product — closer to a digital sketchbook made out of
code. Some are useful. Most aren't. The idea is always the same: I wondered
if I could make this, so I did.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

```bash
npm run build      # production build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```

## How it's put together

```
src/
├── app/
│   ├── page.tsx        archive homepage
│   ├── about/          about
│   └── [id]/           one route per thing
├── things/
│   ├── registry.ts     the canonical index — ids, titles, dates, status
│   ├── 001/            one folder per thing
│   └── ...
├── components/
│   ├── archive/        the list, the timeline
│   ├── navigation/     back link
│   └── shared/         thing shell, lazy stage
├── hooks/              smooth scroll, reduced motion
└── lib/                dates, audio helpers
```

`registry.ts` is the index everything reads from. A thing is only marked
`complete` once it actually runs — the archive is honest about what has and
hasn't been built yet.

Every thing loads as its own chunk, so nothing heavy reaches the homepage.
Anything that needs a camera, a microphone or an audio context asks for it
only after you press something, and releases it on the way out.

## Stack

Next.js · TypeScript · Lenis for scrolling · Anime.js for the small stuff.
Individual things pull in whatever they need — Canvas, WebGL, Web Audio,
physics — and nothing before that.

The archive is black, warm white and copper. The things inside it are not
held to that, and shouldn't be.
