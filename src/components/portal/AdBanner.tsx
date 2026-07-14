import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ExternalLink, ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchActiveAds } from '@/lib/api';
import type { Advertisement } from '@/types/types';
import { cn } from '@/lib/utils';

const AUTO_INTERVAL = 5000; // ms between auto-slides

function AdSlide({ ad }: { ad: Advertisement }) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!videoRef.current) return;
    if (videoRef.current.paused) { videoRef.current.play(); setPlaying(true); }
    else { videoRef.current.pause(); setPlaying(false); }
  };

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    ad.link_url ? (
      <a href={ad.link_url} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
        {children}
      </a>
    ) : <div className="w-full h-full">{children}</div>;

  // ── IMAGE ──
  if (ad.type === 'image') {
    return (
      <Wrapper>
        <div className="relative w-full h-full">
          <img
            src={ad.content_url ?? ''}
            alt={ad.title}
            className="w-full h-full object-cover"
          />
          {/* Gradient + caption */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
            {ad.title && <p className="text-white font-semibold text-sm leading-tight">{ad.title}</p>}
            {ad.caption && <p className="text-white/80 text-xs mt-0.5">{ad.caption}</p>}
            {ad.link_url && (
              <span className="inline-flex items-center gap-1 text-primary text-xs mt-1 font-medium">
                Learn more <ExternalLink className="h-3 w-3" />
              </span>
            )}
          </div>
        </div>
      </Wrapper>
    );
  }

  // ── VIDEO ──
  if (ad.type === 'video') {
    return (
      <div className="relative w-full h-full bg-black">
        <video
          ref={videoRef}
          src={ad.content_url ?? ''}
          className="w-full h-full object-cover"
          loop
          muted
          playsInline
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
        {/* Overlay controls */}
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center group"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          <div className={cn(
            'h-12 w-12 rounded-full bg-black/50 flex items-center justify-center transition-opacity',
            playing ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
          )}>
            {playing
              ? <Pause className="h-5 w-5 text-white" />
              : <Play className="h-5 w-5 text-white ml-0.5" />
            }
          </div>
        </button>
        {/* Caption */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none">
          {ad.title && <p className="text-white font-semibold text-sm">{ad.title}</p>}
          {ad.caption && <p className="text-white/80 text-xs mt-0.5">{ad.caption}</p>}
        </div>
      </div>
    );
  }

  // ── URL / PROMO BANNER ──
  return (
    <Wrapper>
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/20 via-primary/10 to-background px-6 py-5 text-center gap-2">
        <p className="text-foreground font-bold text-base leading-snug">{ad.title}</p>
        {ad.caption && <p className="text-muted-foreground text-sm">{ad.caption}</p>}
        {ad.link_url && (
          <span className="inline-flex items-center gap-1 text-primary text-sm font-semibold mt-1">
            Tap to view <ExternalLink className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
    </Wrapper>
  );
}

export default function AdBanner() {
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [index, setIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchActiveAds().then(setAds).catch(() => {/* silently ignore — ads are non-critical */});
  }, []);

  const next = useCallback(() => setIndex(i => (i + 1) % ads.length), [ads.length]);
  const prev = useCallback(() => setIndex(i => (i - 1 + ads.length) % ads.length), [ads.length]);

  // Auto-advance
  useEffect(() => {
    if (!autoPlay || ads.length <= 1) return;
    timerRef.current = setInterval(next, AUTO_INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoPlay, ads.length, next]);

  if (ads.length === 0) return null;

  const current = ads[index];

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden bg-card border border-border"
      style={{ height: '180px' }}
      onMouseEnter={() => setAutoPlay(false)}
      onMouseLeave={() => setAutoPlay(true)}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current.id}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.35 }}
          className="absolute inset-0"
        >
          <AdSlide ad={current} />
        </motion.div>
      </AnimatePresence>

      {/* Prev / Next arrows — only when >1 ad */}
      {ads.length > 1 && (
        <>
          <button
            onClick={(e) => { e.preventDefault(); prev(); setAutoPlay(false); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-7 w-7 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors"
            aria-label="Previous ad"
          >
            <ChevronLeft className="h-4 w-4 text-white" />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); next(); setAutoPlay(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-7 w-7 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors"
            aria-label="Next ad"
          >
            <ChevronRight className="h-4 w-4 text-white" />
          </button>

          {/* Dot indicators */}
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-10">
            {ads.map((_, i) => (
              <button
                key={i}
                onClick={() => { setIndex(i); setAutoPlay(false); }}
                className={cn(
                  'rounded-full transition-all',
                  i === index ? 'bg-white w-4 h-1.5' : 'bg-white/40 w-1.5 h-1.5'
                )}
                aria-label={`Go to ad ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
