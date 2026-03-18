import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, ArrowRight, Loader2 } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

function getRoleHome(role: string) {
  if (role === 'super_admin') return '/super-admin/dashboard';
  if (role === 'receptionist') return '/receptionist';
  if (role === 'host_employee') return '/host';
  return '/portal/dashboard';
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const loginMutation = useLogin();

  const onSubmit = async (data: z.infer<typeof loginSchema>) => {
    try {
      const res = await loginMutation.mutateAsync({ data });
      toast({ title: "Welcome back", description: "Successfully signed in." });
      
      // Refetch the current user so AuthProvider has fresh data before we navigate
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      await queryClient.refetchQueries({ queryKey: ["/api/auth/me"] });
      
      setLocation(getRoleHome(res.user.role));
    } catch (error) {
      toast({
        title: "Login failed",
        description: "Invalid credentials. Please try again.",
        variant: "destructive",
      });
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
                        <a href="#" className="text-sm font-medium text-primary hover:underline">Forgot password?</a>
                      </div>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="••••••••" 
                          className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:bg-white transition-colors" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full h-12 rounded-xl text-base font-semibold group bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
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
          <p className="text-center text-sm text-muted-foreground">
            Protected by Replit Platform. <a href="#" className="underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
