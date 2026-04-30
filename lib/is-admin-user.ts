const ADMIN_USERNAME = "admin";

export function isAdminUser(username: string | null | undefined): boolean {
  return username?.trim().toLowerCase() === ADMIN_USERNAME;
}
