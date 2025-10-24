import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { CheckCircle2 } from "lucide-react";
import { validateToken } from "@/lib/todoist";

export default function Auth() {
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token.trim()) {
      toast({
        title: "Token required",
        description: "Please enter your Todoist API token",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    // Validate token with Todoist API
    const isValid = await validateToken(token);

    if (!isValid) {
      setIsLoading(false);
      toast({
        title: "Invalid token",
        description: "Invalid Todoist token or unable to fetch data.",
        variant: "destructive",
      });
      return;
    }

    // Store token
    localStorage.setItem("todoist_token", token);

    setIsLoading(false);
    toast({
      title: "Success!",
      description: "Connected to Todoist",
    });
    navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">
            Welcome to DoneGlow
          </CardTitle>
          <CardDescription className="text-base">
            Visualize your Todoist achievements beautifully
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">Todoist API Token</Label>
              <Input
                id="token"
                type="password"
                placeholder="Enter your Todoist API token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
                aria-describedby="token-description"
              />
              <p
                id="token-description"
                className="text-sm text-muted-foreground"
              >
                Get your token from{" "}
                <a
                  href="https://todoist.com/app/settings/integrations/developer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Todoist Settings
                </a>
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Connecting..." : "Connect to Todoist"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
