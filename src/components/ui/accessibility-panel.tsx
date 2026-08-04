'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { 
  Accessibility, Volume2, VolumeX, Eye, EyeOff, 
  Sun, Moon, Contrast, Move, Type, Zap,
  CheckCircle2, AlertCircle, Info, AlertTriangle,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AccessibilityPanelProps {
  className?: string;
  trigger?: 'button' | 'auto';
}

export function AccessibilityPanel({ className, trigger = 'button' }: AccessibilityPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState({
    reducedMotion: false,
    highContrast: false,
    darkMode: false,
    screenReader: false,
    largeText: false,
    focusIndicators: true,
    announceChanges: true,
    keyboardNavigation: true,
  });
  const panelRef = useRef<HTMLDivElement>(null);

  // Load settings from localStorage
  const isMountedRef = useRef(false);
  
  useEffect(() => {
    isMountedRef.current = true;
    
    const stored = localStorage.getItem('a11y-settings');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Defer state update to avoid synchronous setState in effect
        setTimeout(() => {
          if (isMountedRef.current) {
            setSettings(prev => ({
              ...prev,
              ...parsed
            }));
          }
        }, 0);
      } catch {}
    }

    // Apply system preferences
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const highContrast = window.matchMedia('(prefers-contrast: high)').matches;
    const darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Defer system preference settings too
    setTimeout(() => {
      if (isMountedRef.current) {
        setSettings(prev => ({
          ...prev,
          reducedMotion: prev.reducedMotion || reducedMotion,
          highContrast: prev.highContrast || highContrast,
          darkMode: prev.darkMode || darkMode,
        }));
      }
    }, 0);
    
    return () => {
      isMountedRef.current = false;
    };
  }, []); // Empty deps array is correct for initialization

  const applySettings = useCallback((s: typeof settings) => {
    const root = document.documentElement;
    
    // Reduced motion
    if (s.reducedMotion) {
      root.style.setProperty('--animation-duration', '0s');
      root.style.setProperty('--transition-duration', '0s');
    } else {
      root.style.removeProperty('--animation-duration');
      root.style.removeProperty('--transition-duration');
    }

    // High contrast
    root.classList.toggle('high-contrast', s.highContrast);
    
    // Dark mode
    root.classList.toggle('dark', s.darkMode);
    
    // Large text
    root.classList.toggle('large-text', s.largeText);
    
    // Focus indicators
    root.classList.toggle('enhanced-focus', s.focusIndicators);

    // Screen reader announcements
    if (s.screenReader && !s.announceChanges) {
      // Would set up live region
    }
  }, []); // Empty deps as it doesn't depend on any reactive values

  // Save settings and apply
  const updateSetting = useCallback((key: keyof typeof settings, value: boolean) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      localStorage.setItem('a11y-settings', JSON.stringify(next));
      applySettings(next);
      return next;
    });
  }, [applySettings]); // Include applySettings in deps

  // Apply on mount
  useEffect(() => {
    applySettings(settings);
  }, []);

  // Listen for system preference changes
  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const contrastQuery = window.matchMedia('(prefers-contrast: high)');
    const colorQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleMotionChange = (e: MediaQueryListEvent) => {
      if (!settings.reducedMotion || e.matches) {
        updateSetting('reducedMotion', e.matches);
      }
    };

    const handleContrastChange = (e: MediaQueryListEvent) => {
      if (!settings.highContrast || e.matches) {
        updateSetting('highContrast', e.matches);
      }
    };

    const handleColorChange = (e: MediaQueryListEvent) => {
      if (!settings.darkMode || e.matches) {
        updateSetting('darkMode', e.matches);
      }
    };

    motionQuery.addEventListener('change', handleMotionChange);
    contrastQuery.addEventListener('change', handleContrastChange);
    colorQuery.addEventListener('change', handleColorChange);

    return () => {
      motionQuery.removeEventListener('change', handleMotionChange);
      contrastQuery.removeEventListener('change', handleContrastChange);
      colorQuery.removeEventListener('change', handleColorChange);
    };
  }, [settings.reducedMotion, settings.highContrast, settings.darkMode, updateSetting]);

  // Keyboard navigation for panel
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
      if (e.key === 'Tab') {
        // Trap focus within panel
        const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable?.length) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    panelRef.current?.focus();

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Announce changes to screen readers
    const announceChange = useCallback((message: string) => {
      if (!settings.announceChanges) return;

      const announcer = document.getElementById('a11y-announcer') || document.createElement('div');
      announcer.id = 'a11y-announcer';
      announcer.setAttribute('role', 'status');
      announcer.setAttribute('aria-live', 'polite');
      announcer.setAttribute('aria-atomic', 'true');
      announcer.style.cssText = 'position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden;';

      if (!document.getElementById('a11y-announcer')) {
        document.body.appendChild(announcer);
      }

      announcer.textContent = '';
      // Force reflow for screen readers to notice the change
      void announcer.offsetHeight;
      announcer.textContent = message;
    }, [settings.announceChanges]);

  const toggleSetting = (key: keyof typeof settings) => {
    const newValue = !settings[key];
    updateSetting(key, newValue);
    announceChange(`${key.replace(/([A-Z])/g, ' $1').toLowerCase()} ${newValue ? 'enabled' : 'disabled'}`);
  };

  if (!isOpen && trigger === 'auto') return null;

  return (
    <>
      {trigger === 'button' && (
        <button
          onClick={() => setIsOpen(true)}
          className={cn(
            'fixed bottom-4 right-4 z-40 p-3 rounded-xl bg-background border border-border shadow-xl',
            'hover:border-bull/50 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bull',
            className
          )}
          aria-label="Accessibility settings"
          aria-expanded={isOpen}
        >
          <Accessibility className="w-6 h-6 text-bull" />
          <span className="sr-only">Open accessibility settings</span>
        </button>
      )}

      <AnimatePresence>
              {isOpen && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
                    onClick={() => setIsOpen(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="a11y-title"
                  >
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.8 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                      onClick={() => setIsOpen(false)}
                    />
                    <motion.div
                      ref={panelRef}
                      initial={{ opacity: 0, y: '100%', scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: '100%', scale: 0.95 }}
                      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                      className="relative w-full max-w-md mx-4 sm:mx-0 bg-background border-t sm:border border-bull/20 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
                      tabIndex={-1}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="p-4 sm:p-6 space-y-6">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <h2 id="a11y-title" className="text-xl font-bold flex items-center gap-2">
                            <Accessibility className="w-6 h-6 text-bull" />
                            Accessibility
                          </h2>
                          <button
                            onClick={() => setIsOpen(false)}
                            className="p-2 rounded-lg hover:bg-surface-2 text-muted-foreground transition-colors"
                            aria-label="Close"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>

                        {/* Settings Sections */}
                        <div className="space-y-4">
                          {/* Visual Settings */}
                          <SettingsSection title="Visual" icon={Eye}>
                            <SettingToggle
                              label="High Contrast"
                              description="Increase color contrast for better visibility"
                              checked={settings.highContrast}
                              onChange={() => toggleSetting('highContrast')}
                              icon={Contrast}
                            />
                            <SettingToggle
                              label="Dark Mode"
                              description="Use dark color scheme"
                              checked={settings.darkMode}
                              onChange={() => toggleSetting('darkMode')}
                              icon={settings.darkMode ? Sun : Moon}
                            />
                            <SettingToggle
                              label="Large Text"
                              description="Increase base font size"
                              checked={settings.largeText}
                              onChange={() => toggleSetting('largeText')}
                              icon={Type}
                            />
                            <SettingToggle
                              label="Reduced Motion"
                              description="Disable animations and transitions"
                              checked={settings.reducedMotion}
                              onChange={() => toggleSetting('reducedMotion')}
                              icon={Move}
                            />
                          </SettingsSection>

                          {/* Navigation Settings */}
                          <SettingsSection title="Navigation" icon={Zap}>
                            <SettingToggle
                              label="Enhanced Focus Indicators"
                              description="More visible focus rings for keyboard navigation"
                              checked={settings.focusIndicators}
                              onChange={() => toggleSetting('focusIndicators')}
                              icon={CheckCircle2}
                            />
                            <SettingToggle
                              label="Keyboard Navigation"
                              description="Enable arrow key navigation for lists and grids"
                              checked={settings.keyboardNavigation}
                              onChange={() => toggleSetting('keyboardNavigation')}
                              icon={Move}
                            />
                          </SettingsSection>

                          {/* Screen Reader Settings */}
                          <SettingsSection title="Screen Reader" icon={Volume2}>
                            <SettingToggle
                              label="Announce Changes"
                              description="Read out dynamic content updates"
                              checked={settings.announceChanges}
                              onChange={() => toggleSetting('announceChanges')}
                              icon={Volume2}
                            />
                            <SettingToggle
                              label="Verbose Mode"
                              description="More detailed announcements"
                              checked={settings.screenReader}
                              onChange={() => toggleSetting('screenReader')}
                              icon={Info}
                            />
                          </SettingsSection>

                          {/* Quick Actions */}
                          <div className="pt-4 border-t border-border">
                            <h3 className="font-semibold mb-3">Quick Actions</h3>
                            <div className="grid grid-cols-2 gap-3">
                              <QuickActionButton
                                label="Reset to Defaults"
                                description="Restore system preferences"
                                onClick={() => {
                                  const defaults = {
                                    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
                                    highContrast: window.matchMedia('(prefers-contrast: high)').matches,
                                    darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
                                    screenReader: false,
                                    largeText: false,
                                    focusIndicators: true,
                                    announceChanges: true,
                                    keyboardNavigation: true,
                                  };
                                  Object.entries(defaults).forEach(([k, v]) => updateSetting(k as keyof typeof settings, v));
                                  announceChange('Settings reset to defaults');
                                }}
                                icon={AlertTriangle}
                                variant="secondary"
                              />
                              <QuickActionButton
                                label="Test Announcements"
                                description="Verify screen reader works"
                                onClick={() => announceChange('Accessibility announcements are working correctly')}
                                icon={Volume2}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Status */}
                        <div className="pt-4 border-t border-border">
                          <h3 className="font-semibold mb-3">Current Status</h3>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {Object.entries(settings).map(([key, value]) => (
                              <StatusBadge key={key} label={key} value={value} />
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
                </>
            );
        }

// Sub-components
function SettingsSection({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Icon className="w-4 h-4" />
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function SettingToggle({ 
  label, 
  description, 
  checked, 
  onChange, 
  icon: Icon 
}: { 
  label: string; 
  description: string; 
  checked: boolean; 
  onChange: () => void; 
  icon: React.ComponentType<{ className?: string }>; 
}) {
  return (
    <button
      onClick={onChange}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-xl border transition-all',
        checked
          ? 'bg-bull/10 border-bull/30 text-foreground'
          : 'bg-surface-2 border-border hover:bg-surface-3'
      )}
      aria-pressed={checked}
      aria-label={`${label}: ${checked ? 'enabled' : 'disabled'}`}
    >
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', checked ? 'bg-bull/20 text-bull' : 'bg-surface-3 text-muted-foreground')}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 text-left">
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className={cn(
        'relative w-11 h-6 rounded-full transition-colors',
        checked ? 'bg-bull' : 'bg-muted'
      )}>
        <motion.div
          initial={{ x: checked ? 24 : 2 }}
          animate={{ x: checked ? 24 : 2 }}
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-background shadow-md"
        />
      </div>
    </button>
  );
}

function QuickActionButton({ label, description, onClick, icon: Icon, variant = 'primary' }: { 
  label: string; 
  description: string; 
  onClick: () => void; 
  icon: React.ComponentType<{ className?: string }>;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-1 p-3 rounded-xl border transition-colors',
        variant === 'primary'
          ? 'bg-bull/10 border-bull/30 hover:bg-bull/20'
          : 'bg-surface-2 border-border hover:bg-surface-3'
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('w-5 h-5', variant === 'primary' ? 'text-bull' : 'text-muted-foreground')} />
        <span className="font-semibold">{label}</span>
      </div>
      <span className="text-xs text-muted-foreground">{description}</span>
    </button>
  );
}

function StatusBadge({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-surface-2">
      <span className="text-sm text-muted-foreground capitalize">{label.replace(/([A-Z])/g, ' $1')}</span>
      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', value ? 'bg-bull/20 text-bull' : 'bg-muted text-muted-foreground')}>
        {value ? 'Enabled' : 'Disabled'}
      </span>
    </div>
  );
}

// Hook for accessibility
export function useAccessibility() {
  const [settings, setSettings] = React.useState({
    reducedMotion: false,
    highContrast: false,
    darkMode: false,
    screenReader: false,
    largeText: false,
    focusIndicators: true,
    announceChanges: true,
    keyboardNavigation: true,
  });

  React.useEffect(() => {
    const stored = localStorage.getItem('a11y-settings');
    if (stored) {
      try { 
        setTimeout(() => {
          setSettings(JSON.parse(stored)); 
        }, 0);
      } catch {}
    }
  }, []);

  const toggle = React.useCallback((key: keyof typeof settings) => {
    setSettings(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('a11y-settings', JSON.stringify(next));
      return next;
    });
  }, []);

  const announce = React.useCallback((message: string) => {
    if (!settings.announceChanges) return;
    const announcer = document.getElementById('a11y-announcer') || document.createElement('div');
    announcer.id = 'a11y-announcer';
    announcer.setAttribute('role', 'status');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.style.cssText = 'position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden;';
    if (!document.getElementById('a11y-announcer')) document.body.appendChild(announcer);
    announcer.textContent = '';
    // Force reflow for screen readers to notice the change
    void announcer.offsetHeight;
    announcer.textContent = message;
  }, [settings.announceChanges]);

  return { settings, toggle, announce };
}