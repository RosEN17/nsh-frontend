export function saveUser(user: unknown) {
  localStorage.setItem("nordsheet_user", JSON.stringify(user));
}

export function getUser() {
  const raw = localStorage.getItem("nordsheet_user");
  return raw ? JSON.parse(raw) : null;
}

export function clearUser() {
  localStorage.removeItem("nordsheet_user");
}