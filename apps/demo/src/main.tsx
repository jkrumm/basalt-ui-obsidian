// CSS layer order is load-bearing: the `.layer.css` Mantine variants (never `styles.css`), then
// `@mantine/spotlight`'s own layered sheet, then `basalt-ui/styles.css` last — see CLAUDE.md's
// "basalt-ui consumers" note.
import '@mantine/core/styles.layer.css'
import '@mantine/spotlight/styles.layer.css'
import 'basalt-ui/styles.css'
import './styles/safe-area.css'
import './styles/mobile-density.css'

import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { BasaltProvider, createBasaltTheme } from 'basalt-ui'
import { BasaltOverlays } from 'basalt-ui/commands'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { queryClient } from './lib/query-client'
import { routeTree } from './routeTree.gen'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const root = document.getElementById('root')
if (!root) throw new Error('root element not found')

createRoot(root).render(
  <StrictMode>
    <BasaltProvider
      theme={createBasaltTheme()}
      defaultColorScheme="dark"
      // oxlint-disable-next-line no-console
      onError={(error, ctx) => console.error('[basalt]', ctx, error)}
    >
      {/* spotlight={false}: this app registers no `basalt-ui/commands` command map, so the
          command-palette Spotlight would only ever be empty — src/lib/vault-search-spotlight.tsx
          owns Cmd+K instead, backed by useVaultSearch's MiniSearch ranking. */}
      <BasaltOverlays spotlight={false}>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </BasaltOverlays>
    </BasaltProvider>
  </StrictMode>,
)
