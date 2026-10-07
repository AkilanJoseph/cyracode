// One page frame for every marketing surface.
//
// These pages used to hand-write their own width on the header, the <main> and
// the footer, so they drifted: the FAQ shell was max-w-4xl while its own header
// was max-w-6xl, and pricing ran wider than the landing hero it links from.
// LandingPage is the reference, so the shared values mirror it exactly:
//
//   <Header maxWidth={MARKETING_MAX_WIDTH} marketingNav />
//   <main className={`${MARKETING_MAX_WIDTH} mx-auto px-4 ${MARKETING_PADDING_Y}`}>
//   <Footer maxWidth={MARKETING_MAX_WIDTH} />
//
// Narrow pages (registration, admin, search) keep their own widths on purpose.
export const MARKETING_MAX_WIDTH = 'max-w-6xl'

// Matches the landing hero: comfortable gutters on phones, generous on desktop.
export const MARKETING_PADDING_Y = 'py-8 md:py-16'

// The landing hero's h1 scale, shared with the docs/blog placeholder. Both used
// to hard-code their own: the hero at text-6xl and the placeholder at text-3xl,
// so the same frame contained headlines two steps apart in size.
export const MARKETING_HERO_TITLE_CLASS =
  'text-4xl sm:text-5xl lg:text-6xl font-extrabold text-ink leading-[1.08] tracking-tight'

// The hero's subhead, for the same reason.
export const MARKETING_HERO_SUBTITLE_CLASS = 'text-lg text-muted leading-relaxed'

// The signed-in app frame, with Dashboard as the reference. The registration and
// manage screens had each hand-written a narrower max-w-2xl with py-10, so a
// form looked tighter on the screen that creates a CyraCode than on the
// dashboard that lists it.
export const APP_MAX_WIDTH = 'max-w-3xl'

export const APP_PADDING_Y = 'py-12'

// The admin frame, with the admin pages as the reference, exactly as APP_* is to
// the Dashboard. The registration screens reuse these when the flow was entered
// from the admin module, so that hand-off keeps the admin's width and rhythm
// instead of snapping to the narrower app frame at step one.
export const ADMIN_MAX_WIDTH = 'max-w-5xl'

export const ADMIN_PADDING_Y = 'py-10'

// Registration is reachable from the admin module, the Dashboard and the
// marketing pages, and each of those hands the next screen a different frame.
// The entry point records where the flow started, so the frame can follow it
// through every step and on to the completion screen.
export function frameForOrigin(state) {
  const isAdmin = state?.fromAdmin === true
  return isAdmin
    ? { maxWidth: ADMIN_MAX_WIDTH, paddingY: ADMIN_PADDING_Y, isAdmin }
    : { maxWidth: APP_MAX_WIDTH, paddingY: APP_PADDING_Y, isAdmin }
}
