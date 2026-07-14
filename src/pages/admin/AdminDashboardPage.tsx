import React, { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Users, CreditCard, Wifi, DollarSign,
  RefreshCw, Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  fetchSystemStats, fetchRevenueData, fetchPaymentMethodBreakdown,
  fetchTopPackages, fetchRecentPayments,
} from '@/lib/api';
import type { SystemStats, RevenueDataPoint, PaymentMethodBreakdown, TopPackage, Payment } from '@/types/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function formatNGN(n: number) {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(1)}K`;
  return `₦${n.toLocaleString('en-NG')}`;
}

const PIE_COLORS = ['hsl(24,95%,48%)', 'hsl(220,65%,54%)', 'hsl(142,70%,45%)', 'hsl(280,65%,60%)'];

const METHOD_LABELS: Record<string, string> = {
  card: 'Card', bank_transfer: 'Bank Transfer', ussd: 'USSD', voucher: 'Voucher',
};

function KpiCard({
  icon: Icon, label, value, change, color,
}: {
  icon: React.ElementType; label: string; value: string; change?: number; color: string;
}) {
  const up = (change ?? 0) >= 0;
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', color)}>
            <Icon className="h-4 w-4" />
          </div>
          {change !== undefined && (
            <span className={cn('flex items-center gap-0.5 text-xs font-600', up ? 'text-green-400' : 'text-destructive')}>
              {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(change)}%
            </span>
          )}
        </div>
        <p className="text-2xl font-800 text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
  const [methodBreakdown, setMethodBreakdown] = useState<PaymentMethodBreakdown[]>([]);
  const [topPackages, setTopPackages] = useState<TopPackage[]>([]);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [revDays, setRevDays] = useState('30');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r, m, t, p] = await Promise.all([
        fetchSystemStats(),
        fetchRevenueData(parseInt(revDays)),
        fetchPaymentMethodBreakdown(),
        fetchTopPackages(),
        fetchRecentPayments(8),
      ]);
      setStats(s);
      setRevenueData(r);
      setMethodBreakdown(m);
      setTopPackages(t);
      setRecentPayments(p);
    } catch {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [revDays]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const Skeleton = ({ className }: { className?: string }) => (
    <div className={cn('animate-pulse rounded-lg bg-muted', className)} />
  );

  return (
    <div className="space-y-6 max-w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-800 text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Revenue & performance overview</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadAll}
          disabled={loading}
          className="shrink-0 border-border text-muted-foreground hover:text-foreground w-fit"
        >
          <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard icon={DollarSign} label="Revenue (this month)" value={formatNGN(stats?.total_revenue ?? 0)} change={stats?.revenue_change_pct} color="bg-primary/15 text-primary" />
            <KpiCard icon={CreditCard} label="Transactions" value={(stats?.total_transactions ?? 0).toLocaleString()} color="bg-accent/15 text-accent" />
            <KpiCard icon={Users} label="Active Users" value={(stats?.active_users ?? 0).toLocaleString()} color="bg-green-500/15 text-green-400" />
            <KpiCard icon={Wifi} label="Active Sessions" value={(stats?.active_sessions ?? 0).toLocaleString()} color="bg-purple-500/15 text-purple-400" />
          </>
        )}
      </div>

      {/* Revenue Charts */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Bar Chart */}
        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base text-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" /> Revenue Trend
              </CardTitle>
              <Select value={revDays} onValueChange={setRevDays}>
                <SelectTrigger className="w-28 h-8 text-xs bg-muted border-input text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="pr-2">
            {loading ? (
              <Skeleton className="h-52" />
            ) : revenueData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">No revenue data yet</div>
            ) : (
              <div className="w-full min-w-0 overflow-hidden">
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={revenueData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(220,6%,55%)' }} tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(220,6%,55%)' }} tickFormatter={v => `₦${(v / 1000).toFixed(0)}K`} width={48} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(222,10%,15%)', border: '1px solid hsl(220,7%,22%)', borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => [`₦${v.toLocaleString('en-NG')}`, 'Revenue']}
                    />
                    <Bar dataKey="revenue" fill="hsl(24,95%,48%)" radius={[3, 3, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Method Pie */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-foreground">Payment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48" />
            ) : methodBreakdown.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
            ) : (
              <div className="w-full min-w-0 overflow-hidden">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={methodBreakdown} dataKey="count" nameKey="method" cx="50%" cy="45%" outerRadius={65} label={false}>
                      {methodBreakdown.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend
                      layout="horizontal"
                      formatter={(value) => METHOD_LABELS[value] ?? value}
                      wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    />
                    <Tooltip
                      contentStyle={{ background: 'hsl(222,10%,15%)', border: '1px solid hsl(220,7%,22%)', borderRadius: 8, fontSize: 12 }}
                      formatter={(v, name) => [v, METHOD_LABELS[name as string] ?? name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Transactions Line Chart */}
        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-foreground">Transaction Volume</CardTitle>
          </CardHeader>
          <CardContent className="pr-2">
            {loading ? (
              <Skeleton className="h-44" />
            ) : revenueData.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-muted-foreground text-sm">No transaction data yet</div>
            ) : (
              <div className="w-full min-w-0 overflow-hidden">
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={revenueData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(220,6%,55%)' }} tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(220,6%,55%)' }} width={32} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(222,10%,15%)', border: '1px solid hsl(220,7%,22%)', borderRadius: 8, fontSize: 12 }}
                    />
                    <Line type="monotone" dataKey="transactions" stroke="hsl(220,65%,54%)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Packages */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-foreground">Top Packages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              [...Array(4)].map((_, i) => <Skeleton key={i} className="h-8" />)
            ) : topPackages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No package data yet</p>
            ) : (
              topPackages.map((pkg, i) => {
                const maxCount = topPackages[0]?.count ?? 1;
                const pct = Math.round((pkg.count / maxCount) * 100);
                return (
                  <div key={pkg.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-500 text-foreground truncate">{pkg.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">{pkg.count} sales</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-foreground">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap">
              <thead>
                <tr className="border-b border-border">
                  {['Date', 'Phone', 'Package', 'Amount', 'Method', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-600 text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {[...Array(6)].map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 w-20 rounded bg-muted animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : recentPayments.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">No transactions yet</td></tr>
                ) : (
                  recentPayments.map(p => (
                    <tr key={p.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString('en-NG')}</td>
                      <td className="px-4 py-3 text-xs text-foreground font-mono">{p.phone}</td>
                      <td className="px-4 py-3 text-xs text-foreground">{p.package_name}</td>
                      <td className="px-4 py-3 text-xs text-primary font-700">₦{p.amount_ngn.toLocaleString('en-NG')}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{METHOD_LABELS[p.payment_method] ?? p.payment_method}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-600',
                          p.status === 'completed' ? 'bg-green-500/15 text-green-400' :
                          p.status === 'pending' ? 'bg-yellow-500/15 text-yellow-400' :
                          'bg-destructive/15 text-destructive'
                        )}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
