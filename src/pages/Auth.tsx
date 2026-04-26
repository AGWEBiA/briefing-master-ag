import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { ClipboardList, Mail, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/contexts/AuthContext";

const emailSchema = z.string().trim().email("E-mail inválido").max(255);
const pwdSchema = z.string().min(8, "Mínimo 8 caracteres").max(72);

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
  </svg>
);

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!loading && user) {
      const dest = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/dashboard";
      navigate(dest, { replace: true });
    }
  }, [user, loading, navigate, location.state]);

  // Cadastros são feitos exclusivamente pelo admin.

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const ev = emailSchema.safeParse(email);
    if (!ev.success) return toast.error(ev.error.issues[0].message);
    if (!password) return toast.error("Informe a senha");

    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: ev.data, password });
    setBusy(false);
    if (error) {
      if (error.message.toLowerCase().includes("invalid")) toast.error("E-mail ou senha incorretos.");
      else toast.error(error.message);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/dashboard`,
    });
    if ("error" in result && result.error) {
      toast.error("Falha no login com Google");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-soft p-4">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        <Link to="/" className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-brand shadow-elevated">
            <ClipboardList className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Briefing Universal</h1>
            <p className="text-sm text-muted-foreground">Para estrategistas e produtores de infoprodutos</p>
          </div>
        </Link>

        <Card className="shadow-card">
          <CardHeader className="pb-4">
            <CardTitle>Acesse sua conta</CardTitle>
            <CardDescription>Entre ou crie uma conta para começar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={busy}>
              <GoogleIcon /> <span className="ml-2">Continuar com Google</span>
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">ou com e-mail</span>
              </div>
            </div>

            <form onSubmit={handleSignIn} className="space-y-3">
              <FieldEmail value={email} onChange={setEmail} />
              <FieldPassword value={password} onChange={setPassword} />
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
              </Button>
            </form>

            <p className="pt-2 text-center text-xs text-muted-foreground">
              Não tem acesso? Solicite a um administrador para criar sua conta.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const FieldEmail = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <div className="space-y-1.5">
    <Label htmlFor="email">E-mail</Label>
    <div className="relative">
      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input id="email" type="email" autoComplete="email" placeholder="voce@exemplo.com"
        value={value} onChange={(e) => onChange(e.target.value)} className="pl-9" />
    </div>
  </div>
);
const FieldPassword = ({ value, onChange, hint }: { value: string; onChange: (v: string) => void; hint?: string }) => (
  <div className="space-y-1.5">
    <Label htmlFor="password">Senha</Label>
    <div className="relative">
      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••"
        value={value} onChange={(e) => onChange(e.target.value)} className="pl-9" />
    </div>
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

export default Auth;
