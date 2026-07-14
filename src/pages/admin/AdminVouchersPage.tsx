import React, { useEffect, useState, useCallback } from 'react';
import {
  Ticket, Plus, Download, RefreshCw, Search, Filter,
  Copy, CheckCircle, AlertCircle, Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { fetchVouchers, generateVouchers, fetchAllPackages } from '@/lib/api';
import type { Voucher, Package } from '@/types/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<string, { badge: string; icon: React.ElementType }> = {
  active:  { badge: 'bg-green-500/15 text-green-400',  icon: CheckCircle },
  used:    { badge: 'bg-muted text-muted-foreground',   icon: CheckCircle },
  expired: { badge: 'bg-destructive/15 text-destructive', icon: AlertCircle },
};

function formatNGN(n: number) { return `₦${n.toLocaleString('en-NG')}`; }

function exportVouchersCSV(vouchers: Voucher[]) {
  const headers = ['Code', 'Package', 'Validity (hrs)', 'Price (NGN)', 'Reseller Price (NGN)', 'Status', 'Created', 'Redeemed By', 'Redeemed At'];
  const rows = vouchers.map(v => [
    v.code, v.package_name, v.validity_hours, v.price_ngn,
    v.reseller_price_ngn ?? '', v.status,
    new Date(v.created_at).toLocaleString('en-NG'),
    v.redeemed_by_phone ?? '', v.redeemed_at ? new Date(v.redeemed_at).toLocaleString('en-NG') : '',
  ]);
  const csv = [headers, ...rows].map(r => r.map(String).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vouchers_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function GenerateDialog({ packages, onGenerated }: { packages: Package[]; onGenerated: () => void }) {
  const [open, setOpen] = useState(false);
  const [packageId, setPackageId] = useState('');
  const [quantity, setQuantity] = useState(10);
  const [price, setPrice] = useState('');
  const [resellerPrice, setResellerPrice] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedPkg = packages.find(p => p.id === packageId);

  useEffect(() => {
    if (selectedPkg) setPrice(String(selectedPkg.price_ngn));
  }, [selectedPkg]);

  const handleGenerate = async () => {
    if (!packageId) { toast.error('Select a package'); return; }
    if (!price || isNaN(Number(price)) || Number(price) <= 0) { toast.error('Enter a valid price'); return; }
    if (quantity < 1 || quantity > 500) { toast.error('Quantity must be 1–500'); return; }

    setLoading(true);
    try {
      const vouchers = await generateVouchers({
        package_id: packageId,
        quantity,
        price_ngn: Number(price),
        reseller_price_ngn: resellerPrice ? Number(resellerPrice) : undefined,
        expires_at: expiresAt || undefined,
      });
      toast.success(`${vouchers.length} vouchers generated!`);
      setOpen(false);
      onGenerated();
    } catch (err) {
      toast.error('Generation failed', { description: err instanceof Error ? err.message : 'Try again' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary text-primary-foreground font-700 hover:bg-secondary">
          <Plus className="h-4 w-4 mr-2" /> Generate Vouchers
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-[calc(100%-2rem)] md:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Ticket className="h-4 w-4 text-primary" /> Generate Voucher Codes
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-sm text-foreground">Package</Label>
            <Select value={packageId} onValueChange={setPackageId}>
              <SelectTrigger className="bg-muted border-input text-foreground">
                <SelectValue placeholder="Select package..." />
              </SelectTrigger>
              <SelectContent>
                {packages.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {p.duration_hours}hr · {formatNGN(p.price_ngn)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">Quantity</Label>
              <Input
                type="number"
                min={1}
                max={500}
                value={quantity}
                onChange={e => setQuantity(Number(e.target.value))}
                className="bg-muted border-input text-foreground"
              />
              <p className="text-[10px] text-muted-foreground">Max 500 at once</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">Price (₦)</Label>
              <Input
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="e.g. 1200"
                className="bg-muted border-input text-foreground"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">Reseller Price (₦) <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                type="number"
                value={resellerPrice}
                onChange={e => setResellerPrice(e.target.value)}
                placeholder="e.g. 1000"
                className="bg-muted border-input text-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">Expires On <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                type="date"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
                className="bg-muted border-input text-foreground"
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="border-border text-muted-foreground">Cancel</Button>
            <Button onClick={handleGenerate} disabled={loading} className="bg-primary text-primary-foreground font-700 hover:bg-secondary">
              {loading ? 'Generating...' : `Generate ${quantity} Voucher${quantity > 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminVouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [total, setTotal] = useState(0);
  const [packages, setPackages] = useState<Package[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data, count }, pkgs] = await Promise.all([
        fetchVouchers(statusFilter === 'all' ? '' : statusFilter, search, page, PAGE_SIZE),
        fetchAllPackages(),
      ]);
      setVouchers(data);
      setTotal(count);
      setPackages(pkgs);
    } catch {
      toast.error('Failed to load vouchers');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  const Skeleton = () => (
    <tr className="border-b border-border/30">
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-muted animate-pulse" style={{ width: `${40 + (i * 13) % 40}%` }} />
        </td>
      ))}
    </tr>
  );

  // Stats
  const activeCount = vouchers.filter(v => v.status === 'active').length;
  const usedCount = vouchers.filter(v => v.status === 'used').length;
  const expiredCount = vouchers.filter(v => v.status === 'expired').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-800 text-foreground">Vouchers</h1>
          <p className="text-sm text-muted-foreground">{total.toLocaleString()} total voucher codes</p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => exportVouchersCSV(vouchers)} disabled={vouchers.length === 0} className="border-border text-muted-foreground hover:text-foreground">
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="border-border text-muted-foreground hover:text-foreground">
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} /> Refresh
          </Button>
          <GenerateDialog packages={packages} onGenerated={load} />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Active', count: activeCount, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'Used', count: usedCount, color: 'text-muted-foreground', bg: 'bg-muted' },
          { label: 'Expired', count: expiredCount, color: 'text-destructive', bg: 'bg-destructive/10' },
        ].map(({ label, count, color, bg }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <p className={cn('text-2xl font-800', color)}>{count}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search voucher code..."
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
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="used">Used</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap">
              <thead>
                <tr className="border-b border-border">
                  {['Code', 'Package', 'Validity', 'Price', 'Reseller Price', 'Status', 'Created'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-600 text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? [...Array(10)].map((_, i) => <Skeleton key={i} />)
                  : vouchers.length === 0
                    ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                          <Ticket className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          No vouchers found
                        </td>
                      </tr>
                    )
                    : vouchers.map(v => {
                      const sc = STATUS_CONFIG[v.status] ?? STATUS_CONFIG.active;
                      return (
                        <tr key={v.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-foreground font-700 tracking-wider">{v.code}</span>
                              <button
                                onClick={() => handleCopy(v.code)}
                                className="text-muted-foreground hover:text-primary transition-colors"
                                title="Copy code"
                              >
                                {copiedCode === v.code
                                  ? <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                                  : <Copy className="h-3.5 w-3.5" />
                                }
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-foreground">{v.package_name}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{v.validity_hours}hr{v.validity_hours > 1 ? 's' : ''}</td>
                          <td className="px-4 py-3 text-xs text-primary font-700">{formatNGN(v.price_ngn)}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{v.reseller_price_ngn ? formatNGN(v.reseller_price_ngn) : '—'}</td>
                          <td className="px-4 py-3">
                            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-600', sc.badge)}>
                              {v.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(v.created_at).toLocaleDateString('en-NG')}</td>
                        </tr>
                      );
                    })
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
