/**
 * Public data model for `obsidian-vault-core` — an Obsidian vault reduced to a set of parsed
 * notes plus the indexes (`byPath`, `bySlug`, `backlinks`, `tags`, `tree`) and the wikilink
 * resolver (`resolve`) built on top of them. Everything here is plain, readonly, JSON-friendly
 * data — no class instances, no methods besides `VaultIndex.resolve`, which is a plain closure
 * over the note list, not vault state that needs disposing.
 */

/** One `[[target]]` / `[[target|alias]]` / `[[target#heading]]` / `![[embed]]` occurrence. */
export type VaultLink = {
  /** The full matched text, e.g. `'[[wiki/engineering/index|Engineering (wiki)]]'`. */
  readonly raw: string
  /** The link target as written, e.g. `'wiki/engineering/index'`. Trailing `.md` NOT stripped here. */
  readonly target: string
  /** Heading anchor, `'#'` stripped. */
  readonly anchor?: string
  /** Display text, `'|'` stripped. */
  readonly alias?: string
  /** Whether the link had a leading `!` (an embed). */
  readonly embed: boolean
  /** Vault-relative path of the resolved target note. `undefined` means a dead link. */
  readonly resolvedPath?: string
}

/** One heading in a note's body, slugged the same way anchors resolve. */
export type VaultHeading = {
  readonly depth: number
  readonly text: string
  readonly slug: string
}

/** One parsed vault note. */
export type VaultNote = {
  /** Vault-relative POSIX path, e.g. `'wiki/health/peptides/index.md'`. */
  readonly path: string
  /** URL slug — `path` minus the trailing `.md`. */
  readonly slug: string
  /** Filename minus extension, e.g. `'index'`. */
  readonly basename: string
  /** `frontmatter.title` if present, else `basename`. */
  readonly title: string
  /** Raw parsed frontmatter, unmodified beyond YAML parsing — never coerced or validated. */
  readonly frontmatter: Readonly<Record<string, unknown>>
  /** Markdown body with the frontmatter block stripped. */
  readonly body: string
  readonly headings: readonly VaultHeading[]
  readonly links: readonly VaultLink[]
  /** Normalized `frontmatter.tags` — always a string array, regardless of the source YAML shape. */
  readonly tags: readonly string[]
}

/** One inbound link: some other note links to the note this backlink is attached to. */
export type VaultBacklink = {
  /** Vault-relative path of the linking note. */
  readonly from: string
  readonly link: VaultLink
}

/** A folder/file tree node, for building vault navigation UI. */
export type VaultTreeNode = {
  readonly name: string
  readonly path: string
  readonly kind: 'folder' | 'note'
  /** Present only when `kind === 'folder'`. Folders sort before notes; each level sorts by title, case-insensitively. */
  readonly children?: readonly VaultTreeNode[]
  /** Present only when `kind === 'note'`. */
  readonly note?: VaultNote
  /**
   * The raw Iconize icon name (a Lucide id like `LiCamera`), when the vault's
   * `.obsidian/plugins/obsidian-icon-folder/data.json` names this node. Deliberately not resolved
   * to a component here — this package stays free of any icon library; a consumer maps the name to
   * whatever it renders with.
   */
  readonly icon?: string
}

/** The parsed vault: every note plus the indexes built over them. */
export type VaultIndex = {
  readonly notes: readonly VaultNote[]
  readonly byPath: ReadonlyMap<string, VaultNote>
  readonly bySlug: ReadonlyMap<string, VaultNote>
  /** Target note path -> every link that resolves to it. */
  readonly backlinks: ReadonlyMap<string, readonly VaultBacklink[]>
  /** Tag -> vault-relative paths of the notes carrying it. */
  readonly tags: ReadonlyMap<string, readonly string[]>
  readonly tree: VaultTreeNode

  /**
   * Resolves a raw wikilink `target` (as written, `.md` optional) from the note at `fromPath`.
   * Obsidian semantics: case-insensitive, NFC-normalized; a `/`-qualified target matches by path
   * suffix, a bare target matches by basename; ties break toward `fromPath`'s own folder, then
   * the shortest path. Returns `undefined` when nothing matches (a dead link).
   */
  resolve(target: string, fromPath: string): VaultNote | undefined
}

/** Options for {@link readVault}. */
export type ReadVaultOptions = {
  /**
   * Additional ignore entries, same shape as Obsidian's `userIgnoreFilters`: a path prefix
   * ending in `/` ignores a folder, an exact vault-relative path ignores one file.
   */
  readonly ignore?: readonly string[]
  /**
   * When true (the default), also read `<dir>/.obsidian/app.json` and honor its
   * `userIgnoreFilters`. A missing or malformed `app.json` is not an error — it just contributes
   * no extra filters.
   */
  readonly useObsidianIgnoreFilters?: boolean
  /**
   * When true (the default), honors every piece of Obsidian plugin config this package knows how
   * to read: `.obsidian/plugins/obsidian-icon-folder/data.json` (per-path icons) and `sorting-spec`
   * frontmatter (explicit sibling order, scanned across every parsed note — see
   * `collectSortingSpecs`), and — because a note can carry a `sorting-spec` while also being
   * individually excluded from `userIgnoreFilters` — every `.md` file is parsed regardless of
   * file-level ignores, with ignored ones then filtered back out of the public `notes`/`byPath`/
   * tree membership. `false` turns all of that off at once and restores the pre-plugin-config
   * behavior exactly: no icons, no explicit order, and an individually-ignored file is pruned
   * during the walk itself rather than parsed and filtered out afterward. A missing or malformed
   * `data.json` is never an error either way — it just contributes no icons.
   */
  readonly useObsidianPluginConfig?: boolean
}
