# AutoTraceLab documentation index

## Authoritative execution plan

Use **[`MASTER_IMPLEMENTATION_PLAN.md`](./MASTER_IMPLEMENTATION_PLAN.md)** as the single source of truth for implementation order, blocking gates, milestones, cutover policy and Definition of Done.

## Execution annexes

The following documents expand a bounded workstream of the master plan without replacing its authority:

- **[`EMBEDDING_PRODUCTIZATION_PLAN.md`](./EMBEDDING_PRODUCTIZATION_PLAN.md)** — atomic execution plan for turning the reusable Go core, TypeScript SDK, registry and Go/WASM runtime into a production-grade embeddable platform. Covers SDK package separation, runtime isolation, registry materialization, protocol/version compatibility, cancellation, WASM delivery, consumer CI, Go module productization, documentation and 1.0 release gates.

If an execution annex conflicts with mathematical parity, cutover ordering or another blocking requirement in the master plan, **the master plan wins**.

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
