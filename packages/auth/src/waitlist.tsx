import React, { useState } from "react";

export type WaitlistJoinResult = { ok: true };
export type WaitlistJoinInput = {
  endpoint: string;
  email: string;
  product: string;
  source?: string;
  honeypot?: string;
};

export async function joinWaitlist(input: WaitlistJoinInput): Promise<WaitlistJoinResult> {
  const response = await fetch(input.endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: input.email,
      product: input.product,
      source: input.source,
      honeypot: input.honeypot,
    }),
  });
  if (!response.ok) throw new Error("Unable to join waitlist right now");
  return { ok: true };
}

export function useWaitlist(options: { endpoint: string; product: string; source?: string }) {
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  async function join(email: string, honeypot?: string): Promise<void> {
    setStatus("submitting");
    setError(null);
    try {
      await joinWaitlist({ ...options, email, honeypot });
      setStatus("submitted");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to join waitlist right now");
      setStatus("error");
    }
  }
  return { join, status, error };
}

export function Waitlist(props: {
  endpoint: string;
  product: string;
  source?: string;
  buttonLabel?: string;
  placeholder?: string;
  successMessage?: string;
}) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const waitlist = useWaitlist({
    endpoint: props.endpoint,
    product: props.product,
    source: props.source,
  });
  return (
    <form
      data-waitlist={props.product}
      onSubmit={(event) => {
        event.preventDefault();
        void waitlist.join(email, website);
      }}
    >
      <input
        type="email"
        required
        value={email}
        placeholder={props.placeholder ?? "you@example.com"}
        onChange={(event) => setEmail(event.currentTarget.value)}
      />
      <input
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={website}
        onChange={(event) => setWebsite(event.currentTarget.value)}
        style={{ display: "none" }}
      />
      <button type="submit" disabled={waitlist.status === "submitting"}>
        {props.buttonLabel ?? "Join waitlist"}
      </button>
      {waitlist.status === "submitted" ? (
        <p>{props.successMessage ?? "You're on the list. Check your email for confirmation."}</p>
      ) : null}
      {waitlist.error ? <p role="alert">{waitlist.error}</p> : null}
    </form>
  );
}
