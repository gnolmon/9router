# 9Router Product Overview

_Last updated: 2026-05-22_

## Summary

9Router is a local-first AI routing gateway and dashboard. It exposes an OpenAI-compatible endpoint surface under `/v1/*`, connects to many upstream AI providers, and lets operators manage credentials, model aliases, combos, usage, tunnels, and CLI integrations from one place.

## Product Goals

- Give local tools a single stable endpoint instead of provider-specific setup
- Reduce provider lock-in with translation, aliasing, and fallback
- Make local AI operations manageable without separate infra tooling
- Support both interactive dashboard usage and headless client usage

## Primary Users

- Developers running Claude Code, Codex, Cline, OpenCode, OpenClaw, Droid, or similar clients
- Power users managing multiple provider accounts, keys, and model routes
- Small teams that need a local gateway with observability and lightweight remote access

## Core Capabilities

- OpenAI-compatible routing for chat, responses, models, embeddings, search, and media endpoints
- Provider connection management for OAuth, API key, cookie, and compatible-node providers
- Model aliases and combo routing with fallback and round-robin behavior
- Usage tracking, request logging, and request-detail inspection
- Dashboard auth, API key issuance, and per-instance settings
- Optional Cloudflare tunnel, Tailscale funnel, and local MITM tooling
- CLI helper APIs for generating tool-specific connection settings
- Runtime internationalization for dashboard copy

## Supported Service Domains

- LLM chat and responses
- Embeddings
- Text-to-image and image-to-text
- Text-to-speech and speech-to-text
- Web search and web fetch
- Compatible custom nodes for OpenAI-like and Anthropic-like upstreams

## Key User Flows

1. Connect one or more providers
2. Configure aliases, custom models, or combos
3. Point a local client at `http://localhost:20128/v1`
4. Inspect usage, logs, and request details
5. Optionally expose the instance through Cloudflare Tunnel or Tailscale

## Non-Goals

- Operating a hosted multi-tenant cloud control plane inside this repository
- Replacing upstream provider billing, trust, or SLA controls
- Hiding all provider-specific risk; several OAuth-based integrations are explicitly risky

## Product Constraints

- Runs as a local process and persists local state
- Must tolerate heterogeneous upstream APIs and auth models
- Must preserve OpenAI-compatible behavior for downstream clients as much as possible
- Must degrade gracefully when provider credentials expire or providers fail

## Success Criteria

- A user can connect providers and issue requests through one base URL
- Fallback paths recover from common provider/account failures
- Dashboard state persists across restarts
- Usage and request logs are inspectable without external tooling
