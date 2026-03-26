"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
import { saveUser } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    title: "",
  });
  const [error, setError] = useState("");

  async function handleLogin() {
    try {
      setError("");
      const res = await apiPost<{ user: any }>("/api/login", {
        email: form.email,
        password: form.password,
      });
      saveUser(res.user);
      router.push("/connect");
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleSignup() {
    try {
      setError("");
      await apiPost("/api/signup", form);
      setMode("login");
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-form-card">
        <div className="auth-tab-title">{mode === "login" ? "Logga in" : "Skapa konto"}</div>

        {mode === "signup" && (
          <>
            <input placeholder="Namn" onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input placeholder="Jobbtitel" onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </>
        )}

        <input placeholder="E-post" onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input type="password" placeholder="Lösenord" onChange={(e) => setForm({ ...form, password: e.target.value })} />

        {error ? <div className="error-box">{error}</div> : null}

        {mode === "login" ? (
          <>
            <button onClick={handleLogin}>Logga in</button>
            <button onClick={() => setMode("signup")}>Skapa konto</button>
          </>
        ) : (
          <>
            <button onClick={handleSignup}>Registrera</button>
            <button onClick={() => setMode("login")}>Tillbaka till login</button>
          </>
        )}
      </div>
    </div>
  );
}