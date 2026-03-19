import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getRoleHome(role: string, permissions: string[] = []) {
  if (role === "super_admin") return "/super-admin/dashboard";
  if (role === "org_admin") return "/portal/dashboard";
  if (permissions.includes("visit_requests.check_in") || permissions.includes("visit_requests.check_out")) return "/receptionist";
  if (permissions.includes("dashboard.view")) return "/portal/dashboard";
  if (permissions.includes("visit_requests.view") || permissions.includes("visit_requests.create")) return "/portal/visit-requests";
  return "/portal/dashboard";
}

export default function AcceptInvitation() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState<{ email: string; name: string; role: string; orgName: string } | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const token = new URLSearchParams(window.location.search).get("token");

  useEffect(() => {
    if (!token) {
      setError("No invitation token provided.");
      setLoading(false);
      return;
    }
    fetch(`${BASE}/api/auth/verify-invitation-token?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setInfo({ email: data.email, name: data.name, role: data.role, orgName: data.orgName });
        }
      })
      .catch(() => setError("Failed to verify invitation token."))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: "Password too short", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure both passwords match.", variant: "destructive" });
      return;
    }
    if (!acceptedTerms) {
      toast({ title: "Terms required", description: "Please accept the terms and conditions.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/auth/accept-invitation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password, acceptedTerms: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error || "Could not accept invitation.", variant: "destructive" });
        return;
      }
      toast({ title: "Account activated", description: "Welcome to Availo Ventry!" });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setLocation(getRoleHome(data.user.role, data.user.permissions ?? []));
    } catch {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="w-full max-w-md space-y-6 animate-in-fade">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground">Accept Invitation</h2>
          <p className="text-muted-foreground mt-1">Set up your account to get started</p>
        </div>

        <Card className="p-8 border-border/50 shadow-xl shadow-black/5 rounded-2xl">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center space-y-4 py-4">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
              <p className="text-red-600 font-medium">{error}</p>
              <Link href="/login">
                <Button variant="outline" className="rounded-xl">Back to Login</Button>
              </Link>
            </div>
          ) : info ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="bg-primary/5 rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-foreground">{info.orgName}</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Invited as:</span>
                  <Badge variant="secondary" className="capitalize">{info.role.replace(/_/g, " ")}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{info.email}</p>
              </div>

              <div className="space-y-1.5">
                <Label>Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Minimum 8 characters"
                    className="h-11 rounded-xl pr-12"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Confirm Password</Label>
                <div className="relative">
                  <Input
                    type={showConfirm ? "text" : "password"}
                    placeholder="Re-enter password"
                    className="h-11 rounded-xl pr-12"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowConfirm(!showConfirm)} tabIndex={-1}>
                    {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox id="terms" checked={acceptedTerms} onCheckedChange={v => setAcceptedTerms(v === true)} />
                <label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer">I accept the terms and conditions</label>
              </div>

              <Button type="submit" className="w-full h-11 rounded-xl font-semibold" disabled={submitting}>
                {submitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Activate My Account"}
              </Button>
            </form>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
