# Aegos

**Spot the signal ahead of the crowd.** A live Solana market board with a reserved first row for the $AEGOS token.

[![Live site](https://img.shields.io/badge/live-aegos.online-DC4307)](https://aegos.online)
![Chain](https://img.shields.io/badge/chain-Solana-010101)
![License](https://img.shields.io/badge/license-MIT-2C1D13)

| | |
|---|---|
| Chain | Solana mainnet |
| Contract address | `TBA` (placeholder until announced) |
| Site | https://aegos.online |

## Overview

Aegos reads the most-boosted Solana tokens, prices each by its deepest pool, and lays them out on a single board that can be scanned in seconds. The site is static: plain HTML, CSS and ES modules, no framework and no runtime dependencies.

## Features

- Live board of the ten most-boosted Solana tokens, polled every 60 seconds, paused while the tab is hidden, with exponential backoff and last-good-data retention.
- Ticker built from the same feed.
- Pinned first row for $AEGOS. It shows the brand mark and placeholders until the contract address is stated, then fills from DexScreener and pump.fun, fetched in parallel.
- Top-of-page contract address slot, click to copy, inert until the address exists.
- Register pattern: every external fact (contract, socials, data sources) is a single record with a state of `stated`, `absent` or `unconfirmed`. Unstated records render inert and carry no link.
- Spring-physics reveals, hero parallax, spotlight hover, scroll progress, and a full reduced-motion fallback.

## Links

- Site: https://aegos.online
- X: not announced
- GitHub: not announced
- Whitepaper: [docs/whitepaper.md](docs/whitepaper.md)

## Develop

```bash
npm run build     # src/ -> dist/ (deploy output)
npm run verify    # gate suite, exit 0 only if all pass
npm run serve     # static preview of dist/ on :4173
```

State a contract address by editing the `ca` record in `src/js/register.js`, then rebuild.

## License

MIT, see [LICENSE](LICENSE).
