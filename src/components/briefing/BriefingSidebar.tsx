import { CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { FIXED_SECTIONS, getStrategy, isSectionComplete, type Section } from "@/lib/briefingSchema";

interface Props {
  strategyId: string | null;
  data: Record<string, string>;
  visited: Set<string>;
  currentIndex: number;
  onJump: (idx: number) => void;
}

export const BriefingSidebar = ({ strategyId, data, visited, currentIndex, onJump }: Props) => {
  const strat = getStrategy(strategyId);
  const all: Section[] = strat ? [...FIXED_SECTIONS, ...strat.sections] : FIXED_SECTIONS;

  const completed = all.filter((s) => isSectionComplete(s, data, strategyId) || visited.has(s.id)).length;
  const pct = (completed / all.length) * 100;

  const renderItem = (s: Section, idx: number) => {
    const active = idx === currentIndex;
    const done = isSectionComplete(s, data, strategyId);
    return (
      <button
        key={s.id}
        type="button"
        onClick={() => onJump(idx)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-all",
          active
            ? "border-primary bg-primary-soft font-medium text-primary"
            : "border-transparent text-foreground hover:bg-muted",
        )}
      >
        {done ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
        ) : (
          <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="flex-1 truncate">{s.title}</span>
      </button>
    );
  };

  return (
    <aside className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>Progresso</span>
          <span>{completed}/{all.length}</span>
        </div>
        <Progress value={pct} className="h-2" />
      </div>

      <div className="space-y-1">
        <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Base do Produto
        </p>
        {FIXED_SECTIONS.map((s, i) => renderItem(s, i))}
      </div>

      {strat ? (
        <div className="space-y-1">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-primary">
            {strat.emoji} {strat.name}
          </p>
          {strat.sections.map((s, i) => renderItem(s, FIXED_SECTIONS.length + i))}
        </div>
      ) : (
        <div className="flex gap-2 rounded-md border border-accent/30 bg-accent/10 p-3 text-xs text-foreground">
          <AlertTriangle className="h-4 w-4 shrink-0 text-accent" />
          <span>Selecione uma estratégia na seção 5 para ver as seções específicas.</span>
        </div>
      )}
    </aside>
  );
};
