import { useMemo, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, Check, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { validateEmpathyMap } from "@/lib/briefingReport";

interface Quadrant {
  id: string;
  label: string;
  emoji: string;
  min: number;
  accent: string;        // bg accent (semantic token via opacity)
  hint: string;
  placeholder: string;
}

const QUADRANTS: Quadrant[] = [
  { id: "me_pensaSente", label: "Pensa & Sente", emoji: "🧠", min: 3, accent: "bg-primary/8 border-primary/30",
    hint: "Mundo interior, crenças, medos não admitidos.",
    placeholder: "Ex.: 'Preciso provar que dá certo'..." },
  { id: "me_ve", label: "Vê", emoji: "👀", min: 3, accent: "bg-success/10 border-success/30",
    hint: "Estímulos visuais do cotidiano: amigos, concorrentes, ofertas.",
    placeholder: "Ex.: Concorrentes posando de ricos no Instagram..." },
  { id: "me_ouve", label: "Ouve", emoji: "👂", min: 3, accent: "bg-accent border-accent",
    hint: "Vozes e influências: família, ídolos, podcasts, líderes.",
    placeholder: "Ex.: Família dizendo 'arruma emprego de verdade'..." },
  { id: "me_falaFaz", label: "Fala & Faz", emoji: "💬", min: 3, accent: "bg-secondary border-secondary-foreground/20",
    hint: "Comportamento público; contradições entre discurso e prática.",
    placeholder: "Ex.: Posta prints de fatura mas raramente compra..." },
  { id: "me_dores", label: "Dores", emoji: "😣", min: 4, accent: "bg-destructive/10 border-destructive/30",
    hint: "Medos, frustrações e obstáculos. Mínimo 4.",
    placeholder: "Ex.: Medo de investir e não ter retorno..." },
  { id: "me_ganhos", label: "Ganhos", emoji: "🏆", min: 4, accent: "bg-primary-soft border-primary/30",
    hint: "Sucesso tangível e intangível. Mínimo 4.",
    placeholder: "Ex.: Faturar R$10k/mês previsível em 12 meses..." },
];

const countItems = (v: string) =>
  v.split(/[,\n;]+/).map((s) => s.trim()).filter((s) => s.length >= 3).length;

const splitItems = (v: string) =>
  v.split(/[,\n;]+/).map((s) => s.trim()).filter((s) => s.length > 0);

interface Props {
  data: Record<string, string>;
  onChange: (id: string, value: string) => void;
}

export const EmpathyMapPreview = ({ data, onChange }: Props) => {
  const [editing, setEditing] = useState<string | null>(null);
  const validation = useMemo(() => validateEmpathyMap(data), [data]);

  const totalMin = QUADRANTS.reduce((s, q) => s + q.min, 0);
  const totalActual = QUADRANTS.reduce((s, q) => s + Math.min(countItems(data[q.id] ?? ""), q.min), 0);
  const completionPct = Math.round((totalActual / totalMin) * 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3">
        <div className="flex items-center gap-2 text-sm">
          <Eye className="h-4 w-4 text-primary" />
          <span className="font-semibold">Preview do Mapa da Empatia</span>
          <span className="text-muted-foreground">— 6 quadrantes (Xplane / Dave Gray)</span>
        </div>
        <div className="flex items-center gap-2">
          {validation.ok ? (
            <span className="flex items-center gap-1 text-xs font-medium text-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> Completo
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-medium text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" /> {validation.errors.length} pendente(s)
            </span>
          )}
          <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold tabular-nums">
            {completionPct}%
          </span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {QUADRANTS.map((q) => {
          const value = data[q.id] ?? "";
          const items = splitItems(value);
          const count = countItems(value);
          const ok = count >= q.min;
          const isEditing = editing === q.id;

          return (
            <div
              key={q.id}
              className={cn(
                "flex flex-col rounded-xl border-2 p-3 transition-shadow",
                q.accent,
                !ok && "ring-1 ring-destructive/40",
                isEditing && "ring-2 ring-primary",
              )}
            >
              <div className="mb-2 flex items-center justify-between">
                <Label htmlFor={`prev-${q.id}`} className="flex items-center gap-2 text-sm font-bold">
                  <span className="text-lg leading-none">{q.emoji}</span>
                  {q.label}
                </Label>
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                      ok
                        ? "bg-success/20 text-success-foreground/80"
                        : "bg-destructive/20 text-destructive",
                    )}
                  >
                    {count}/{q.min}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => setEditing(isEditing ? null : q.id)}
                    aria-label={isEditing ? "Concluir edição" : "Editar quadrante"}
                  >
                    {isEditing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              {isEditing ? (
                <>
                  <Textarea
                    id={`prev-${q.id}`}
                    rows={5}
                    autoFocus
                    value={value}
                    placeholder={q.placeholder}
                    onChange={(e) => onChange(q.id, e.target.value)}
                    onBlur={() => setEditing(null)}
                    className="bg-background text-xs"
                  />
                  <p className="mt-1.5 text-[10px] text-muted-foreground">{q.hint}</p>
                </>
              ) : items.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setEditing(q.id)}
                  className="flex-1 rounded-md border border-dashed border-muted-foreground/40 p-2 text-left text-xs text-muted-foreground hover:border-primary hover:text-primary"
                >
                  Vazio — clique para preencher.
                  <br />
                  <span className="opacity-70">{q.hint}</span>
                </button>
              ) : (
                <ul className="space-y-1 text-xs leading-relaxed">
                  {items.slice(0, 6).map((item, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="text-muted-foreground">•</span>
                      <span className="line-clamp-2">{item}</span>
                    </li>
                  ))}
                  {items.length > 6 && (
                    <li className="text-[10px] italic text-muted-foreground">
                      +{items.length - 6} item(ns) ocultos
                    </li>
                  )}
                </ul>
              )}

              {!ok && !isEditing && (
                <p className="mt-1.5 text-[10px] font-medium text-destructive">
                  Faltam {q.min - count} item(ns).
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Dica: separe os itens por <strong>vírgula</strong> ou <strong>nova linha</strong>. Edite cada quadrante
        diretamente no preview ou nos campos completos abaixo.
      </p>
    </div>
  );
};
