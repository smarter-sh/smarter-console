# The Smarter web console's npm workspace. See README.md and CLAUDE.md.
SHELL := /bin/bash

# The Python that creates the virtual environment of the development tools (pre-commit).
PYTHON ?= python3
VENV := venv
VENV_BIN := $(VENV)/bin

.PHONY: init venv install test lint format typecheck build storybook i18n-extract pre-commit-init pre-commit-run clean help

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
	@echo 'lint             - Check formatting, lint and types, as CI does'
	@echo 'format           - Fix formatting and auto-fixable lint'
	@echo 'typecheck        - Check types'
	@echo 'build            - Build the production bundles into dist/react/'
	@echo 'storybook        - Run a package'"'"'s Storybook: make storybook APP=smarter-secret-list'
	@echo 'i18n-extract     - Extract the translatable messages into i18n/messages.js'
	@echo 'pre-commit-init  - Install the pre-commit hooks'
	@echo 'pre-commit-run   - Run the pre-commit hooks on every file'
	@echo 'clean            - Remove the builds, coverage, the venv and node_modules'
