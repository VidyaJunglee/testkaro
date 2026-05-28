import React, { useState } from 'react';
import { Camera, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface Screenshot {
  label: string;
  data: string;
}

interface Props {
  screenshots: Screenshot[];
}

export function ScreenshotPanel({ screenshots }: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (screenshots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
        <Camera size={28} className="mb-3 opacity-30" />
        <p className="text-sm">No screenshots captured</p>
        <p className="text-xs mt-1 text-text-tertiary">Screenshots are taken on failed steps and explicit screenshot actions</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-3">
          {screenshots.map((shot, i) => (
            <div
              key={i}
              className="group cursor-pointer rounded-lg border border-border-subtle bg-bg-card overflow-hidden hover:border-accent/50 transition-colors"
              onClick={() => setSelectedIndex(i)}
            >
              <div className="aspect-video bg-black/5 relative overflow-hidden">
                <img
                  src={shot.data}
                  alt={shot.label}
                  className="w-full h-full object-cover object-top"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              </div>
              <div className="px-2 py-1.5">
                <p className="text-[11px] text-text-primary font-medium truncate">{shot.label}</p>
                <p className="text-[10px] text-text-tertiary">Step {i + 1}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-border-subtle bg-bg-secondary text-[10px] text-text-tertiary shrink-0">
        {screenshots.length} screenshot{screenshots.length !== 1 ? 's' : ''}
      </div>

      {/* Lightbox */}
      {selectedIndex !== null && (
        <ScreenshotLightbox
          screenshots={screenshots}
          currentIndex={selectedIndex}
          onClose={() => setSelectedIndex(null)}
          onNavigate={setSelectedIndex}
        />
      )}
    </div>
  );
}

function ScreenshotLightbox({
  screenshots,
  currentIndex,
  onClose,
  onNavigate,
}: {
  screenshots: Screenshot[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const shot = screenshots[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < screenshots.length - 1;

  // Keyboard navigation
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onNavigate(currentIndex - 1);
      if (e.key === 'ArrowRight' && hasNext) onNavigate(currentIndex + 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentIndex, hasPrev, hasNext]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 animate-fade-in" onClick={onClose}>
      <div className="relative max-w-[90vw] max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-bg-secondary rounded-t-lg">
          <span className="text-xs text-text-primary font-medium">{shot.label}</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-tertiary">{currentIndex + 1} / {screenshots.length}</span>
            <button onClick={onClose} className="p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Image */}
        <div className="bg-black rounded-b-lg overflow-hidden">
          <img
            src={shot.data}
            alt={shot.label}
            className="max-w-[90vw] max-h-[80vh] object-contain"
          />
        </div>

        {/* Navigation arrows */}
        {hasPrev && (
          <button
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            onClick={() => onNavigate(currentIndex - 1)}
          >
            <ChevronLeft size={20} />
          </button>
        )}
        {hasNext && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            onClick={() => onNavigate(currentIndex + 1)}
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
