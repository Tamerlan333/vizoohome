// Press-state logic for the Services cards on touch screens, kept free of the DOM so it can be unit-tested.
// ServicesSection feeds it native Touch Events. One finger is tracked at a time. The card is "pressed" from touchstart until
// touchend/touchcancel, except while the finger is outside the card. The press ends for good once the page actually scrolls.
//
// Why Touch Events and not Pointer Events: browsers fire pointercancel as soon as the finger drifts past the touch slop,
// even sideways on a page that cannot scroll sideways, and then stop sending pointer events. A slightly moving finger
// would lose the orange state while still touching the card and could never get it back. Touch events keep arriving until
// the finger lifts.

export type Box = { left: number; top: number; right: number; bottom: number };
export type TouchPoint = { id: number; x: number; y: number };

/** Scroll movement (CSS px) after which the browser is treated as having taken the gesture over. */
export const SCROLL_SLOP = 2;

export function createPressTracker<C>(onChange: (card: C, pressed: boolean) => void) {
  let active: { id: number; card: C; box: Box; sx: number; sy: number; pressed: boolean } | null = null;

  const set = (pressed: boolean) => {
    if (!active || active.pressed === pressed) return; // report changes only
    active.pressed = pressed;
    onChange(active.card, pressed);
  };
  const end = (id?: number): boolean => {
    if (!active || (id !== undefined && id !== active.id)) return false;
    set(false);
    active = null;
    return true;
  };

  return {
    isActive: () => active !== null,
    /** Finger down on a card. Ignored (returns false) while another finger is already tracked. */
    start(card: C, box: Box, t: TouchPoint, scrollX: number, scrollY: number): boolean {
      if (active) return false;
      active = { id: t.id, card, box, sx: scrollX, sy: scrollY, pressed: false };
      set(true);
      return true;
    },
    /** Finger moved. Returns false once tracking has ended (the page scrolled), so the caller can drop its listeners. */
    move(t: TouchPoint, scrollX: number, scrollY: number): boolean {
      if (!active) return false;
      if (t.id !== active.id) return true;
      if (Math.abs(scrollX - active.sx) > SCROLL_SLOP || Math.abs(scrollY - active.sy) > SCROLL_SLOP) return !end();
      const b = active.box;
      set(t.x >= b.left && t.x <= b.right && t.y >= b.top && t.y <= b.bottom);
      return true;
    },
    /** Finger lifted or touch cancelled (pass its id), or a forced stop such as blur/unmount (no id). True if tracking ended. */
    end,
  };
}
