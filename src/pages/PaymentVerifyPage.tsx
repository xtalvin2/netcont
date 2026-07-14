import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock, Loader2, Wifi, ArrowRight, Home, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/db/supabase';

type VerifyStatus = 'loading' | 'success' | 'failed' | 'pending';

interface SessionInfo {
  packageName: string;
  durationHours: number;
  amountNgn: number;
  expiresAt: string;
  phone: string;
}

export default function PaymentVerifyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const reference = searchParams.get('ref') || searchParams.get('reference') || searchParams.get('trxref');

  const [status, setStatus] = useState<VerifyStatus>('loading');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (!reference) {
      setStatus('failed');
      setErrorMsg('No payment reference found. Please try again.');
      return;
    }
    verifyPayment();
  }, [reference]);

  // Auto-redirect to home on success
  useEffect(() => {
    if (status !== 'success') return;
    if (countdown <= 0) { navigate('/'); return; }
    const t = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [status, countdown, navigate]);

  async function verifyPayment() {
    setStatus('loading');
    try {
      // Look up the payment record by reference in the DB
      const { data: payment, error } = await supabase
        .from('payments')
        .select('*, packages:package_id(name, duration_hours, speed_mbps)')
        .or(`paystack_ref.eq.${reference},transaction_id.eq.${reference}`)
        .maybeSingle();

      if (error) throw error;

      if (!payment) {
        setStatus('pending');
        setErrorMsg('Payment record not found yet. This can take a moment.');
        return;
      }

      if (payment.status === 'completed') {
        const pkg = payment.packages as { name: string; duration_hours: number } | null;
        setSession({
          packageName: payment.package_name ?? pkg?.name ?? 'WiFi Access',
          durationHours: pkg?.duration_hours ?? 0,
          amountNgn: payment.amount_ngn,
          expiresAt: payment.expires_at ?? '',
          phone: payment.phone,
        });
        setStatus('success');
      } else if (payment.status === 'failed' || payment.status === 'cancelled') {
        setStatus('failed');
        setErrorMsg('Payment was not completed. You have not been charged.');
      } else {
        // Still pending — webhook may not have fired yet
        setStatus('pending');
        setErrorMsg('Your payment is being confirmed. Please wait a moment and refresh.');
      }
    } catch {
      setStatus('failed');
      setErrorMsg('Unable to verify payment status. Please contact support.');
    }
  }

  function formatExpiry(iso: string) {
    if (!iso) return 'N/A';
    const d = new Date(iso);
    return d.toLocaleString('en-NG', {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  }

  function formatNaira(n: number) {
    return `₦${n.toLocaleString('en-NG')}`;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Header bar */}
      <div className="w-full max-w-md mb-6 flex items-center gap-2">
        <Wifi className="h-6 w-6 text-primary shrink-0" />
        <span className="font-bold text-lg text-foreground">NetConnect</span>
      </div>

      <div className="w-full max-w-md">
        {/* ── LOADING ── */}
        {status === 'loading' && (
          <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-4 text-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Verifying Payment…</h1>
            <p className="text-muted-foreground text-sm">Checking your transaction with Paystack. Please wait.</p>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {status === 'success' && session && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {/* Green banner */}
            <div className="bg-green-600/90 px-6 py-5 flex flex-col items-center gap-2 text-center">
              <CheckCircle2 className="h-12 w-12 text-white" />
              <h1 className="text-2xl font-bold text-white">Payment Successful!</h1>
              <p className="text-green-100 text-sm">Your internet access is now active</p>
            </div>

            {/* Session details */}
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted rounded-xl p-3">
                  <p className="text-muted-foreground text-xs mb-1">Package</p>
                  <p className="font-semibold text-foreground text-sm">{session.packageName}</p>
                </div>
                <div className="bg-muted rounded-xl p-3">
                  <p className="text-muted-foreground text-xs mb-1">Duration</p>
                  <p className="font-semibold text-foreground text-sm">
                    {session.durationHours >= 24
                      ? `${session.durationHours / 24} day${session.durationHours / 24 > 1 ? 's' : ''}`
                      : `${session.durationHours} hour${session.durationHours > 1 ? 's' : ''}`}
                  </p>
                </div>
                <div className="bg-muted rounded-xl p-3">
                  <p className="text-muted-foreground text-xs mb-1">Amount Paid</p>
                  <p className="font-semibold text-primary text-sm">{formatNaira(session.amountNgn)}</p>
                </div>
                <div className="bg-muted rounded-xl p-3">
                  <p className="text-muted-foreground text-xs mb-1">Phone</p>
                  <p className="font-semibold text-foreground text-sm">{session.phone}</p>
                </div>
              </div>

              {session.expiresAt && (
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-start gap-2">
                  <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Access expires</p>
                    <p className="text-sm font-semibold text-foreground">{formatExpiry(session.expiresAt)}</p>
                  </div>
                </div>
              )}

              <div className="bg-muted rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground">Reference</p>
                <p className="text-xs font-mono text-foreground mt-0.5 break-all">{reference}</p>
              </div>

              <Button
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                onClick={() => navigate('/')}
              >
                <Home className="h-4 w-4 mr-2" />
                Back to Portal
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Redirecting to home in <span className="text-primary font-semibold">{countdown}s</span>
              </p>
            </div>
          </div>
        )}

        {/* ── PENDING ── */}
        {status === 'pending' && (
          <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-4 text-center">
            <div className="h-16 w-16 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Payment Pending</h1>
            <p className="text-muted-foreground text-sm">{errorMsg}</p>
            {reference && (
              <p className="text-xs text-muted-foreground font-mono break-all bg-muted px-3 py-2 rounded-lg w-full">
                Ref: {reference}
              </p>
            )}
            <div className="flex flex-col gap-2 w-full">
              <Button
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={verifyPayment}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Check Again
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground border border-border hover:bg-muted"
                onClick={() => navigate('/')}
              >
                <Home className="h-4 w-4 mr-2" />
                Back to Portal
              </Button>
            </div>
          </div>
        )}

        {/* ── FAILED ── */}
        {status === 'failed' && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {/* Red banner */}
            <div className="bg-red-600/90 px-6 py-5 flex flex-col items-center gap-2 text-center">
              <XCircle className="h-12 w-12 text-white" />
              <h1 className="text-2xl font-bold text-white">Payment Failed</h1>
              <p className="text-red-100 text-sm">Your payment could not be completed</p>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <p className="text-sm text-foreground">{errorMsg}</p>
              </div>

              {reference && (
                <div className="bg-muted rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground">Reference</p>
                  <p className="text-xs font-mono text-foreground mt-0.5 break-all">{reference}</p>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Button
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                  onClick={() => navigate('/')}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground border border-border hover:bg-muted"
                  onClick={() => navigate('/support')}
                >
                  Contact Support
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
