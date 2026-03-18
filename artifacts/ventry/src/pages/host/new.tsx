import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateVisitRequest, useListBranches } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useState } from "react";

const schema = z.object({
  visitorName: z.string().min(2, "Full name is required"),
  visitorPhone: z.string().min(9, "Valid phone number required"),
  visitorEmail: z.string().email("Valid email required").optional().or(z.literal("")),
  visitorNationalId: z.string().optional(),
  visitorCompany: z.string().optional(),
  branchId: z.string().min(1, "Please select a branch"),
  purpose: z.string().min(5, "Please describe the purpose"),
  scheduledDate: z.string().min(1, "Date is required"),
  scheduledTimeFrom: z.string().optional(),
  scheduledTimeTo: z.string().optional(),
  notes: z.string().optional(),
});

export default function HostNewRequest() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isSuccess, setIsSuccess] = useState(false);

  const { data: branchesData } = useListBranches(user?.orgId || "", {}, { query: { enabled: !!user?.orgId } });
  const createMutation = useCreateVisitRequest();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      visitorName: "", visitorPhone: "", visitorEmail: "", visitorNationalId: "",
      visitorCompany: "", branchId: "", purpose: "",
      scheduledDate: new Date().toISOString().split("T")[0],
      scheduledTimeFrom: "10:00", scheduledTimeTo: "", notes: "",
    },
  });

  const branches = (branchesData?.data ?? []).filter((b: any) => b.isActive);

  const onSubmit = async (data: z.infer<typeof schema>) => {
    try {
      await createMutation.mutateAsync({
        orgId: user!.orgId!,
        data: {
          ...data,
          type: "pre_registered",
        },
      });
      setIsSuccess(true);
    } catch {
      toast({ title: "Submission Failed", description: "Please try again.", variant: "destructive" });
    }
  };

  if (isSuccess) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <Card className="border-border/50 shadow-xl rounded-3xl p-8">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-display font-bold mb-3">Visitor Invited!</h2>
          <p className="text-muted-foreground mb-8">Your visit request has been submitted. The visitor will be notified once approved.</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" className="rounded-xl" onClick={() => setLocation("/host")}>Back to My Visitors</Button>
            <Button className="rounded-xl" onClick={() => { setIsSuccess(false); form.reset(); }}>Add Another</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setLocation("/host")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Invite a Visitor</h1>
          <p className="text-muted-foreground mt-0.5">Pre-register a guest for your organization.</p>
        </div>
      </div>

      <Card className="border-border/50 shadow-sm rounded-2xl overflow-hidden">
        <div className="h-1.5 bg-primary w-full" />
        <CardContent className="p-6 sm:p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-4">Visitor Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <FormField control={form.control} name="visitorName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl><Input className="h-11 rounded-xl" placeholder="John Doe" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="visitorPhone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone *</FormLabel>
                      <FormControl><Input className="h-11 rounded-xl" placeholder="+966 5X XXX XXXX" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="visitorEmail" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input type="email" className="h-11 rounded-xl" placeholder="visitor@email.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="visitorNationalId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>National ID / Iqama</FormLabel>
                      <FormControl><Input className="h-11 rounded-xl" placeholder="10XXXXXXXX" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="visitorCompany" render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Company / Organization</FormLabel>
                      <FormControl><Input className="h-11 rounded-xl" placeholder="Company name" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <div className="border-t pt-6">
                <p className="text-sm font-semibold text-slate-700 mb-4">Visit Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <FormField control={form.control} name="branchId" render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Branch *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select branch" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {branches.map((b: any) => (
                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="purpose" render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Purpose of Visit *</FormLabel>
                      <FormControl>
                        <Textarea className="rounded-xl resize-none" rows={3} placeholder="Meeting regarding..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="scheduledDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date *</FormLabel>
                      <FormControl><Input type="date" className="h-11 rounded-xl" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="scheduledTimeFrom" render={({ field }) => (
                      <FormItem>
                        <FormLabel>From</FormLabel>
                        <FormControl><Input type="time" className="h-11 rounded-xl" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="scheduledTimeTo" render={({ field }) => (
                      <FormItem>
                        <FormLabel>To</FormLabel>
                        <FormControl><Input type="time" className="h-11 rounded-xl" {...field} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Additional Notes</FormLabel>
                      <FormControl>
                        <Textarea className="rounded-xl resize-none" rows={2} placeholder="Any special requirements..." {...field} />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" className="w-full h-12 rounded-xl font-semibold text-base" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Submitting..." : "Send Visit Invitation"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
