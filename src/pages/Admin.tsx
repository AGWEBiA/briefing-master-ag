import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Loader2, Shield, Users, FileText, Pencil, Trash2, KeyRound, Mail, UserCog, UserPlus, Upload, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { getStrategy } from "@/lib/briefingSchema";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface AdminUser {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  roles: string[];
  is_admin: boolean;
}
interface BriefingRow {
  id: string; user_id: string; title: string; strategy: string | null;
  is_complete: boolean; updated_at: string;
}

const Admin = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [briefings, setBriefings] = useState<BriefingRow[]>([]);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);

  const loadUsers = async () => {
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "list" },
    });
    if (error) { toast.error("Falha ao carregar usuários"); return; }
    setUsers((data?.users ?? []) as AdminUser[]);
  };

  useEffect(() => {
    (async () => {
      const [{ data: br, error: be }] = await Promise.all([
        supabase.from("briefings").select("id,user_id,title,strategy,is_complete,updated_at")
          .order("updated_at", { ascending: false }),
      ]);
      if (be) toast.error("Falha ao carregar briefings");
      setBriefings(br ?? []);
      await loadUsers();
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const userName = (uid: string) =>
    users.find((p) => p.id === uid)?.display_name
    ?? users.find((p) => p.id === uid)?.email
    ?? uid.slice(0, 8);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-brand text-primary-foreground">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Painel Admin</h1>
            <p className="text-sm text-muted-foreground">Gestão completa de usuários e briefings.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard icon={Users} label="Usuários" value={users.length} />
          <StatCard icon={Shield} label="Admins" value={users.filter((u) => u.is_admin).length} />
          <StatCard icon={FileText} label="Briefings" value={briefings.length} />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Gestão de Usuários</CardTitle>
            <Button variant="outline" size="sm" onClick={loadUsers}>Recarregar</Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Último acesso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.display_name ?? "—"}
                      {u.id === user?.id && (
                        <Badge variant="outline" className="ml-2 text-xs">você</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email ?? "—"}</TableCell>
                    <TableCell>
                      {u.is_admin
                        ? <Badge className="bg-primary text-primary-foreground">Admin</Badge>
                        : <Badge variant="outline">Usuário</Badge>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {u.last_sign_in_at
                        ? new Date(u.last_sign_in_at).toLocaleDateString("pt-BR")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(u)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={u.id === user?.id}
                          onClick={() => setDeleting(u)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Briefings</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead><TableHead>Usuário</TableHead>
                  <TableHead>Estratégia</TableHead><TableHead>Status</TableHead>
                  <TableHead>Atualizado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {briefings.map((b) => {
                  const s = getStrategy(b.strategy);
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.title}</TableCell>
                      <TableCell>{userName(b.user_id)}</TableCell>
                      <TableCell>{s ? `${s.emoji} ${s.name}` : "—"}</TableCell>
                      <TableCell>
                        {b.is_complete
                          ? <Badge className="bg-success text-success-foreground">Finalizado</Badge>
                          : <Badge variant="outline">Em andamento</Badge>}
                      </TableCell>
                      <TableCell>{new Date(b.updated_at).toLocaleDateString("pt-BR")}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      <EditUserDialog
        user={editing}
        currentUserId={user?.id ?? null}
        onClose={() => setEditing(null)}
        onSaved={async () => { setEditing(null); await loadUsers(); }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Todos os briefings, integrações e dados do usuário
              <strong> {deleting?.display_name ?? deleting?.email}</strong> serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleting) return;
                const { data, error } = await supabase.functions.invoke("admin-users", {
                  body: { action: "delete", id: deleting.id },
                });
                if (error || data?.error) {
                  toast.error(data?.error ?? "Falha ao excluir");
                } else {
                  toast.success("Usuário excluído");
                  setDeleting(null);
                  await loadUsers();
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const EditUserDialog = ({
  user, currentUserId, onClose, onSaved,
}: {
  user: AdminUser | null;
  currentUserId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name ?? "");
      setEmail(user.email ?? "");
      setPassword("");
      setIsAdmin(user.is_admin);
    }
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const payload: Record<string, unknown> = { action: "update", id: user.id };
    if (displayName !== (user.display_name ?? "")) payload.display_name = displayName;
    if (email && email !== (user.email ?? "")) payload.email = email;
    if (password) {
      if (password.length < 6) { toast.error("Senha deve ter ao menos 6 caracteres"); setSaving(false); return; }
      payload.password = password;
    }
    if (isAdmin !== user.is_admin) payload.is_admin = isAdmin;

    const { data, error } = await supabase.functions.invoke("admin-users", { body: payload });
    setSaving(false);
    if (error || data?.error) {
      toast.error(data?.error ?? "Falha ao salvar");
      return;
    }
    toast.success("Usuário atualizado");
    onSaved();
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
          <DialogDescription>
            Atualize nome, email, senha ou permissões. Deixe a senha em branco para mantê-la.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><UserCog className="h-3.5 w-3.5" />Nome</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><KeyRound className="h-3.5 w-3.5" />Nova senha</Label>
            <Input
              type="password"
              placeholder="(deixe em branco para não alterar)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Acesso de Admin</p>
              <p className="text-xs text-muted-foreground">
                {user?.id === currentUserId
                  ? "Você não pode remover seu próprio admin."
                  : "Concede acesso ao painel administrativo."}
              </p>
            </div>
            <Switch
              checked={isAdmin}
              onCheckedChange={setIsAdmin}
              disabled={user?.id === currentUserId}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const StatCard = ({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) => (
  <Card>
    <CardContent className="flex items-center gap-4 py-5">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-soft text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </CardContent>
  </Card>
);

export default Admin;
