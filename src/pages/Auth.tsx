import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { LucideIcon } from "lucide-react";
import { Activity, ArrowRight, CheckCircle2, LogIn, ShieldCheck, Sparkles } from "lucide-react";
import {
  createTodoistAuthorizationUrl,
  exchangeTodoistAuthCode,
  revokeTodoistToken,
  validateToken,
} from "@/lib/todoist";

const TODOIST_STATE_KEY = "todoist_oauth_state";

type FeatureHighlight = {
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
};

function generateState() {
  if (typeof window === "undefined" || typeof window.crypto === "undefined") {
    return Math.random().toString(36).slice(2);
  }

  const bytes = new Uint32Array(8);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16)).join("");
}

function clearOAuthParams() {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  url.searchParams.delete("error");
  window.history.replaceState({}, "", url.toString());
}

export default function Auth() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [token, setToken] = useState(() => localStorage.getItem("todoist_token") ?? "");
  const [tokenLoading, setTokenLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const clientId = import.meta.env.VITE_TODOIST_CLIENT_ID as string | undefined;
  const clientSecret = import.meta.env.VITE_TODOIST_CLIENT_SECRET as string | undefined;
  const configuredRedirect = import.meta.env.VITE_TODOIST_REDIRECT_URI as string | undefined;
  const requestedScope =
    (import.meta.env.VITE_TODOIST_OAUTH_SCOPE as string | undefined) ||
    "data:read,profile:read";

  const redirectUri = useMemo(() => {
    if (configuredRedirect) return configuredRedirect;
    if (typeof window !== "undefined") {
      return `${window.location.origin}/auth`;
    }
    return "";
  }, [configuredRedirect]);

  const hasStoredToken = Boolean(token);
  const canStartOAuth = Boolean(clientId && clientSecret && redirectUri);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const code = params.get("code");
    const error = params.get("error");
    const state = params.get("state");

    if (error) {
      toast({
        title: "Todoist sign-in failed",
        description: decodeURIComponent(error),
        variant: "destructive",
      });
      clearOAuthParams();
      return;
    }

    if (!code) {
      return;
    }

    if (!clientId || !clientSecret) {
      toast({
        title: "OAuth not configured",
        description:
          "Set VITE_TODOIST_CLIENT_ID and VITE_TODOIST_CLIENT_SECRET to enable Todoist sign-in.",
        variant: "destructive",
      });
      clearOAuthParams();
      return;
    }

    const storedState = typeof window !== "undefined" ? sessionStorage.getItem(TODOIST_STATE_KEY) : null;
    if (storedState && state && storedState !== state) {
      toast({
        title: "State mismatch",
        description: "The Todoist sign-in response didn't match the initiated request. Please try again.",
        variant: "destructive",
      });
      clearOAuthParams();
      return;
    }

    setOauthLoading(true);

    exchangeTodoistAuthCode({
      code,
      clientId,
      clientSecret,
      redirectUri,
    })
      .then((response) => {
        localStorage.setItem("todoist_token", response.access_token);
        setToken(response.access_token);
        toast({
          title: "Connected to Todoist",
          description: "Your DoneGlow dashboard will now personalize itself with your Todoist history.",
        });
        navigate("/", { replace: true });
      })
      .catch((exchangeError) => {
        console.error("[Auth] Failed to exchange Todoist code", exchangeError);
        toast({
          title: "Unable to complete sign-in",
          description:
            exchangeError instanceof Error
              ? exchangeError.message
              : "Unexpected error while connecting to Todoist.",
          variant: "destructive",
        });
      })
      .finally(() => {
        clearOAuthParams();
        setOauthLoading(false);
        if (typeof window !== "undefined") {
          sessionStorage.removeItem(TODOIST_STATE_KEY);
        }
      });
  }, [clientId, clientSecret, redirectUri, navigate, search, toast]);

  const handleTodoistLogin = () => {
    if (!canStartOAuth || !clientId) {
      return;
    }

    const state = generateState();
    if (typeof window !== "undefined") {
      sessionStorage.setItem(TODOIST_STATE_KEY, state);
    }

    const authUrl = createTodoistAuthorizationUrl({
      clientId,
      redirectUri,
      scope: requestedScope,
      state,
    });

    window.location.href = authUrl;
  };

  const handleTokenSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!token.trim()) {
      toast({
        title: "Token required",
        description: "Paste a Todoist API token to continue.",
        variant: "destructive",
      });
      return;
    }

    setTokenLoading(true);
    const isValid = await validateToken(token.trim());
    setTokenLoading(false);

    if (!isValid) {
      toast({
        title: "Invalid token",
        description: "Todoist rejected this token. Double-check it in Todoist's developer settings.",
        variant: "destructive",
      });
      return;
    }

    localStorage.setItem("todoist_token", token.trim());
    toast({
      title: "Token saved",
      description: "Connected to Todoist with your personal API token.",
    });
    navigate("/");
  };

  const handleDisconnect = async () => {
    if (!hasStoredToken) return;

    setDisconnecting(true);
    const revoked = await revokeTodoistToken({
      token,
      clientId,
      clientSecret,
    });
    setDisconnecting(false);

    if (!revoked) {
      console.warn("[Auth] Todoist token revocation returned a non-success status. Proceeding to clear token locally.");
    }

    localStorage.removeItem("todoist_token");
    setToken("");
    toast({
      title: "Disconnected",
      description: "Todoist access has been cleared for this browser.",
    });
  };

  const featureHighlights: FeatureHighlight[] = [
    {
      title: "Personalized recaps",
      description: "See streaks, focus windows, and project momentum the moment you connect Todoist.",
      icon: Sparkles,
      accent: "bg-primary/15 text-primary",
    },
    {
      title: "Actionable planning",
      description: "Bring overdue, today, and upcoming tasks into a guided action plan without leaving DoneGlow.",
      icon: Activity,
      accent: "bg-emerald-500/15 text-emerald-400",
    },
    {
      title: "Secure by design",
      description: "Authorize directly with Todoist or keep data local with a personal API token saved to this browser.",
      icon: ShieldCheck,
      accent: "bg-amber-500/15 text-amber-400",
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-30 bg-[radial-gradient(circle_at_top,hsla(var(--primary),0.18),transparent_65%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20 bg-[linear-gradient(120deg,hsla(var(--background),1)_0%,hsla(var(--background),0.92)_42%,hsla(var(--background),1)_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-40 [background-image:radial-gradient(1px_1px_at_1px_1px,hsla(var(--foreground),0.08),transparent)] [background-size:46px_46px]"
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col justify-between gap-12">
            <div className="space-y-6">
              <Badge
                variant="secondary"
                className="w-fit rounded-full border border-white/10 bg-background/70 px-4 py-1.5 text-xs uppercase tracking-[0.28em] text-muted-foreground/80"
              >
                DoneGlow companion
              </Badge>
              <div className="space-y-4">
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                  Sign in to unlock your Todoist glow
                </h1>
                <p className="max-w-xl text-base text-muted-foreground/80">
                  Connect directly with Todoist to transform raw completions into a guided dashboard with streaks, focus cues,
                  and an action plan tailored to your day.
                </p>
              </div>
              <div className="inline-flex flex-wrap items-center gap-3 text-sm text-muted-foreground/70">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-background/70 px-3 py-1">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Personalized analytics in seconds
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-background/70 px-3 py-1">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  No passwords stored by DoneGlow
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featureHighlights.map((feature) => (
                <div
                  key={feature.title}
                  className="relative overflow-hidden rounded-3xl border border-white/10 bg-background/75 p-5 shadow-[0_24px_64px_-40px_rgba(15,23,42,0.65)]"
                >
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(140deg,hsla(var(--foreground),0.05),transparent_65%)]" />
                  <div className="relative space-y-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${feature.accent}`}>
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <h2 className="text-sm font-semibold text-foreground">{feature.title}</h2>
                    <p className="text-xs text-muted-foreground/75">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-[2.5rem] border border-white/10 bg-background/80 p-6 shadow-[0_30px_70px_-40px_rgba(15,23,42,0.6)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Connect in two flexible ways</p>
                  <p className="text-sm text-muted-foreground/75">
                    Authorize with Todoist OAuth for a one-click experience or drop in a personal API token to keep everything
                    local.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-background/70 px-4 py-2 text-sm"
                  onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                >
                  Explore options
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <Card className="border-white/10 bg-background/85 backdrop-blur">
              <CardHeader className="space-y-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15">
                  <LogIn className="h-10 w-10 text-primary" />
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-3xl font-semibold">Continue with Todoist</CardTitle>
                  <CardDescription className="text-base text-muted-foreground/80">
                    We&apos;ll send you to Todoist to approve secure access, then bring you back here once DoneGlow is ready with
                    your insights.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <Button
                  type="button"
                  className="w-full rounded-full"
                  size="lg"
                  onClick={handleTodoistLogin}
                  disabled={oauthLoading || !canStartOAuth}
                >
                  {oauthLoading ? "Connecting..." : "Continue with Todoist"}
                </Button>
                {!canStartOAuth && (
                  <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                    Configure <code className="font-mono">VITE_TODOIST_CLIENT_ID</code>,{" "}
                    <code className="font-mono">VITE_TODOIST_CLIENT_SECRET</code>, and{" "}
                    <code className="font-mono">VITE_TODOIST_REDIRECT_URI</code> to enable Todoist sign-in.
                  </div>
                )}
                <p className="text-sm text-muted-foreground/80">
                  DoneGlow never sees your Todoist password—authorization happens entirely on Todoist. When you return, your
                  dashboard personalizes instantly.
                </p>
                {hasStoredToken && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-full"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                  >
                    {disconnecting ? "Disconnecting..." : "Disconnect Todoist"}
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-background/85 backdrop-blur">
              <CardHeader className="space-y-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
                  <CheckCircle2 className="h-10 w-10 text-primary-foreground" />
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-3xl font-semibold">Use an API token instead</CardTitle>
                  <CardDescription className="text-base text-muted-foreground/80">
                    Prefer the classic route? Paste your personal Todoist API token and we&apos;ll store it securely in this
                    browser only.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleTokenSubmit} className="space-y-4 text-left">
                  <div className="space-y-2">
                    <Label htmlFor="token">Todoist API Token</Label>
                    <Input
                      id="token"
                      type="password"
                      placeholder="Enter your Todoist API token"
                      value={token}
                      onChange={(event) => setToken(event.target.value)}
                      disabled={tokenLoading}
                      autoComplete="new-password"
                      aria-describedby="token-description"
                    />
                    <p id="token-description" className="text-sm text-muted-foreground/80">
                      Find your token in{" "}
                      <a
                        href="https://todoist.com/app/settings/integrations/developer"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline-offset-4 transition hover:underline"
                      >
                        Todoist developer settings
                      </a>
                      .
                    </p>
                  </div>
                  <Button type="submit" className="w-full rounded-full" disabled={tokenLoading}>
                    {tokenLoading ? "Validating..." : "Save token"}
                  </Button>
                  {hasStoredToken && (
                    <p className="text-center text-sm text-muted-foreground/80">
                      A Todoist token is already saved — reconnect if you need to refresh permissions.
                    </p>
                  )}
                </form>
              </CardContent>
            </Card>

            <div className="rounded-3xl border border-white/10 bg-background/75 p-6 text-sm text-muted-foreground/75 shadow-[0_24px_64px_-44px_rgba(15,23,42,0.6)]">
              DoneGlow stores any tokens in your browser&apos;s local storage. Clear your token or disconnect at any time to remove
              access instantly.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
