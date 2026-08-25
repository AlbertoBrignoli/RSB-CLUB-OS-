"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import type { Role } from "@/lib/types";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";

interface Permission {
  key: string;
  description: string | null;
}

// Matrice read-only ruoli × permessi del club.
export function RolesMatrix({ roles }: { roles: Role[] }) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePerms, setRolePerms] = useState<Map<string, Set<string>>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (roles.length === 0) return;
    (async () => {
      const sb = supabase();
      const [permsRes, rpRes] = await Promise.all([
        sb.from("permissions").select("*").order("key"),
        sb.from("role_permissions").select("role_id, permission_key").in(
          "role_id",
          roles.map((r) => r.id)
        ),
      ]);
      setPermissions((permsRes.data as Permission[]) ?? []);
      const map = new Map<string, Set<string>>();
      for (const rp of (rpRes.data as { role_id: string; permission_key: string }[]) ?? []) {
        if (!map.has(rp.role_id)) map.set(rp.role_id, new Set());
        map.get(rp.role_id)!.add(rp.permission_key);
      }
      setRolePerms(map);
      setLoading(false);
    })();
  }, [roles]);

  return (
    <Card>
      <CardHeader title="Ruoli e permessi" />
      <CardBody>
        <p className="mb-3 text-[12px] text-muted">
          Panoramica read-only di cosa può fare ogni ruolo. I permessi determinano le azioni
          disponibili in tutta la piattaforma.
        </p>
        {loading ? (
          <Skeleton className="h-48" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3 font-semibold">Permesso</th>
                  {roles.map((r) => (
                    <th key={r.id} className="py-2 px-2 text-center font-semibold whitespace-nowrap">
                      {r.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {permissions.map((p) => (
                  <tr key={p.key} className="transition-colors hover:bg-background">
                    <td className="py-2 pr-3">
                      <p className="font-medium">{p.key}</p>
                      {p.description && <p className="text-[11px] text-muted">{p.description}</p>}
                    </td>
                    {roles.map((r) => (
                      <td key={r.id} className="py-2 px-2 text-center">
                        {rolePerms.get(r.id)?.has(p.key) ? (
                          <Check className="mx-auto h-3.5 w-3.5 text-ok" />
                        ) : (
                          <span className="text-muted/30">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
