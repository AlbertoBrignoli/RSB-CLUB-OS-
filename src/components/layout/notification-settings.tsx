"use client";

import { useEffect, useState } from "react";
import { BellRing, Smartphone } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import {
  currentSubscription, pushSupported, subscribePush, unsubscribePush,
} from "@/lib/push";
import type { NotificationPrefs, NotificationType } from "@/lib/types";
import { NOTIFICATION_TYPE_LABEL, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

const ALL_TYPES = Object.keys(NOTIFICATION_TYPE_LABEL) as NotificationType[];

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5.5 w-10 shrink-0 rounded-full transition-colors cursor-pointer",
        checked ? "bg-brand" : "bg-black/[0.15]",
        disabled && "opacity-40 pointer-events-none"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-all",
          checked ? "left-5" : "left-0.5"
        )}
      />
    </button>
  );
}

export function NotificationSettingsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { userId, profile, refresh } = useClub();
  const [prefs, setPrefs] = useState<NotificationPrefs>({});
  const [pushActive, setPushActive] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPrefs(profile?.notification_prefs ?? {});
    setError(null);
    setSaved(false);
    currentSubscription().then((s) => setPushActive(!!s));
  }, [open, profile]);

  const masterOn = prefs.enabled !== false;

  function typeOn(t: NotificationType) {
    return prefs.types?.[t] !== false;
  }

  function setType(t: NotificationType, v: boolean) {
    setPrefs((p) => ({ ...p, types: { ...(p.types ?? {}), [t]: v } }));
    setSaved(false);
  }

  async function togglePush() {
    if (!userId) return;
    setPushBusy(true);
    setError(null);
    try {
      if (pushActive) {
        await unsubscribePush();
        setPushActive(false);
      } else {
        await subscribePush(userId);
        setPushActive(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore nell'attivazione delle push");
    }
    setPushBusy(false);
  }

  async function save() {
    if (!userId) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase()
      .from("profiles")
      .update({ notification_prefs: prefs })
      .eq("id", userId);
    if (err) setError(err.message);
    else {
      setSaved(true);
      refresh();
    }
    setSaving(false);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Impostazioni notifiche"
      footer={
        <>
          {saved && <span className="mr-auto text-xs text-ok">Preferenze salvate ✓</span>}
          <Button onClick={onClose}>Chiudi</Button>
          <Button variant="primary" onClick={save} loading={saving}>
            Salva preferenze
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Push su questo dispositivo */}
        <div className="rounded-xl border border-line bg-background p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Smartphone className="mt-0.5 h-4 w-4 text-brand" />
              <div>
                <p className="text-[13px] font-semibold">Notifiche su questo dispositivo</p>
                <p className="mt-0.5 text-[12px] text-muted">
                  Ricevi le notifiche anche quando l&apos;app è chiusa.
                  {!pushSupported() && " Non supportato da questo browser."}
                </p>
              </div>
            </div>
            <Button
              variant={pushActive ? "secondary" : "primary"}
              size="sm"
              onClick={togglePush}
              loading={pushBusy}
              disabled={!pushSupported()}
            >
              {pushActive ? "Disattiva" : "Attiva"}
            </Button>
          </div>
          {pushActive && (
            <p className="mt-2 text-[11px] text-ok">✓ Push attive su questo dispositivo</p>
          )}
          <p className="mt-2 text-[11px] text-muted/80">
            Su iPhone/iPad: prima aggiungi l&apos;app alla schermata Home (Condividi → Aggiungi alla
            schermata Home), poi attiva da lì.
          </p>
        </div>

        {/* Master switch */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <BellRing className="h-4 w-4 text-brand" />
            <div>
              <p className="text-[13px] font-semibold">Tutte le notifiche</p>
              <p className="text-[12px] text-muted">Interruttore generale del tuo account</p>
            </div>
          </div>
          <Toggle
            checked={masterOn}
            onChange={(v) => {
              setPrefs((p) => ({ ...p, enabled: v }));
              setSaved(false);
            }}
          />
        </div>

        {/* Per tipo */}
        <div className="space-y-1">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Scegli cosa ricevere
          </p>
          {ALL_TYPES.map((t) => {
            const meta = NOTIFICATION_TYPE_LABEL[t];
            return (
              <div
                key={t}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 hover:bg-background",
                  !masterOn && "opacity-50"
                )}
              >
                <div>
                  <p className="text-[13px] font-medium">{meta.label}</p>
                  <p className="text-[11.5px] text-muted">{meta.desc}</p>
                </div>
                <Toggle checked={typeOn(t)} onChange={(v) => setType(t, v)} disabled={!masterOn} />
              </div>
            );
          })}
        </div>

        {error && (
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>
        )}
      </div>
    </Dialog>
  );
}
