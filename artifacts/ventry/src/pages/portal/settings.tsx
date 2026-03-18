import { useState, useEffect } from "react";
import { useGetOrganization, useUpdateOrganization, useListUsers, useListBranches, useCreateInvitation, useDeactivateUser } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Save, Plus, UserPlus, Building2, Settings, Users, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function PortalSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: org } = useGetOrganization(user?.orgId || "", { query: { enabled: !!user?.orgId } });
  const { data: usersData } = useListUsers(user?.orgId || "", {}, { query: { enabled: !!user?.orgId } });
  const { data: branchesData } = useListBranches(user?.orgId || "", {}, { query: { enabled: !!user?.orgId } });

  const updateMutation = useUpdateOrganization();
  const inviteMutation = useCreateInvitation();
  const deactivateMutation = useDeactivateUser();

  const [orgForm, setOrgForm] = useState({ name: "", nameAr: "", address: "", primaryContactName: "", primaryContactEmail: "", primaryContactPhone: "" });
  const [inviteDialog, setInviteDialog] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", role: "visitor_manager", department: "", jobTitle: "" });
  const [activeTab, setActiveTab] = useState<"general" | "users" | "branches">("general");

  useEffect(() => {
    if (org) {
      setOrgForm({
        name: org.name || "",
        nameAr: org.nameAr || "",
        address: org.address || "",
        primaryContactName: org.primaryContactName || "",
        primaryContactEmail: org.primaryContactEmail || "",
        primaryContactPhone: org.primaryContactPhone || "",
      });
    }
  }, [org]);

  const handleSaveOrg = async () => {
    try {
      await updateMutation.mutateAsync({ orgId: user!.orgId!, data: orgForm });
      toast({ title: "Settings Saved", description: "Organization details have been updated." });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.orgId}`] });
    } catch {
      toast({ title: "Save Failed", variant: "destructive" });
    }
  };

  const handleInvite = async () => {
    if (!inviteForm.name || !inviteForm.email || !inviteForm.role) {
      toast({ title: "Missing fields", variant: "destructive" });
      return;
    }
    try {
      await inviteMutation.mutateAsync({ orgId: user!.orgId!, data: inviteForm });
      toast({ title: "Invitation Sent", description: `${inviteForm.name} has been invited as ${inviteForm.role.replace("_", " ")}.` });
      setInviteDialog(false);
      setInviteForm({ name: "", email: "", role: "visitor_manager", department: "", jobTitle: "" });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.orgId}/users`] });
    } catch {
      toast({ title: "Invite Failed", variant: "destructive" });
    }
  };

  const handleDeactivate = async (userId: string, userName: string) => {
    try {
      await deactivateMutation.mutateAsync({ orgId: user!.orgId!, userId });
      toast({ title: "User Deactivated", description: `${userName} has been deactivated.` });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.orgId}/users`] });
    } catch {
      toast({ title: "Action Failed", variant: "destructive" });
    }
  };

  const tabs = [
    { id: "general", label: "General", icon: Settings },
    { id: "users", label: "Users", icon: Users },
    { id: "branches", label: "Branches", icon: Building2 },
  ] as const;

  const users = usersData?.data ?? [];
  const branches = branchesData?.data ?? [];

  const roleColor: Record<string, string> = {
    org_admin: "bg-violet-100 text-violet-700",
    visitor_manager: "bg-blue-100 text-blue-700",
    receptionist: "bg-emerald-100 text-emerald-700",
    host_employee: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your organization, users, and branches.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? "bg-white text-foreground shadow-sm" : "text-slate-600 hover:text-foreground"}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* General Tab */}
      {activeTab === "general" && (
        <Card className="border-border/50 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="font-display">Organization Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <Label>Organization Name</Label>
                <Input className="rounded-xl" value={orgForm.name} onChange={e => setOrgForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Arabic Name</Label>
                <Input className="rounded-xl" dir="rtl" value={orgForm.nameAr} onChange={e => setOrgForm(f => ({ ...f, nameAr: e.target.value }))} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Address</Label>
                <Input className="rounded-xl" value={orgForm.address} onChange={e => setOrgForm(f => ({ ...f, address: e.target.value }))} />
              </div>
            </div>
            <div className="border-t pt-5">
              <p className="text-sm font-semibold mb-4 text-slate-700">Primary Contact</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input className="rounded-xl" value={orgForm.primaryContactName} onChange={e => setOrgForm(f => ({ ...f, primaryContactName: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" className="rounded-xl" value={orgForm.primaryContactEmail} onChange={e => setOrgForm(f => ({ ...f, primaryContactEmail: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input className="rounded-xl" value={orgForm.primaryContactPhone} onChange={e => setOrgForm(f => ({ ...f, primaryContactPhone: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button className="gap-2 rounded-xl" onClick={handleSaveOrg} disabled={updateMutation.isPending}>
                <Save className="w-4 h-4" />
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users Tab */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-2 rounded-xl" onClick={() => setInviteDialog(true)}>
              <UserPlus className="w-4 h-4" />
              Invite User
            </Button>
          </div>
          <Card className="border-border/50 shadow-sm rounded-2xl overflow-hidden">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-border/50">
                  <tr>
                    <th className="text-left p-4 font-semibold text-slate-600">Name</th>
                    <th className="text-left p-4 font-semibold text-slate-600">Email</th>
                    <th className="text-left p-4 font-semibold text-slate-600">Role</th>
                    <th className="text-left p-4 font-semibold text-slate-600">Status</th>
                    <th className="p-4 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs shrink-0">
                            {u.name.charAt(0)}
                          </div>
                          <span className="font-medium">{u.name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-slate-600">{u.email}</td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-1 rounded-lg font-medium capitalize ${roleColor[u.role] || "bg-slate-100 text-slate-600"}`}>
                          {u.role.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`text-xs font-medium ${u.isActive ? "text-emerald-600" : "text-slate-400"}`}>
                          {u.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-4">
                        {u.id !== user?.id && u.isActive && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg"><MoreHorizontal className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl">
                              <DropdownMenuItem className="text-red-600 cursor-pointer" onClick={() => handleDeactivate(u.id, u.name)}>
                                Deactivate
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Branches Tab */}
      {activeTab === "branches" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map(b => (
            <Card key={b.id} className="border-border/50 shadow-sm rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <Badge className={`text-xs shadow-none border ${b.isActive ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600"}`}>
                    {b.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <h3 className="font-semibold text-foreground">{b.name}</h3>
                {b.nameAr && <p className="text-xs text-muted-foreground">{b.nameAr}</p>}
                <div className="mt-3 space-y-1 text-xs text-slate-500">
                  <p>Code: <span className="font-mono font-medium text-foreground">{b.branchCode}</span></p>
                  {b.city && <p>City: {b.city}</p>}
                  <p className="capitalize">Mode: {b.entryMode}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          {branches.length === 0 && (
            <div className="col-span-3 p-12 text-center text-muted-foreground">No branches configured.</div>
          )}
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteDialog} onOpenChange={setInviteDialog}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Invite Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input placeholder="Name" className="rounded-xl" value={inviteForm.name} onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" placeholder="email@org.sa" className="rounded-xl" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Role *</Label>
              <Select value={inviteForm.role} onValueChange={v => setInviteForm(f => ({ ...f, role: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="org_admin">Org Admin</SelectItem>
                  <SelectItem value="visitor_manager">Visitor Manager</SelectItem>
                  <SelectItem value="receptionist">Receptionist</SelectItem>
                  <SelectItem value="host_employee">Host Employee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Input placeholder="IT, HR..." className="rounded-xl" value={inviteForm.department} onChange={e => setInviteForm(f => ({ ...f, department: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Job Title</Label>
                <Input placeholder="Manager..." className="rounded-xl" value={inviteForm.jobTitle} onChange={e => setInviteForm(f => ({ ...f, jobTitle: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setInviteDialog(false)}>Cancel</Button>
            <Button className="rounded-xl" onClick={handleInvite} disabled={inviteMutation.isPending}>
              {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
