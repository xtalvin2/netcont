import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, Zap, Phone, Package, CheckCircle, XCircle, Clock, Ticket, AlertCircle, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PublicLayout } from '@/components/layouts/PublicLayout';
import { fetchPackages, redeemVoucher, retryActivation } from '@/lib/api';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import type { Package as PkgType } from '@/types/types';
import { cn } from '@/lib/utils';
import AdBanner from '@/components/portal/AdBanner';

const LS_PHONE = 'nc_pay_phone';
const LS_EMAIL = 'nc_pay_email';

function formatNGN(amount: number) {
  return `₦${amount.toLocaleString('en-NG')}`;
}

function validateNigerianPhone(phone: string) {
  return /^(0[7-9][01]\d{8})$/.test(phone);
}

const PKG_COLORS: Record<number, string> = {
  0: 'border-yellow-500/40 hover:border-yellow-500',
  1: 'border-green-500/40 hover:border-green-500',
  2: 'border-accent/40 hover:border-accent',
  3: 'border-primary/40 hover:border-primary',
};

type PayStatus = 'pending' | 'completed' | 'failed' | '';
type RedeemState = 'idle' | 'loading' | 'success' | 'error';

type RetryState = 'idle' | 'loading' | 'success' | 'already_active' | 'error';

export default function HomePage() {
  // Payment state — pre-fill from localStorage
  const [phone, setPhone] = useState(() => localStorage.getItem(LS_PHONE) ?? '');
  const [email, setEmail] = useState(() => localStorage.getItem(LS_EMAIL) ?? '');
  const [packages, setPackages] = useState<PkgType[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<PkgType | null>(null);
  const [macAddress, setMacAddress] = useState('XX:XX:XX:XX:XX:XX');
  const [payStatus, setPayStatus] = useState<PayStatus>('');
  const [isPayLoading, setIsPayLoading] = useState(false);

  // Voucher state
  const [voucherCode, setVoucherCode] = useState('');
  const [redeemState, setRedeemState] = useState<RedeemState>('idle');
  const [redeemResult, setRedeemResult] = useState<{ message: string; expires_at?: string } | null>(null);

  // Already paid / retry state
  const [retryPhone, setRetryPhone] = useState('');
  const [retryState, setRetryState] = useState<RetryState>('idle');
  const [retryResult, setRetryResult] = useState<{ message: string; expires_at?: string } | null>(null);

  // Persist phone & email whenever they change
  const handlePhoneChange = (val: string) => {
    setPhone(val);
    localStorage.setItem(LS_PHONE, val);
  };
  const handleEmailChange = (val: string) => {
    setEmail(val);
    localStorage.setItem(LS_EMAIL, val);
  };

  useEffect(() => {
    fetchPackages().then(pkgs => {
      setPackages(pkgs);
      setSelectedPkg(pkgs.find(p => p.is_popular) ?? pkgs[pkgs.length - 1] ?? null);
    }).catch(() => toast.error('Failed to load packages'));

    const urlParams = new URLSearchParams(window.location.search);
    const mac = urlParams.get('mac') ?? urlParams.get('macAddress') ?? 'XX:XX:XX:XX:XX:XX';
    setMacAddress(mac);
  }, []);

  const handlePayment = useCallback(async () => {
    if (!validateNigerianPhone(phone)) {
      toast.error('Invalid phone number', { description: 'Enter a valid 11-digit Nigerian number (e.g. 08012345678)' });
      return;
    }
    if (!selectedPkg) { toast.error('Please select a package'); return; }
    if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      toast.error('Valid email required', { description: 'Paystack requires an email to process payment' });
      return;
    }
    setIsPayLoading(true);
    setPayStatus('pending');
    toast.loading('Initiating Paystack payment...', { id: 'pay' });
    try {
      const { data, error } = await supabase.functions.invoke('paystack-payment', {
        body: { phone, email, amount_ngn: selectedPkg.price_ngn, package_id: selectedPkg.id, mac_address: macAddress },
        method: 'POST',
      });
      if (error) { const msg = await error.context?.text?.(); throw new Error(msg || error.message); }
      toast.dismiss('pay');
      if (data?.authorization_url) {
        toast.success('Redirecting to Paystack...', { duration: 2000 });
        setTimeout(() => { window.location.href = data.authorization_url; }, 1000);
      } else { throw new Error('No payment URL returned'); }
    } catch (err) {
      setPayStatus('failed');
      toast.dismiss('pay');
      toast.error('Payment failed', { description: err instanceof Error ? err.message : 'Please try again' });
    } finally { setIsPayLoading(false); }
  }, [phone, email, selectedPkg, macAddress]);

  const handleRedeem = async () => {
    if (!voucherCode.trim() || voucherCode.trim().length < 4) {
      toast.error('Please enter a valid voucher code'); return;
    }
    setRedeemState('loading');
    try {
      const res = await redeemVoucher(voucherCode.trim().toUpperCase(), '', macAddress);
      if (res.success) {
        setRedeemState('success');
        setRedeemResult({ message: res.message, expires_at: res.expires_at });
        toast.success('Voucher redeemed!');
      } else {
        setRedeemState('error');
        setRedeemResult({ message: res.message });
        toast.error('Redemption failed', { description: res.message });
      }
    } catch (err) {
      setRedeemState('error');
      setRedeemResult({ message: err instanceof Error ? err.message : 'An error occurred. Please try again.' });
    }
  };

  const resetRedeem = () => { setRedeemState('idle'); setRedeemResult(null); setVoucherCode(''); };

  // Already Paid — reconnect handler
  const handleRetryActivation = async () => {
    if (!retryPhone.trim() || retryPhone.trim().length < 10) {
      toast.error('Enter your 11-digit phone number'); return;
    }
    setRetryState('loading');
    try {
      const res = await retryActivation(retryPhone.trim(), macAddress);
      if (res.success) {
        setRetryState(res.already_active ? 'already_active' : 'success');
        setRetryResult({ message: res.message, expires_at: res.expires_at });
        toast.success(res.already_active ? 'Session is active!' : 'Access granted!');
      } else {
        setRetryState('error');
        setRetryResult({ message: res.message });
        toast.error('Could not reconnect', { description: res.message });
      }
    } catch (err) {
      setRetryState('error');
      setRetryResult({ message: err instanceof Error ? err.message : 'An error occurred. Please try again.' });
    }
  };

  const resetRetry = () => { setRetryState('idle'); setRetryResult(null); };

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-6 max-w-lg space-y-5">

        {/* ── 1. VOUCHER SECTION (TOP — most prominent) ── */}
        <Card className="bg-card border-primary/30 shadow-md">
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="flex items-center gap-2 text-foreground text-base">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Ticket className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-700 text-foreground leading-tight">Have a Voucher?</p>
                <p className="text-xs font-400 text-muted-foreground leading-tight">Enter your code to get instant access</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {redeemState === 'success' ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-4 py-2">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15">
                  <CheckCircle className="h-7 w-7 text-green-400" />
                </div>
                <div>
                  <p className="text-base font-700 text-foreground">You're Connected!</p>
                  <p className="text-sm text-muted-foreground mt-1">{redeemResult?.message}</p>
                </div>
                {redeemResult?.expires_at && (
                  <div className="flex items-center justify-center gap-2 bg-muted rounded-lg px-4 py-2 text-sm text-foreground">
                    <Clock className="h-4 w-4 text-primary" />
                    Expires: {new Date(redeemResult.expires_at).toLocaleString('en-NG')}
                  </div>
                )}
                <div className="flex items-center justify-center gap-2 text-sm text-green-400">
                  <Wifi className="h-4 w-4" /> Internet access granted!
                </div>
                <Button variant="outline" size="sm" onClick={resetRedeem} className="border-border text-muted-foreground">
                  Redeem Another
                </Button>
              </motion.div>
            ) : redeemState === 'error' ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4 py-2">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15">
                  <AlertCircle className="h-7 w-7 text-destructive" />
                </div>
                <p className="text-sm text-muted-foreground">{redeemResult?.message}</p>
                <Button variant="outline" size="sm" onClick={resetRedeem} className="border-border text-muted-foreground">Try Again</Button>
              </motion.div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Enter voucher code e.g. ABCD12345"
                  value={voucherCode}
                  onChange={e => setVoucherCode(e.target.value.toUpperCase())}
                  className="flex-1 bg-muted border-input text-foreground placeholder:text-muted-foreground font-mono tracking-widest uppercase"
                  maxLength={20}
                  onKeyDown={e => e.key === 'Enter' && handleRedeem()}
                />
                <Button
                  onClick={handleRedeem}
                  disabled={redeemState === 'loading' || !voucherCode}
                  className="shrink-0 bg-primary text-primary-foreground font-700 hover:bg-primary/90 px-5"
                >
                  {redeemState === 'loading' ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                  ) : (
                    'Redeem'
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── 2. ADVERTISEMENT BANNER (MIDDLE) ── */}
        <AdBanner />

        {/* ── Divider ── */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground px-2">or buy access online</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* ── 3. PAYMENT SECTION ── */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-foreground text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
                <Zap className="h-3.5 w-3.5 text-primary" />
              </div>
              Buy Access — Pay with Paystack
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Phone — above packages */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-foreground text-sm">
                <Phone className="h-3.5 w-3.5" /> Phone Number
              </Label>
              <Input
                type="tel"
                placeholder="08012345678"
                value={phone}
                onChange={e => handlePhoneChange(e.target.value)}
                maxLength={11}
                className="bg-muted border-input text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {/* Email — above packages */}
            <div className="space-y-1.5">
              <Label className="text-foreground text-sm">Email (for receipt)</Label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => handleEmailChange(e.target.value)}
                className="bg-muted border-input text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {/* Package Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-foreground text-sm">
                <Package className="h-3.5 w-3.5" /> Select Package
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {packages.map((pkg, i) => (
                  <button
                    key={pkg.id}
                    onClick={() => setSelectedPkg(pkg)}
                    className={cn(
                      'relative rounded-lg border p-3 text-left transition-all duration-150',
                      'bg-muted hover:bg-muted/70',
                      PKG_COLORS[i % 4],
                      selectedPkg?.id === pkg.id ? 'ring-2 ring-primary border-primary' : ''
                    )}
                  >
                    {pkg.is_popular && (
                      <Badge className="absolute -top-2 left-2 text-[10px] px-1.5 py-0 bg-primary text-primary-foreground">Popular</Badge>
                    )}
                    <p className="text-xs font-600 text-foreground">{pkg.name}</p>
                    <p className="text-lg font-800 text-primary">{formatNGN(pkg.price_ngn)}</p>
                    <p className="text-xs text-muted-foreground">{pkg.duration_hours}hrs · {pkg.speed_mbps}Mbps</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Pay Button */}
            <Button
              onClick={handlePayment}
              disabled={isPayLoading || !phone || !email || !selectedPkg}
              className="w-full h-11 bg-primary text-primary-foreground font-700 hover:bg-primary/90"
            >
              {isPayLoading ? (
                <><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground mr-2" />Processing...</>
              ) : (
                <><Zap className="h-4 w-4 mr-2" />Pay {selectedPkg ? formatNGN(selectedPkg.price_ngn) : ''} with Paystack</>
              )}
            </Button>

            {/* Status feedback */}
            {payStatus === 'pending' && (
              <div className="flex items-center gap-2 text-sm text-yellow-400">
                <Clock className="h-4 w-4" /> Awaiting payment...
              </div>
            )}
            {payStatus === 'completed' && (
              <div className="flex items-center gap-2 text-sm text-green-400">
                <CheckCircle className="h-4 w-4" /> Payment confirmed!
              </div>
            )}
            {payStatus === 'failed' && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <XCircle className="h-4 w-4" /> Payment failed. Please try again.
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── 4. ALREADY PAID? — very bottom ── */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="flex items-center gap-2 text-foreground text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
                <RefreshCw className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-700 text-foreground leading-tight">Already Paid but Not Connected?</p>
                <p className="text-xs font-400 text-muted-foreground leading-tight">Enter your phone number to reconnect</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {retryState === 'success' && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-3 py-1">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-500/15">
                  <Wifi className="h-6 w-6 text-green-400" />
                </div>
                <p className="text-sm font-600 text-foreground">{retryResult?.message}</p>
                {retryResult?.expires_at && (
                  <div className="flex items-center justify-center gap-2 bg-muted rounded-lg px-3 py-2 text-xs text-foreground">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    Expires: {new Date(retryResult.expires_at).toLocaleString('en-NG')}
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={resetRetry} className="border-border text-muted-foreground text-xs">
                  Try Again
                </Button>
              </motion.div>
            )}
            {retryState === 'already_active' && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-3 py-1">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
                  <CheckCircle className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-600 text-foreground">{retryResult?.message}</p>
                {retryResult?.expires_at && (
                  <div className="flex items-center justify-center gap-2 bg-muted rounded-lg px-3 py-2 text-xs text-foreground">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    Active until: {new Date(retryResult.expires_at).toLocaleString('en-NG')}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Turn WiFi off and on again if you still can't browse.</p>
                <Button variant="outline" size="sm" onClick={resetRetry} className="border-border text-muted-foreground text-xs">
                  Done
                </Button>
              </motion.div>
            )}
            {retryState === 'error' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-3 py-1">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
                <p className="text-sm text-muted-foreground">{retryResult?.message}</p>
                <Button variant="outline" size="sm" onClick={resetRetry} className="border-border text-muted-foreground text-xs">
                  Try Again
                </Button>
              </motion.div>
            )}
            {(retryState === 'idle' || retryState === 'loading') && (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    type="tel"
                    placeholder="08012345678"
                    value={retryPhone}
                    onChange={e => setRetryPhone(e.target.value)}
                    maxLength={11}
                    className="pl-8 bg-muted border-input text-foreground placeholder:text-muted-foreground"
                    onKeyDown={e => e.key === 'Enter' && handleRetryActivation()}
                  />
                </div>
                <Button
                  onClick={handleRetryActivation}
                  disabled={retryState === 'loading' || !retryPhone}
                  variant="outline"
                  className="shrink-0 border-primary text-primary hover:bg-primary hover:text-primary-foreground font-600"
                >
                  {retryState === 'loading' ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                  ) : (
                    <><RefreshCw className="h-3.5 w-3.5 mr-1" />Reconnect</>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
