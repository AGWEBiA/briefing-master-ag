import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, FileText, Trash2, Loader2, CheckCircle2, Clock, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppHeader } from "@/components/AppHeader";
import { getStrategy, STRATEGIES } from "@/lib/briefingSchema";

interface BriefingRow {
  id: string;
  title: string;
  strategy: string | null;
  is_complete: boolean;
  updated_at: string;
}

type StatusFilter = "all" | "complete" | "in_progress";
const PAGE_SIZE_OPTIONS = [6, 9, 12, 24];

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<BriefingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [search, setSearch] = useState("");
  const [strategyFilter, setStrategyFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [pageSize, setPageSize] = useState<number>(9);
  const [page, setPage] = useState(1);

  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("briefings")
      .select("id,title,strategy,is_complete,updated_at")
      .order("updated_at", { ascending: false });
    if (error) { toast.error("Não foi possível carregar seus briefings"); return; }
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const create = async () => {
    if (!user) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("briefings")
      .insert({ user_id: user.id, title: "Novo briefing", data: {} })
      .select("id").single();
    setCreating(false);
    if (error || !data) { toast.error("Falha ao criar briefing"); return; }
    navigate(`/briefing/${data.id}`);
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("briefings").delete().eq("id", id);
    if (error) { toast.error("Falha ao excluir"); return; }
    toast.success("Briefing excluído");
    setItems((arr) => arr.filter((b) => b.id !== id));
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((b) => {
      if (strategyFilter === "none" && b.strategy) return false;
      if (strategyFilter !== "all" && strategyFilter !== "none" && b.strategy !== strategyFilter) return false;
      if (statusFilter === "complete" && !b.is_complete) return false;
      if (statusFilter === "in_progress" && b.is_complete) return false;
      if (q && !(b.title ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, strategyFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Reset to first page whenever filters/search/page size change
  useEffect(() => { setPage(1); }, [search, strategyFilter, statusFilter, pageSize]);

  const hasFilters = !!search || strategyFilter !== "all" || statusFilter !== "all";
  const clearFilters = () => {
    setSearch("");
    setStrategyFilter("all");
    setStatusFilter("all");
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Meus briefings</h1>
            <p className="text-sm text-muted-foreground">Crie, edite e exporte seus briefings de infoproduto.</p>
          </div>
          <Button onClick={create} disabled={creating} size="lg">
            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Novo briefing
          </Button>
        </div>

        {!loading && items.length > 0 && (
          <div className="mt-6 flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título…"
                className="pl-9 pr-9"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Limpar busca"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Select value={strategyFilter} onValueChange={setStrategyFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Estratégia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as estratégias</SelectItem>
                <SelectItem value="none">Sem estratégia</SelectItem>
                {STRATEGIES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.emoji} {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-full sm:w-[170px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="in_progress">Em andamento</SelectItem>
                <SelectItem value="complete">Finalizado</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Limpar
              </Button>
            )}
          </div>
        )}

        <div className="mt-6">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : items.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft">
                  <FileText className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Nenhum briefing ainda</h3>
                  <p className="text-sm text-muted-foreground">Crie seu primeiro para começar.</p>
                </div>
                <Button onClick={create} disabled={creating}>
                  <Plus className="mr-2 h-4 w-4" /> Criar primeiro briefing
                </Button>
              </CardContent>
            </Card>
          ) : filtered.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <Search className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Nenhum briefing encontrado com os filtros aplicados.
                </p>
                <Button variant="outline" size="sm" onClick={clearFilters}>Limpar filtros</Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Mostrando {(currentPage - 1) * pageSize + 1}
                  –{Math.min(currentPage * pageSize, filtered.length)} de {filtered.length}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {paged.map((b) => {
                  const strat = getStrategy(b.strategy);
                  return (
                    <Card key={b.id} className="group transition-shadow hover:shadow-elevated">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <Link to={`/briefing/${b.id}`} className="flex-1">
                            <CardTitle className="line-clamp-2 text-base group-hover:text-primary">
                              {b.title || "Sem título"}
                            </CardTitle>
                          </Link>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir briefing?</AlertDialogTitle>
                                <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => remove(b.id)}>Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Link to={`/briefing/${b.id}`} className="block space-y-3">
                          <div className="flex flex-wrap gap-2">
                            {strat ? (
                              <Badge variant="secondary" className="font-medium">{strat.emoji} {strat.name}</Badge>
                            ) : (
                              <Badge variant="outline">Sem estratégia</Badge>
                            )}
                            {b.is_complete ? (
                              <Badge className="bg-success text-success-foreground"><CheckCircle2 className="mr-1 h-3 w-3" />Finalizado</Badge>
                            ) : (
                              <Badge variant="outline"><Clock className="mr-1 h-3 w-3" />Em andamento</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Atualizado em {new Date(b.updated_at).toLocaleString("pt-BR")}
                          </p>
                        </Link>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="mt-6 flex flex-col items-center justify-between gap-3 sm:flex-row">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Por página</span>
                  <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                    <SelectTrigger className="h-8 w-[80px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Página {currentPage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
