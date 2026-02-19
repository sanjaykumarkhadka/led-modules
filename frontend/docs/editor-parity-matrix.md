# Editor Parity Matrix

This checklist is the merge gate for Konva stabilization.

## Transform Determinism

| Area | Scenario | Expected | Status | Evidence |
|---|---|---|---|---|
| Designer | Drag selected character to each edge | Character bbox stays fully inside stage | Pending | |
| Designer | Resize from `nw` / `ne` / `sw` / `se` | Opposite corner anchored, min/max size enforced | Pending | |
| Manual | Drag single LED to edge | LED capsule remains fully inside character bounds | Pending | |
| Manual | Drag multi-select group to edge | Group clamps as a set, no per-item drift | Pending | |
| Manual | Rotate single LED near edge | Rotation blocked from escaping bounds | Pending | |
| Manual | Rotate multi group near edge | Group remains bounded, relative layout preserved | Pending | |

## Selection and Interaction State

| Area | Scenario | Expected | Status | Evidence |
|---|---|---|---|---|
| Manual | Start drag then press `Esc` | Interaction cancels cleanly, no stuck state | Pending | |
| Manual | Start transform then lose focus | Interaction resets on window blur | Pending | |
| Designer | Click empty stage | Selection clears | Pending | |
| Both | During active transform | No concurrent drag/resize/rotate state corruption | Pending | |

## Persistence and Sync

| Area | Scenario | Expected | Status | Evidence |
|---|---|---|---|---|
| Designer | Drag/resize then release | Dirty marked on commit, autosync heartbeat persists | Pending | |
| Designer | Rapid consecutive transforms | Latest state persists, no lost updates | Pending | |
| Manual | Save after transform edits | Saved layout matches visible state after route return | Pending | |
| Both | API failure during save | Single toast per unique error, recover on next change | Pending | |

## UX Consistency

| Area | Scenario | Expected | Status | Evidence |
|---|---|---|---|---|
| Both | Theme parity | Same neutral tokens in light/dark modes | Pending | |
| Both | Error delivery | Toast only, no inline persistent transform errors | Pending | |
| Both | Handle styling | Consistent handle size/selection stroke/hover states | Pending | |

## Regression Gates

- [ ] `npm run build`
- [ ] `npm run test -- --run`
- [ ] Targeted lint for active source files

