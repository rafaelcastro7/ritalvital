import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().trim().email('Correo inválido').max(255);
const passwordSchema = z.string().min(8, 'Mínimo 8 caracteres').max(72);
const nameSchema = z.string().trim().min(2, 'Mínimo 2 caracteres').max(100);

const Auth = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');

  useEffect(() => {
    if (!authLoading && user) navigate('/cuenta', { replace: true });
  }, [user, authLoading, navigate]);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const email = emailSchema.parse(fd.get('email'));
      const password = passwordSchema.parse(fd.get('password'));
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success('Bienvenido');
      navigate('/cuenta', { replace: true });
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.errors[0].message
        : err instanceof Error ? err.message : 'Error al iniciar sesión';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const email = emailSchema.parse(fd.get('email'));
      const password = passwordSchema.parse(fd.get('password'));
      const fullName = nameSchema.parse(fd.get('full_name'));
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/cuenta`,
          data: { full_name: fullName },
        },
      });
      if (error) throw error;
      toast.success('Cuenta creada');
      navigate('/cuenta', { replace: true });
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.errors[0].message
        : err instanceof Error ? err.message : 'Error al crear cuenta';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Volver al dashboard
        </Link>
        <Card className="p-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="text-primary">🏥</span> RutaVital IA
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Acceso para entidades y analistas</p>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as 'signin' | 'signup')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Ingresar</TabsTrigger>
              <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="si-email">Correo</Label>
                  <Input id="si-email" name="email" type="email" required autoComplete="email" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="si-password">Contraseña</Label>
                  <Input id="si-password" name="password" type="password" required autoComplete="current-password" />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Ingresar
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="su-name">Nombre completo</Label>
                  <Input id="su-name" name="full_name" type="text" required autoComplete="name" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-email">Correo</Label>
                  <Input id="su-email" name="email" type="email" required autoComplete="email" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-password">Contraseña</Label>
                  <Input id="su-password" name="password" type="password" required minLength={8} autoComplete="new-password" />
                  <p className="text-[11px] text-muted-foreground">Mínimo 8 caracteres. Verificamos contra contraseñas filtradas.</p>
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Crear cuenta
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="text-[11px] text-muted-foreground text-center mt-6">
            Al crear una cuenta aceptas el uso responsable de RutaVital IA.
            Datos abiertos · No reemplaza criterio operativo.
          </p>
        </Card>
      </div>
    </main>
  );
};

export default Auth;
