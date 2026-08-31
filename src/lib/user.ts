export function initialsFor(firstName: string, lastName: string, email: string): string {
  const first = firstName.trim().charAt(0);
  const last = lastName.trim().charAt(0);
  if (first || last) return `${first}${last}`.toUpperCase();
  return email.trim().charAt(0).toUpperCase() || "?";
}

export function displayName(firstName: string, lastName: string, email: string): string {
  const full = `${firstName.trim()} ${lastName.trim()}`.trim();
  return full || email;
}
