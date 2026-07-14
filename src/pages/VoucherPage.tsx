import React, { useState } from 'react';
import { Ticket, CheckCircle, AlertCircle, Wifi, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PublicLayout } from '@/components/layouts/PublicLayout';
import { redeemVoucher } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function validateNigerianPhone(phone: string) {
  return /^(0[7-9][01]\d{8})$/.test(phone);
}

type RedeemState = 'idle' | 'loading' | 'success' | 'error';

export default function VoucherPage() {
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState<RedeemState>('idle');
  const [result, setResult] = useState<{ message: string; expires_at?: string } | null>(null);

  // MAC detection
  const urlParams = new URLSearchParams(window.location.search);
  const macAddress = urlParams.get('mac') ?? urlParams.get('macAddress') ?? 'XX:XX:XX:XX:XX:XX';

  const handleRedeem = async () => {
    if (!code.trim() || code.trim().length < 4) {
      toast.error('Please enter a valid voucher code');
      return;
    }
    if (!validateNigerianPhone(phone)) {
      toast.error('Invalid phone number', { description: 'Enter an 11-digit Nigerian number (e.g. 08012345678)' });
      return;
    }

    setState('loading');
    try {
      const res = await redeemVoucher(code.trim().toUpperCase(), phone, macAddress);
      if (res.success) {
        setState('success');
        setResult({ message: res.message, expires_at: res.expires_at });
        toast.success('Voucher redeemed successfully!');
      } else {
        setState('error');
        setResult({ message: res.message });
        toast.error('Redemption failed', { description: res.message });
      }
    } catch (err) {
      setState('error');
      setResult({ message: err instanceof Error ? err.message : 'An error occurred. Please try again.' });
      toast.error('Error redeeming voucher');
    }
  };

  const handleReset = () => {
    setState('idle');
    setResult(null);
    setCode('');
    setPhone('');
  };

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-12 md:py-20 max-w-lg">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15">
              <Ticket className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-3xl font-800 text-foreground mb-2 text-balance">Redeem Voucher</h1>
            <p className="text-muted-foreground text-sm">Enter your voucher code to get instant internet access.</p>
          </div>

          <Card className="bg-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base text-foreground">Enter Your Voucher Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {state === 'success' ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center space-y-4 py-4"
                >
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15">
                    <CheckCircle className="h-8 w-8 text-green-400" />
                  </div>
                  <div>
                    <p className="text-lg font-700 text-foreground">You're Connected!</p>
                    <p className="text-sm text-muted-foreground mt-1">{result?.message}</p>
                  </div>
                  {result?.expires_at && (
                    <div className="flex items-center justify-center gap-2 bg-muted rounded-lg px-4 py-2 text-sm text-foreground">
                      <Clock className="h-4 w-4 text-primary" />
                      Expires: {new Date(result.expires_at).toLocaleString('en-NG')}
                    </div>
                  )}
                  <div className="flex items-center justify-center gap-2 text-sm text-green-400">
                    <Wifi className="h-4 w-4" />
                    Internet access granted — enjoy browsing!
                  </div>
                  <Button variant="outline" size="sm" onClick={handleReset} className="border-border text-muted-foreground">
                    Redeem Another Voucher
                  </Button>
                </motion.div>
              ) : state === 'error' ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center space-y-4 py-4"
                >
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/15">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                  </div>
                  <div>
                    <p className="text-lg font-700 text-foreground">Redemption Failed</p>
                    <p className="text-sm text-muted-foreground mt-1">{result?.message}</p>
                  </div>
                  <Button onClick={handleReset} className="bg-primary text-primary-foreground hover:bg-secondary">
                    Try Again
                  </Button>
                </motion.div>
              ) : (
                <>
                  {/* Voucher Code */}
                  <div className="space-y-1.5">
                    <Label className="text-foreground text-sm">Voucher Code</Label>
                    <Input
                      placeholder="e.g. ABC12XYZ"
                      value={code}
                      onChange={e => setCode(e.target.value.toUpperCase())}
                      className="bg-muted border-input text-foreground placeholder:text-muted-foreground font-mono tracking-widest text-center uppercase text-lg"
                      maxLength={16}
                    />
                  </div>

                  {/* Phone */}
                  <div className="space-y-1.5">
                    <Label className="text-foreground text-sm">Phone Number</Label>
                    <Input
                      type="tel"
                      placeholder="08012345678"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      maxLength={11}
                      className="bg-muted border-input text-foreground placeholder:text-muted-foreground"
                    />
                    <p className="text-xs text-muted-foreground">Nigerian number (080/081/090/070)</p>
                  </div>

                  {/* MAC */}
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Device MAC Address</p>
                    <p className="text-xs font-mono text-foreground mt-0.5">{macAddress}</p>
                  </div>

                  <Button
                    onClick={handleRedeem}
                    disabled={state === 'loading' || !code || !phone}
                    className="w-full bg-primary text-primary-foreground font-700 hover:bg-secondary h-11"
                  >
                    {state === 'loading' ? (
                      <><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground mr-2" />Verifying...</>
                    ) : (
                      <><Ticket className="h-4 w-4 mr-2" />Redeem Voucher</>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Instructions */}
          {state === 'idle' && (
            <Card className="mt-4 bg-card border-border">
              <CardContent className="p-4">
                <p className="text-xs font-600 text-foreground mb-2">How to use a voucher</p>
                <ol className="space-y-1.5">
                  {['Purchase a voucher from an authorized reseller', 'Enter the voucher code above', 'Enter your phone number', 'Click Redeem to get instant access'].map((step, i) => (
                    <li key={step} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="shrink-0 flex h-4 w-4 items-center justify-center rounded-full bg-primary/20 text-primary text-[10px] font-700 mt-0.5">{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </PublicLayout>
  );
}
