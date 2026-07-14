import React, { useEffect, useState, useCallback } from 'react';
import {
  Search, Filter, Users as UsersIcon, MoreHorizontal,
  Shield, ShieldOff, Wifi, WifiOff, RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { fetchHotspotUsers, updateUserStatus } from '@/lib/api';
import type { HotspotUser } from '@/types/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-500/15 text-green-400',
  inactive: 'bg-muted text-muted-foreground',
  blocked: 'bg-destructive/15 text-destructive',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<HotspotUser[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, count } = await fetchHotspotUsers(search, page, PAGE_SIZE);
      let filtered = data;
      if (statusFilter !== 'all') {
        filtered = data.filter(u => u.status === statusFilter);
      }
      setUsers(filtered);
      setTotal(count);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [search, page, statusFilter]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const handleStatusChange = async (id: string, status: HotspotUser['status']) => {
    try {
      await updateUserStatus(id, status);
      toast.success(`User ${status}`);
      load();
    } catch {
      toast.error('Failed to update user status');
    }
  };

  const Skeleton = () => (
    <tr className="border-b border-border/30">
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-muted animate-pulse" style={{ width: `${40 + (i * 13) % 40}%` }} />
        </td>
      ))}
    </tr>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-800 text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground">{total.toLocaleString()} total users</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="border-border text-muted-foreground hover:text-foreground">
          <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} /> Refresh
        </Button>
      </div>

      <Card className="bg-card border-border">
        {/* Filters */}
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by phone or MAC..."
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
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap">
              <thead>
                <tr className="border-b border-border">
                  {['Phone', 'MAC Address', 'Status', 'Package', 'Expires', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-600 text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? [...Array(8)].map((_, i) => <Skeleton key={i} />)
                  : users.length === 0
                    ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                          <UsersIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          No users found
                        </td>
                      </tr>
                    )
                    : users.map(u => (
                      <tr key={u.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-sm text-foreground font-mono">{u.phone}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{u.mac_address || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-600', STATUS_BADGE[u.status])}>
                            {u.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-foreground">{u.current_package_id ? 'Active Package' : '—'}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {u.expires_at ? new Date(u.expires_at).toLocaleString('en-NG') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-card border-border">
                              {u.status !== 'active' && (
                                <DropdownMenuItem onClick={() => handleStatusChange(u.id, 'active')} className="text-green-400 text-xs">
                                  <Wifi className="h-3.5 w-3.5 mr-2" /> Activate
                                </DropdownMenuItem>
                              )}
                              {u.status !== 'inactive' && (
                                <DropdownMenuItem onClick={() => handleStatusChange(u.id, 'inactive')} className="text-muted-foreground text-xs">
                                  <WifiOff className="h-3.5 w-3.5 mr-2" /> Deactivate
                                </DropdownMenuItem>
                              )}
                              {u.status !== 'blocked' && (
                                <DropdownMenuItem onClick={() => handleStatusChange(u.id, 'blocked')} className="text-destructive text-xs">
                                  <ShieldOff className="h-3.5 w-3.5 mr-2" /> Block
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="border-border text-muted-foreground">
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)} className="border-border text-muted-foreground">
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
