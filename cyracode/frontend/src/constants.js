// sessionStorage key used by the LandingPage to signal that the user has just
// registered and the mode-select modal should be shown. HomeRoute checks it so
// the landing page stays mounted (instead of redirecting an authenticated user
// to /dashboard) until the modal is dismissed or a registration mode is chosen.
export const PENDING_MODE_SELECT_KEY = 'cyracode_pending_mode_select'