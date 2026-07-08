import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, School } from "lucide-react";

interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: "ADMIN" | "CASHIER";
  };
}

export function Login() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setUser, isAuthenticated } = useAuthStore();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"CASHIER" | "ADMIN">("CASHIER");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const response = await apiClient.post<AuthResponse>("/auth/login", data);
      return response.data;
    },
    onSuccess: (data) => {
      setUser(data.user);
      queryClient.clear();
      navigate("/", { replace: true });
    },
    onError: (err: { message?: string }) => {
      setError(err.message || "Invalid credentials");
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; password: string; role: string }) => {
      const response = await apiClient.post<AuthResponse>("/auth/signup", data);
      return response.data;
    },
    onSuccess: (data) => {
      setUser(data.user);
      queryClient.clear();
      navigate("/", { replace: true });
    },
    onError: (err: { message?: string }) => {
      setError(err.message || "Failed to create account");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (mode === "login") {
      if (!email || !password) return;
      loginMutation.mutate({ email, password });
    } else {
      if (!name || !email || !password) return;
      signupMutation.mutate({ name, email, password, role });
    }
  };

  const isPending = loginMutation.isPending || signupMutation.isPending;

  const switchMode = () => {
    setMode(mode === "login" ? "signup" : "login");
    setError("");
    setEmail("");
    setPassword("");
    setName("");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <School className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-on-surface" style={{ fontFamily: "Crimson Text" }}>
            SmartSchool
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">Fee Management System</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-outline-variant p-8 shadow-sm">
          <h2 className="text-xl font-bold text-on-surface mb-1" style={{ fontFamily: "Crimson Text" }}>
            {mode === "login" ? "Welcome back" : "Create account"}
          </h2>
          <p className="text-sm text-on-surface-variant mb-6">
            {mode === "login"
              ? "Sign in to your account to continue"
              : "Fill in the details to get started"}
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-error/5 border border-error/20 text-sm text-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name (signup only) */}
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="bg-white"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={mode === "login" ? "admin@school.com" : "you@school.com"}
                className="bg-white"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "login" ? "Enter your password" : "Min. 6 characters"}
                className="bg-white"
                required
              />
            </div>

            {/* Role (signup only) */}
            {mode === "signup" && (
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as "CASHIER" | "ADMIN")}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASHIER">Cashier</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              type="submit"
              disabled={isPending || (mode === "login" ? !email || !password : !name || !email || !password)}
              className="w-full bg-primary text-white hover:bg-primary/90 h-11"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {mode === "login" ? "Signing in..." : "Creating account..."}
                </>
              ) : mode === "login" ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          {/* Switch Mode */}
          <div className="mt-6 text-center">
            <p className="text-sm text-on-surface-variant">
              {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={switchMode}
                className="text-primary font-bold hover:underline"
              >
                {mode === "login" ? "Sign Up" : "Sign In"}
              </button>
            </p>
          </div>

          {/* Demo Credentials (login only) */}
          {mode === "login" && (
            <div className="mt-6 pt-4 border-t border-outline-variant">
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold mb-2">
                Demo Credentials
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs text-on-surface-variant">
                <div>
                  <span className="font-bold text-on-surface">Admin:</span> admin@school.com
                </div>
                <div>
                  <span className="font-bold text-on-surface">Cashier:</span> cashier@school.com
                </div>
                <div>
                  <span className="font-bold text-on-surface">Pass:</span> admin123
                </div>
                <div>
                  <span className="font-bold text-on-surface">Pass:</span> cashier123
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
