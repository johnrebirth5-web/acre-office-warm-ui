# Pipeline Phase 2 Spec

## Goal

Evolve `/office/pipeline` into a stronger BoldTrail/Brokermint-style management workspace while keeping real database-backed workflow context and honest metrics.

## Current implemented foundation

- dual-column pipeline workspace with a `Pending` summary card and a `Closed` history rail that defaults to the latest six months but can switch to a full calendar year (`Jan` through `Dec`)
- right-side transaction list driven by the current `Pending` or monthly `Closed` selection
- default landing selection now prefers the current month's `Closed` bucket, then the most recent month with closed records, then `Pending`
- the current snapshot service now reads pipeline data through dedicated `pending metrics`, `closed history metrics`, and `selected rows` queries instead of loading the full visible transaction set and slicing it in memory
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
- sales volume uses the normalized purchased price first, then falls back to the legacy imported `legacySalesVolume` value when an older imported record stored `0` in the normalized price fields
- office-level metrics are visible only to `owner` and `office_admin`
- personal `my_*` metrics stay self-scoped even when the viewer has team visibility elsewhere:
  - `team leader` sees only deals where they are directly involved when a `my_*` metric is selected
  - `junior team leader` also stays self-scoped for `my_*` metric rows and totals
  - broader team visibility still exists in transactions/reporting surfaces outside these personal pipeline metrics
- right-side rows now emphasize address, selected metric value, owner, and key date instead of the older grid table

## Current gaps

- still lighter than full target-product parity
- historical drilldown currently supports either the default six-month window or one selected calendar year at a time
- no automation or drag/drop behavior
- no deeper analytics layers

## Future direction

- improve manager scanning and context summaries for pending vs closed review
- deepen historical rollups and comparisons
- improve cross-links into transaction work queues
- keep the page as a working pipeline workspace, not a kanban board
