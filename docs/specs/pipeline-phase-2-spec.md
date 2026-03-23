# Pipeline Phase 2 Spec

## Goal

Evolve `/office/pipeline` into a stronger BoldTrail/Brokermint-style management workspace while keeping real database-backed workflow context and honest metrics.

## Current implemented foundation

- dual-column pipeline workspace with a `Pending` summary card and fixed six-month `Closed` history rail
- right-side transaction list driven by the current `Pending` or monthly `Closed` selection
- default landing selection now prefers the current month's `Closed` bucket, then the most recent month with closed records, then `Pending`
- URL-driven filters:
  - side / representing
  - metric mode
  - hidden compatibility support for `owner`, `search`, and old stage/history params
- supported metric modes:
  - office sales volume
  - office net
  - office gross
  - my net income
  - my sales volume
- office-level metrics are visible only to `owner` and `office_admin`
- personal metrics reuse current office data scope:
  - `team leader` sees self + branch
  - `junior team leader` sees self + subordinate agents
  - other roles stay self-scoped
- right-side rows now emphasize address, selected metric value, owner, and key date instead of the older grid table

## Current gaps

- still lighter than full target-product parity
- historical drilldown is intentionally limited to six recent months
- no automation or drag/drop behavior
- no deeper analytics layers

## Future direction

- improve manager scanning and context summaries for pending vs closed review
- deepen historical rollups and comparisons
- improve cross-links into transaction work queues
- keep the page as a working pipeline workspace, not a kanban board
