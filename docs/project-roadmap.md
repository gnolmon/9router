# Project Roadmap

_Last updated: 2026-05-22_

## Purpose

This is the baseline engineering roadmap inferred from the current implementation. It is not a product commitment; it is the practical next-step view for maintaining and hardening the existing 9Router codebase.

## Phase 1: Documentation and Repo Hygiene

- Reconcile the stale root `README.md` with the actual 9Router product
- Keep `/docs` as the canonical reference set
- Document major provider/routing behaviors that currently live only in code

## Phase 2: Storage and Runtime Consolidation

- Unify legacy usage/log persistence with the main `DATA_DIR` strategy
- Audit runtime files written outside the primary data directory
- Tighten backup, migration, and restore expectations around SQLite state

## Phase 3: Compatibility and Reliability

- Add regression tests around `/v1/*` compatibility routes
- Add focused coverage for combo fallback, account fallback, and translation adapters
- Harden provider error normalization and retry boundaries

## Phase 4: Provider Catalog Maintainability

- Break down the large provider constants surface into smaller domain-focused modules
- Separate provider metadata from execution behavior where practical
- Improve discoverability for service-kind support and risk posture

## Phase 5: Operational Hardening

- Clarify tunnel, Tailscale, and MITM prerequisites per platform
- Improve observability around background auto-recovery flows
- Tighten startup validation for missing secrets and unwritable data paths

## Phase 6: UX and Dashboard Quality

- Continue normalizing dashboard patterns across provider, usage, and media workflows
- Reduce duplicated operational UI logic in route-specific pages
- Improve docs and in-product guidance for power-user setup flows
