---
sidebar_position: 9
---

# Accessibility

Forja targets **WCAG 2.1 Level AA** as a hard requirement for all frontend changes. Level AAA is a best-effort goal.

Accessibility is not a post-shipment checklist item — it is built in from the start, enforced in code review, and verified in tests.

---

## Semantic HTML First

Use native HTML elements before reaching for ARIA. Native elements come with built-in keyboard handling, focus management, and screen reader semantics.

| Use | Not |
|---|---|
| `<button onClick={...}>` | `<div onClick={...}>` |
| `<nav>` | `<div role="navigation">` |
| `<main>` | `<div id="main">` |
| `<section>` | `<div class="section">` |
| `<dialog>` | `<div class="modal">` |
| `<ul>` / `<li>` | `<div class="list">` / `<div class="item">` |
| `<a href="...">` | `<span onClick={navigate}>` |
| `<img alt="description">` | `<img>` with no alt |

If an image is purely decorative, use `alt=""` — do not omit the attribute.

Headings must follow a logical hierarchy with no skips:

```
h1 — Page title (one per page)
  h2 — Section heading
    h3 — Sub-section heading
```

---

## ARIA

Use ARIA only when native semantics are insufficient.

- Interactive custom widgets must have `role`, `aria-label`, and keyboard handlers.
- Live regions announce dynamic content to screen readers:

```tsx
// Toast messages, search results, status updates
<div aria-live="polite" aria-atomic="true">
  {statusMessage}
</div>

// Critical alerts (errors, destructive actions)
<div role="alert">
  {errorMessage}
</div>
```

---

## Keyboard Navigation

Every interactive element must be reachable and operable using the keyboard alone.

| Widget | Expected Keys |
|---|---|
| Button | `Enter`, `Space` |
| Link | `Enter` |
| Checkbox | `Space` to toggle |
| Radio group | `Arrow` keys to move within group |
| Menu | `Arrow` keys to navigate items, `Escape` to close |
| Dialog | `Escape` to close, `Tab` cycles within dialog |
| Combobox / Select | `Arrow` keys, `Enter` to select, `Escape` to dismiss |

Rules:

- `Tab` order must follow visual reading order (left to right, top to bottom for LTR; right to left for RTL/Arabic).
- Never use `tabIndex > 0` — it breaks natural tab order.
- Never use `outline: none` without a visible focus replacement.
- Trap focus within open dialogs using a focus trap utility.

---

## Color and Contrast

**Minimum contrast ratios (WCAG 2.1 AA):**

| Text Type | Minimum Ratio |
|---|---|
| Normal text (< 18pt / < 14pt bold) | 4.5:1 |
| Large text (>= 18pt or >= 14pt bold) | 3:1 |
| UI components and states (borders, focus indicators) | 3:1 |

Use the MUI theme color palette — it is calibrated for AA compliance. Do not introduce ad-hoc hex colors without verifying contrast.

**Never convey meaning through color alone.** Always pair color with a secondary indicator:

| Approach | Example |
|---|---|
| Color + icon | Red circle with `✕` icon for error, green circle with `✓` for success |
| Color + text label | "Active" badge, not just a green dot |
| Color + pattern | Chart series with both color and line pattern |

---

## Focus Management

When the UI changes state, focus must be managed explicitly so keyboard and screen reader users are not lost.

| Event | Focus Destination |
|---|---|
| Dialog opens | First focusable element in the dialog (usually the first input or the close button) |
| Dialog closes | The element that triggered the dialog to open |
| Item deleted from list | The next item in the list, or the empty state if the list is now empty |
| Item created | The new item's row, or a success message with `role="status"` |
| Page / route changes | The page's `<h1>` or the main content landmark |
| Content loads (async) | The element that becomes visible, or announce via `aria-live` |

```tsx
// Focus first input when dialog opens
const dialogRef = useRef<HTMLDivElement>(undefined);

useEffect(() => {
  if (open) {
    const firstInput = dialogRef.current?.querySelector<HTMLElement>(
      'input, button, [tabindex]'
    );
    firstInput?.focus();
  }
}, [open]);
```

---

## Motion

Some users experience motion sickness from animations. Always respect the `prefers-reduced-motion` media query.

**CSS transitions** — wrap in a media query:

```css
.card {
  transition: transform 0.2s ease;
}

@media (prefers-reduced-motion: reduce) {
  .card {
    transition: none;
  }
}
```

**React / MUI** — check preference at runtime:

```tsx
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
const transitionDuration = prefersReducedMotion ? 0 : 300;

<Fade in={visible} timeout={transitionDuration}>
  <Box>...</Box>
</Fade>
```

Do not use `Fade`, `Collapse`, `Grow`, or any animation component without accounting for this preference.

---

## Testing for Accessibility

If a test cannot find an element by its role or label, the component is not accessible. Use this as a signal to fix the component, not to fall back to `getByTestId`.

**Query priority order:**

| Priority | Query | When to use |
|---|---|---|
| 1st | `getByRole('button', { name: '...' })` | Interactive elements |
| 2nd | `getByLabelText('...')` | Form fields, tooltips, icon buttons |
| 3rd | `getByText('...')` | Static text content |
| Last | `getByTestId('...')` | Fallback only — add `data-testid` when semantic selectors aren't enough |

**Keyboard navigation tests:**

```tsx
it('dialog closes when Escape is pressed', async () => {
  await userEvent.click(openButton);
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('menu items are navigable with arrow keys', async () => {
  await userEvent.click(menuTrigger);
  await screen.findByRole('menu');
  await userEvent.keyboard('{ArrowDown}');
  expect(document.activeElement).toHaveAttribute('role', 'menuitem');
});
```

**Focus management tests:**

```tsx
it('focuses the first input when dialog opens', async () => {
  await userEvent.click(openButton);
  await waitFor(() => {
    expect(screen.getByLabelText(t('form.name'))).toHaveFocus();
  });
});

it('returns focus to trigger button after dialog closes', async () => {
  await userEvent.click(openButton);
  await userEvent.keyboard('{Escape}');
  await waitFor(() => {
    expect(openButton).toHaveFocus();
  });
});
```

---

## Audit Checklist

Use this checklist during code review and when running the `architect-review` skill.

**Semantic HTML**
- [ ] Interactive elements use `<button>`, `<a>`, or other native interactive elements — no `<div onClick>`
- [ ] Images have `alt` attributes (meaningful for content, `alt=""` for decorative)
- [ ] Heading hierarchy is correct (h1 → h2 → h3, no skips)
- [ ] Landmark regions are present: `<main>`, `<nav>`, `<header>`, `<footer>`

**Keyboard**
- [ ] All interactive elements are reachable with `Tab`
- [ ] Focus indicator is visible (no naked `outline: none`)
- [ ] Custom widgets implement expected key bindings (see table above)
- [ ] Dialog focus is trapped while open

**ARIA**
- [ ] Icon-only buttons have `aria-label`
- [ ] Dynamic regions use `aria-live` or `role="alert"`
- [ ] ARIA is used only where native semantics are insufficient

**Color and Contrast**
- [ ] Text contrast is at least 4.5:1 (normal text) or 3:1 (large text)
- [ ] Status indicators use color + icon or color + text label (not color alone)

**Focus Management**
- [ ] Dialog open: focus moves to first focusable element
- [ ] Dialog close: focus returns to trigger
- [ ] Delete: focus moves to next item or empty state

**Motion**
- [ ] `prefers-reduced-motion` is respected for all transitions and animations
- [ ] No animation is essential to understanding content

**Testing**
- [ ] Tests use `getByRole` and `getByLabelText` as primary queries
- [ ] Keyboard navigation is tested for custom widgets
- [ ] Focus management is tested for dialogs and CRUD operations
