import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Loader2, Shield, Users, FileText, Pencil, Trash2, KeyRound, Mail, UserCog, UserPlus, Upload, Download, Search, X, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
  const [creating, setCreating] = useState(false);
  const [importResult, setImportResult] = useState<null | {
    created: number;
    total: number;
    results: Array<{ email: string; status: "created" | "error"; error?: string }>;
  }>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<"all" | "admin" | "user">("all");
  const [userSort, setUserSort] = useState<{ key: "name" | "last_sign_in"; dir: "asc" | "desc" }>({ key: "last_sign_in", dir: "desc" });
  const [briefingSort, setBriefingSort] = useState<{ key: "title" | "updated"; dir: "asc" | "desc" }>({ key: "updated", dir: "desc" });

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

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { email: "exemplo@dominio.com", password: "senha123", display_name: "Nome Completo", is_admin: false },
      { email: "admin@dominio.com", password: "outraSenha", display_name: "Admin Exemplo", is_admin: true },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "usuarios");
    XLSX.writeFile(wb, "modelo-importacao-usuarios.xlsx");
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

      const items = rows.map((r) => {
        const get = (keys: string[]) => {
          for (const k of keys) {
            const found = Object.keys(r).find((x) => x.toLowerCase().trim() === k);
            if (found && r[found] !== "" && r[found] != null) return String(r[found]).trim();
          }
          return "";
        };
        const adminRaw = get(["is_admin", "admin", "isadmin"]).toLowerCase();
        return {
          email: get(["email", "e-mail"]),
          password: get(["password", "senha"]),
          display_name: get(["display_name", "nome", "name", "full_name"]) || null,
          is_admin: ["true", "1", "sim", "yes", "x"].includes(adminRaw),
        };
      }).filter((i) => i.email);

      if (!items.length) {
        toast.error("Nenhuma linha válida encontrada.");
        return;
      }

      setImporting(true);
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "bulk_create", items },
      });
      setImporting(false);

      if (error || data?.error) {
        toast.error(data?.error ?? "Falha na importação");
        return;
      }
      setImportResult({
        created: data.created,
        total: data.total,
        results: data.results,
      });
      toast.success(`${data.created}/${data.total} usuários importados`);
      await loadUsers();
    } catch (err) {
      setImporting(false);
      toast.error("Não foi possível ler a planilha");
      console.error(err);
    }
  };

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

  const filteredUsers = users.filter((u) => {
    if (userRoleFilter === "admin" && !u.is_admin) return false;
    if (userRoleFilter === "user" && u.is_admin) return false;
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.display_name ?? "").toLowerCase().includes(q)
    );
  });

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
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Gestão de Usuários</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFile}
              />
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="mr-1.5 h-4 w-4" /> Modelo XLSX
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={importing}
              >
                {importing ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-1.5 h-4 w-4" />
                )}
                Importar XLSX
              </Button>
              <Button size="sm" onClick={() => setCreating(true)}>
                <UserPlus className="mr-1.5 h-4 w-4" /> Novo usuário
              </Button>
              <Button variant="ghost" size="sm" onClick={loadUsers}>Recarregar</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Buscar por nome ou email…"
                  className="pl-9 pr-9"
                />
                {userSearch && (
                  <button
                    type="button"
                    onClick={() => setUserSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                    aria-label="Limpar busca"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Select value={userRoleFilter} onValueChange={(v) => setUserRoleFilter(v as typeof userRoleFilter)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filtrar por role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="admin">Apenas Admins</SelectItem>
                  <SelectItem value="user">Apenas Usuários</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground sm:ml-2">
                {filteredUsers.length} de {users.length}
              </div>
            </div>

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
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum usuário encontrado com os filtros atuais.
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.display_name ?? "—"}
                      {u.id === user?.id && (
                        <Badge variant="outline" className="ml-2 text-xs">você</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={u.is_admin}
                          disabled={u.id === user?.id}
                          aria-label="Alternar permissão de admin"
                          onCheckedChange={async (checked) => {
                            if (u.id === user?.id) return;
                            // Optimistic update
                            const prev = u.is_admin;
                            setUsers((list) => list.map((x) =>
                              x.id === u.id
                                ? { ...x, is_admin: checked, roles: checked
                                    ? Array.from(new Set([...x.roles, "admin"]))
                                    : x.roles.filter((r) => r !== "admin") }
                                : x
                            ));
                            const { data, error } = await supabase.functions.invoke("admin-users", {
                              body: { action: "set_admin", id: u.id, is_admin: checked },
                            });
                            if (error || data?.error) {
                              // rollback
                              setUsers((list) => list.map((x) =>
                                x.id === u.id
                                  ? { ...x, is_admin: prev, roles: prev
                                      ? Array.from(new Set([...x.roles, "admin"]))
                                      : x.roles.filter((r) => r !== "admin") }
                                  : x
                              ));
                              toast.error(data?.error ?? "Falha ao atualizar permissão");
                            } else {
                              toast.success(checked ? "Promovido a admin" : "Removido de admin");
                            }
                          }}
                        />
                        {u.is_admin
                          ? <Badge className="bg-primary text-primary-foreground">Admin</Badge>
                          : <Badge variant="outline">Usuário</Badge>}
                      </div>
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

      <CreateUserDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={async () => { setCreating(false); await loadUsers(); }}
      />

      <ImportResultDialog
        result={importResult}
        onClose={() => setImportResult(null)}
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

const CreateUserDialog = ({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) => {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDisplayName(""); setEmail(""); setPassword(""); setIsAdmin(false);
    }
  }, [open]);

  const create = async () => {
    if (!email.trim() || !password) return toast.error("Email e senha são obrigatórios");
    if (password.length < 6) return toast.error("Senha deve ter ao menos 6 caracteres");
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: {
        action: "create",
        email: email.trim(),
        password,
        display_name: displayName.trim() || null,
        is_admin: isAdmin,
      },
    });
    setSaving(false);
    if (error || data?.error) {
      toast.error(data?.error ?? "Falha ao criar usuário");
      return;
    }
    toast.success("Usuário criado");
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar novo usuário</DialogTitle>
          <DialogDescription>
            O usuário receberá acesso imediato com email já confirmado.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><UserCog className="h-3.5 w-3.5" />Nome</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nome completo" />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@dominio.com" />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><KeyRound className="h-3.5 w-3.5" />Senha</Label>
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Conceder acesso de Admin</p>
              <p className="text-xs text-muted-foreground">Acesso ao painel administrativo.</p>
            </div>
            <Switch checked={isAdmin} onCheckedChange={setIsAdmin} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={create} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar usuário
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ImportResultDialog = ({
  result, onClose,
}: {
  result: null | {
    created: number;
    total: number;
    results: Array<{ email: string; status: "created" | "error"; error?: string }>;
  };
  onClose: () => void;
}) => {
  const errors = result?.results.filter((r) => r.status === "error") ?? [];
  const duplicates = errors.filter((r) => /j[áa] cadastrad|duplicad/i.test(r.error ?? "")).length;
  const otherErrors = errors.length - duplicates;

  return (
    <Dialog open={!!result} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Resultado da importação</DialogTitle>
          <DialogDescription>
            {result?.created ?? 0} de {result?.total ?? 0} usuários criados com sucesso.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border bg-success/5 p-3">
            <p className="text-xs text-muted-foreground">Criados</p>
            <p className="text-xl font-bold text-success">{result?.created ?? 0}</p>
          </div>
          <div className="rounded-lg border bg-warning/5 p-3">
            <p className="text-xs text-muted-foreground">Já existiam</p>
            <p className="text-xl font-bold">{duplicates}</p>
          </div>
          <div className="rounded-lg border bg-destructive/5 p-3">
            <p className="text-xs text-muted-foreground">Outros erros</p>
            <p className="text-xl font-bold text-destructive">{otherErrors}</p>
          </div>
        </div>

        <div className="max-h-80 overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result?.results.map((r, i) => {
                const isDup = r.status === "error" && /j[áa] cadastrad|duplicad/i.test(r.error ?? "");
                return (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{r.email || "—"}</TableCell>
                    <TableCell>
                      {r.status === "created"
                        ? <Badge className="bg-success text-success-foreground">Criado</Badge>
                        : isDup
                          ? <Badge variant="outline" className="border-warning text-warning">Já existia</Badge>
                          : <Badge variant="destructive">Erro</Badge>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.error ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
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
