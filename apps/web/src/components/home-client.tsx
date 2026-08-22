"use client";

import type { Conversation } from "@nousarium/contracts";
import { ACCESS_POLICY_LABELS, CONVERSATION_MODE_LABELS } from "@nousarium/core";
import { Button, Field } from "@nousarium/ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

export function HomeClient() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [mode, setMode] = useState<"plan" | "agent">("plan");
  const [accessPolicy, setAccessPolicy] = useState<"chat" | "read" | "vault-work">("read");

  async function refresh() {
    setItems(await api<Conversation[]>("/conversations"));
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-sm border border-stroke bg-surface-elevated p-4">
        <h1 className="mb-3 text-xl font-semibold">新しい対話</h1>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="モード">
            <select value={mode} onChange={(event) => setMode(event.target.value as "plan" | "agent")}>
              <option value="plan">{CONVERSATION_MODE_LABELS.plan}</option>
              <option value="agent">{CONVERSATION_MODE_LABELS.agent}</option>
            </select>
          </Field>
          <Field label="権限">
            <select
              value={accessPolicy}
              onChange={(event) => setAccessPolicy(event.target.value as "chat" | "read" | "vault-work")}
            >
              <option value="chat">{ACCESS_POLICY_LABELS.chat}</option>
              <option value="read">{ACCESS_POLICY_LABELS.read}</option>
              <option value="vault-work">{ACCESS_POLICY_LABELS["vault-work"]}</option>
            </select>
          </Field>
        </div>
        <Button
          className="mt-4"
          onClick={async () => {
            const created = await api<Conversation>("/conversations", {
              method: "POST",
              body: JSON.stringify({ mode, accessPolicy }),
            });
            window.location.href = `/c/${created.id}`;
          }}
        >
          開始
        </Button>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm text-text-secondary">最近</h2>
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/c/${item.id}`}
            className="rounded-sm border border-stroke bg-surface-elevated px-4 py-3"
          >
            <div className="font-medium">{item.title}</div>
            <div className="text-xs text-text-secondary">
              {CONVERSATION_MODE_LABELS[item.mode]} / {ACCESS_POLICY_LABELS[item.accessPolicy]}
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
