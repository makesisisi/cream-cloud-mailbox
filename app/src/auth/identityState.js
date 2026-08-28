export function isConfirmedIdentityUser(user) {
  return Boolean(user?.confirmedAt);
}
