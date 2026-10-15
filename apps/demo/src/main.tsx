// `basalt-ui/styles.css` `@import`s the Mantine core, notifications and spotlight layers itself —
// importing them here as well would ship each sheet twice. App CSS comes after it.
import 'basalt-ui/styles.css'
import './shell/safe-area.css'
import './shell/mobile-density.css'

import { BasaltProvider, createBasaltRouter } from 'basalt-ui'
import type { BasaltEvent } from 'basalt-ui'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerServiceWorker } from './lib/sw-update'
import { routeTree } from './routeTree.gen'

const router = createBasaltRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Console sink for failures only: no telemetry backend exists (AGENTS.md § Verify & Monitor), so
// this keeps the 1.x `onError` behaviour — a failed route, query or render is visible in devtools.
function telemetry(event: BasaltEvent): void {
  if (!event.failed) return
  // oxlint-disable-next-line no-console
  console.error('[basalt]', event.type, event.attributes)
}

// Before render, not after: `registerSW({ immediate: true })` should be in flight while React
// mounts, so a tab opened moments after a deploy picks the new worker up on this load rather than
// the next one.
registerServiceWorker()

const root = document.getElementById('root')
if (!root) throw new Error('root element not found')

createRoot(root).render(
  <StrictMode>
    {/* spotlight={false}: this app registers no command map, so the provider's command-palette
        Spotlight would only ever hold `nav.*` entries — src/lib/vault-search-spotlight.tsx owns
        Cmd+K instead, backed by useVaultSearch's MiniSearch ranking. */}
    <BasaltProvider
      router={router}
      defaultColorScheme="dark"
      spotlight={false}
      telemetry={telemetry}
    />
  </StrictMode>,
)
