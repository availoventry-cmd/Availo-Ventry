import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSubmitPublicVisitRequest, useGetPublicOrgInfo } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Building2 } from "lucide-react";
import { useState } from "react";

const bookingSchema = z.object({
  visitorName: z.string().min(2, "Full name is required"),
  nationalId: z.string().optional(),
  phone: z.string().min(9, "Valid phone number required"),
  companyName: z.string().optional(),
  branchId: z.string().min(1, "Please select a branch"),
  purpose: z.string().min(5, "Please state your purpose"),
  scheduledDate: z.string().min(1, "Date is required"),
  scheduledTimeFrom: z.string().optional(),
});

export default function PublicBooking() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const [isSuccess, setIsSuccess] = useState(false);

  const { data: org, isLoading: orgLoading } = useGetPublicOrgInfo(slug);
  const submitMutation = useSubmitPublicVisitRequest();

  const form = useForm<z.infer<typeof bookingSchema>>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      visitorName: "",
      nationalId: "",
      phone: "",
      companyName: "",
      branchId: "",
      purpose: "",
      scheduledDate: new Date().toISOString().split("T")[0],
      scheduledTimeFrom: "10:00",
    },
  });

  const onSubmit = async (data: z.infer<typeof bookingSchema>) => {
    try {
      await submitMutation.mutateAsync({ slug, data });
      setIsSuccess(true);
    } catch (e) {
      toast({ title: "Submission Failed", description: "Please try again later.", variant: "destructive" });
    }
  };

  if (orgLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50">Loading...</div>;
  if (!org) return <div className="min-h-screen flex items-center justify-center bg-slate-50">Organization not found</div>;

  if (isSuccess) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md p-8 text-center border-border/50 shadow-xl rounded-3xl animate-in-slide">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-display font-bold text-foreground mb-3">Request Submitted</h2>
          <p className="text-muted-foreground text-lg mb-8">
            Your visit request for <strong>{org.name}</strong> has been sent for approval. You will receive an SMS with your entry pass once approved.
          </p>
          <Button onClick={() => window.location.reload()} variant="outline" className="h-12 px-8 rounded-xl font-semibold hover-elevate">
            Submit Another Request
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 py-12 px-4 flex flex-col items-center">
      <div className="w-full max-w-2xl mb-8 text-center animate-in-fade">
        <div className="w-16 h-16 bg-white border border-slate-200 shadow-sm rounded-2xl flex items-center justify-center mx-auto mb-4 overflow-hidden">
          {org.logo ? <img src={org.logo} alt="Logo" className="w-full h-full object-cover" /> : <Building2 className="w-8 h-8 text-primary" />}
        </div>
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground tracking-tight">{org.name}</h1>
        <p className="text-muted-foreground mt-2 text-lg">Visitor Registration Form</p>
      </div>

      <Card className="w-full max-w-2xl border-border/50 shadow-xl rounded-3xl overflow-hidden animate-in-slide bg-white">
        <div className="h-2 bg-primary w-full" />
        <div className="p-6 sm:p-10">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <FormField control={form.control} name="visitorName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-slate-700">Full Name</FormLabel>
                    <FormControl><Input className="h-12 rounded-xl bg-slate-50 border-slate-200" placeholder="John Doe" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-slate-700">Phone Number</FormLabel>
                    <FormControl>
                      <Input className="h-12 rounded-xl bg-slate-50 border-slate-200" placeholder="+966 5X XXX XXXX" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="nationalId" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-slate-700">National ID / Iqama (Optional)</FormLabel>
                    <FormControl><Input className="h-12 rounded-xl bg-slate-50 border-slate-200" placeholder="10XXXXXXXX" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="companyName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-slate-700">Representing Company</FormLabel>
                    <FormControl><Input className="h-12 rounded-xl bg-slate-50 border-slate-200" placeholder="Company Name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="col-span-1 sm:col-span-2">
                  <FormField control={form.control} name="branchId" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-slate-700">Destination Branch</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200">
                            <SelectValue placeholder="Select a branch" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {org.branches.map(b => (
                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <FormField control={form.control} name="purpose" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-slate-700">Purpose of Visit</FormLabel>
                      <FormControl><Textarea className="min-h-[100px] rounded-xl bg-slate-50 border-slate-200 resize-none p-4" placeholder="Meeting with IT department regarding..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="scheduledDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-slate-700">Date</FormLabel>
                    <FormControl><Input type="date" className="h-12 rounded-xl bg-slate-50 border-slate-200" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="scheduledTimeFrom" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-slate-700">Expected Time</FormLabel>
                    <FormControl><Input type="time" className="h-12 rounded-xl bg-slate-50 border-slate-200" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full h-14 rounded-xl text-lg font-bold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all hover-elevate"
                  disabled={submitMutation.isPending}
                >
                  {submitMutation.isPending ? "Submitting..." : "Request Entry Pass"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </Card>
    </div>
  );
}
