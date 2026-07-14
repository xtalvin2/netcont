import React, { useEffect, useState, useCallback } from 'react';
import { Search, Filter, RefreshCw, Download, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { fetchPayments } from '@/lib/api';
import type { Payment } from '@/types/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STATUS_BADGE: Record<string, string> = {
  completed: 'bg-green-500/15 text-green-400',
  pending:   'bg-yellow-500/15 text-yellow-400',
  failed:    'bg-destructive/15 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
};

const METHOD_LABELS: Record<string, string> = {
  card: 'Card', bank_transfer: 'Bank Transfer', ussd: 'USSD', voucher: 'Voucher',
};

function exportCSV(payments: Payment[]) {
  const headers = ['Date', 'Transaction ID', 'Phone', 'Package', 'Amount (NGN)', 'Method', 'Status'];
  const rows = payments.map(p => [
    new Date(p.created_at).toLocaleString('en-NG'),
    p.transaction_id,
    p.phone,
    p.package_name,
    p.amount_ngn,
    METHOD_LABELS[p.payment_method] ?? p.payment_method,
    p.status,
  ]);
  const csv = [headers, ...rows].map(r => r.map(String).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payments_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, count } = await fetchPayments(
        search,
        statusFilter === 'all' ? '' : statusFilter,
        methodFilter === 'all' ? '' : methodFilter,
        page,
        PAGE_SIZE,
      );
      setPayments(data);
      setTotal(count);
    } catch {
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, methodFilter, page]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const Skeleton = () => (
    <tr className="border-b border-border/30">
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-muted animate-pulse" style={{ width: `${40 + (i * 11) % 40}%` }} />
        </td>
      ))}
    </tr>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-800 text-foreground">Payments</h1>
          <p className="text-sm text-muted-foreground">{total.toLocaleString()} total transactions</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => exportCSV(payments)} disabled={payments.length === 0} className="border-border text-muted-foreground hover:text-foreground">
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="border-border text-muted-foreground hover:text-foreground">
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} /> Refresh
          </Button>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search phone or transaction ID..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
                className="pl-9 bg-muted border-input text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="w-36 bg-muted border-input text-foreground">
                <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={methodFilter} onValueChange={v => { setMethodFilter(v); setPage(0); }}>
              <SelectTrigger className="w-40 bg-muted border-input text-foreground">
                <CreditCard className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="ussd">USSD</SelectItem>
                <SelectItem value="voucher">Voucher</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap">
              <thead>
                <tr className="border-b border-border">
                  {['Date', 'Phone', 'Package', 'Amount', 'Method', 'Ref', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-600 text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? [...Array(10)].map((_, i) => <Skeleton key={i} />)
                  : payments.length === 0
                    ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                          No transactions found
                        </td>
                      </tr>
                    )
                    : payments.map(p => (
                      <tr key={p.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString('en-NG')}</td>
                        <td className="px-4 py-3 text-xs text-foreground font-mono">{p.phone}</td>
                        <td className="px-4 py-3 text-xs text-foreground">{p.package_name}</td>
                        <td className="px-4 py-3 text-xs text-primary font-700">₦{p.amount_ngn.toLocaleString('en-NG')}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{METHOD_LABELS[p.payment_method] ?? p.payment_method}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground font-mono max-w-[120px] truncate">{p.paystack_ref ?? p.transaction_id.slice(0, 12) + '...'}</td>
                        <td className="px-4 py-3">
                          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-600', STATUS_BADGE[p.status] ?? 'bg-muted text-muted-foreground')}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>

          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="border-border text-muted-foreground">Previous</Button>
                <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)} className="border-border text-muted-foreground">Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
