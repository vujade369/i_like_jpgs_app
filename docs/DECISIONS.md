# Decisions

## 2026-05-26 — JPG Match is a standalone module

JPG Match owns collection-based wallet discovery.

It should remain independent from future wallet-read, compare, event, or profile tools.

Shared OpenSea and identity functionality may be extracted into reusable ILJ core helpers, but future modules should not directly rewrite JPG Match behavior.

Reason:
We want each ILJ tool to be independently testable, demoable, and replaceable.