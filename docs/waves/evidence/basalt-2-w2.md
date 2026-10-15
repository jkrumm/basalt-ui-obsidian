# Wave 2 evidence — the basalt-ui 2.8.0 bump

Branch `basalt-2` (worktree `basalt-ui-obsidian-w2`), off `4fd72a7`. Pinned `2.8.0`, not the 2.7.3 the plan
text names (plan **Target** line).

## Gate

| Check                 | Result                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| `bun install`         | warning-free on a clean resolve (Mantine 9.7.2 across core, hooks, spotlight, modals, notifications) |
| `bun run pre`         | green: `fmt:check`, `oxlint .` (warnings only, 0 errors) + `check-theme`, `tsc --noEmit` ×3 (**0 errors**), `bun test` |
| `bun test`            | 260 pass, 1 skip, 0 fail (28 files), same as Wave 1                                            |
| `basalt-ui doctor`    | all 15 checks pass (was 3 hard failures on the probe): `install-parity`, `tsconfig-base`, `app-wiring` now green |
| Demo build            | green against `/tmp/basalt-w1-vault`, `vite build --outDir /tmp/basalt-w2-dist`               |
| Console, 6 routes     | 0 errors, 0 warnings, 0 page errors at 1440 (`@verifier`, puppeteer-core)                      |

Type errors: the probe predicted 6 plus a possible second wave from the `Register` change. Actual: 0 after
the wiring edit, no second wave.

## Pins and peers

| Where                                  | Change                                                                                    |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| `basalt-ui` (library dev, demo)        | `1.41.0` → `2.8.0` exact                                                                  |
| library peers                          | `basalt-ui ^1.30.2` → `^2.7.3`; `@mantine/core\|hooks ^9.3.0` → `^9.7.0` (dev `9.7.2`)    |
| demo                                   | Mantine `^9.7.0`; added `@mantine/modals`, `@mantine/notifications`; `motion 14.1.0`; `shiki`, `@shikijs/*` `4.5.0`; `@tanstack/react-query ^5.104.0` |

## Wiring decisions

- `main.tsx` follows `agent/templates/main.tpl`: `createBasaltRouter({ routeTree })` and
  `<BasaltProvider router={router} …/>`. `lib/query-client.ts`, `QueryClientProvider`, `RouterProvider`,
  `BasaltOverlays` and the two Mantine `styles.layer.css` imports are gone.
- **`onError` → `telemetry`.** Kept as a failures-only console sink (`console.error('[basalt]', type,
  attributes)`), preserving the 1.x behaviour; there is no backend (`AGENTS.md` § Verify & Monitor).
- **D4 resolved by 2.8.0.** `BasaltProviderProps` has `spotlight?: boolean` ("set `false` when the app owns
  its own palette"), so `spotlight={false}` has a 2.x equivalent after all; the demo passes it. The
  2.7.3-era "no opt-out" claim in the plan no longer holds on 2.8.0. Verified in the built bundle: Cmd+K and
  Ctrl+K each open exactly one dialog, the app's own `VaultSearchSpotlight`; `/` does nothing. Wave 3 owns
  the full D4 record.
- `__root.tsx`: `useBasaltNav` from `basalt-ui`, `useNav` deleted, `nav={VAULT_NAV}` on `BasaltShell`.
  `createRootRoute` kept: `doctor` and `tsc` did not ask for `createRootRouteWithContext`.
- `nav.tsx`: `defineNav`, `navGroup` from `basalt-ui`. The `Register` augmentation stays in `main.tsx`
  (same shape as the template).
- `apps/demo/tsconfig.json` extends `basalt-ui/configs/tsconfig.react-app.json`. The root
  `tsconfig.base.json` stays: the shipped base preset sets the identical compiler options, and the two
  libraries still extend the repo's own file. `check.yml` header needed no change (bin path unchanged).
- `basalt-ui sync`: 10 files updated (6 rules, 3 skills, AGENTS.md block) plus `.basalt/manifest.json`.

## Bundle vs Wave 1 (same scratch vault)

| Artifact                | 1.41.0  | 2.8.0   | Delta  |
| ----------------------- | ------- | ------- | ------ |
| entry `index-*.js`      | 667414  | 697066  | +29652 |
| `index-*.css`           | 280277  | 298523  | +18246 |
| vendor `dist-*.js`      | 1590430 | 1590430 | 0 (same hash `CsyB0UlE`) |
| shiki tsx chunk         | 175529  | 175529  | 0      |
| `assets/` file count    | 82      | 82      | 0      |
| SW precache             | 92 entries, 4437.12 KiB | 92 entries, 4537.28 KiB | +100.16 KiB |
| `sw.js`                 | 6301    | 6302    | +1     |

The CSS growth is consistent with the provider now owning the Mantine notifications layer and the
`BasaltOverlays`-era code moving into `basalt-ui`; the entry growth with the router bridge and
provider-mounted overlays. The split is not re-attributed here: Wave 5 explains it against the screenshots.
No Mantine sheet is shipped twice (the demo imports none directly). Not measured this wave: `build-id.txt`
(written by `make build`, which would overwrite the live `dist/`).

## Observations

- Mermaid's Google Fonts `@import` request appears twice on `/Showcase` (once in Wave 1): known, basalt
  ledger row 68, not worked around.
- Not checked this wave: service-worker behaviour, phone viewport, light scheme, Lighthouse. Waves 3 and 5.

## Review

`/review` (master..HEAD): 3 blocking claimed, 1 real. Fixed: React peers `^19.2.7` → `^19.3.0` (library and
demo; basalt 2.8.0 requires `^19.3.0`). Disproved: "no QueryClient" (the router-owned client serves
`useVaultIndexQuery`; the built reader renders the vault on all routes) and "`failed` may be misnamed"
(`BasaltEvent` carries a required `failed` boolean on every variant, `telemetry.d.ts`). `createBasaltTheme()`
is the provider default (`theme?` doc), so dropping the explicit call changes nothing. Comment wraps fixed.
Declined as out of scope: unused `@types/mdast`, `RootLayout` size, duplicated block (pre-existing code).
