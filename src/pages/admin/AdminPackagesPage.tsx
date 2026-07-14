import React, { useEffect, useState } from 'react';
import {
  Plus, Edit2, Trash2, Save, X, Package, Star, StarOff, ToggleLeft, ToggleRight, Zap, Clock, Wifi
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { fetchAllPackages, upsertPackage } from '@/lib/api';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import type { Package as PkgType } from '@/types/types';

function formatNGN(n: number) { return `₦${n.toLocaleString('en-NG')}`; }

const EMPTY_FORM = {
  name: '', duration_hours: 1, price_ngn: 100, speed_mbps: 5,
  data_limit: 'Unlimited', is_popular: false, is_active: true,
};

type FormState = typeof EMPTY_FORM;

export default function AdminPackagesPage() {
  const [packages, setPackages] = useState<PkgType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<PkgType | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PkgType | null>(null);

  const load = () => {
    setLoading(true);
    fetchAllPackages()
      .then(setPackages)
      .catch(() => toast.error('Failed to load packages'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openAdd = () => {
    setEditingPkg(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (pkg: PkgType) => {
    setEditingPkg(pkg);
    setForm({
      name: pkg.name,
      duration_hours: pkg.duration_hours,
      price_ngn: pkg.price_ngn,
      speed_mbps: pkg.speed_mbps,
      data_limit: pkg.data_limit ?? 'Unlimited',
      is_popular: pkg.is_popular,
      is_active: pkg.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Package name is required'); return; }
    if (form.price_ngn <= 0) { toast.error('Price must be greater than 0'); return; }
    if (form.duration_hours <= 0) { toast.error('Duration must be greater than 0'); return; }
    setSaving(true);
    try {
      await upsertPackage({
        ...(editingPkg ? { id: editingPkg.id } : {}),
        name: form.name.trim(),
        duration_hours: Number(form.duration_hours),
        price_ngn: Number(form.price_ngn),
        speed_mbps: Number(form.speed_mbps),
        data_limit: form.data_limit || 'Unlimited',
        is_popular: form.is_popular,
        is_active: form.is_active,
        features: [`${form.duration_hours}hrs access`, `${form.speed_mbps}Mbps speed`, form.data_limit || 'Unlimited data'],
      });
      toast.success(editingPkg ? 'Package updated' : 'Package created');
      setDialogOpen(false);
      load();
    } catch {
      toast.error('Failed to save package');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pkg: PkgType) => {
    try {
      const { error } = await supabase.from('packages').delete().eq('id', pkg.id);
      if (error) throw error;
      toast.success('Package deleted');
      load();
    } catch {
      toast.error('Failed to delete package');
    } finally {
      setDeleteTarget(null);
    }
  };

  const toggleActive = async (pkg: PkgType) => {
    try {
      await upsertPackage({ id: pkg.id, is_active: !pkg.is_active });
      toast.success(pkg.is_active ? 'Package deactivated' : 'Package activated');
      load();
    } catch { toast.error('Failed to update package'); }
  };

  const togglePopular = async (pkg: PkgType) => {
    try {
      await upsertPackage({ id: pkg.id, is_popular: !pkg.is_popular });
      load();
    } catch { toast.error('Failed to update package'); }
  };

  const f = (key: keyof FormState, val: string | number | boolean) =>
    setForm(p => ({ ...p, [key]: val }));

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-800 text-foreground">Packages</h1>
          <p className="text-sm text-muted-foreground">Manage your WiFi access packages and pricing</p>
        </div>
        <Button onClick={openAdd} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
          <Plus className="h-4 w-4" /> Add Package
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : packages.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-16 text-center space-y-3">
            <Package className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">No packages yet</p>
            <Button onClick={openAdd} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
              <Plus className="h-4 w-4" /> Add your first package
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {packages.map(pkg => (
            <Card key={pkg.id} className={`bg-card border-border relative overflow-hidden transition-all ${!pkg.is_active ? 'opacity-60' : ''}`}>
              {pkg.is_popular && (
                <div className="absolute top-0 right-0">
                  <div className="bg-primary text-primary-foreground text-[10px] font-700 px-3 py-0.5 rounded-bl-lg">Popular</div>
                </div>
              )}
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 className="font-700 text-foreground text-base">{pkg.name}</h3>
                    <p className="text-2xl font-800 text-primary mt-0.5">{formatNGN(pkg.price_ngn)}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={pkg.is_active
                      ? 'border-green-500/40 text-green-500 shrink-0'
                      : 'border-muted-foreground/40 text-muted-foreground shrink-0'}
                  >
                    {pkg.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-4">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{pkg.duration_hours}hrs</span>
                  <span className="flex items-center gap-1"><Zap className="h-3 w-3" />{pkg.speed_mbps}Mbps</span>
                  <span className="flex items-center gap-1"><Wifi className="h-3 w-3" />{pkg.data_limit}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(pkg)} className="flex-1 gap-1.5 border-border">
                    <Edit2 className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => togglePopular(pkg)}
                    title={pkg.is_popular ? 'Remove popular' : 'Mark as popular'}
                    className="border border-border text-muted-foreground hover:text-foreground px-2"
                  >
                    {pkg.is_popular ? <Star className="h-3.5 w-3.5 text-primary" /> : <StarOff className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => toggleActive(pkg)}
                    title={pkg.is_active ? 'Deactivate' : 'Activate'}
                    className="border border-border text-muted-foreground hover:text-foreground px-2"
                  >
                    {pkg.is_active ? <ToggleRight className="h-4 w-4 text-green-500" /> : <ToggleLeft className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => setDeleteTarget(pkg)}
                    className="border border-destructive/40 text-destructive hover:bg-destructive/10 px-2"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">{editingPkg ? 'Edit Package' : 'New Package'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">Package Name</Label>
              <Input
                placeholder="e.g. Quick Browse"
                value={form.name}
                onChange={e => f('name', e.target.value)}
                className="bg-muted border-input text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm text-foreground">Price (₦)</Label>
                <Input
                  type="number" min={1}
                  value={form.price_ngn}
                  onChange={e => f('price_ngn', Number(e.target.value))}
                  className="bg-muted border-input text-foreground"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-foreground">Duration (hours)</Label>
                <Input
                  type="number" min={1}
                  value={form.duration_hours}
                  onChange={e => f('duration_hours', Number(e.target.value))}
                  className="bg-muted border-input text-foreground"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-foreground">Speed (Mbps)</Label>
                <Input
                  type="number" min={1}
                  value={form.speed_mbps}
                  onChange={e => f('speed_mbps', Number(e.target.value))}
                  className="bg-muted border-input text-foreground"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-foreground">Data Limit</Label>
                <Input
                  placeholder="Unlimited"
                  value={form.data_limit}
                  onChange={e => f('data_limit', e.target.value)}
                  className="bg-muted border-input text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_popular}
                  onChange={e => f('is_popular', e.target.checked)}
                  className="accent-primary w-4 h-4"
                />
                <span className="text-sm text-foreground">Mark as Popular</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => f('is_active', e.target.checked)}
                  className="accent-primary w-4 h-4"
                />
                <span className="text-sm text-foreground">Active (visible to users)</span>
              </label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-border text-muted-foreground">
              <X className="h-4 w-4 mr-1.5" /> Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {saving
                ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground mr-2" />
                : <Save className="h-4 w-4 mr-1.5" />}
              {editingPkg ? 'Save Changes' : 'Create Package'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-card border-border max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete Package?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will permanently delete <span className="text-foreground font-600">"{deleteTarget?.name}"</span>. Existing payments referencing this package are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-muted-foreground">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
