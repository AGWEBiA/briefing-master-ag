import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Field } from "@/lib/briefingSchema";

interface Props {
  field: Field;
  value: string;
  onChange: (v: string) => void;
  /** Dados completos do briefing — usado por campos com `optionsFn` dinâmico. */
  allData?: Record<string, string>;
}

export const FieldRenderer = ({ field, value, onChange, allData }: Props) => {
  const dynamicOptions = field.optionsFn ? field.optionsFn(allData ?? {}) : field.options;
  const fieldWithOptions = { ...field, options: dynamicOptions };
  const labelEl = (
    <Label htmlFor={field.id} className="text-sm font-medium">
      {field.label}
      {field.required && <span className="ml-1 text-destructive">*</span>}
    </Label>
  );

  return (
    <div className="space-y-1.5">
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
            {field.options?.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {field.type === "radio" && (
        <RadioGroup value={value} onValueChange={onChange} className="flex flex-wrap gap-4 pt-1">
          {field.options?.map((o) => (
            <div key={o} className="flex items-center space-x-2">
              <RadioGroupItem value={o} id={`${field.id}-${o}`} />
              <Label htmlFor={`${field.id}-${o}`} className="font-normal cursor-pointer">{o}</Label>
            </div>
          ))}
        </RadioGroup>
      )}
      {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
    </div>
  );
};
