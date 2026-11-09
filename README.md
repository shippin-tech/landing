# ShippinTECH landing

Astro static site for shippin.tech plus a small self-hosted signup API.

```sh
npm install
npm run signup   # API on :8787, writes data/signups.jsonl
npm run dev      # site on :4321, proxies /api to :8787
npm test
npm run build    # static output in dist/
```

## Signup tiers

Positions are assigned in arrival order:

- 1-100: beta, hands-on support and deployment help (`path: assisted`)
- 101-500: waitlist, or self-deploy from GitHub (visitor's choice)
- 501+: waitlist

`GET /api/signup/count` returns the remaining seats. Set `SIGNUP_WEBHOOK_URL`
to also forward each new signup to a third-party tool. In production, serve
`dist/` and proxy `/api/` to the signup process (see `.env.example`).

## Interactive story ("video as data")

`src/scripts/story.ts` morphs a particle field between scenes as you scroll and
reacts to the pointer. Scenes are polylines in normalised -1..1 coordinates.
To replace the procedural scenes with data converted from real video, drop a
file at `public/data/scenes.json`:

```json
{ "version": 1, "scenes": [{ "name": "intro", "polylines": [[[-0.5, 0], [0.5, 0]]] }] }
```

The video-to-data converter itself is not included yet.

## Using it as a submodule

The main ShippinTECH repo references this repo at `landing/` as an optional
submodule, not pulled by default. See that repo's `landing/README` note in
`deploy/README.md`.
