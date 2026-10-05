export const AUTH_LINK_MESSAGES: Record<string, string> = {
  "auth-link-invalid": "That sign-in link is invalid. Request a new link or log in below.",
  "auth-link-expired": "That link has expired or was already used. Request a new one below.",
  "auth-link-browser": "Open this link in the browser where you requested it, or request a new link here.",
  "auth-link-unavailable": "We couldn't verify that link right now. Please try again.",
  "reset-link-invalid": "Open a fresh password-reset email to continue. Recovery access lasts 15 minutes.",
  "logout-failed": "We couldn't sign you out. Please try logging out again.",
};

export function authLinkError(code: string | undefined, status?: number): string {
  if (status === 0 || (status !== undefined && status >= 500)) return "auth-link-unavailable";
  if (code === "otp_expired" || code === "flow_state_expired" || code === "flow_state_not_found") {
    // Supabase deliberately does not distinguish consumed OTPs from expired ones.
    return "auth-link-expired";
  }
  if (code === "pkce_code_verifier_not_found" || code === "bad_code_verifier") return "auth-link-browser";
  if (code === "unexpected_failure" || code === "request_timeout") return "auth-link-unavailable";
  return "auth-link-invalid";
}

export const SESSION_EXPIRY_NOTE =
  "Other devices may retain access briefly before being asked to log in again.";
