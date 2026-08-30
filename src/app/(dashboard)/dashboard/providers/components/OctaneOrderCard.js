"use client";

import { useState, useEffect } from "react";
import { Card, Button, Badge } from "@/shared/components";

const DEFAULT_ORDER = ["freebuff", "opencode", "codebuddy-intl", "codebuddy-cn", "qoder"];

export default function OctaneOrderCard() {
  const [order, setOrder] = useState(DEFAULT_ORDER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.octaneProviderOrder) && data.octaneProviderOrder.length) {
          setOrder(data.octaneProviderOrder);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const move = (idx, dir) => {
    const next = [...order];
    const newIdx = dir === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= next.length) return;
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    setOrder(next);
    setHasChanges(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ octaneProviderOrder: order }),
      });
      if (res.ok) setHasChanges(false);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setOrder(DEFAULT_ORDER);
    setHasChanges(true);
  };

  if (loading) return <Card padding="sm"><div className="text-sm text-text-muted">Loading Octane order...</div></Card>;

  return (
    <Card padding="sm" className="border-2 border-orange-200 dark:border-orange-900">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-orange-500">rocket_launch</span>
            Octane AI — Provider Order
          </h3>
          <p className="text-xs text-text-muted mt-1">Semua model <code>ot/</code> tanpa prefix upstream. Jika model ada di beberapa provider (misal <code>muse</code> di freebuff & opencode), urutan ini menentukan fallback.</p>
        </div>
        <Badge variant="default" size="sm">ot/</Badge>
      </div>

      <div className="space-y-2">
        {order.map((pid, idx) => (
          <div key={pid} className="flex items-center justify-between rounded-lg border border-border bg-bg px-3 py-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-text-muted w-6">#{idx + 1}</span>
              <span className="text-sm font-medium">{pid}</span>
              {pid === "freebuff" && <Badge variant="success" size="sm">fb</Badge>}
              {pid === "opencode" && <Badge variant="default" size="sm">oc</Badge>}
            </div>
            <div className="flex gap-1">
              <button onClick={() => move(idx, "up")} disabled={idx === 0} className={`p-1 rounded ${idx === 0 ? "text-text-muted/30" : "hover:bg-black/5 text-text-muted"}`}>
                <span className="material-symbols-outlined text-sm">keyboard_arrow_up</span>
              </button>
              <button onClick={() => move(idx, "down")} disabled={idx === order.length - 1} className={`p-1 rounded ${idx === order.length - 1 ? "text-text-muted/30" : "hover:bg-black/5 text-text-muted"}`}>
                <span className="material-symbols-outlined text-sm">keyboard_arrow_down</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-3">
        <Button size="sm" onClick={save} disabled={!hasChanges || saving}>{saving ? "Saving..." : "Save Order"}</Button>
        <Button size="sm" variant="secondary" onClick={reset}>Reset Default</Button>
        <span className="text-xs text-text-muted self-center ml-2">Provider Octane AI: kumpulan semua model ot/ dari {order.join(" → ")}</span>
      </div>
    </Card>
  );
}
