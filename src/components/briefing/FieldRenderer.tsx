import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Field } from "@/lib/briefingSchema";

interface Props {
  field: Field;
  value: string;
  onChange: (v: string) => void;
  /** Dados completos do briefing — usado por campos com `optionsFn` dinâmico. */
  allData?: Record<string, string>;
  /** Destaca o campo (ex.: ICP recém-sugerido sobrescreveu valor anterior). */
  highlighted?: boolean;
  /** Mensagem de erro/aviso renderizada abaixo do campo. */
  error?: string;
}

export const FieldRenderer = ({ field, value, onChange, allData, highlighted, error }: Props) => {
  const dynamicOptions = field.optionsFn ? field.optionsFn(allData ?? {}) : field.options;
  const fieldWithOptions = { ...field, options: dynamicOptions };
  const labelEl = (
    <Label htmlFor={field.id} className="text-sm font-medium">
      {field.label}
      {field.required && <span className="ml-1 text-destructive">*</span>}
      {highlighted && (
        <span className="ml-2 inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
          ✨ Sugerido
        </span>
      )}
    </Label>
  );

  const ringClass = cn(
    highlighted && "ring-2 ring-primary/60 rounded-md transition-shadow",
    error && "ring-2 ring-destructive/60 rounded-md",
  );

  return (
    <div className={cn("space-y-1.5", (highlighted || error) && "p-1 -m-1", ringClass)}>
      {labelEl}
      {field.type === "text" && (
        <Input id={field.id} value={value} placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)} />
      )}
      {field.type === "date" && (
        <Input id={field.id} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {field.type === "textarea" && (
        <Textarea id={field.id} rows={field.rows ?? 3} value={value}
          placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
      {field.type === "select" && (
        <Select value={value || undefined} onValueChange={onChange}>
          <SelectTrigger id={field.id}><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>
            {fieldWithOptions.options?.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {field.type === "radio" && (
        <RadioGroup value={value} onValueChange={onChange} className="flex flex-wrap gap-4 pt-1">
          {fieldWithOptions.options?.map((o) => (
            <div key={o} className="flex items-center space-x-2">
              <RadioGroupItem value={o} id={`${field.id}-${o}`} />
              <Label htmlFor={`${field.id}-${o}`} className="font-normal cursor-pointer">{o}</Label>
            </div>
          ))}
        </RadioGroup>
      )}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
      {field.hint && !error && <p className="text-xs text-muted-foreground">{field.hint}</p>}
    </div>
  );
};
