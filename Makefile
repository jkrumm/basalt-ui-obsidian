.PHONY: help build up down logs logs-follow rebuild refresh check deploy verify
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
	@# instead of a source tree. `verify` fetches this file from the running
	@# container and compares it to what's on disk right here.
	@(cat $(DIST)/vault.json $(DIST)/assets/*.js $(DIST)/assets/*.css | md5 2>/dev/null \
		|| cat $(DIST)/vault.json $(DIST)/assets/*.js $(DIST)/assets/*.css | md5sum | cut -d' ' -f1) \
		> $(DIST)/build-id.txt
	@VAULT_SIZE=$$(wc -c < $(DIST)/vault.json | tr -d ' '); \
	SEARCH_SIZE=$$(wc -c < $(DIST)/search-index.json | tr -d ' '); \
	NOTES=$$(bun -e "console.log(JSON.parse(require('fs').readFileSync('$(DIST)/vault.json','utf8')).notes.length)"); \
	echo "  vault.json        $${VAULT_SIZE} bytes"; \
	echo "  search-index.json $${SEARCH_SIZE} bytes"; \
	echo "  notes              $${NOTES}"

check: ## Run all local validation — fmt check + lint + typecheck + tests (bun run pre). Non-zero on failure; no side effects (no container, no vault writes).
	bun run pre

up: ## Build → recreate the container → verify it answers and serves the fresh bundle → print the URL and exit. THE entrypoint; safe to re-run any time.
	$(MAKE) build
	docker compose up -d --force-recreate --remove-orphans
	$(MAKE) verify
	@echo "✓ brain-web up — http://127.0.0.1:7733"

deploy: ## Ship to the mini — alias of `up` (build → recreate the container → assert the served bundle). This is the mini's deploy mechanism.
	$(MAKE) up

verify: ## Probe the served site on the loopback URL and assert the served bundle matches the working tree. READ-ONLY; exit 0 = live and matching. `up` calls this after recreating the container.
	@printf "  waiting for nginx… "
	@LIVE=0; for i in 1 2 3 4 5 6 7 8 9 10; do \
		curl -fsS -o /dev/null http://127.0.0.1:7733/ 2>/dev/null && { LIVE=1; break; } || sleep 1; \
	done; \
	if [ "$$LIVE" = 0 ]; then \
		echo "DOWN"; \
		echo "✗ brain-web is not answering on http://127.0.0.1:7733 — is the container up? (make up)"; \
		exit 1; \
	fi; \
	echo "ok"
	@# ASSERT, don't nuke — same reasoning as rb's `up` (see rb/Makefile and
	@# dotfiles/rules/makefile-conventions.md "Assert, don't nuke"). There is
	@# no --no-cache / CLEAN=1 escape hatch here on purpose: a bind mount has
	@# no layer cache to distrust in the first place, so the only thing
	@# actually worth proving is that the container is reading the dist/ you
	@# think it is reading, not a leftover one from a stale mount or a wrong
	@# working directory. Skip gracefully — never fail the whole target —
	@# when either side can't be read.
	@printf "  verifying the served bundle matches the working tree… "
	@HOST=$$(cat $(DIST)/build-id.txt 2>/dev/null); \
	CONT=$$(curl -fsS http://127.0.0.1:7733/build-id.txt 2>/dev/null); \
	if [ -z "$$HOST" ] || [ -z "$$CONT" ]; then \
		echo "SKIPPED (could not fingerprint both sides)"; \
	elif [ "$$HOST" = "$$CONT" ]; then \
		echo "ok ($$HOST)"; \
	else \
		echo "MISMATCH"; \
		echo "✗ the served bundle is NOT what was just built — diagnose, don't rebuild past it."; \
		echo "    working tree: $$HOST"; \
		echo "    served:       $$CONT"; \
		exit 1; \
	fi

down: ## Stop the stack
	docker compose down

logs: ## Print the last 200 lines of container logs, then exit — bounded, safe for a script or agent. (To tail instead, use `logs-follow`.)
	docker compose logs --tail=200

logs-follow: ## Follow the container logs (non-terminating; Ctrl-C to stop).
	docker compose logs -f

rebuild: ## Refresh the pinned base image, then same as `up`. Use for periodic base-image maintenance — NOT a staleness fix (see `verify`'s fingerprint assertion). Deviates from the build-based house pattern's `docker compose build --pull`: this service has no `build:` stage (bare nginx:alpine, no custom Dockerfile — see docker-compose.yml), so `compose build` has nothing to do here; `compose pull` is the equivalent that actually refreshes the image.
	docker compose pull
	$(MAKE) up

refresh: ## Rebuild dist/ only — no container churn, since nginx serves the bind mount live. This is what the LaunchAgent calls every 5 minutes when the vault's git HEAD has moved.
	$(MAKE) build
