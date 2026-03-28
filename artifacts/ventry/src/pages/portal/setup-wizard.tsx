import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Building2, MapPin, Users, ShieldCheck, Check, ArrowRight, Plus, Trash2, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const STEPS = [
  { title: "Organization Info", subtitle: "Review your organization details", icon: Building2 },
  { title: "Add Branches", subtitle: "Set up your physical locations", icon: MapPin },
  { title: "Invite Team", subtitle: "Add team members to get started", icon: Users },
  { title: "All Set!", subtitle: "Your organization is ready", icon: ShieldCheck },
];

export default function SetupWizard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [branches, setBranches] = useState([{ name: "", nameAr: "", branchCode: "", address: "" }]);

  const [invitations, setInvitations] = useState([{ name: "", email: "", role: "visitor_manager" }]);

  const addBranch = () => setBranches([...branches, { name: "", nameAr: "", branchCode: "", address: "" }]);
  const removeBranch = (i: number) => setBranches(branches.filter((_, idx) => idx !== i));
  const updateBranch = (i: number, field: string, value: string) => {
    const updated = [...branches];
    (updated[i] as any)[field] = value;
    setBranches(updated);
  };

  const addInvitation = () => setInvitations([...invitations, { name: "", email: "", role: "visitor_manager" }]);
  const removeInvitation = (i: number) => setInvitations(invitations.filter((_, idx) => idx !== i));
  const updateInvitation = (i: number, field: string, value: string) => {
    const updated = [...invitations];
    (updated[i] as any)[field] = value;
    setInvitations(updated);
  };

  const handleSaveBranches = async () => {
    setLoading(true);
    try {
      const validBranches = branches.filter(b => b.name.trim());
      let created = 0;
      for (const branch of validBranches) {
        const res = await fetch(`${BASE}/api/organizations/${user?.orgId}/branches`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(branch),
        });
        if (!res.ok) throw new Error("Failed to create branch");
        created++;
      }
      toast({ title: `${created} branch(es) created` });
      setStep(2);
    } catch {
      toast({ title: "Failed to create branches", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvitations = async () => {
    setLoading(true);
    try {
      const valid = invitations.filter(inv => inv.name.trim() && inv.email.trim());
      let sent = 0;
      for (const inv of valid) {
        const res = await fetch(`${BASE}/api/organizations/${user?.orgId}/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name: inv.name, email: inv.email, role: inv.role, method: "invitation" }),
        });
        if (!res.ok) throw new Error("Failed to send invitation");
        sent++;
      }
      toast({ title: `${sent} invitation(s) sent` });
      setStep(3);
    } catch {
      toast({ title: "Failed to send invitations", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/organizations/${user?.orgId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ setupWizardCompleted: true }),
      });
      if (!res.ok) throw new Error("Failed to complete setup");
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Setup complete! Welcome to Availo Ventry." });
      setLocation("/portal/dashboard");
    } catch {
      toast({ title: "Failed to complete setup", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-center gap-2 mb-10">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                i < step ? "bg-emerald-500 text-white" :
                i === step ? "bg-primary text-white shadow-lg shadow-primary/30" :
                "bg-slate-200 text-slate-500"
              }`}>
                {i < step ? <Check className="w-5 h-5" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`w-12 h-1 rounded-full ${i < step ? "bg-emerald-500" : "bg-slate-200"}`} />}
            </div>
          ))}
        </div>

        <Card className="p-8 rounded-3xl shadow-xl border-border/50">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
              {(() => { const Icon = STEPS[step].icon; return <Icon className="w-8 h-8" />; })()}
            </div>
            <h2 className="text-2xl font-display font-bold">{STEPS[step].title}</h2>
            <p className="text-muted-foreground mt-1">{STEPS[step].subtitle}</p>
          </div>

          {step === 0 && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-sm text-muted-foreground">Organization Name</p>
                <p className="font-semibold text-lg">{user?.organizationName || "Your Organization"}</p>
              </div>
              <p className="text-sm text-muted-foreground">You can update your organization details later in Settings. Let's set up the basics first.</p>
              <Button className="w-full h-12 rounded-xl gap-2" onClick={() => setStep(1)}>
                Continue <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              {branches.map((b, i) => (
                <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-slate-700">Branch {i + 1}</span>
                    {branches.length > 1 && (
                      <Button variant="ghost" size="sm" className="text-red-500 h-7" onClick={() => removeBranch(i)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <Input placeholder="Branch name (e.g. Riyadh HQ)" className="rounded-xl" value={b.name} onChange={e => updateBranch(i, "name", e.target.value)} />
                  <Input placeholder="Branch name (Arabic)" className="rounded-xl" dir="rtl" value={b.nameAr} onChange={e => updateBranch(i, "nameAr", e.target.value)} />
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder="Branch code" className="rounded-xl" value={b.branchCode} onChange={e => updateBranch(i, "branchCode", e.target.value)} />
                    <Input placeholder="Address" className="rounded-xl" value={b.address} onChange={e => updateBranch(i, "address", e.target.value)} />
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full rounded-xl gap-2" onClick={addBranch}>
                <Plus className="w-4 h-4" /> Add Another Branch
              </Button>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setStep(0)}>Back</Button>
                <Button className="flex-1 rounded-xl gap-2" onClick={handleSaveBranches} disabled={loading || !branches.some(b => b.name.trim())}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Save & Continue <ArrowRight className="w-4 h-4" /></>}
                </Button>
              </div>
              <button className="text-sm text-muted-foreground hover:text-foreground w-full text-center" onClick={() => setStep(2)}>
                Skip for now →
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {invitations.map((inv, i) => (
                <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-slate-700">Member {i + 1}</span>
                    {invitations.length > 1 && (
                      <Button variant="ghost" size="sm" className="text-red-500 h-7" onClick={() => removeInvitation(i)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <Input placeholder="Full name" className="rounded-xl" value={inv.name} onChange={e => updateInvitation(i, "name", e.target.value)} />
                  <Input placeholder="Email address" type="email" className="rounded-xl" value={inv.email} onChange={e => updateInvitation(i, "email", e.target.value)} />
                  <select className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    value={inv.role} onChange={e => updateInvitation(i, "role", e.target.value)}>
                    <option value="visitor_manager">Visitor Manager</option>
                    <option value="receptionist">Receptionist</option>
                    <option value="host_employee">Host Employee</option>
                  </select>
                </div>
              ))}
              <Button variant="outline" className="w-full rounded-xl gap-2" onClick={addInvitation}>
                <Plus className="w-4 h-4" /> Add Another Member
              </Button>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setStep(1)}>Back</Button>
                <Button className="flex-1 rounded-xl gap-2" onClick={handleSendInvitations} disabled={loading || !invitations.some(inv => inv.name.trim() && inv.email.trim())}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send Invitations <ArrowRight className="w-4 h-4" /></>}
                </Button>
              </div>
              <button className="text-sm text-muted-foreground hover:text-foreground w-full text-center" onClick={() => setStep(3)}>
                Skip for now →
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 text-center">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-xl font-display font-bold text-foreground">You're all set!</h3>
                <p className="text-muted-foreground mt-2">Your organization is ready to receive visitors. You can always adjust settings later.</p>
              </div>
              <Button className="w-full h-12 rounded-xl text-base font-semibold" onClick={handleComplete} disabled={loading}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Go to Dashboard →"}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
