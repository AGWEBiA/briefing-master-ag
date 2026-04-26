import { Link, Navigate } from "react-router-dom";
import { ClipboardList, ArrowRight, CheckCircle2, Sparkles, Layers, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-gradient-soft">
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-brand text-primary-foreground shadow-elevated">
              <ClipboardList className="h-5 w-5" />
            </div>
            <span className="font-bold">Briefing Universal</span>
          </div>
          <Button asChild><Link to="/auth">Entrar</Link></Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
        <section className="mx-auto max-w-3xl text-center animate-fade-in">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-soft px-4 py-1.5 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Para estrategistas e produtores de infoprodutos
          </div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
            Estruture o lançamento do seu infoproduto em minutos.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Um formulário multi-etapas inteligente que se adapta à sua estratégia — Lançamento Pago, Orgânico, Semente, Interno, Evergreen, Afiliados ou Co-produção.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Começar grátis <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </section>

        <section className="mt-20 grid gap-5 md:grid-cols-3">
          {[
            { icon: Layers, title: "7 estratégias suportadas", desc: "Seções específicas aparecem conforme sua escolha." },
            { icon: CheckCircle2, title: "Salvamento automático", desc: "Cada briefing fica seguro na sua conta." },
            { icon: Download, title: "Exporte em Markdown", desc: "Compartilhe ou imprima quando quiser." },
          ].map((f) => (
            <Card key={f.title} className="shadow-card transition-shadow hover:shadow-elevated">
              <CardContent className="space-y-3 pt-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </section>
      </main>
    </div>
  );
};

export default Index;
