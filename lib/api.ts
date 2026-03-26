const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export async function apiPost(path: string, data: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(`API-fel: ${res.status}`);
  }

  return res.json();
}