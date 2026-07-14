import React, { useEffect, useState } from 'react';
import {
  Plus, Trash2, ToggleLeft, ToggleRight, Megaphone,
  Image, Video, Link2, Pencil, GripVertical, Eye, EyeOff,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { fetchAllAds, upsertAd, deleteAd, toggleAdActive } from '@/lib/api';
import type { Advertisement } from '@/types/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const TYPE_META: Record<Advertisement['type'], { icon: React.ElementType; label: string; color: string }> = {
  image:  { icon: Image,  label: 'Image Slide', color: 'text-blue-400 bg-blue-400/10' },
  video:  { icon: Video,  label: 'Video',        color: 'text-purple-400 bg-purple-400/10' },
  url:    { icon: Link2,  label: 'Promo Link',   color: 'text-green-400 bg-green-400/10' },
};

const EMPTY_AD: Partial<Advertisement> = {
  title: '',
  type: 'image',
  content_url: '',
  link_url: '',
  caption: '',
  is_active: true,
  display_order: 0,
};

export default function AdminAdsPage() {
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Advertisement | null>(null);
  const [form, setForm] = useState<Partial<Advertisement>>(EMPTY_AD);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchAllAds()
      .then(setAds)
      .catch(() => toast.error('Failed to load advertisements'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openNew = () => { setForm(EMPTY_AD); setDialogOpen(true); };
  const openEdit = (ad: Advertisement) => { setForm({ ...ad }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.title?.trim()) { toast.error('Title is required'); return; }
    if ((form.type === 'image' || form.type === 'video') && !form.content_url?.trim()) {
      toast.error(`${form.type === 'image' ? 'Image' : 'Video'} URL is required`); return;
    }
    setSaving(true);
    try {
      await upsertAd(form);
      toast.success(form.id ? 'Advertisement updated' : 'Advertisement created');
      setDialogOpen(false);
      load();
    } catch {
      toast.error('Failed to save advertisement');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (ad: Advertisement) => {
    setTogglingId(ad.id);
    try {
      await toggleAdActive(ad.id, !ad.is_active);
      toast.success(`Ad ${!ad.is_active ? 'activated' : 'deactivated'}`);
      setAds(prev => prev.map(a => a.id === ad.id ? { ...a, is_active: !a.is_active } : a));
    } catch {
      toast.error('Failed to toggle advertisement');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAd(deleteTarget.id);
      toast.success('Advertisement deleted');
      setAds(prev => prev.filter(a => a.id !== deleteTarget.id));
    } catch {
      toast.error('Failed to delete advertisement');
    } finally {
      setDeleteTarget(null);
    }
  };

  const activeCount = ads.filter(a => a.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            Advertisements
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage banners shown on the customer portal. Supports images, videos, and promo links.
          </p>
        </div>
        <Button onClick={openNew} className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0">
          <Plus className="h-4 w-4 mr-2" /> Add Advertisement
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Ads', value: ads.length },
          { label: 'Active', value: activeCount },
          { label: 'Inactive', value: ads.length - activeCount },
        ].map(s => (
          <Card key={s.label} className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Ads list */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-foreground">All Advertisements</CardTitle>
          <CardDescription className="text-muted-foreground text-xs">
            Active ads display on the portal homepage as a rotating banner.
          </CardDescription>
        </CardHeader>
        <Separator className="bg-border" />
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : ads.length === 0 ? (
            <div className="p-12 text-center">
              <Megaphone className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No advertisements yet.</p>
              <Button onClick={openNew} variant="outline" className="mt-4 border-border text-muted-foreground">
                <Plus className="h-4 w-4 mr-2" /> Create your first ad
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {ads.map(ad => {
                const meta = TYPE_META[ad.type];
                const Icon = meta.icon;
                return (
                  <div key={ad.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                    {/* Drag handle (cosmetic) */}
                    <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0 hidden md:block" />

                    {/* Type icon */}
                    <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', meta.color)}>
                      <Icon className="h-4 w-4" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground truncate">{ad.title}</p>
                        <Badge variant="outline" className={cn('text-xs border-0 shrink-0', meta.color)}>
                          {meta.label}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs shrink-0',
                            ad.is_active
                              ? 'border-green-500/30 text-green-400 bg-green-500/10'
                              : 'border-muted text-muted-foreground bg-muted/50'
                          )}
                        >
                          {ad.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      {ad.caption && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{ad.caption}</p>
                      )}
                      {(ad.content_url || ad.link_url) && (
                        <p className="text-xs text-muted-foreground/50 truncate mt-0.5 font-mono">
                          {ad.content_url || ad.link_url}
                        </p>
                      )}
                    </div>

                    {/* Order badge */}
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0 hidden md:block">
                      #{ad.display_order}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Toggle active */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'h-8 w-8 transition-colors',
                          ad.is_active ? 'text-primary hover:text-primary/80' : 'text-muted-foreground hover:text-foreground'
                        )}
                        onClick={() => handleToggle(ad)}
                        disabled={togglingId === ad.id}
                        title={ad.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {ad.is_active
                          ? <Eye className="h-4 w-4" />
                          : <EyeOff className="h-4 w-4" />}
                      </Button>

                      {/* Edit */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => openEdit(ad)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(ad)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── CREATE / EDIT DIALOG ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {form.id ? 'Edit Advertisement' : 'New Advertisement'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Title */}
            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">Title <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Fast WiFi for Everyone"
                value={form.title ?? ''}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="bg-background border-border text-foreground"
              />
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">Ad Type <span className="text-destructive">*</span></Label>
              <Select
                value={form.type ?? 'image'}
                onValueChange={v => setForm(f => ({ ...f, type: v as Advertisement['type'] }))}
              >
                <SelectTrigger className="bg-background border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="image">🖼️ Image Slide — photo/banner URL</SelectItem>
                  <SelectItem value="video">🎬 Video — video file URL</SelectItem>
                  <SelectItem value="url">🔗 Promo Link — text banner with link</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Content URL (image / video only) */}
            {(form.type === 'image' || form.type === 'video') && (
              <div className="space-y-1.5">
                <Label className="text-sm text-foreground">
                  {form.type === 'image' ? 'Image URL' : 'Video URL'}{' '}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder={
                    form.type === 'image'
                      ? 'https://example.com/banner.jpg'
                      : 'https://example.com/promo.mp4'
                  }
                  value={form.content_url ?? ''}
                  onChange={e => setForm(f => ({ ...f, content_url: e.target.value }))}
                  className="bg-background border-border text-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  {form.type === 'image'
                    ? 'Direct link to an image (JPG, PNG, WEBP). Recommended: 800×300px.'
                    : 'Direct link to a video file (MP4). Video plays muted on the portal.'}
                </p>
              </div>
            )}

            {/* Link URL */}
            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">
                Destination URL{' '}
                <span className="text-muted-foreground text-xs font-normal">(optional)</span>
              </Label>
              <Input
                placeholder="https://wa.me/234... or /packages"
                value={form.link_url ?? ''}
                onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))}
                className="bg-background border-border text-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Where to send users when they tap the ad. Leave blank for non-clickable ads.
              </p>
            </div>

            {/* Caption */}
            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">
                Caption{' '}
                <span className="text-muted-foreground text-xs font-normal">(optional)</span>
              </Label>
              <Input
                placeholder="e.g. Plans from ₦200 — connect now!"
                value={form.caption ?? ''}
                onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
                className="bg-background border-border text-foreground"
              />
            </div>

            {/* Display order */}
            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">Display Order</Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={form.display_order ?? 0}
                onChange={e => setForm(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))}
                className="bg-background border-border text-foreground w-24"
              />
              <p className="text-xs text-muted-foreground">Lower number = shown first.</p>
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                className="shrink-0"
              >
                {form.is_active
                  ? <ToggleRight className="h-8 w-8 text-primary" />
                  : <ToggleLeft className="h-8 w-8 text-muted-foreground" />}
              </button>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {form.is_active ? 'Active — visible on portal' : 'Inactive — hidden from portal'}
                </p>
                <p className="text-xs text-muted-foreground">Toggle to show or hide this ad immediately.</p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              className="border border-border text-muted-foreground"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving
                ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                : form.id ? 'Save Changes' : 'Create Ad'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DELETE CONFIRM ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete Advertisement?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              "{deleteTarget?.title}" will be permanently removed from the portal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-muted-foreground">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
