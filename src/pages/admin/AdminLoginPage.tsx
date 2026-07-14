import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wifi, Eye, EyeOff, LogIn } from 'lucide-react';
import { motion } from 'motion/react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Map plain username → stored email in Supabase Auth
function resolveEmail(username: string): string {
  const trimmed = username.trim().toLowerCase();
  // If already an email address, use as-is
  if (trimmed.includes('@')) return trimmed;
  // Otherwise map "admin" → "admin@admin.com"
  return `${trimmed}@admin.com`;
}

export default function AdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Please enter username and password');
      return;
    }
    setLoading(true);
    try {
      await signIn(resolveEmail(username), password);
      toast.success('Welcome back!');
      navigate('/admin');
    } catch (err) {
      toast.error('Login failed', { description: 'Invalid credentials' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left Branding Panel */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between bg-muted border-r border-border p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Wifi className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-800 text-foreground">NetConnect</span>
        </div>

        <div>
          <div className="w-12 h-1 bg-primary rounded-full mb-6" />
          <h2 className="text-4xl font-800 text-foreground mb-4 leading-tight">
            Manage Your<br />WiFi Business<br /><span className="text-primary">Effortlessly</span>
          </h2>
          <p className="text-muted-foreground text-base max-w-xs">
            Monitor revenue, manage users, generate vouchers — all from one powerful dashboard.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Total Revenue', value: '₦2.4M', color: 'text-primary' },
            { label: 'Active Users', value: '1,240', color: 'text-green-400' },
            { label: 'Vouchers Sold', value: '8,900', color: 'text-accent' },
            { label: 'Uptime', value: '99.9%', color: 'text-foreground' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-card rounded-xl p-4 border border-border">
              <p className={`text-2xl font-800 ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right Login Form */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-8 justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Wifi className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-800 text-foreground">NetConnect Admin</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-800 text-foreground mb-1">Admin Login</h1>
            <p className="text-sm text-muted-foreground">Sign in to access your dashboard</p>
          </div>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-foreground text-sm">Username</Label>
                  <Input
                    type="text"
                    placeholder="admin"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    autoComplete="username"
                    className="bg-muted border-input text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground text-sm">Password</Label>
                  <div className="relative">
                    <Input
                      type={showPass ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="current-password"
                      className="bg-muted border-input text-foreground placeholder:text-muted-foreground pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-primary text-primary-foreground font-700 hover:bg-primary/90 mt-2"
                >
                  {loading ? (
                    <><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground mr-2" />Signing in...</>
                  ) : (
                    <><LogIn className="h-4 w-4 mr-2" />Sign In</>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
