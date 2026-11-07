# The Smarter web console's npm workspace. See README.md and CLAUDE.md.
SHELL := /bin/bash

# The Python that creates the virtual environment of the development tools (pre-commit).
PYTHON ?= python3
VENV := venv
VENV_BIN := $(VENV)/bin

.PHONY: init venv install test e2e lint analyze bundle-report format typecheck build dev storybook i18n-extract contracts keen-init keen-build keen-server keen-install pre-commit-init pre-commit-run clean help

.DEFAULT_GOAL := help

# Everything a new checkout needs: the Python virtual environment with pre-commit, the npm
# dependencies, and the pre-commit hooks.
init: venv install pre-commit-init

# (Re)create the Python virtual environment, venv/, with the tools in requirements.txt.
venv:
	@command -v $(PYTHON) >/dev/null 2>&1 || { echo >&2 "$(PYTHON) is not installed. Install Python 3, or run make init PYTHON=<python>."; exit 1; }
	rm -rf $(VENV)
	$(PYTHON) -m venv $(VENV)
	$(VENV_BIN)/pip install --quiet --upgrade pip
	$(VENV_BIN)/pip install --quiet -r requirements.txt

# Install the workspace's dependencies, which the tests, the builds and the pre-commit hooks need.
install:
	npm install --include=dev

# Every package's tests, with a coverage report in coverage/.
test:
	npm run build:deps && npm run coverage

# The end-to-end tests: a real browser (Chromium, which npx playwright install chromium downloads once) against
# the console on Vite's dev server, and a Smarter backend: the smarter repository's make run. They create a
# throwaway user in the backend, and delete it after. See e2e/ and README.md, End-to-end tests.
e2e:
	npm run e2e

# What CI checks: formatting, lint and types.
lint:
	npm run build:deps && npm run format:check && npm run lint && npm run typecheck

# A count of the repository's lines of code, by language, with cloc (brew install cloc), as the smarter repository's
# make analyze does. --vcs=git counts only the files that git tracks, so node_modules, the builds and the untracked
# Keen theme are left out.
analyze:
	@command -v cloc > /dev/null || { echo >&2 "cloc is not installed: brew install cloc, or see https://github.com/AlDanial/cloc"; exit 1; }
	cloc . --exclude-ext=svg,zip --fullpath --vcs=git

# The console build's size: what a browser loads first, the pages and packages that load later, and the largest
# files. It fails when the first load, gzipped, is over BUNDLE_MAX_INITIAL_KB: a library that only some pages need
# belongs in a lazily loaded chunk. See bundle/report.ts.
BUNDLE_MAX_INITIAL_KB ?= 175
bundle-report:
	npm run build:deps && NODE_ENV=production npm run build -w @smarter/console
	npm run bundle:report -- --max-initial-kb $(BUNDLE_MAX_INITIAL_KB)

# Fix formatting and auto-fixable lint.
format:
	npm run format && npm run lint:fix

typecheck:
	npm run build:deps && npm run typecheck

# The production builds, into dist/react/<package>/, the layout of the backend's static/react/.
build:
	NODE_ENV=production npm run build

# The console's dev server, http://localhost:5173/, which proxies the backend's paths to a Smarter dev
# server on port 9357 (the smarter repository's make run).
dev:
	npm run dev -w @smarter/console

# One package's Storybook, e.g. make storybook APP=smarter-secret-list
storybook:
	cd packages/$(or $(APP),smarter-dashboard) && npm run storybook

# The backend's api contracts that the console reads, from a smarter checkout, and their TypeScript types:
# make contracts, or make contracts SMARTER=../smarter SMARTER_REF=origin/main. See scripts/sync-contracts.sh.
contracts:
	scripts/sync-contracts.sh $(or $(SMARTER),../smarter) $(SMARTER_REF)

# The Keen theme (keen_v3.0.6/, a licensed copy that isn't committed: see README.md, The Theme). Its build,
# demo1/assets/, holds the stylesheets and scripts that every page loads from the backend's /static/assets/.
KEEN := keen_v3.0.6
KEEN_ASSETS := $(KEEN)/demo1/assets

# Once: the theme's build tools (yarn, gulp) and its dependencies.
keen-init:
	@test -d $(KEEN)/tools || { echo >&2 "$(KEEN)/tools is missing: copy the theme into the repository root first."; exit 1; }
	cd $(KEEN)/tools && npm install --global yarn && npm install gulp@^4.0.2 gulp-cli && yarn && npx gulp --version

# The theme's stylesheets and scripts, from its Sass and plugins, into $(KEEN_ASSETS)/.
keen-build:
	cd $(KEEN)/tools && npx gulp --demo1

# The theme's own demo pages, to look up a component's markup: http://localhost:3000/
keen-server:
	cd $(KEEN)/tools && npx gulp localhost

# The theme's build into a smarter checkout's static/assets/, which the backend serves at /static/assets/:
# make keen-install SMARTER=../smarter, then review and commit the change there.
keen-install:
	@test -f $(KEEN_ASSETS)/css/style.bundle.css || { echo >&2 "$(KEEN_ASSETS) has no build: run make keen-build."; exit 1; }
	rsync -a $(KEEN_ASSETS)/ $(or $(SMARTER),../smarter)/smarter/smarter/static/assets/

# The translatable messages, into i18n/messages.js.
i18n-extract:
	npm run i18n:extract

# The pre-commit hooks, including commitlint's commit-msg hook. Needs make venv and make install.
pre-commit-init:
	@test -x $(VENV_BIN)/pre-commit || { echo >&2 "pre-commit is not installed: run make init, or make venv."; exit 1; }
	$(VENV_BIN)/pre-commit install

pre-commit-run:
	@test -x $(VENV_BIN)/pre-commit || { echo >&2 "pre-commit is not installed: run make init, or make venv."; exit 1; }
	$(VENV_BIN)/pre-commit run --all-files

# Remove the builds, coverage, the virtual environment and node_modules.
clean:
	rm -rf $(VENV) node_modules packages/*/node_modules dist packages/*/dist coverage

help:
	@echo 'init             - Set up a new checkout: the venv with pre-commit, npm install, and the hooks'
	@echo 'venv             - (Re)create the Python virtual environment of the development tools'
	@echo 'install          - Install the workspace'"'"'s dependencies'
	@echo 'test             - Run every package'"'"'s tests, with coverage'
	@echo 'e2e              - Run the end-to-end tests, against a Smarter backend on :9357 (its make run)'
	@echo 'lint             - Check formatting, lint and types, as CI does'
	@echo 'analyze          - Count the lines of code, by language, with cloc'
	@echo 'bundle-report    - Build the console, and report its size and the first load'"'"'s budget'
	@echo 'format           - Fix formatting and auto-fixable lint'
	@echo 'typecheck        - Check types'
	@echo 'build            - Build the production bundles into dist/react/'
	@echo 'dev              - Run the console on :5173, against a Smarter dev server on :9357'
	@echo 'storybook        - Run a package'"'"'s Storybook: make storybook APP=smarter-secret-list'
	@echo 'i18n-extract     - Extract the translatable messages into i18n/messages.js'
	@echo 'contracts        - Copy the backend'"'"'s api contracts and regenerate their types: SMARTER=../smarter SMARTER_REF=...'
	@echo 'keen-init        - Once: install the Keen theme'"'"'s build tools and dependencies'
	@echo 'keen-build       - Build the Keen theme'"'"'s stylesheets and scripts into keen_v3.0.6/demo1/assets/'
	@echo 'keen-server      - Serve the Keen theme'"'"'s demo pages'
	@echo 'keen-install     - Copy the theme'"'"'s build into a smarter checkout'"'"'s static/assets/: SMARTER=../smarter'
	@echo 'pre-commit-init  - Install the pre-commit hooks'
	@echo 'pre-commit-run   - Run the pre-commit hooks on every file'
	@echo 'clean            - Remove the builds, coverage, the venv and node_modules'
