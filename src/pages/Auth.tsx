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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, CheckCircle2, LogIn, ShieldCheck, Sparkles } from "lucide-react";
import {
  createTodoistAuthorizationUrl,
  exchangeTodoistAuthCode,
  revokeTodoistToken,
  validateToken,
} from "@/lib/todoist";

const TODOIST_STATE_KEY = "todoist_oauth_state";

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
    "data:read";

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
    console.log("Redirecting to Todoist with URL:", authUrl);
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

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.15),_transparent_60%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-primary/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 bottom-10 h-[26rem] w-[26rem] rounded-full bg-rose-500/10 blur-3xl"
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-12 px-6 py-20 lg:flex-row lg:items-center lg:px-12">
        <div className="flex flex-1 flex-col items-center gap-8 text-center lg:items-start lg:text-left">
          <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
            Seamless Todoist sync
          </Badge>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Elevate your focus with a smarter Todoist companion
            </h1>
            <p className="max-w-xl text-base text-slate-300 sm:text-lg">
              Connect DoneGlow to Todoist to surface your wins, momentum streaks, and insights that keep you motivated.
              Choose a one-click OAuth flow or manage your own API token — either way, you stay in control.
            </p>
          </div>
          <div className="grid w-full gap-4 sm:grid-cols-2">
            <div className="group rounded-2xl border border-white/10 bg-white/5 p-5 text-left shadow-lg backdrop-blur transition hover:border-primary/40 hover:bg-primary/10">
              <Sparkles className="mb-3 h-6 w-6 text-primary" />
              <h3 className="text-base font-semibold text-white">Personalized momentum</h3>
              <p className="text-sm text-slate-300">
                Your dashboard evolves with every Todoist action, spotlighting the routines and habits that help you win the
                week.
              </p>
            </div>
            <div className="group rounded-2xl border border-white/10 bg-white/5 p-5 text-left shadow-lg backdrop-blur transition hover:border-emerald-400/40 hover:bg-emerald-400/10">
              <ShieldCheck className="mb-3 h-6 w-6 text-emerald-300" />
              <h3 className="text-base font-semibold text-white">Privacy-first control</h3>
              <p className="text-sm text-slate-300">
                Tokens stay in your browser. Disconnect anytime in one tap and DoneGlow forgets everything immediately.
              </p>
            </div>
          </div>
          {hasStoredToken ? (
            <div className="flex items-center gap-3 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-5 py-2 text-sm font-medium text-emerald-300 shadow-lg">
              <CheckCircle2 className="h-5 w-5" />
              Connected — ready to sync your wins
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <LogIn className="h-4 w-4" />
              Pick the connection flow that fits your setup.
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-6 lg:max-w-xl">
          <Card className="relative overflow-hidden border-white/10 bg-slate-950/70 shadow-[0_40px_120px_-40px_rgba(59,130,246,0.45)] backdrop-blur">
            <CardHeader className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20">
                <LogIn className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-3xl font-semibold text-white">Sign in with Todoist</CardTitle>
                <CardDescription className="text-base text-slate-300">
                  Authorize DoneGlow in a secure Todoist window. We&apos;ll only ever ask for the permissions you configure
                  below.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <Button
                type="button"
                className="group w-full justify-center text-base"
                size="lg"
                onClick={handleTodoistLogin}
                disabled={oauthLoading || !canStartOAuth}
              >
                <span>{oauthLoading ? "Connecting..." : "Continue with Todoist"}</span>
                {!oauthLoading && <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" />}
              </Button>
              {!canStartOAuth && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  Configure <code className="font-mono">VITE_TODOIST_CLIENT_ID</code>,{" "}
                  <code className="font-mono">VITE_TODOIST_CLIENT_SECRET</code>, and{" "}
                  <code className="font-mono">VITE_TODOIST_REDIRECT_URI</code> in your environment to enable Todoist sign-in.
                </div>
              )}
              <Separator className="bg-white/10" />
              <p className="text-sm leading-relaxed text-slate-300">
                We redirect you to Todoist to confirm access — no passwords handled here. Once you&apos;re back, DoneGlow
                automatically syncs your latest tasks and completions.
              </p>
              {hasStoredToken && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-emerald-400/40 text-emerald-300 hover:border-emerald-300 hover:bg-emerald-400/10"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  {disconnecting ? "Disconnecting..." : "Disconnect Todoist"}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-slate-950/70 shadow-[0_40px_120px_-48px_rgba(16,185,129,0.45)] backdrop-blur">
            <CardHeader className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/15">
                <CheckCircle2 className="h-8 w-8 text-emerald-300" />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-3xl font-semibold text-white">Use an API token instead</CardTitle>
                <CardDescription className="text-base text-slate-300">
                  Prefer the classic approach? Paste your Todoist token directly — it stays encrypted in this browser.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTokenSubmit} className="space-y-5 text-left">
                <div className="space-y-2">
                  <Label htmlFor="token" className="text-slate-200">
                    Todoist API Token
                  </Label>
                  <Input
                    id="token"
                    type="password"
                    placeholder="Enter your Todoist API token"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    disabled={tokenLoading}
                    autoComplete="new-password"
                    aria-describedby="token-description"
                    className="border-white/10 bg-slate-900/80 text-base"
                  />
                  <p id="token-description" className="text-sm text-slate-300">
                    Find your token in{" "}
                    <a
                      href="https://todoist.com/app/settings/integrations/developer"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-300 underline-offset-4 transition hover:text-emerald-200 hover:underline"
                    >
                      Todoist developer settings
                    </a>
                    .
                  </p>
                </div>
                <Button
                  type="submit"
                  className="w-full justify-center text-base"
                  disabled={tokenLoading}
                >
                  {tokenLoading ? "Validating..." : "Save token"}
                </Button>
                {hasStoredToken && (
                  <p className="text-center text-sm text-slate-300">
                    A Todoist token is already saved — reconnect if you need to refresh permissions.
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
