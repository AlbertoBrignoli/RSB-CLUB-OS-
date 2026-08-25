"use client";

import { supabase } from "./supabase/client";

export const VAPID_PUBLIC_KEY =
  "BMvE_rbVQ6y0sE34Deg7ccp_U3jDbSiv6eQsYBFGEUxvZR4_uBfHesGuz_stlcCIpy5uC9JYeOrs1pduxp9rvA0";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  return navigator.serviceWorker.register("/sw.js");
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await getRegistration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

// Attiva le push su QUESTO dispositivo e salva la sottoscrizione.
export async function subscribePush(userId: string): Promise<void> {
  const reg = await getRegistration();
  if (!reg) throw new Error("Push non supportate su questo browser");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      "Permesso negato. Abilita le notifiche per questo sito nelle impostazioni del browser/sistema."
    );
  }

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
  });

  const json = sub.toJSON();
  const { error } = await supabase().from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
      user_agent: navigator.userAgent.slice(0, 200),
    },
    { onConflict: "endpoint" }
  );
  if (error) throw error;
}

// Disattiva le push su questo dispositivo.
export async function unsubscribePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}
