// An empty database can always register the first admin.
// After that, ALLOW_REGISTRATION set to false, 0, no, or off closes sign-up.
export const registrationOpen = (env, userCount) => {
  if (!userCount) return true
  const flag = String(env?.ALLOW_REGISTRATION ?? 'true').trim().toLowerCase()
  return !['0', 'false', 'no', 'off'].includes(flag)
}
