"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface LookupRow {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

// Slug automatico: minuscolo, underscore al posto degli spazi/simboli.
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Card riutilizzabile per liste configurabili (content types, social channels).
export function LookupCard({
  title,
  rows,
  onToggle,
  onAdd,
  addPlaceholder,
}: {
  title: string;
  rows: LookupRow[];
  onToggle: (row: LookupRow) => Promise<void>;
  onAdd: (name: string) => Promise<void>;
  addPlaceholder: string;
}) {
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  async function add() {
    if (!name.trim()) return;
    setAdding(true);
    await onAdd(name.trim());
    setName("");
    setAdding(false);
  }

  return (
    <Card>
      <CardHeader title={title} />
      <CardBody>
        <ul className="divide-y divide-line/70">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2">
              <span className={cn("min-w-0 flex-1 truncate text-[13px]", !r.is_active && "text-muted line-through")}>
                {r.name}
              </span>
              <span className="text-[11px] text-muted/70">{r.slug}</span>
              <button
                type="button"
                role="switch"
                aria-checked={r.is_active}
                aria-label={`${r.is_active ? "Disattiva" : "Attiva"} ${r.name}`}
                onClick={() => onToggle(r)}
                className={cn(
                  "relative h-5 w-9 shrink-0 rounded-full transition-colors cursor-pointer",
                  r.is_active ? "bg-ok" : "bg-black/[0.12]"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
                    r.is_active ? "left-4.5" : "left-0.5"
                  )}
                />
              </button>
            </li>
          ))}
          {rows.length === 0 && <li className="py-3 text-[12.5px] text-muted">Nessuna voce.</li>}
        </ul>
        <div className="mt-3 flex items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={addPlaceholder}
            className="h-8 text-[13px]"
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
          />
          <Button size="sm" loading={adding} disabled={!name.trim()} onClick={add}>
            <Plus className="h-3.5 w-3.5" /> Aggiungi
          </Button>
        </div>
        {name.trim() && (
          <p className="mt-1.5 text-[11px] text-muted/80">Slug: {slugify(name)}</p>
        )}
      </CardBody>
    </Card>
  );
}
