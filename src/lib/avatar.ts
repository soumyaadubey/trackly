/**
 * Avatar upload rules.
 *
 * These constants are the application-side half of a limit that is really
 * enforced on the Supabase bucket itself (`file_size_limit`,
 * `allowed_mime_types` — see supabase/schema.sql). That split is deliberate:
 * a signed-in user holds a JWT that works directly against the Storage REST
 * API, so they can skip this server action entirely. Anything enforced only
 * here is advisory. Keep the two in sync; the bucket is the real boundary.
 *
 * SVG is absent on purpose. The bucket is public and an SVG is an executable
 * document, so accepting one would mean serving attacker-supplied script from
 * the storage origin.
 */

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB — mirrors file_size_limit

export const ALLOWED_AVATAR_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export type AllowedAvatarType = (typeof ALLOWED_AVATAR_TYPES)[number];

/**
 * The extension the file will be stored under. Derived from the (validated)
 * MIME type rather than from the uploaded filename, so a user cannot choose
 * the stored path — the storage policy pins it to `<uid>/avatar[-a|-b].<ext>`.
 */
const EXTENSION_BY_TYPE: Record<AllowedAvatarType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

export const AVATAR_EXTENSIONS = Object.values(EXTENSION_BY_TYPE);

export function isAllowedAvatarType(type: string): type is AllowedAvatarType {
  return (ALLOWED_AVATAR_TYPES as readonly string[]).includes(type);
}

export function extensionForType(type: AllowedAvatarType): string {
  return EXTENSION_BY_TYPE[type];
}

/** Human-readable list for form copy, e.g. "JPG, PNG, GIF, or WebP". */
export const AVATAR_TYPES_LABEL = "JPG, PNG, GIF, or WebP";

const AVATAR_NAME = /^avatar(?:-[ab])?\.(?:jpg|png|gif|webp)$/;

/** The stored file name an avatar_url points at, if it is one of ours. */
export function avatarFileName(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    const name = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
    return AVATAR_NAME.test(name) ? name : null;
  } catch {
    return null;
  }
}

/**
 * Where a replacement photo goes: whichever of the two slots the profile is
 * not using. The current photo is never overwritten, so a failed upload or a
 * failed profile update leaves it intact. Two slots (not a fresh name per
 * upload) keep the number of files a user can create bounded.
 */
export function nextAvatarName(currentUrl: unknown, ext: string): string {
  const current = avatarFileName(currentUrl);
  return `avatar-${current?.startsWith("avatar-a.") ? "b" : "a"}.${ext}`;
}
