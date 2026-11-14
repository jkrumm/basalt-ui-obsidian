.PHONY: help build up refresh typegen check deploy verify version
.DEFAULT_GOAL := help

DEMO_DIR := apps/demo
DIST     := $(DEMO_DIR)/dist
VAULT_DIR ?= $(HOME)/SourceRoot/brain

help: ## Show targets
	@awk 'BEGIN{FS=":.*##"; printf "Targets:\n"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build the workspace packages + the demo static site against VAULT_DIR (default ~/SourceRoot/brain; override with VAULT_DIR=<path> make build). Writes dist/build-id.txt, the fingerprint `verify` asserts against.
	@[ -d node_modules ] || bun install --frozen-lockfile
	bun run build
	cd $(DEMO_DIR) && VAULT_DIR="$(VAULT_DIR)" bun run build
	@# The build-id: a hash of vault.json (the vault's content) plus every
	@# emitted JS/CSS asset (the app bundle) — the same "prove it, don't
	@# guess" idea as rb's codesum.ts, sized to this app's two moving parts
	@# instead of a source tree. `verify` fetches this file from the served
	@# site and compares it to what's on disk right here.
	@(cat $(DIST)/vault.json $(DIST)/assets/*.js $(DIST)/assets/*.css | md5 2>/dev/null \
		|| cat $(DIST)/vault.json $(DIST)/assets/*.js $(DIST)/assets/*.css | md5sum | cut -d' ' -f1) \
		> $(DIST)/build-id.txt
	@# commit.txt: the git commit this dist/ was built from. `version` reads it
	@# back from the served site — not from disk — so it reports what is
	@# actually served. Not part of the build-id (a new commit with identical
	@# output is the same bundle).
	@git rev-parse HEAD > $(DIST)/commit.txt
	@VAULT_SIZE=$$(wc -c < $(DIST)/vault.json | tr -d ' '); \
	SEARCH_SIZE=$$(wc -c < $(DIST)/search-index.json | tr -d ' '); \
	NOTES=$$(bun -e "console.log(JSON.parse(require('fs').readFileSync('$(DIST)/vault.json','utf8')).notes.length)"); \
	echo "  vault.json        $${VAULT_SIZE} bytes"; \
	echo "  search-index.json $${SEARCH_SIZE} bytes"; \
	echo "  notes              $${NOTES}"

typegen: ## Emit the gitignored artifacts typecheck needs: the two packages' .d.ts and the demo's routeTree.gen.ts. Scratch vault + scratch outDir, so the live apps/demo/dist is untouched.
	@[ -d node_modules ] || bun install --frozen-lockfile
	bun run build
	@tmp=$$(mktemp -d) && trap 'rm -rf "$$tmp"' EXIT && \
	mkdir "$$tmp/vault" && printf '# Typegen\n\nA note.\n' > "$$tmp/vault/note.md" && \
	cd $(DEMO_DIR) && VAULT_DIR="$$tmp/vault" bun run build --outDir "$$tmp/dist" --emptyOutDir

check: typegen ## Run all local validation — typegen, then fmt check + lint + typecheck + tests (bun run pre). Non-zero on failure; writes only gitignored build artifacts (no vault writes, live dist untouched).
	bun run pre

up: ## Build the bundle, then verify the door on 127.0.0.1:7733 serves it. THE entrypoint; safe to re-run any time. Caddy (dotfiles config/Caddyfile) serves dist/ live, so there is nothing to restart.
	$(MAKE) build
	$(MAKE) verify
	@echo "✓ brain-web up — http://127.0.0.1:7733"

deploy: ## Ship to the mini — alias of `up` (build → assert the served bundle). This is the mini's deploy mechanism.
	$(MAKE) up

verify: ## Probe the served site on the loopback URL and assert the served bundle matches the working tree. READ-ONLY; exit 0 = live and matching. `up` calls this after building.
	@printf "  waiting for the door… "
	@LIVE=0; for i in 1 2 3 4 5 6 7 8 9 10; do \
		curl -fsS -o /dev/null http://127.0.0.1:7733/ 2>/dev/null && { LIVE=1; break; } || sleep 1; \
	done; \
	if [ "$$LIVE" = 0 ]; then \
		echo "DOWN"; \
		echo "✗ brain-web is not answering on http://127.0.0.1:7733 — is Caddy's :7733 block up? (dotfiles config/Caddyfile)"; \
		exit 1; \
	fi; \
	echo "ok"
	@# ASSERT, don't nuke — same reasoning as rb's `up` (see rb/Makefile and
	@# dotfiles/rules/makefile-conventions.md "Assert, don't nuke"). There is
	@# no --no-cache / CLEAN=1 escape hatch here on purpose: Caddy reads dist/
	@# off disk per request, so there is no cache to distrust and the only
	@# thing worth proving is that the door is serving the dist/ you think it
	@# is, not a leftover one from a wrong working directory.
	@# Skip gracefully — never fail the whole target — when either side
	@# can't be read.
	@printf "  verifying the served bundle matches the working tree… "
	@HOST=$$(cat $(DIST)/build-id.txt 2>/dev/null); \
	SERVED=$$(curl -fsS http://127.0.0.1:7733/build-id.txt 2>/dev/null); \
	if [ -z "$$HOST" ] || [ -z "$$SERVED" ]; then \
		echo "SKIPPED (could not fingerprint both sides)"; \
	elif [ "$$HOST" = "$$SERVED" ]; then \
		echo "ok ($$HOST)"; \
	else \
		echo "MISMATCH"; \
		echo "✗ the served bundle is NOT what was just built — diagnose, don't rebuild past it."; \
		echo "    working tree: $$HOST"; \
		echo "    served:       $$SERVED"; \
		exit 1; \
	fi

version: ## Print the commit sha the served bundle was built from (one line). READ-ONLY; non-zero when the site does not answer or serves no commit.txt.
	@# The door falls back to index.html (SPA) for a missing file with a 200, so the
	@# body is only a commit if it is exactly a 40-hex sha.
	@SHA=$$(curl -fsS --max-time 5 http://127.0.0.1:7733/commit.txt 2>/dev/null | head -c 64 | tr -d '[:space:]'); \
	if ! printf '%s' "$$SHA" | grep -Eq '^[0-9a-f]{40}$$'; then \
		echo "✗ no commit served at http://127.0.0.1:7733/commit.txt — door down or dist/ built before commit.txt existed (make refresh)" >&2; \
		exit 1; \
	fi; \
	echo "$$SHA"

refresh: ## Rebuild dist/ only — nothing to restart, since Caddy serves dist/ live. This is what the LaunchAgent calls every 5 minutes when the vault's git HEAD has moved.
	$(MAKE) build
