# App Shell & Navigation

> The app-wide map of **the frame every feature is shown inside** — navigation, layout regions, and the patterns each page repeats.
>
> - Created by `/init` (the first holistic pass: top-level areas + layout).
> - Refined by `/architecture` as each feature is designed.
> - **Altitude:** structure, not styling. Which areas exist, where they live, who sees them, what every page shares. Colors, fonts, and component styling belong in `docs/design-system.md`; a single page's internals belong in that feature's `design.md`.
>
> Without this map the shell grows by accretion — every feature adds a nav item and a header variant in its own `design.md`, and nobody owns the whole. Rebuilding it later is then expensive, because no acceptance criterion says what it is supposed to do.

## Owning feature

_The feature whose `spec.md` carries the shell's acceptance criteria (e.g. `PROJ-1 App Shell & Navigation`), or "none — shell is trivial" for a single-screen app. Changes to the shell are refined there, not invented per feature._

Owner: _PROJ-X — always a feature: the App Shell feature if one exists, otherwise the feature that builds the screen the frame sits on. Changes to the frame go through `/refine` on this feature._

## Top-Level Areas

_The places a user can navigate to. One row per nav entry — not one row per page._

| Area | What the user does there | Visible to | Owning feature |
|------|--------------------------|------------|----------------|
| _Dashboard_ | _Overview after login_ | _signed-in users_ | _PROJ-2_ |
| _..._ | _..._ | _..._ | _..._ |

## Layout Regions

_The fixed frame. Name each region and what belongs in it._

- **Sidebar:** _the top-level areas, logo at the top, account menu at the bottom_
- **Header:** _page title, primary action for that page_
- **Content:** _the feature's own UI_
- **Mobile:** _how the sidebar behaves below `md` (burger / drawer / bottom bar)_

## Page Pattern

_What every page repeats, so features don't each invent their own. `/build` follows this instead of guessing._

- **Page header:** _title, optional subtitle, primary action on the right_
- **Loading state:** _skeleton / spinner, and where_
- **Empty state:** _what an area with no data shows_
- **Error state:** _how a failed load is presented_
- **Toasts / feedback:** _where confirmations appear_

## Auth States

_The shell usually differs by who is looking. Say how._

- **Signed out:** _which areas are reachable, what the shell shows_
- **Signed in:** _..._
- **Roles (if any):** _which areas each role sees_

## Shell Components

_The shared building blocks and where they live, so nothing gets rebuilt per feature._

| Component | File | Purpose |
|-----------|------|---------|
| _AppSidebar_ | _`src/components/app-sidebar.tsx`_ | _top-level navigation_ |
| _..._ | _..._ | _..._ |

---

_This is a living document. When `/architecture` designs a feature that adds a nav entry, a layout region, or a new page pattern, it updates this map first, so later features build against an accurate frame. Behavior changes to the shell go through `/refine` on the owning feature — never straight into a feature's `design.md`._
