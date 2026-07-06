export function parseAdminEmails(raw: string | undefined): string[] {
  return (raw ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}
export function resolveRole(email: string, adminEmails: string[]): 'admin' | 'user' {
  return adminEmails.includes(email.trim().toLowerCase()) ? 'admin' : 'user';
}
