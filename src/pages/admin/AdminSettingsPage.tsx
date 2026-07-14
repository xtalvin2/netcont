import React, { useEffect, useState } from 'react';
import { Save, Settings, Key, Server, Building, Eye, EyeOff, Copy, Check, ExternalLink, User, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { fetchSettings, saveSetting } from '@/lib/api';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';

interface SettingField {
  key: string;
  label: string;
  placeholder: string;
  type?: 'text' | 'password';
  hint?: string;
}

const WEBHOOK_URL = `${window.location.origin.replace(/:\d+$/, '')}/functions/v1/paystack-webhook`;
const SUPABASE_FUNCTIONS_URL = 'https://drtvelrikmvkhmiiewgw.supabase.co/functions/v1/paystack-webhook';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSecret, setShowSecret] = useState(false);
  const [showMikrotikPwd, setShowMikrotikPwd] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Admin credentials state
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);

  useEffect(() => {
    fetchSettings()
      .then(setSettings)
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (key: string) => {
    setSaving(key);
    try {
      await saveSetting(key, settings[key] ?? '');
      toast.success('Setting saved');
    } catch {
      toast.error('Failed to save setting');
    } finally {
      setSaving(null);
    }
  };

  const handleChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveGroup = async (keys: string[]) => {
    setSaving('__group__');
    try {
      await Promise.all(keys.map(k => saveSetting(k, settings[k] ?? '')));
      toast.success('All settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(null);
    }
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(SUPABASE_FUNCTIONS_URL).then(() => {
      setCopiedWebhook(true);
      toast.success('Webhook URL copied!');
      setTimeout(() => setCopiedWebhook(false), 2000);
    });
  };

  const handleSaveCredentials = async () => {
    if (!newUsername && !newPassword) {
      toast.error('Enter a new username or password to update');
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword && newPassword.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }
    setSavingCreds(true);
    try {
      // Build the update payload for Supabase Auth directly — no edge function needed
      const updatePayload: { password?: string; email?: string } = {};
      if (newPassword) updatePayload.password = newPassword;
      if (newUsername) {
        updatePayload.email = newUsername.includes('@')
          ? newUsername
          : `${newUsername.toLowerCase().trim()}@admin.com`;
      }

      const { error } = await supabase.auth.updateUser(updatePayload);
      if (error) throw error;

      toast.success('Credentials updated! Signing out…');
      setNewUsername('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => supabase.auth.signOut(), 1500);
    } catch (err) {
      toast.error('Failed to update credentials', {
        description: err instanceof Error ? err.message : 'Please try again',
      });
    } finally {
      setSavingCreds(false);
    }
  };

  const SaveBtn = ({ fieldKey }: { fieldKey: string }) => (
    <Button
      size="sm"
      onClick={() => handleSave(fieldKey)}
      disabled={loading || saving === fieldKey || saving === '__group__'}
      className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 font-600"
    >
      {saving === fieldKey ? (
        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
      ) : (
        <Save className="h-3.5 w-3.5" />
      )}
    </Button>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-800 text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure your WiFi billing system</p>
      </div>

      {/* Business Info */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base text-foreground">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
              <Building className="h-3.5 w-3.5 text-primary" />
            </div>
            Business Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {([
            { key: 'business_name', label: 'Business Name', placeholder: 'NetConnect Nigeria' },
            { key: 'support_phone', label: 'Support Phone', placeholder: '08000000000' },
            { key: 'hotspot_name', label: 'Hotspot Network Name', placeholder: 'MyHotspot' },
          ] as SettingField[]).map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-sm text-foreground">{label}</Label>
              <div className="flex gap-2">
                <Input
                  placeholder={placeholder}
                  value={settings[key] ?? ''}
                  onChange={e => handleChange(key, e.target.value)}
                  disabled={loading}
                  className="flex-1 bg-muted border-input text-foreground placeholder:text-muted-foreground"
                />
                <SaveBtn fieldKey={key} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Paystack Configuration */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base text-foreground">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
                <Key className="h-3.5 w-3.5 text-primary" />
              </div>
              Paystack Configuration
            </CardTitle>
            <a
              href="https://dashboard.paystack.com/#/settings/developer"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Get keys <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            Find your keys at <span className="text-foreground">Settings → API Keys & Webhooks</span> in Paystack dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          {/* Public Key */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label className="text-sm text-foreground">Live Public Key</Label>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500/40 text-green-500">pk_live_...</Badge>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={settings['paystack_public_key'] ?? ''}
                onChange={e => handleChange('paystack_public_key', e.target.value)}
                disabled={loading}
                className="flex-1 bg-muted border-input text-foreground placeholder:text-muted-foreground font-mono text-sm"
              />
              <SaveBtn fieldKey="paystack_public_key" />
            </div>
          </div>

          {/* Secret Key */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label className="text-sm text-foreground">Live Secret Key</Label>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-500/40 text-primary">sk_live_...</Badge>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showSecret ? 'text' : 'password'}
                  placeholder="sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={settings['paystack_secret_key'] ?? ''}
                  onChange={e => handleChange('paystack_secret_key', e.target.value)}
                  disabled={loading}
                  className="bg-muted border-input text-foreground placeholder:text-muted-foreground font-mono text-sm pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <SaveBtn fieldKey="paystack_secret_key" />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Used by the server to verify payments. Never share this key.
            </p>
          </div>

          {/* Webhook URL — read-only, copy only */}
          <div className="space-y-1.5">
            <Label className="text-sm text-foreground">Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={SUPABASE_FUNCTIONS_URL}
                className="flex-1 bg-muted/50 border-input text-muted-foreground font-mono text-xs cursor-default select-all"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={copyWebhook}
                className="shrink-0"
              >
                {copiedWebhook ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Paste this URL into <span className="text-foreground">Paystack → Settings → API → Live Webhook URL</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* MikroTik Router */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base text-foreground">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
              <Server className="h-3.5 w-3.5 text-primary" />
            </div>
            MikroTik Router
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Direct router credentials for reference. Live voucher sync uses the Relay URL below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {([
            { key: 'mikrotik_ip', label: 'Router IP Address', placeholder: '192.168.88.1' },
            { key: 'mikrotik_username', label: 'Router Username', placeholder: 'admin' },
            { key: 'mikrotik_password', label: 'Router Password', placeholder: '••••••••', type: 'password' },
          ] as SettingField[]).map(({ key, label, placeholder, type }) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-sm text-foreground">{label}</Label>
              <div className="flex gap-2">
                {type === 'password' ? (
                  <div className="relative flex-1">
                    <Input
                      type={showMikrotikPwd ? 'text' : 'password'}
                      placeholder={placeholder}
                      value={settings[key] ?? ''}
                      onChange={e => handleChange(key, e.target.value)}
                      disabled={loading}
                      className="bg-muted border-input text-foreground placeholder:text-muted-foreground pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowMikrotikPwd(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showMikrotikPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                ) : (
                  <Input
                    placeholder={placeholder}
                    value={settings[key] ?? ''}
                    onChange={e => handleChange(key, e.target.value)}
                    disabled={loading}
                    className="flex-1 bg-muted border-input text-foreground placeholder:text-muted-foreground"
                  />
                )}
                <SaveBtn fieldKey={key} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* MikroTik Relay — Live Voucher Sync */}
      <Card className="bg-card border-border border-primary/20">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2 text-base text-foreground">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
                <Server className="h-3.5 w-3.5 text-primary" />
              </div>
              MikroTik Relay (Live Voucher Sync)
            </CardTitle>
            <Badge variant="outline" className="text-[10px] px-2 border-primary/40 text-primary">Approach B</Badge>
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            The relay is a small Node.js server running on your VPS or Raspberry Pi that bridges this platform to your MikroTik L009 in real time.
            Download <span className="text-foreground font-medium">mikrotik-relay</span> from the source code ZIP and run it on your relay device.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Relay URL */}
          <div className="space-y-1.5">
            <Label className="text-sm text-foreground">
              Relay URL <span className="text-muted-foreground text-xs font-normal">(public HTTPS URL of your relay server)</span>
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="https://your-vps.example.com:3000"
                value={settings['mikrotik_relay_url'] ?? ''}
                onChange={e => handleChange('mikrotik_relay_url', e.target.value)}
                disabled={loading}
                className="flex-1 bg-muted border-input text-foreground placeholder:text-muted-foreground font-mono text-sm"
              />
              <SaveBtn fieldKey="mikrotik_relay_url" />
            </div>
            <p className="text-[11px] text-muted-foreground">
              If using Cloudflare Tunnel: <span className="text-foreground">https://your-name.trycloudflare.com</span>
            </p>
          </div>

          {/* Relay Secret */}
          <div className="space-y-1.5">
            <Label className="text-sm text-foreground">
              Relay Secret Key <span className="text-muted-foreground text-xs font-normal">(must match RELAY_SECRET in relay .env)</span>
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showMikrotikPwd ? 'text' : 'password'}
                  placeholder="a long random secret string"
                  value={settings['mikrotik_relay_secret'] ?? ''}
                  onChange={e => handleChange('mikrotik_relay_secret', e.target.value)}
                  disabled={loading}
                  className="bg-muted border-input text-foreground placeholder:text-muted-foreground font-mono text-sm pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowMikrotikPwd(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showMikrotikPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <SaveBtn fieldKey="mikrotik_relay_secret" />
            </div>
          </div>

          {/* How it works info box */}
          <div className="rounded-lg bg-muted/60 border border-border p-3 space-y-1.5 text-[11px] text-muted-foreground">
            <p className="text-foreground font-medium text-xs">How live sync works:</p>
            <p>1. Customer enters a voucher code on the portal.</p>
            <p>2. Platform checks its own DB first (platform-generated vouchers).</p>
            <p>3. If not found → queries MikroTik via this relay in real time.</p>
            <p>4. If the code exists on the router → activates the user's session and records it here.</p>
            <p>5. If relay is offline → falls back to "invalid code" gracefully.</p>
          </div>
        </CardContent>
      </Card>

      {/* Admin Account */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base text-foreground">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
              <User className="h-3.5 w-3.5 text-primary" />
            </div>
            Admin Account
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Change your admin username or password. You'll be logged out after saving.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* New Username */}
          <div className="space-y-1.5">
            <Label className="text-sm text-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> New Username
            </Label>
            <Input
              placeholder="Leave blank to keep current"
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
              className="bg-muted border-input text-foreground placeholder:text-muted-foreground"
            />
            <p className="text-[11px] text-muted-foreground">Current username: <span className="text-foreground">admin</span></p>
          </div>

          <Separator className="bg-border" />

          {/* New Password */}
          <div className="space-y-1.5">
            <Label className="text-sm text-foreground flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" /> New Password
            </Label>
            <div className="relative">
              <Input
                type={showNewPwd ? 'text' : 'password'}
                placeholder="Leave blank to keep current"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="bg-muted border-input text-foreground placeholder:text-muted-foreground pr-9"
              />
              <button
                type="button"
                onClick={() => setShowNewPwd(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <Label className="text-sm text-foreground">Confirm New Password</Label>
            <Input
              type="password"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="bg-muted border-input text-foreground placeholder:text-muted-foreground"
            />
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-[11px] text-destructive">Passwords do not match</p>
            )}
          </div>

          <Button
            onClick={handleSaveCredentials}
            disabled={savingCreds || (!newUsername && !newPassword)}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-600"
          >
            {savingCreds
              ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground mr-2" />Saving...</>
              : <><Save className="h-4 w-4 mr-2" />Update Credentials</>}
          </Button>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-muted/50 border-border">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Settings className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p><span className="text-foreground font-500">Paystack Keys:</span> Log into dashboard.paystack.com → Settings → API Keys & Webhooks to copy your live keys.</p>
              <p><span className="text-foreground font-500">Webhook:</span> Copy the Webhook URL above and paste it into Paystack's "Live Webhook URL" field so payments auto-confirm.</p>
              <p><span className="text-foreground font-500">MikroTik:</span> Ensure the router API port (8728) is open and accessible from this server.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
