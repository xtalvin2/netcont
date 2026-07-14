import React, { useEffect, useState } from 'react';
import { Wifi, Zap, Clock, CheckCircle, ArrowRight, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PublicLayout } from '@/components/layouts/PublicLayout';
import { fetchPackages } from '@/lib/api';
import type { Package } from '@/types/types';
import { cn } from '@/lib/utils';

function formatNGN(amount: number) {
  return `₦${amount.toLocaleString('en-NG')}`;
}

const BORDER_COLORS = [
  'border-yellow-500/30 hover:border-yellow-500/80',
  'border-green-500/30 hover:border-green-500/80',
  'border-accent/30 hover:border-accent/80',
  'border-primary/30 hover:border-primary/80',
];

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPackages()
      .then(setPackages)
      .finally(() => setLoading(false));
  }, []);

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-10 md:py-16 max-w-6xl">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-800 text-foreground mb-4 text-balance">
            Choose Your <span className="text-primary">Perfect Package</span>
          </h1>
          <p className="text-muted-foreground md:text-lg max-w-2xl mx-auto">
            Affordable internet packages for every need. Pay with Paystack — instant activation guaranteed.
          </p>
          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-8 mt-8">
            {[
              { label: 'Happy Customers', value: '10,000+', color: 'text-primary' },
              { label: 'Uptime', value: '99.9%', color: 'text-green-400' },
              { label: 'Support', value: '24/7', color: 'text-accent' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <p className={cn('text-3xl font-800', color)}>{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Packages Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-80 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {packages.map((pkg, i) => (
              <motion.div
                key={pkg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Card className={cn(
                  'relative bg-card border transition-all duration-200 h-full flex flex-col',
                  BORDER_COLORS[i % 4],
                  pkg.is_popular ? 'ring-1 ring-primary shadow-lg shadow-primary/10' : ''
                )}>
                  {pkg.is_popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground px-3 py-0.5 text-xs">
                        <Star className="h-3 w-3 mr-1" />Most Popular
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="text-center pb-3 pt-6">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <Wifi className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg text-foreground">{pkg.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col flex-1 space-y-4">
                    {/* Price */}
                    <div className="text-center">
                      <p className="text-3xl font-800 text-foreground">{formatNGN(pkg.price_ngn)}</p>
                      <p className="text-xs text-muted-foreground">per {pkg.duration_hours} hour{pkg.duration_hours > 1 ? 's' : ''}</p>
                    </div>
                    {/* Speed & Duration */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-muted rounded-lg p-2 text-center">
                        <Zap className="h-4 w-4 mx-auto mb-1 text-primary" />
                        <p className="text-xs font-600 text-foreground">{pkg.speed_mbps}Mbps</p>
                        <p className="text-[10px] text-muted-foreground">Speed</p>
                      </div>
                      <div className="bg-muted rounded-lg p-2 text-center">
                        <Clock className="h-4 w-4 mx-auto mb-1 text-green-400" />
                        <p className="text-xs font-600 text-foreground">{pkg.duration_hours}hr{pkg.duration_hours > 1 ? 's' : ''}</p>
                        <p className="text-[10px] text-muted-foreground">Duration</p>
                      </div>
                    </div>
                    {/* Features */}
                    <ul className="space-y-1.5 flex-1">
                      {pkg.features.map(f => (
                        <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <CheckCircle className="h-3.5 w-3.5 text-green-400 shrink-0 mt-0.5" />{f}
                        </li>
                      ))}
                    </ul>
                    {/* CTA */}
                    <Link to={`/?pkg=${pkg.id}`}>
                      <Button
                        className={cn(
                          'w-full font-700',
                          pkg.is_popular
                            ? 'bg-primary text-primary-foreground hover:bg-secondary'
                            : 'bg-muted text-foreground hover:bg-muted/70 border border-border'
                        )}
                      >
                        Select Package <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* FAQ */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-800 text-center text-foreground mb-8">Frequently Asked Questions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { q: 'How do I pay?', a: 'Select a package and pay using Paystack — supports card, bank transfer, and USSD.' },
              { q: 'Is there a data cap?', a: 'No, all packages offer unlimited data for the duration of your session.' },
              { q: 'Can I extend my session?', a: 'Yes, purchase again before your session expires to extend access.' },
              { q: 'What if I have issues?', a: 'Our support team is available 24/7. Visit the Support page for contact details.' },
            ].map(({ q, a }) => (
              <Card key={q} className="bg-card border-border">
                <CardContent className="p-4">
                  <p className="text-sm font-600 text-foreground mb-1">{q}</p>
                  <p className="text-xs text-muted-foreground">{a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* CTA Banner */}
        <div className="mt-12">
          <Card className="bg-primary border-0 text-center max-w-xl mx-auto">
            <CardContent className="p-8">
              <h3 className="text-xl font-800 text-primary-foreground mb-2">Ready to Get Connected?</h3>
              <p className="text-primary-foreground/80 text-sm mb-5">Join thousands enjoying fast, reliable internet.</p>
              <Link to="/">
                <Button className="bg-primary-foreground text-secondary hover:bg-primary-foreground/90 font-700">
                  Get Started Now <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicLayout>
  );
}
