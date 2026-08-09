/**
 * `renderVaultIcon` — the `Li` prefix strip plus the static Lucide lookup, and specifically the
 * silent-fallback path the module doc calls out: an unrecognized name (a typo, or picking
 * `Gamepad2` when the vault names `Gamepad`) must render nothing rather than throwing.
 *
 * Asserted structurally (`React.isValidElement`/`.type`/`.props`), not via `@testing-library/react`
 * `render()` — this workspace resolves TWO React copies (root/packages pin `react@19.2.7`, but
 * `apps/demo`'s own `^19.2.7` range floats to `19.2.8`, see `node_modules/react` in each), which
 * trips "Invalid hook call" the moment anything actually mounts here. No existing `apps/demo` test
 * mounts a component either (`index-structure.test.ts` tests pure functions the same way) — this
 * is that convention, not a new one.
 */
import { describe, expect, test } from 'bun:test'
import { isValidElement } from 'react'
import { Camera } from 'lucide-react'
import { renderVaultIcon } from '../src/lib/vault-icons.js'

describe('renderVaultIcon', () => {
  test('a known Iconize name resolves to its stripped Lucide component', () => {
    const element = renderVaultIcon('LiCamera')
    expect(isValidElement(element)).toBe(true)
    expect(element && isValidElement(element) ? element.type : undefined).toBe(Camera)
  })

  test('the rendered icon is aria-hidden and sized to match the row label', () => {
    const element = renderVaultIcon('LiCamera')
    expect(isValidElement(element) ? element.props : undefined).toMatchObject({
      size: 14,
      'aria-hidden': 'true',
    })
  })

  test('an unknown name returns null rather than throwing', () => {
    expect(() => renderVaultIcon('LiGamepad2')).not.toThrow()
    expect(renderVaultIcon('LiGamepad2')).toBeNull()
  })

  test('a name with no Li prefix at all also returns null, not a crash', () => {
    expect(renderVaultIcon('NotAnIconizeName')).toBeNull()
  })
})
