import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, User, Sparkles, ArrowRight, CheckCircle2, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { isLovableDomain, isCustomDomain } from "@/lib/canonical";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
});

type AuthMode = 'login' | 'signup' | 'forgot';

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const modeParam = searchParams.get("mode");
  
  const [mode, setMode] = useState<AuthMode>(
    modeParam === 'signup' ? 'signup' : 
    modeParam === 'reset' ? 'forgot' : 'login'
  );
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('rememberMe') === 'true';
  });
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn, signUp, user, isAdmin, isLoading: authLoading } = useAuth();

  // Check if returning from OAuth callback
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    if (accessToken) {
      setIsRedirecting(true);
    }
  }, []);

  // Handle remember me
  useEffect(() => {
    localStorage.setItem('rememberMe', String(rememberMe));
    
    if (!rememberMe) {
      const handleBeforeUnload = () => {
        sessionStorage.setItem('sessionActive', 'true');
      };
      
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [rememberMe]);

  useEffect(() => {
    if (!authLoading && user) {
      setIsRedirecting(true);
      toast({
        title: "Welcome!",
        description: "Redirecting to your dashboard...",
      });
      const timer = setTimeout(() => {
        const redirectPath = isAdmin ? "/admin" : "/dashboard";
        navigate(redirectPath);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user, isAdmin, authLoading, navigate, toast]);

  const validateForm = () => {
    try {
      if (mode === 'signup') {
        signupSchema.parse({ email, password, fullName });
      } else if (mode === 'login') {
        loginSchema.parse({ email, password });
      }
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    localStorage.setItem('rememberMe', String(rememberMe));
    try {
      if (isCustomDomain()) {
        // On custom domain (phynetix.me), bypass auth-bridge
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/dashboard`,
            skipBrowserRedirect: true,
          },
        });
        if (error) throw error;
        if (data?.url) {
          window.location.href = data.url;
        }
      } else {
        // On Lovable domains, use managed OAuth
        const { error } = await lovable.auth.signInWithOAuth("google", {
          redirect_uri: window.location.origin,
        });
        if (error) {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        }
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to sign in with Google", variant: "destructive" });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    localStorage.setItem('rememberMe', String(rememberMe));
    try {
      if (isCustomDomain()) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "apple",
          options: {
            redirectTo: `${window.location.origin}/dashboard`,
            skipBrowserRedirect: true,
          },
        });
        if (error) throw error;
        if (data?.url) {
          window.location.href = data.url;
        }
      } else {
        const { error } = await lovable.auth.signInWithOAuth("apple", {
          redirect_uri: window.location.origin,
        });
        if (error) {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        }
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to sign in with Apple", variant: "destructive" });
    } finally {
      setAppleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode !== 'forgot' && !validateForm()) return;
    
    setIsLoading(true);
    setMessage("");
    
    try {
      if (mode === 'signup') {
        const { error } = await signUp(email, password, fullName);
        if (error) {
          if (error.message.includes("already registered")) {
            toast({
              title: "Account exists",
              description: "This email is already registered. Please sign in instead.",
              variant: "destructive",
            });
          } else {
            toast({ title: "Signup failed", description: error.message, variant: "destructive" });
          }
        } else {
          setMessage("Please check your email to verify your account before signing in.");
          toast({ 
            title: "Account created!", 
            description: "Please check your email to verify your account." 
          });
        }
      } else if (mode === 'login') {
        const { error, isAdmin: userIsAdmin } = await signIn(email, password);
        if (error) {
          toast({ title: "Login failed", description: "Invalid email or password", variant: "destructive" });
        } else {
          toast({
            title: "Welcome back!",
            description: userIsAdmin ? "Redirecting to admin dashboard..." : "You've been successfully logged in.",
          });
          navigate(userIsAdmin ? "/admin" : "/dashboard");
        }
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth?mode=reset`,
        });
        if (error) {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        } else {
          setMessage("Password reset link sent to your email!");
          toast({ title: "Email sent", description: "Check your inbox for the reset link" });
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const benefits = [
    "Access to 10,000+ practice questions",
    "Detailed performance analytics",
    "AI-powered study recommendations",
    "Track progress across subjects"
  ];

  const getTitle = () => {
    switch (mode) {
      case 'signup': return 'Create Account';
      case 'forgot': return 'Reset Password';
      default: return 'Welcome Back';
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case 'signup': return 'Start your free trial today';
      case 'forgot': return 'Enter your email to receive a reset link';
      default: return 'Enter your credentials to continue';
    }
  };

  // Show full-page loading when redirecting after OAuth
  if (isRedirecting || (authLoading && !user)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
        <div className="fixed inset-0 pointer-events-none">
          <div className="floating-orb w-96 h-96 bg-primary/30 top-20 -left-48" />
          <div className="floating-orb w-80 h-80 bg-accent/30 bottom-20 -right-40" style={{ animationDelay: '2s' }} />
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6 z-10"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-fuchsia-600 flex items-center justify-center">
            <Sparkles className="w-9 h-9 text-white" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-lg font-medium text-foreground">Signing you in...</p>
            <p className="text-sm text-muted-foreground">Please wait while we set up your session</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="floating-orb w-96 h-96 bg-primary/30 top-20 -left-48" />
        <div className="floating-orb w-80 h-80 bg-accent/30 bottom-20 -right-40" style={{ animationDelay: '2s' }} />
      </div>

      {/* Left Side - Benefits (Signup only) */}
      {mode === 'signup' && (
        <div className="hidden lg:flex flex-col justify-center w-1/2 p-12 relative z-10">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Link to="/" className="flex items-center gap-2 mb-12">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-fuchsia-600 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <span className="text-2xl font-bold font-display gradient-text">PhyNetix</span>
            </Link>

            <h1 className="text-4xl font-bold font-display mb-6">
              Start Your Journey to <span className="gradient-text">Success</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              Join thousands of students who are already mastering their exams with our AI-powered platform.
            </p>

            <ul className="space-y-4">
              {benefits.map((benefit, index) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  </div>
                  <span className="text-foreground">{benefit}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>
      )}

      {/* Form Side */}
      <div className={`flex-1 flex items-center justify-center p-4 lg:p-12 ${mode !== 'signup' ? 'w-full' : ''}`}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md relative z-10"
        >
          {/* Logo */}
          <Link to="/" className="flex items-center justify-center gap-2 mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-fuchsia-600 flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold font-display gradient-text">PhyNetix</span>
          </Link>

          {/* Form Card */}
          <div className="glass-card p-8">
            {/* Back button for forgot password */}
            {mode === 'forgot' && (
              <button
                onClick={() => setMode('login')}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to login
              </button>
            )}

            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold font-display mb-2">{getTitle()}</h1>
              <p className="text-muted-foreground">{getSubtitle()}</p>
            </div>

            {message && (
              <div className="mb-6 p-4 rounded-lg bg-success/10 text-success text-center text-sm">
                {message}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === 'signup' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Enter your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-12"
                    />
                  </div>
                  {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-12"
                  />
                </div>
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>

              {(mode === 'login' || mode === 'signup') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder={mode === 'signup' ? "Create a password" : "Enter your password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-12 pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>
              )}

              {mode === 'login' && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="rememberMe"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked === true)}
                    />
                    <label
                      htmlFor="rememberMe"
                      className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    >
                      Remember me
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-sm text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <Button
                type="submit"
                variant="gradient"
                size="lg"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </span>
                ) : (
                  <>
                    {mode === 'signup' && "Create Account"}
                    {mode === 'login' && "Sign In"}
                    {mode === 'forgot' && "Send Reset Link"}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </form>

            {/* Social Sign In */}
            {(mode === 'login' || mode === 'signup') && (
              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                  </div>
                </div>
                <div className="flex flex-col gap-3 mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading || appleLoading}
                  >
                    {googleLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                    )}
                    Continue with Google
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleAppleSignIn}
                    disabled={googleLoading || appleLoading}
                  >
                    {appleLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                      </svg>
                    )}
                    Continue with Apple
                  </Button>
                </div>
              </div>
            )}

            <p className="text-center text-sm text-muted-foreground mt-8">
              {mode === 'signup' ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                type="button"
                onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}
                className="text-primary hover:underline font-medium"
              >
                {mode === 'signup' ? "Sign in" : "Sign up"}
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
