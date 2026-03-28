import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

function getRoleHome(role: string, permissions: string[] = [], user?: any) {
  if (role === 'org_admin' && user?.organizationStatus === 'pending_setup' && !user?.setupWizardCompleted) {
    return '/portal/setup';
  }
  if (role === 'super_admin') return '/super-admin/dashboard';
  if (role === 'org_admin') return '/portal/dashboard';
  if (permissions.includes('visit_requests.check_in') || permissions.includes('visit_requests.check_out')) return '/receptionist';
  if (permissions.includes('dashboard.view')) return '/portal/dashboard';
  if (permissions.includes('visit_requests.view') || permissions.includes('visit_requests.create')) return '/portal/visit-requests';
  return '/portal/dashboard';
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);

  const [otpStep, setOtpStep] = useState(false);
  const [loginToken, setLoginToken] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [availableChannels, setAvailableChannels] = useState<string[]>([]);
  const [otpChannel, setOtpChannel] = useState<"sms" | "whatsapp" | "email">("sms");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resolvedPhone, setResolvedPhone] = useState("");
  const [resolvedEmail, setResolvedEmail] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: z.infer<typeof loginSchema>) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      const result = await res.json();

      if (result.requires2FA) {
        setLoginToken(result.loginToken);
        setMaskedPhone(result.phone || "");
        setMaskedEmail(result.email || "");
        setAvailableChannels(result.channels || ["sms"]);
        setOtpChannel(result.channels?.[0] || "sms");
        setOtpStep(true);
        return;
      }

      if (!res.ok) {
        toast({ title: "Login failed", description: result.message || "Invalid credentials.", variant: "destructive" });
        return;
      }

      toast({ title: "Welcome back" });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      await queryClient.refetchQueries({ queryKey: ["/api/auth/me"] });
      setLocation(getRoleHome(result.user.role, result.user.permissions ?? [], result.user));
    } catch (error) {
      toast({ title: "Login failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendOtp = async () => {
    setSendingOtp(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/verification/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: otpChannel, loginToken }),
      });
      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
        setChallengeId(data.challengeId || "");
        setResolvedPhone(data.phone || "");
        setResolvedEmail(data.email || "");
        toast({ title: "Code Sent", description: `Verification code sent via ${otpChannel.toUpperCase()}.` });
      } else {
        toast({ title: "Failed", description: data.error || "Try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to send code", variant: "destructive" });
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    setVerifyingOtp(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/auth/verify-login-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          loginToken,
          phone: resolvedPhone || undefined,
          email: resolvedEmail || undefined,
          otp: otpCode,
        }),
      });
      const data = await res.json();
      if (data.user) {
        toast({ title: "Welcome back" });
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        await queryClient.refetchQueries({ queryKey: ["/api/auth/me"] });
        setLocation(getRoleHome(data.user.role, data.user.permissions ?? [], data.user));
      } else {
        toast({ title: "Verification failed", description: data.error || "Incorrect code.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Verification failed", variant: "destructive" });
    } finally {
      setVerifyingOtp(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-background">
      <div className="hidden lg:flex w-1/2 relative bg-primary/5 items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={`${import.meta.env.BASE_URL}images/auth-bg.png`} 
            alt="Enterprise building" 
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-primary/40 mix-blend-multiply" />
        </div>
        <div className="relative z-10 p-12 text-white max-w-xl animate-in-slide">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-xl">
              <img src={`${import.meta.env.BASE_URL}images/logo-mark.png`} alt="Logo" className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-display font-bold">Ventry</h1>
          </div>
          <h2 className="text-5xl font-display font-bold leading-tight mb-6">
            Smart Visitor <br/>Management.
          </h2>
          <p className="text-lg text-primary-foreground/80 leading-relaxed">
            Secure, seamless, and integrated entry experiences for government entities and modern enterprises.
          </p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-card shadow-[-20px_0_40px_rgba(0,0,0,0.05)] z-10">
        <div className="w-full max-w-md space-y-8 animate-in-fade">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-display font-bold text-foreground tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground mt-2">Sign in to your Ventry portal</p>
          </div>

          {otpStep ? (
            <Card className="p-8 border-border/50 shadow-xl shadow-black/5 rounded-2xl">
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-display font-bold">Two-Factor Verification</h3>
                <p className="text-sm text-muted-foreground mt-2">Choose how to receive your verification code</p>
              </div>

              {!otpSent ? (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    {availableChannels.includes("sms") && (
                      <button type="button" onClick={() => setOtpChannel("sms")}
                        className={`flex-1 p-3 rounded-xl border text-center text-sm font-medium transition-all ${otpChannel === "sms" ? "border-primary bg-primary/5 text-primary" : "border-slate-200"}`}>
                        SMS
                      </button>
                    )}
                    {availableChannels.includes("whatsapp") && (
                      <button type="button" onClick={() => setOtpChannel("whatsapp")}
                        className={`flex-1 p-3 rounded-xl border text-center text-sm font-medium transition-all ${otpChannel === "whatsapp" ? "border-primary bg-primary/5 text-primary" : "border-slate-200"}`}>
                        WhatsApp
                      </button>
                    )}
                    {availableChannels.includes("email") && (
                      <button type="button" onClick={() => setOtpChannel("email")}
                        className={`flex-1 p-3 rounded-xl border text-center text-sm font-medium transition-all ${otpChannel === "email" ? "border-primary bg-primary/5 text-primary" : "border-slate-200"}`}>
                        Email
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Code will be sent to {otpChannel === "email" ? maskedEmail : maskedPhone}
                  </p>
                  <Button className="w-full h-12 rounded-xl" onClick={handleSendOtp} disabled={sendingOtp}>
                    {sendingOtp ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send Verification Code"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Enter the code sent via {otpChannel.toUpperCase()}
                  </p>
                  <Input
                    className="h-14 rounded-xl text-center text-2xl tracking-[0.5em] font-mono bg-slate-50"
                    placeholder="000000"
                    maxLength={6}
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    autoFocus
                  />
                  <Button className="w-full h-12 rounded-xl" onClick={handleVerifyOtp} disabled={verifyingOtp || otpCode.length < 4}>
                    {verifyingOtp ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify & Sign In"}
                  </Button>
                  <div className="flex justify-between text-xs">
                    <button type="button" className="text-primary hover:underline" onClick={() => { setOtpSent(false); setOtpCode(""); }}>
                      Change method
                    </button>
                    <button type="button" className="text-primary hover:underline" onClick={handleSendOtp}>
                      Resend code
                    </button>
                  </div>
                </div>
              )}
              <div className="mt-4 text-center">
                <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => { setOtpStep(false); setOtpSent(false); setOtpCode(""); }}>
                  Back to login
                </button>
              </div>
            </Card>
          ) : (
            <Card className="p-8 border-border/50 shadow-xl shadow-black/5 rounded-2xl">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold">Work Email</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="name@organization.gov.sa" 
                            className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:bg-white transition-colors" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel className="font-semibold">Password</FormLabel>
                          <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">Forgot password?</Link>
                        </div>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••" 
                              className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:bg-white transition-colors pr-12" 
                              {...field} 
                            />
                            <button
                              type="button"
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                              onClick={() => setShowPassword(!showPassword)}
                              tabIndex={-1}
                            >
                              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="submit" 
                    className="w-full h-12 rounded-xl text-base font-semibold group bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    ) : (
                      <>
                        Sign In
                        <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </Card>
          )}
          <p className="text-center text-sm text-muted-foreground">
            Protected by Replit Platform. <a href="#" className="underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
