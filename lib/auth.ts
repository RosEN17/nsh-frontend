function isBrowser() {
  return typeof window !== "undefined";
}

export function saveUser(user: unknown) {
  if (!isBrowser()) return;
  localStorage.setItem("nordsheet_user", JSON.stringify(user));
}

export function getUser() {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem("nordsheet_user");
  return raw ? JSON.parse(raw) : null;
}

export function clearUser() {
  if (!isBrowser()) return;
  localStorage.removeItem("nordsheet_user");
}