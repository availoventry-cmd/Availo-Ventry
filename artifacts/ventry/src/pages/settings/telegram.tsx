import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Send, Link2, Link2Off, RefreshCw, CheckCircle2, XCircle, Bell, BellOff } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface TelegramStatus {
  botConfigured: boolean;
  linked: boolean;
  subscription: {
    chatId: string;
    username?: string;
    firstName?: string;
    notifyApprovals: boolean;
    notifyCheckIns: boolean;
    notifyWalkIns: boolean;
    notifyRejections: boolean;
  } | null;
}

interface LinkCodeResponse {
  code: string;
  expiresAt: string;
  botUsername: string | null;
  instructions: string;
}

export default function TelegramSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [linkData, setLinkData] = useState<LinkCodeResponse | null>(null);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});

  const { data: status, isLoading } = useQuery<TelegramStatus>({
    queryKey: ["/api/telegram/status"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/telegram/status`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch Telegram status");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.subscription) {
        setPrefs({
          notifyApprovals: data.subscription.notifyApprovals,
          notifyCheckIns: data.subscription.notifyCheckIns,
          notifyWalkIns: data.subscription.notifyWalkIns,
          notifyRejections: data.subscription.notifyRejections,
        });
      }
    }
  } as any);

  const generateCodeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/telegram/generate-link-code`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to generate code");
      return res.json() as Promise<LinkCodeResponse>;
    },
    onSuccess: (data) => setLinkData(data),
    onError: () => toast({ title: "Error generating link code", variant: "destructive" }),
  });

  const unlinkMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/telegram/unlink`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Unlink failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Telegram account unlinked" });
      setLinkData(null);
      queryClient.invalidateQueries({ queryKey: ["/api/telegram/status"] });
    },
    onError: () => toast({ title: "Unlink failed", variant: "destructive" }),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/telegram/test`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Test failed");
      return res.json();
    },
    onSuccess: () => toast({ title: "Test message sent!", description: "Check your Telegram." }),
    onError: () => toast({ title: "Test failed", variant: "destructive" }),
  });

  const prefsMutation = useMutation({
    mutationFn: async (updates: Record<string, boolean>) => {
      const res = await fetch(`${BASE}/api/telegram/preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to save preferences");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Preferences saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/telegram/status"] });
    },
    onError: () => toast({ title: "Failed to save preferences", variant: "destructive" }),
  });

  const handlePrefChange = (key: string, value: boolean) => {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    prefsMutation.mutate(updated);
  };

  if (isLoading) {
    return <div className="p-8 animate-pulse space-y-4">
      <div className="h-32 bg-slate-100 rounded-2xl" />
      <div className="h-48 bg-slate-100 rounded-2xl" />
    </div>;
  }

  const notConfigured = !status?.botConfigured;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Telegram Notifications</h1>
        <p className="text-muted-foreground mt-1">
          Get real-time visitor alerts directly in Telegram.
        </p>
      </div>

      {notConfigured && (
        <Card className="border-amber-200 bg-amber-50 rounded-2xl">
          <CardContent className="p-6 flex gap-4 items-start">
            <XCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-900">Bot not configured</p>
              <p className="text-sm text-amber-700 mt-1">
                Ask your platform administrator to set the <code className="bg-amber-100 px-1 rounded">TELEGRAM_BOT_TOKEN</code> secret to enable this feature.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connection status card */}
      <Card className="border-border/50 shadow-sm rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-display flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Connection Status
            </CardTitle>
            {status?.linked
              ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 shadow-none">Connected</Badge>
              : <Badge className="bg-slate-100 text-slate-600 shadow-none">Not connected</Badge>
            }
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status?.linked && status.subscription ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-900">
                    {status.subscription.firstName || "Telegram User"}
                    {status.subscription.username && ` (@${status.subscription.username})`}
                  </p>
                  <p className="text-xs text-emerald-700">Chat ID: {status.subscription.chatId}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => testMutation.mutate()}
                  disabled={testMutation.isPending}
                >
                  <Send className="w-4 h-4" />
                  {testMutation.isPending ? "Sending..." : "Send Test Message"}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 gap-2 text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => unlinkMutation.mutate()}
                  disabled={unlinkMutation.isPending}
                >
                  <Link2Off className="w-4 h-4" />
                  Unlink Account
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <p className="font-semibold text-slate-800">How to connect:</p>
                <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600">
                  <li>Open Telegram and search for <strong>@BotFather</strong></li>
                  <li>Send <code className="bg-slate-200 px-1 rounded">/newbot</code> and follow the setup steps</li>
                  <li>Copy the bot token and ask your admin to add it as <code className="bg-slate-200 px-1 rounded">TELEGRAM_BOT_TOKEN</code></li>
                  <li>Come back here, click <strong>Generate Link Code</strong> below</li>
                  <li>Open your bot in Telegram and send <code className="bg-slate-200 px-1 rounded">/link YOUR_CODE</code></li>
                </ol>
              </div>

              {linkData ? (
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 space-y-3">
                  <p className="font-semibold text-blue-900">Your link code:</p>
                  <div className="flex items-center gap-3">
                    <code className="text-3xl font-mono font-bold tracking-widest text-blue-700 bg-white px-4 py-2 rounded-lg border border-blue-200">
                      {linkData.code}
                    </code>
                  </div>
                  <p className="text-sm text-blue-700">{linkData.instructions}</p>
                  <p className="text-xs text-blue-600">
                    Expires: {new Date(linkData.expiresAt).toLocaleTimeString()}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => generateCodeMutation.mutate()}
                    disabled={generateCodeMutation.isPending}
                  >
                    <RefreshCw className="w-3 h-3" /> Generate new code
                  </Button>
                </div>
              ) : (
                <Button
                  className="w-full gap-2"
                  onClick={() => generateCodeMutation.mutate()}
                  disabled={generateCodeMutation.isPending || notConfigured}
                >
                  <Link2 className="w-4 h-4" />
                  {generateCodeMutation.isPending ? "Generating..." : "Generate Link Code"}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification preferences */}
      {status?.linked && (
        <Card className="border-border/50 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Notification Preferences
            </CardTitle>
            <CardDescription>Choose which events trigger a Telegram message.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: "notifyApprovals", label: "Visit Approved", description: "When a visit request you submitted or host gets approved" },
              { key: "notifyCheckIns", label: "Visitor Check-in", description: "When a visitor arrives and checks in at reception" },
              { key: "notifyWalkIns", label: "Walk-in Requests", description: "When a new walk-in request arrives in your queue" },
              { key: "notifyRejections", label: "Visit Rejected", description: "When a request is rejected" },
            ].map(({ key, label, description }) => (
              <div key={key} className="flex items-center justify-between py-3 border-b border-border/40 last:border-0">
                <div>
                  <p className="font-medium text-foreground">{label}</p>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                <Switch
                  checked={prefs[key] ?? false}
                  onCheckedChange={(v) => handlePrefChange(key, v)}
                  disabled={prefsMutation.isPending}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
