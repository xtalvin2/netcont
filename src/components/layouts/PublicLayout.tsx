import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Wifi } from 'lucide-react';
import { fetchSettings } from '@/lib/api';

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const [businessName, setBusinessName] = useState('NetConnect');

  useEffect(() => {
    fetchSettings()
      .then(s => { if (s.business_name) setBusinessName(s.business_name); })
      .catch(() => {/* keep default */});
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header — business name only */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-14 items-center justify-center px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Wifi className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-700 text-foreground">{businessName}</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card px-4 py-4">
        <div className="container mx-auto flex items-center justify-center text-xs text-muted-foreground gap-1">
          <Wifi className="h-3 w-3 text-primary" />
          <span>{businessName} · <Link to="/support" className="hover:text-foreground transition-colors">Support</Link></span>
        </div>
      </footer>
    </div>
  );
}
