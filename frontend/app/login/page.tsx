"use client";

import { type FormEvent, useState } from "react";
import { ArrowRight, Utensils } from "lucide-react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { Notice } from "@/components/StaffFrame";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const staff = await login(username, password);
      const candidate = new URLSearchParams(window.location.search).get("next");
      const safeNext =
        candidate?.startsWith("/") && !candidate.startsWith("//")
          ? candidate
          : null;
      router.replace(
        safeNext ?? (staff.role === "KITCHEN" ? "/kitchen" : "/admin"),
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Sign in could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="staff-login">
      <section className="login-story">
        <a className="brand-lockup" href="/">
          <span className="brand-mark">
            <Utensils size={17} />
          </span>
          <span>
            foodhub<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="login-story-copy">
          <div className="eyebrow">THE RESTAURANT, IN RHYTHM</div>
          <h1>
            Make room
            <br />
            for <em>good work.</em>
          </h1>
          <p>
            One calm place to manage service, the menu and everything in
            between.
          </p>
        </div>
        <div className="login-foot">
          A THOUGHTFUL OPERATING SYSTEM FOR HOSPITALITY
        </div>
        <div className="login-orbit" aria-hidden="true" />
      </section>
      <section className="login-form-side">
        <form className="login-form" onSubmit={submit}>
          <div className="eyebrow">STAFF ACCESS</div>
          <h2>Welcome back.</h2>
          <p>Sign in to your FoodHub workspace.</p>
          {error ? <Notice>{error}</Notice> : null}
          <div className="form-field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              required
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <button className="button-primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
            <ArrowRight size={15} />
          </button>
          <div className="login-footnote">
            Staff accounts are managed by your administrator. Customer ordering
            does not require an account.
          </div>
        </form>
      </section>
    </main>
  );
}
