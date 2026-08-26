# AutoTraceLab documentation index

## Authoritative execution plan

Use **[`MASTER_IMPLEMENTATION_PLAN.md`](./MASTER_IMPLEMENTATION_PLAN.md)** as the single source of truth for implementation order, blocking gates, milestones, cutover policy and Definition of Done.

## Reference plans

The following documents are retained as detailed audit/history material:

- [`PARETO_IMPLEMENTATION_PLAN.md`](./PARETO_IMPLEMENTATION_PLAN.md) — architecture, performance, reusable-core, registry/customization and delivery analysis.
- [`REACT_TO_GO_MATHEMATICAL_PARITY_PLAN.md`](./REACT_TO_GO_MATHEMATICAL_PARITY_PLAN.md) — detailed React/TypeScript → Go mathematics/parity migration analysis.

If a reference plan conflicts with the master plan, **the master plan wins**.

Canonical implementation order:

```text
contract + TS oracle freeze
-> cross-language semantics
-> mathematical parity
-> incremental SceneEngine integration
-> Go optimization
-> Worker shadow rollout
-> production cutover
-> TS reference-only
-> TS retirement
```

Tracking issue: GitHub issue #1, **AutoTraceLab master implementation program**.
