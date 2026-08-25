"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, Trash2, UserPlus, Users } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import { logActivity } from "@/lib/activity";
import type { Membership, Role } from "@/lib/types";
import { fmtDate } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Avatar, EmptyState, PageHeader, PageSkeleton } from "@/components/ui/misc";
import { RolesMatrix } from "@/components/admin/roles-matrix";

type MemberRow = Membership & { created_at: string };

export default function UsersPage() {
  const { club, userId, profile, can, refresh, loading: ctxLoading } = useClub();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [email, setEmail] = useState("");
  const [roleSlug, setRoleSlug] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!club || !can("users.manage")) return;
    const sb = supabase();
    const [membersRes, rolesRes] = await Promise.all([
      sb.from("memberships")
        .select("*, profile:profiles(*), role:roles(*)")
        .eq("club_id", club.id)
        .order("created_at"),
      sb.from("roles").select("*").eq("club_id", club.id).order("name"),
    ]);
    setMembers((membersRes.data as MemberRow[]) ?? []);
    setRoles((rolesRes.data as Role[]) ?? []);
    setLoading(false);
  }, [club, can]);

  useEffect(() => {
    load();
  }, [load]);

  if (ctxLoading) return <PageSkeleton />;

  if (!can("users.manage")) {
    return (
      <EmptyState
        icon={<Lock />}
        title="Gestione utenti non disponibile"
        description="Non hai il permesso per gestire utenti e ruoli. Chiedi al Super Admin AUVI se pensi sia un errore."
      />
    );
  }

  if (loading) return <PageSkeleton />;

  async function changeRole(m: MemberRow, roleId: string) {
    if (!club || !userId || roleId === m.role_id) return;
    const { error } = await supabase().from("memberships").update({ role_id: roleId }).eq("id", m.id);
    if (!error) {
      const roleName = roles.find((r) => r.id === roleId)?.name ?? "nuovo ruolo";
      await logActivity({
        clubId: club.id,
        actorId: userId,
        action: "updated",
        summary: `${profile?.full_name ?? "Qualcuno"} ha cambiato il ruolo di ${m.profile?.full_name ?? "un membro"} in ${roleName}`,
      });
      await Promise.all([load(), refresh()]);
    }
  }

  async function removeMember(m: MemberRow) {
    if (!club || !userId) return;
    const name = m.profile?.full_name ?? "questo membro";
    if (!window.confirm(`Rimuovere ${name} dal club? Perderà l'accesso alla piattaforma.`)) return;
    const { error } = await supabase().from("memberships").delete().eq("id", m.id);
    if (!error) {
      await logActivity({
        clubId: club.id,
        actorId: userId,
        action: "deleted",
        summary: `${profile?.full_name ?? "Qualcuno"} ha rimosso ${name} dal club`,
      });
      await Promise.all([load(), refresh()]);
    }
  }

  async function addMember() {
    if (!club || !userId || !email.trim() || !roleSlug) return;
    setAdding(true);
    setAddError(null);
    const { error } = await supabase().rpc("add_member_by_email", {
      p_club: club.id,
      p_email: email.trim(),
      p_role_slug: roleSlug,
    });
    if (error) {
      // Mostra il messaggio della funzione (es. utente non registrato).
      setAddError(error.message);
      setAdding(false);
      return;
    }
    await logActivity({
      clubId: club.id,
      actorId: userId,
      action: "created",
      summary: `${profile?.full_name ?? "Qualcuno"} ha aggiunto ${email.trim()} al club`,
    });
    setAdding(false);
    setShowAdd(false);
    setEmail("");
    setRoleSlug("");
    await Promise.all([load(), refresh()]);
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Utenti"
        subtitle="Membri del club, ruoli e permessi."
        action={
          <Button variant="primary" onClick={() => setShowAdd(true)}>
            <UserPlus className="h-3.5 w-3.5" /> Add member
          </Button>
        }
      />

      <Card className="mb-4">
        <CardHeader title="Membri" />
        <CardBody>
          {members.length === 0 ? (
            <EmptyState className="py-6" icon={<Users />} title="Nessun membro" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3 font-semibold">Membro</th>
                    <th className="py-2 px-3 font-semibold">Ruolo</th>
                    <th className="py-2 px-3 font-semibold">Nel club dal</th>
                    <th className="py-2 pl-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {members.map((m) => (
                    <tr key={m.id} className="transition-colors hover:bg-background">
                      <td className="py-2.5 pr-3">
                        <span className="flex items-center gap-2.5">
                          <Avatar name={m.profile?.full_name} src={m.profile?.avatar_url} size={30} />
                          <span>
                            <span className="block font-medium">
                              {m.profile?.full_name ?? "—"}
                              {m.user_id === userId && (
                                <span className="ml-1.5 text-[11px] font-normal text-muted">(tu)</span>
                              )}
                            </span>
                            <span className="block text-[11px] text-muted">email non disponibile</span>
                          </span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <Select
                          value={m.role_id}
                          onChange={(e) => changeRole(m, e.target.value)}
                          disabled={m.user_id === userId}
                          className="h-8 w-auto min-w-44 text-[13px]"
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="py-2.5 px-3 text-muted">{fmtDate(m.created_at)}</td>
                      <td className="py-2.5 pl-3 text-right">
                        {m.user_id !== userId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeMember(m)}
                            aria-label={`Rimuovi ${m.profile?.full_name ?? "membro"}`}
                            className="text-muted hover:text-danger"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <RolesMatrix roles={roles} />

      <Dialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Aggiungi membro"
        footer={
          <>
            <Button onClick={() => setShowAdd(false)}>Annulla</Button>
            <Button
              variant="primary"
              loading={adding}
              disabled={!email.trim() || !roleSlug}
              onClick={addMember}
            >
              Aggiungi
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-[12.5px] text-muted">
            L&apos;utente deve essersi già registrato alla piattaforma con questa email.
          </p>
          <Field label="Email" required>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@esempio.com"
              autoFocus
            />
          </Field>
          <Field label="Ruolo" required>
            <Select value={roleSlug} onChange={(e) => setRoleSlug(e.target.value)}>
              <option value="">— Seleziona ruolo —</option>
              {roles.map((r) => (
                <option key={r.id} value={r.slug}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          {addError && <p className="text-[12px] text-danger">{addError}</p>}
        </div>
      </Dialog>
    </div>
  );
}
