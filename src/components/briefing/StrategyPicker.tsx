import { STRATEGIES, type StrategyId } from "@/lib/briefingSchema";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  selected: StrategyId | null;
  onSelect: (id: StrategyId) => void;
}

export const StrategyPicker = ({ selected, onSelect }: Props) => {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Selecione a estratégia
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {STRATEGIES.map((s) => {
          const active = selected === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              className={cn(
                "group rounded-lg border p-4 text-left transition-all",
                "hover:border-primary hover:shadow-sm",
                active ? "border-primary bg-primary-soft shadow-sm" : "border-border bg-card",
              )}
            >
              <div className="flex items-start gap-3">
                <span className="text-3xl leading-none">{s.emoji}</span>
                <div className="flex-1 space-y-2">
                  <div className="font-semibold">{s.name}</div>
                  <p className="text-xs text-muted-foreground">{s.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {s.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px] font-normal">{t}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
