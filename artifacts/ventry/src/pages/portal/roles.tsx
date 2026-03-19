import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, ShieldCheck, Pencil, Trash2, Users } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    body: options?.body ? (typeof options.body === "string" ? options.body : JSON.stringify(options.body)) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || err.error || "Request failed");
  }
  return res.json() as Promise<T>;
}

const PERMISSION_GROUPS: Record<string, { key: string; label: string }[]> = {
  "Visit Requests": [
    { key: "visit_requests.view", label: "View Visit Requests" },
    { key: "visit_requests.create", label: "Create Visit Requests" },
    { key: "visit_requests.approve", label: "Approve / Reject Requests" },
    { key: "visit_requests.check_in", label: "Check In / Out Visitors" },
  ],
  "Visitors": [
    { key: "visitors.view", label: "View Visitors" },
    { key: "visitors.manage", label: "Manage Visitors" },
    { key: "blacklist.view", label: "View Blacklist" },
    { key: "blacklist.manage", label: "Manage Blacklist" },
  ],
  "Users & Invitations": [
    { key: "users.view", label: "View Users" },
    { key: "users.manage", label: "Manage Users" },
    { key: "invitations.manage", label: "Send & Revoke Invitations" },
  ],
  "Organization": [
    { key: "branches.view", label: "View Branches" },
    { key: "branches.manage", label: "Manage Branches" },
    { key: "settings.view", label: "View Settings" },
    { key: "settings.manage", label: "Manage Settings" },
  ],
  "Reports & Logs": [
    { key: "dashboard.view", label: "View Dashboard" },
    { key: "reports.view", label: "View Reports" },
    { key: "audit_logs.view", label: "View Audit Logs" },
  ],
  "Roles": [
    { key: "roles.view", label: "View Roles & Permissions" },
    { key: "roles.manage", label: "Manage Roles & Permissions" },
  ],
  "Notifications & Integrations": [
    { key: "notifications.view", label: "View Notifications" },
    { key: "notifications.manage", label: "Manage Notification Settings" },
    { key: "telegram.manage", label: "Manage Telegram Bot" },
    { key: "public_booking.manage", label: "Manage Public Booking Page" },
  ],
};

interface Role {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  description?: string;
  isSystem: boolean;
  isDefault: boolean;
  isActive: boolean;
  permissionCount: number;
  userCount: number;
  permissions?: string[];
}

interface PermissionSelectorProps {
  selectedPerms: Set<string>;
  onToggle: (key: string) => void;
}

function PermissionSelector({ selectedPerms, onToggle }: PermissionSelectorProps) {
  return (
    <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
      {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
        <div key={group}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{group}</p>
          <div className="space-y-1.5 ml-1">
            {perms.map(p => (
              <div key={p.key} className="flex items-center gap-2">
                <Checkbox
                  id={p.key}
                  checked={selectedPerms.has(p.key)}
                  onCheckedChange={() => onToggle(p.key)}
                />
                <label htmlFor={p.key} className="text-sm cursor-pointer">{p.label}</label>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PortalRoles() {
  const { user, hasPermission } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", description: "" });
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());

  const canManage = hasPermission("roles.manage");
  const orgId = user?.orgId;

  const { data: roles = [], isLoading } = useQuery<Role[]>({
    queryKey: ["roles", orgId],
    queryFn: () => apiFetch<Role[]>(`/api/organizations/${orgId}/roles`),
    enabled: !!orgId,
  });

  const createMutation = useMutation({
    mutationFn: (data: object) => apiFetch(`/api/organizations/${orgId}/roles`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "Role created" });
      qc.invalidateQueries({ queryKey: ["roles", orgId] });
      setShowCreate(false);
      resetForm();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & object) => apiFetch(`/api/organizations/${orgId}/roles/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "Role updated" });
      qc.invalidateQueries({ queryKey: ["roles", orgId] });
      setEditingRole(null);
      resetForm();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/organizations/${orgId}/roles/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Role deleted" });
      qc.invalidateQueries({ queryKey: ["roles", orgId] });
      setDeletingRole(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setForm({ name: "", slug: "", description: "" });
    setSelectedPerms(new Set());
  };

  const openEdit = (role: Role) => {
    apiFetch<Role>(`/api/organizations/${orgId}/roles/${role.id}`)
      .then((detailed) => {
        setEditingRole(detailed);
        setForm({ name: detailed.name, slug: detailed.slug, description: detailed.description || "" });
        setSelectedPerms(new Set(detailed.permissions ?? []));
      })
      .catch((e: Error) => {
        toast({ title: "Failed to load role", description: e.message, variant: "destructive" });
      });
  };

  const togglePerm = (key: string) => {
    setSelectedPerms(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleSave = () => {
    if (!form.name) return;
    const payload = { ...form, permissions: Array.from(selectedPerms) };
    if (editingRole) {
      updateMutation.mutate({ id: editingRole.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const closeCreateEdit = () => {
    setShowCreate(false);
    setEditingRole(null);
    resetForm();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Roles & Permissions</h1>
          <p className="text-muted-foreground mt-1">Manage access control for your organization's users</p>
        </div>
        {canManage && (
          <Button onClick={() => { resetForm(); setShowCreate(true); }} className="gap-2">
            <Plus className="w-4 h-4" />
            New Role
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <Card key={role.id} className="hover-elevate transition-all">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
                    <CardTitle className="text-base">{role.name}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    {role.isDefault && <Badge variant="secondary" className="text-xs">Default</Badge>}
                    {role.isSystem && <Badge className="text-xs">System</Badge>}
                  </div>
                </div>
                <CardDescription className="text-xs font-mono text-muted-foreground">{role.slug}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {role.permissionCount} permissions
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    {role.userCount} users
                  </span>
                </div>
                {canManage && !role.isSystem && (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => openEdit(role)}>
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </Button>
                    {!role.isDefault && (
                      <Button size="sm" variant="outline" className="text-destructive hover:text-destructive gap-1.5" onClick={() => setDeletingRole(role)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate || !!editingRole} onOpenChange={(open) => { if (!open) closeCreateEdit(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit Role" : "Create New Role"}</DialogTitle>
            <DialogDescription>
              {editingRole ? "Update this role's name and permissions." : "Define a new access role with specific permissions."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="role-name">Name</Label>
                <Input id="role-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Security Staff" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role-slug">Slug</Label>
                <Input
                  id="role-slug"
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "_") }))}
                  placeholder="security_staff"
                  disabled={!!editingRole}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-desc">Description (optional)</Label>
              <Input id="role-desc" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description of this role" />
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <PermissionSelector selectedPerms={selectedPerms} onToggle={togglePerm} />
              <p className="text-xs text-muted-foreground">{selectedPerms.size} permission{selectedPerms.size !== 1 ? "s" : ""} selected</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeCreateEdit}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name || createMutation.isPending || updateMutation.isPending}>
              {editingRole ? "Save Changes" : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingRole} onOpenChange={(open) => { if (!open) setDeletingRole(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the <strong>{deletingRole?.name}</strong> role?
              {(deletingRole?.userCount ?? 0) > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  This role has {deletingRole?.userCount} assigned user(s) and cannot be deleted.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingRole(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={(deletingRole?.userCount ?? 0) > 0 || deleteMutation.isPending}
              onClick={() => deletingRole && deleteMutation.mutate(deletingRole.id)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
