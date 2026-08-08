/**
 * `preselectFirstAction` and `identityFilter` are the two pieces of `vault-search-spotlight.tsx`
 * that patch `@mantine/spotlight`'s own behavior (see that file's module doc) rather than just wire
 * it up — both are plain functions over public `@mantine/spotlight` surface, testable without
 * mounting the Spotlight component or a router.
 */
import { describe, expect, test } from 'bun:test'
import { createSpotlightStore } from '@mantine/spotlight'
import { preselectFirstAction } from '../src/lib/vault-search-spotlight.js'

function renderActionList(listId: string, count: number): HTMLElement {
  const list = document.createElement('div')
  list.id = listId
  for (let i = 0; i < count; i += 1) {
    const action = document.createElement('button')
    action.setAttribute('data-action', 'true')
    list.appendChild(action)
  }
  document.body.appendChild(list)
  return list
}

describe('preselectFirstAction', () => {
  test('does nothing when the store has no listId yet (Spotlight not opened)', () => {
    const store = createSpotlightStore()
    expect(() => preselectFirstAction(store)).not.toThrow()
    expect(store.getState().selected).toBe(-1)
  })

  test('does nothing when the list element is not in the DOM', () => {
    const store = createSpotlightStore()
    store.updateState((state) => ({ ...state, listId: 'missing-list' }))
    expect(() => preselectFirstAction(store)).not.toThrow()
  })

  test('marks the first action selected and clears a stale selection', () => {
    const store = createSpotlightStore()
    store.updateState((state) => ({ ...state, listId: 'results' }))
    const list = renderActionList('results', 3)
    const actions = list.querySelectorAll('[data-action]')
    actions[1]?.setAttribute('data-selected', 'true') // simulate a stale selection

    preselectFirstAction(store)

    expect(actions[0]?.getAttribute('data-selected')).toBe('true')
    expect(actions[1]?.hasAttribute('data-selected')).toBe(false)
    expect(store.getState().selected).toBe(0)

    list.remove()
  })

  test('does nothing when there are no actions in the list', () => {
    const store = createSpotlightStore()
    store.updateState((state) => ({ ...state, listId: 'empty-results' }))
    const list = renderActionList('empty-results', 0)

    expect(() => preselectFirstAction(store)).not.toThrow()
    expect(store.getState().selected).toBe(-1)

    list.remove()
  })
})
