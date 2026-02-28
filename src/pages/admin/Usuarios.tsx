import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Search, Shield, UserCog, Plus, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface UserProfile {
  profile_id: string;
  nome: string;
  avatar_url: string | null;
  email?: string;
  roles: string[];
}

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin", color: "bg-red-100 text-red-800" },
  { value: "vendedor", label: "Vendedor", color: "bg-blue-100 text-blue-800" },
  { value: "cliente", label: "Cliente", color: "bg-green-100 text-green-800" },
];

const Usuarios = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [editNome, setEditNome] = useState("");
  const [saving, setSaving] = useState(false);

  // Role dialog
  const [roleOpen, setRoleOpen] = useState(false);
  const [roleUser, setRoleUser] = useState<UserProfile | null>(null);
  const [newRole, setNewRole] = useState("");

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);

    // Get all profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("profile_id, nome, avatar_url")
      .order("nome");

    // Get all roles
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role");

    // Get cliente emails
    const { data: clientes } = await supabase
      .from("cliente")
      .select("user_id, email");

    if (profiles) {
      const roleMap: Record<string, string[]> = {};
      (roles || []).forEach((r: any) => {
        if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
        roleMap[r.user_id].push(r.role);
      });

      const emailMap: Record<string, string> = {};
      (clientes || []).forEach((c: any) => {
        if (c.user_id && c.email) emailMap[c.user_id] = c.email;
      });

      setUsers(
        profiles.map((p: any) => ({
          profile_id: p.profile_id,
          nome: p.nome,
          avatar_url: p.avatar_url,
          email: emailMap[p.profile_id] || "",
          roles: roleMap[p.profile_id] || [],
        }))
      );
    }
    setLoading(false);
  };

  const openEdit = (u: UserProfile) => {
    setEditUser(u);
    setEditNome(u.nome);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nome: editNome })
      .eq("profile_id", editUser.profile_id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Perfil atualizado" });
      setEditOpen(false);
      loadUsers();
    }
  };

  const openRoles = (u: UserProfile) => {
    setRoleUser(u);
    setNewRole("");
    setRoleOpen(true);
  };

  const addRole = async () => {
    if (!roleUser || !newRole) return;
    if (roleUser.roles.includes(newRole)) {
      toast({ title: "Usuário já possui esta role", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: roleUser.profile_id, role: newRole as any });
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Role "${newRole}" adicionada` });
      loadUsers();
      setRoleUser({ ...roleUser, roles: [...roleUser.roles, newRole] });
    }
  };

  const removeRole = async (role: string) => {
    if (!roleUser) return;
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", roleUser.profile_id)
      .eq("role", role as any);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Role "${role}" removida` });
      const updated = roleUser.roles.filter((r) => r !== role);
      setRoleUser({ ...roleUser, roles: updated });
      loadUsers();
    }
  };

  const filtered = users.filter(
    (u) =>
      u.nome.toLowerCase().includes(search.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Usuários</h1>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((u) => (
              <Card key={u.profile_id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{u.nome || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openRoles(u)}>
                        <Shield className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {u.roles.length === 0 && <span className="text-xs text-muted-foreground">Sem roles</span>}
                    {u.roles.map((r) => {
                      const opt = ROLE_OPTIONS.find((o) => o.value === r);
                      return (
                        <span key={r} className={`text-xs px-2 py-0.5 rounded-full ${opt?.color || "bg-muted"}`}>
                          {opt?.label || r}
                        </span>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead className="w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((u) => (
                      <TableRow key={u.profile_id}>
                        <TableCell className="font-medium">{u.nome || "Sem nome"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {u.roles.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                            {u.roles.map((r) => {
                              const opt = ROLE_OPTIONS.find((o) => o.value === r);
                              return (
                                <span key={r} className={`text-xs px-2 py-0.5 rounded-full ${opt?.color || "bg-muted"}`}>
                                  {opt?.label || r}
                                </span>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)} title="Editar perfil">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openRoles(u)} title="Gerenciar roles">
                              <Shield className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <p className="text-sm text-muted-foreground">{filtered.length} usuário(s)</p>
        </>
      )}

      {/* Edit Profile Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Perfil</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} />
            </div>
            {editUser?.email && (
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={editUser.email} disabled className="bg-muted" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Roles Dialog */}
      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" /> Gerenciar Roles
            </DialogTitle>
          </DialogHeader>
          {roleUser && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Usuário: <strong>{roleUser.nome || roleUser.email}</strong>
              </p>

              {/* Current roles */}
              <div className="space-y-2">
                <Label>Roles atuais</Label>
                {roleUser.roles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma role atribuída</p>
                ) : (
                  <div className="space-y-2">
                    {roleUser.roles.map((r) => {
                      const opt = ROLE_OPTIONS.find((o) => o.value === r);
                      return (
                        <div key={r} className="flex items-center justify-between border rounded-md px-3 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${opt?.color || "bg-muted"}`}>
                            {opt?.label || r}
                          </span>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRole(r)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add role */}
              <div className="space-y-2">
                <Label>Adicionar role</Label>
                <div className="flex gap-2">
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecionar role..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.filter((o) => !roleUser.roles.includes(o.value)).map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={addRole} disabled={!newRole || saving} className="gap-1">
                    <Plus className="h-4 w-4" /> Adicionar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Usuarios;
