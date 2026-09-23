# basalt-ui-obsidian — Agent Instructions

## Design system — read DESIGN.md

Read `DESIGN.md` before any UI work — it records this app's deltas on top of the shipped
basalt-ui doctrine. The doctrine itself is the six `basalt-*` rules in `.claude/rules/`.

The basalt-ui managed block (stack, precedence, local-bin rule, restraint and chart-doctrine
overrides) lives in `CLAUDE.md`, because `basalt-ui sync` owns it there and CI gates it with
`sync --check`. Agents that do not load `CLAUDE.md` should read that block too — never hand-edit it.
