/** Builds, serializes, and reloads a MiniSearch index over a {@link VaultIndex}'s notes. */
import MiniSearch from 'minisearch'
import type { Options as MiniSearchOptions } from 'minisearch'

import { stripMarkdownToText } from './strip-markdown.js'
import type { VaultIndex, VaultNote } from '../types.js'

export type SearchDocument = {
  readonly id: string
  readonly path: string
  readonly slug: string
  readonly title: string
  readonly description: string
  readonly tags: string
  readonly text: string
}

const SEARCH_OPTIONS: MiniSearchOptions<SearchDocument> = {
  idField: 'id',
  fields: ['title', 'description', 'tags', 'text'],
  storeFields: ['path', 'slug', 'title'],
}

function toSearchDocument(note: VaultNote): SearchDocument {
  const descriptionRaw = note.frontmatter['description']

  return {
    id: note.path,
    path: note.path,
    slug: note.slug,
    title: note.title,
    description: typeof descriptionRaw === 'string' ? descriptionRaw : '',
    tags: note.tags.join(' '),
    text: stripMarkdownToText(note.body),
  }
}

export function buildSearchIndex(index: VaultIndex): MiniSearch<SearchDocument> {
  const miniSearch = new MiniSearch<SearchDocument>(SEARCH_OPTIONS)
  miniSearch.addAll(index.notes.map(toSearchDocument))
  return miniSearch
}

export function serializeSearchIndex(miniSearch: MiniSearch<SearchDocument>): string {
  return JSON.stringify(miniSearch)
}

export function loadSearchIndex(json: string): MiniSearch<SearchDocument> {
  return MiniSearch.loadJSON<SearchDocument>(json, SEARCH_OPTIONS)
}
