import { useEffect, useState } from "react";
import { Loader2, Shield, Users, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { getStrategy } from "@/lib/briefingSchema";
import { toast } from "sonner";

interface Profile { id: string; display_name: string | null; created_at: string }
interface BriefingRow {
  id: string; user_id: string; title: string; strategy: string | null;
  is_complete: boolean; updated_at: string;
}

const Admin = () => {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [briefings, setBriefings] = useState<BriefingRow[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: pr, error: pe }, { data: br, error: be }] = await Promise.all([
        supabase.from("profiles").select("id,display_name,created_at").order("created_at", { ascending: false }),
        supabase.from("briefings").select("id,user_id,title,strategy,is_complete,updated_at")
          .order("updated_at", { ascending: false }),
      ]);
      if (pe || be) { toast.error("Falha ao carregar dados"); }
      setProfiles(pr ?? []);
      setBriefings(br ?? []);
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

  const profileName = (uid: string) =>
    profiles.find((p) => p.id === uid)?.display_name ?? uid.slice(0, 8);

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
            <p className="text-sm text-muted-foreground">Visão geral de todos os usuários e briefings.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard icon={Users} label="Usuários" value={profiles.length} />
          <StatCard icon={FileText} label="Briefings" value={briefings.length} />
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Usuários</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Nome</TableHead><TableHead>ID</TableHead><TableHead>Criado em</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.display_name ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{p.id.slice(0, 8)}…</TableCell>
                    <TableCell>{new Date(p.created_at).toLocaleDateString("pt-BR")}</TableCell>
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
                      <TableCell>{profileName(b.user_id)}</TableCell>
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
    </div>
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
