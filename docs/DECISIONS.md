# Decisions

## 2026-05-26 — JPG Match is a standalone module

JPG Match owns collection-based wallet discovery.

It should remain independent from future wallet-read, compare, event, or profile tools.

Shared OpenSea and identity functionality may be extracted into reusable ILJ core helpers, but future modules should not directly rewrite JPG Match behavior.

Reason:
We want each ILJ tool to be independently testable, demoable, and replaceable.

## 2026-05-29 — Wallet Read v1 is the base for Compare

Wallet Read v1 is complete enough for feedback/testing.

Accepted scope includes single-wallet reads, two-wallet combined reads, individual wallet tabs, top collections, taste signals, collectors nearby / collectors near this taste, sample wallet entry, OpenSea-linked proof where available, and resilient nearby collector proof chips.

Compare v1 should now become the next product focus. It is the relationship layer built on top of Wallet Read's visible collection signal model.

Reason:
Wallet Read no longer needs to be perfect before Compare begins. Future overlap collection identity hardening is useful deferred resilience, but it should not block Compare or be bundled into Compare unless explicitly scoped.
