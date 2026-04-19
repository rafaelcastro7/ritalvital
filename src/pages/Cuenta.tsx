import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, LogOut, ArrowLeft, ShieldCheck } from 'lucide-react';

interface Profile {
  full_name: string | null;
  cargo: string | null;
  telefono: string | null;
  entidad_id: string | null;
}

const Cuenta = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth', { replace: true });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [profRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('full_name, cargo, telefono, entidad_id').eq('id', user.id).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', user.id),
      ]);
      if (profRes.data) setProfile(profRes.data);
      if (rolesRes.data) setRoles(rolesRes.data.map((r) => r.role));
      setLoading(false);
    })();
  }, [user]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from('profiles').update({
      full_name: String(fd.get('full_name') || '').trim() || null,
      cargo: String(fd.get('cargo') || '').trim() || null,
      telefono: String(fd.get('telefono') || '').trim() || null,
    }).eq('id', user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Perfil actualizado');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  if (authLoading || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>

        <Card className="p-6">
          <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Mi cuenta</h1>
              <p className="text-sm text-muted-foreground mt-1">{user?.email}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-1.5" /> Cerrar sesión
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-6">
            {roles.map((r) => (
              <Badge key={r} variant="secondary" className="gap-1">
                <ShieldCheck className="w-3 h-3" /> {r}
              </Badge>
            ))}
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Nombre completo</Label>
              <Input id="full_name" name="full_name" defaultValue={profile?.full_name ?? ''} maxLength={100} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cargo">Cargo</Label>
                <Input id="cargo" name="cargo" defaultValue={profile?.cargo ?? ''} placeholder="Ej. Coordinador de salud" maxLength={120} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input id="telefono" name="telefono" defaultValue={profile?.telefono ?? ''} placeholder="+57 ..." maxLength={30} />
              </div>
            </div>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar cambios
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Próximamente:</strong> vincular tu cuenta a una entidad
              (gobernación, alcaldía, MinSalud) para acceder a reportes, suscripciones de alertas
              y vistas filtradas a tu jurisdicción.
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
};

export default Cuenta;
