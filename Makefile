# The Smarter web console's npm workspace. See README.md and CLAUDE.md.
.PHONY: install test lint format typecheck build storybook i18n-extract pre-commit-init pre-commit-run help

.DEFAULT_GOAL := help

# Install the workspace's dependencies, which the tests, the builds and the pre-commit hooks need.
install:
	npm install --include=dev

# Every package's tests, with a coverage report in coverage/.
test:
	npm run build:deps && npm run coverage

# What CI checks: formatting, lint and types.
lint:
	npm run build:deps && npm run format:check && npm run lint && npm run typecheck

# Fix formatting and auto-fixable lint.
format:
	npm run format && npm run lint:fix

typecheck:
	npm run build:deps && npm run typecheck

# The production builds, into dist/react/<package>/, the layout of the backend's static/react/.
build:
	NODE_ENV=production npm run build

# One package's Storybook, e.g. make storybook APP=smarter-secret-list
storybook:
	cd packages/$(or $(APP),smarter-dashboard) && npm run storybook

# The translatable messages, into i18n/messages.js.
i18n-extract:
	npm run i18n:extract

pre-commit-init:
	pre-commit install

pre-commit-run:
	pre-commit run --all-files

help:
	@echo 'install          - Install the workspace'"'"'s dependencies'
	@echo 'test             - Run every package'"'"'s tests, with coverage'
	@echo 'lint             - Check formatting, lint and types, as CI does'
	@echo 'format           - Fix formatting and auto-fixable lint'
	@echo 'typecheck        - Check types'
	@echo 'build            - Build the production bundles into dist/react/'
	@echo 'storybook        - Run a package'"'"'s Storybook: make storybook APP=smarter-secret-list'
	@echo 'i18n-extract     - Extract the translatable messages into i18n/messages.js'
	@echo 'pre-commit-init  - Install the pre-commit hooks'
	@echo 'pre-commit-run   - Run the pre-commit hooks on every file'
