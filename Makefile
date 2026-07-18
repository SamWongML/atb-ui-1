.PHONY: help dev build typecheck lint test check clean

# Frontend-only workspace. All tasks run through pnpm + Turborepo.
# (The Go backend, local daemon, CLI, and Docker self-host stack were
# removed when this workspace was extracted for the auto-tobe monorepo.)

.DEFAULT_GOAL := help

help: ## Show available make targets
	@awk 'BEGIN {FS = ":.*## "; printf "\nUsage:\n  make \033[36m<target>\033[0m\n\n"} \
		/^[a-zA-Z0-9_.-]+:.*## / {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

dev: ## Start the Next.js web dev server (port 3000)
	pnpm dev:web

build: ## Build all packages + apps/web
	pnpm build

typecheck: ## TypeScript type check across all packages
	pnpm typecheck

lint: ## ESLint across all packages
	pnpm lint

test: ## Run Vitest unit tests across all packages
	pnpm test

check: ## Run the full verification pipeline: typecheck, lint, test, build
	pnpm typecheck
	pnpm lint
	pnpm test
	pnpm build

clean: ## Remove build artifacts and node_modules
	pnpm clean
