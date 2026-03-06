import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield } from "lucide-react";
import {
  ADMIN_RESOURCES,
  RESOURCE_LABELS,
  type AdminResource,
  type PermissionLevel,
} from "@/hooks/usePermissions";

interface PermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

const LEVEL_OPTIONS: { value: PermissionLevel; label: string; color: string }[] = [
  { value: "editar", label: "Editar", color: "text-green-600" },
  { value: "ver", label: "Somente ver", color: "text-blue-600" },
  { value: "sem_acesso", label: "Sem acesso", color: "text-red-600" },
];

const PermissionsDialog = ({ open, onOpenChange, userId, userName }: PermissionsDialogProps) => {
  const { toast } = useToast();
  const [perms, setPerms] = useState<Record<string, PermissionLevel>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);

    supabase
      .from("user_permissions")
      .select("recurso, nivel")
      .eq("user_id", userId)
      .then(({ data }) => {
        const map: Record<string, PermissionLevel> = {};
        ADMIN_RESOURCES.forEach((r) => (map[r] = "editar")); // default for admins
        (data || []).forEach((p: any) => {
          map[p.recurso] = p.nivel as PermissionLevel;
        });
        setPerms(map);
        setLoading(false);
      });
  }, [open, userId]);

  const handleChange = (resource: AdminResource, nivel: PermissionLevel) => {
    setPerms((prev) => ({ ...prev, [resource]: nivel }));
  };

  const handleSetAll = (nivel: PermissionLevel) => {
    const updated: Record<string, PermissionLevel> = {};
    ADMIN_RESOURCES.forEach((r) => (updated[r] = nivel));
    setPerms(updated);
  };

  const handleSave = async () => {
    setSaving(true);

    // Delete existing permissions for this user
    await supabase.from("user_permissions").delete().eq("user_id", userId);

    // Insert only non-default (non-editar) permissions to save space
    // But we save all explicitly to allow overriding admin defaults
    const rows = ADMIN_RESOURCES.map((r) => ({
      user_id: userId,
      recurso: r,
      nivel: perms[r] || "editar",
    }));

    const { error } = await supabase.from("user_permissions").insert(rows as any);
    setSaving(false);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Permissões atualizadas" });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" /> Permissões - {userName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-4">Carregando...</p>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Label className="text-xs text-muted-foreground self-center">Aplicar a todos:</Label>
              {LEVEL_OPTIONS.map((o) => (
                <Button
                  key={o.value}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => handleSetAll(o.value)}
                >
                  {o.label}
                </Button>
              ))}
            </div>

            <div className="space-y-2">
              {ADMIN_RESOURCES.map((resource) => (
                <div
                  key={resource}
                  className="flex items-center justify-between border rounded-md px-3 py-2"
                >
                  <span className="text-sm font-medium">
                    {RESOURCE_LABELS[resource]}
                  </span>
                  <Select
                    value={perms[resource] || "editar"}
                    onValueChange={(v) => handleChange(resource, v as PermissionLevel)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEVEL_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          <span className={o.color}>{o.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Salvando..." : "Salvar Permissões"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PermissionsDialog;
