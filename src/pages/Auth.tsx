import { useEffect, useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { BarChart3, CheckCircle2, LogIn, ShieldCheck, Sparkles } from "lucide-react";
import type { TodoistUserProfile } from "@/types/todoist";
import {
  requestTodoistAuthorizeUrl,
  completeTodoistOAuth,
  logoutSession,
  establishSessionWithToken,
  fetchSession,
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

  const [token, setToken] = useState("");
  const [tokenLoading, setTokenLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [session, setSession] = useState<{
    authenticated: boolean;
    profile: TodoistUserProfile | null;
  } | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [oauthConfigured, setOauthConfigured] = useState(true);

  const requestedScope =
    (import.meta.env.VITE_TODOIST_OAUTH_SCOPE as string | undefined) ||
    "data:read";

  const hasStoredToken = Boolean(session?.authenticated);
  const canStartOAuth = oauthConfigured && !sessionLoading;

  useEffect(() => {
    let active = true;
    setSessionLoading(true);

    fetchSession()
      .then((data) => {
        if (!active) return;
        setSession(data);
      })
      .catch((error) => {
        console.error("[Auth] Failed to load session", error);
        if (!active) return;
        setSession({ authenticated: false, profile: null });
      })
      .finally(() => {
        if (!active) return;
        setSessionLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

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

    completeTodoistOAuth({ code, state })
      .then((response) => {
        setSession({ authenticated: true, profile: response.profile ?? null });
        setToken("");
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
  }, [navigate, search, toast]);

  const handleTodoistLogin = async () => {
    if (!canStartOAuth) {
      return;
    }

    const state = generateState();
    if (typeof window !== "undefined") {
      sessionStorage.setItem(TODOIST_STATE_KEY, state);
    }

    setOauthLoading(true);
    try {
      const authUrl = await requestTodoistAuthorizeUrl({ state, scope: requestedScope });
      window.location.href = authUrl;
    } catch (error) {
      console.error("[Auth] Failed to build Todoist authorize URL", error);
      setOauthConfigured(false);
      toast({
        title: "Todoist sign-in unavailable",
        description:
          error instanceof Error
            ? error.message
            : "The server could not start the Todoist authorization flow.",
        variant: "destructive",
      });
    } finally {
      setOauthLoading(false);
    }
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
    try {
      const response = await establishSessionWithToken(token.trim());
      setSession({ authenticated: true, profile: response.profile ?? null });
      setToken("");
      toast({
        title: "Token saved",
        description: "Connected to Todoist with your personal API token.",
      });
      navigate("/");
    } catch (error) {
      console.error("[Auth] Token login failed", error);
      toast({
        title: "Invalid token",
        description:
          error instanceof Error
            ? error.message
            : "Todoist rejected this token. Double-check it in Todoist's developer settings.",
        variant: "destructive",
      });
    } finally {
      setTokenLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!hasStoredToken) return;

    setDisconnecting(true);
    try {
      await logoutSession();
      setSession({ authenticated: false, profile: null });
      setToken("");
    } finally {
      setDisconnecting(false);
    }
    toast({
      title: "Disconnected",
      description: "Todoist access has been cleared for this browser.",
    });
  };

  const highlightItems = [
    {
      icon: Sparkles,
      title: "Bring focus to your flow",
      description: "Highlight the tasks that matter most with a calm, distraction-free dashboard built for dark mode.",
    },
    {
      icon: BarChart3,
      title: "See progress instantly",
      description: "Surface streaks, completion trends, and personal bests as soon as you sign in.",
    },
    {
      icon: ShieldCheck,
      title: "Keep access secure",
      description: "Authorize with Todoist OAuth or drop in an API token—either way, we keep the credentials behind a secure session.",
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.25)_0%,_transparent_55%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-gradient-to-b from-primary/20 via-background/40 to-transparent blur-3xl"
      />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-16 lg:grid lg:min-h-screen lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16 lg:px-12">
        <section className="flex flex-col items-center gap-8 text-center lg:items-start lg:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-sm text-muted-foreground backdrop-blur">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">DoneGlow</span>
            <span>Powered by your Todoist history</span>
          </div>

          <div className="space-y-5">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Sign in and turn Todoist into a glowing command center
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Connect securely, keep the interface dark by default, and unlock a richer overview of everything you&apos;ve
              accomplished. DoneGlow translates your Todoist data into focused momentum.
            </p>
          </div>

          <div className="grid w-full gap-4 sm:grid-cols-2">
            {highlightItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="group flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left shadow-[0_20px_60px_rgba(15,23,42,0.4)] transition hover:border-primary/40 hover:bg-primary/10"
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              );
            })}
          </div>

          <p className="text-sm text-muted-foreground">
            Prefer a manual setup? Head to the right column to paste an API token—DoneGlow never sends it to our servers.
          </p>
        </section>

        <div className="flex flex-col gap-6">
          <Card className="border-white/10 bg-background/80 shadow-[0_30px_120px_rgba(15,23,42,0.45)] backdrop-blur">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15">
                <LogIn className="h-10 w-10 text-primary" />
              </div>
              <CardTitle className="text-3xl font-bold">Sign in with Todoist</CardTitle>
              <CardDescription className="text-base">
                Authorize DoneGlow with your Todoist account to fetch tasks, completions, and profile insights.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Button
                type="button"
                className="w-full"
                size="lg"
                onClick={handleTodoistLogin}
                disabled={oauthLoading || !canStartOAuth}
              >
                {oauthLoading ? "Connecting..." : "Continue with Todoist"}
              </Button>
              {!canStartOAuth && !sessionLoading && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  Configure <code className="font-mono">TODOIST_CLIENT_ID</code>,{" "}
                  <code className="font-mono">TODOIST_CLIENT_SECRET</code>, and{" "}
                  <code className="font-mono">TODOIST_REDIRECT_URI</code> on the server to enable Todoist sign-in.
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                We redirect you to Todoist to sign in securely. After granting access, you&apos;ll return here and DoneGlow
                will load your personalized dashboard automatically.
              </p>
              {hasStoredToken && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  {disconnecting ? "Disconnecting..." : "Disconnect Todoist"}
                </Button>
              )}
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-background/80 shadow-[0_30px_120px_rgba(15,23,42,0.45)] backdrop-blur">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
                <CheckCircle2 className="h-10 w-10 text-primary-foreground" />
              </div>
              <CardTitle className="text-3xl font-bold">Use an API token instead</CardTitle>
              <CardDescription className="text-base">
                Prefer the classic approach? Paste your Todoist API token directly and we&apos;ll lock it in a secure session
                cookie.
              </CardDescription>
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
                  <p id="token-description" className="text-sm text-muted-foreground">
                    Find your token in{" "}
                    <a
                      href="https://todoist.com/app/settings/integrations/developer"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Todoist developer settings
                    </a>
                    .
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={tokenLoading}>
                  {tokenLoading ? "Validating..." : "Save token"}
                </Button>
                {hasStoredToken && (
                  <p className="text-center text-sm text-muted-foreground">
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
