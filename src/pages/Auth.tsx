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
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, LogIn } from "lucide-react";
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
    "data:read,profile:read";

  const redirectUri = useMemo(() => {
    if (configuredRedirect) return configuredRedirect;
    if (typeof window !== "undefined") {
      return `${window.location.origin}/auth`;
    }
    return "";
  }, [configuredRedirect]);

  const hasStoredToken = Boolean(token);

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
    if (!clientId) {
      toast({
        title: "Missing Todoist client ID",
        description: "Add VITE_TODOIST_CLIENT_ID to your environment to start the OAuth flow.",
        variant: "destructive",
      });
      return;
    }

    if (!redirectUri) {
      toast({
        title: "Missing redirect URI",
        description: "Set VITE_TODOIST_REDIRECT_URI or host DoneGlow so the OAuth redirect can complete.",
        variant: "destructive",
      });
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

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 md:flex-row">
        <Card className="flex-1 border-white/10 bg-background/80 backdrop-blur">
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
              disabled={oauthLoading}
            >
              {oauthLoading ? "Connecting..." : "Continue with Todoist"}
            </Button>
            <p className="text-sm text-muted-foreground">
              We redirect you to Todoist to sign in securely. After granting access, you&apos;ll return here and DoneGlow will
              load your personalized dashboard automatically.
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
        <Card className="flex-1 border-white/10 bg-background/80 backdrop-blur">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
              <CheckCircle2 className="h-10 w-10 text-primary-foreground" />
            </div>
            <CardTitle className="text-3xl font-bold">Use an API token instead</CardTitle>
            <CardDescription className="text-base">
              Prefer the classic approach? Paste your Todoist API token directly and we&apos;ll store it securely in this
              browser.
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
  );
}
