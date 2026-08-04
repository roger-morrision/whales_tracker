/**
 * Gesture Navigation
 * Swipe between tabs, pull-to-refresh everywhere, edge swipe back
 */
import React from 'react';

export interface GestureConfig {
  enabled: boolean;
  swipeThreshold: number; // pixels
  velocityThreshold: number; // pixels/ms
  longPressDelay: number; // ms
  hapticFeedback: boolean;
  preventDefault: boolean;
}

export interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
}

export interface GestureEvent {
  type: 'swipe' | 'pan' | 'pinch' | 'tap' | 'double-tap' | 'long-press' | 'edge-swipe';
  direction?: 'left' | 'right' | 'up' | 'down';
  distance: number;
  velocity: number;
  duration: number;
  startPoint: TouchPoint;
  endPoint: TouchPoint;
  target: EventTarget | null;
}

export interface SwipeAction {
  direction: 'left' | 'right' | 'up' | 'down';
  action: () => void | Promise<void>;
  threshold?: number;
  haptic?: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';
}

class GestureNavigation {
  private config: GestureConfig;
  private touchHistory: TouchPoint[] = [];
  private isTracking = false;
  private longPressTimer: NodeJS.Timeout | null = null;
  private swipeActions: SwipeAction[] = [];
  private subscribers: Set<(event: GestureEvent) => void> = new Set();
  private element: HTMLElement | null = null;
  private panStart: TouchPoint | null = null;
  private lastPanEvent: GestureEvent | null = null;

  constructor(config?: Partial<GestureConfig>) {
    this.config = {
      enabled: true,
      swipeThreshold: 50,
      velocityThreshold: 0.3,
      longPressDelay: 500,
      hapticFeedback: true,
      preventDefault: true,
      ...config,
    };

    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  private initialize(): void {
    this.setupDefaultActions();
  }

  private setupDefaultActions(): void {
    // Edge swipe from left - go back
    this.addSwipeAction({
      direction: 'right',
      action: () => this.handleEdgeSwipeBack(),
      threshold: 30, // Start from edge
      haptic: 'light',
    });

    // Pull to refresh (down from top)
    this.addSwipeAction({
      direction: 'down',
      action: () => this.handlePullToRefresh(),
      threshold: 80,
      haptic: 'medium',
    });

    // Swipe left/right for tab navigation
    this.addSwipeAction({
      direction: 'left',
      action: () => this.handleTabSwipe('next'),
      threshold: 60,
      haptic: 'light',
    });

    this.addSwipeAction({
      direction: 'right',
      action: () => this.handleTabSwipe('prev'),
      threshold: 60,
      haptic: 'light',
    });
  }

  attachToElement(element: HTMLElement): void {
    this.element = element;
    this.bindEvents();
  }

  detach(): void {
    if (this.element) {
      this.unbindEvents();
      this.element = null;
    }
  }

  private bindEvents(): void {
    if (!this.element) return;

    this.element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: !this.config.preventDefault });
    this.element.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: !this.config.preventDefault });
    this.element.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: !this.config.preventDefault });
    this.element.addEventListener('touchcancel', this.handleTouchCancel.bind(this), { passive: true });

    // Mouse events for desktop testing
    this.element.addEventListener('mousedown', this.handleMouseDown.bind(this));
  }

  private unbindEvents(): void {
    if (!this.element) return;

    this.element.removeEventListener('touchstart', this.handleTouchStart.bind(this));
    this.element.removeEventListener('touchmove', this.handleTouchMove.bind(this));
    this.element.removeEventListener('touchend', this.handleTouchEnd.bind(this));
    this.element.removeEventListener('touchcancel', this.handleTouchCancel.bind(this));
    this.element.removeEventListener('mousedown', this.handleMouseDown.bind(this));
  }

  private handleTouchStart(event: TouchEvent): void {
    if (!this.config.enabled) return;

    const touch = event.touches[0];
    const point: TouchPoint = {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now(),
    };

    this.touchHistory = [point];
    this.panStart = point;
    this.isTracking = true;

    // Long press detection
    this.longPressTimer = setTimeout(() => {
      if (this.isTracking && this.panStart) {
        this.emitGesture({
          type: 'long-press',
          distance: 0,
          velocity: 0,
          duration: this.config.longPressDelay,
          startPoint: this.panStart,
          endPoint: point,
          target: event.target,
        });
        this.triggerHaptic('medium');
      }
    }, this.config.longPressDelay);
  }

  private handleTouchMove(event: TouchEvent): void {
    if (!this.isTracking || !this.panStart) return;

    const touch = event.touches[0];
    const point: TouchPoint = {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now(),
    };

    this.touchHistory.push(point);

    // Clear long press timer if moved significantly
    const distance = this.getDistance(this.panStart, point);
    if (distance > 10) {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
    }

    // Emit pan event for real-time feedback
    const panEvent: GestureEvent = {
      type: 'pan',
      direction: this.getDirection(this.panStart, point),
      distance,
      velocity: this.getVelocity(),
      duration: point.timestamp - this.panStart.timestamp,
      startPoint: this.panStart,
      endPoint: point,
      target: event.target,
    };

    this.lastPanEvent = panEvent;
    this.emitGesture(panEvent);
  }

  private handleTouchEnd(event: TouchEvent): void {
    if (!this.isTracking || !this.panStart) return;

    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    const endPoint: TouchPoint = {
      x: event.changedTouches[0].clientX,
      y: event.changedTouches[0].clientY,
      timestamp: Date.now(),
    };

    const distance = this.getDistance(this.panStart, endPoint);
    const velocity = this.getVelocity();
    const duration = endPoint.timestamp - this.panStart.timestamp;
    const direction = this.getDirection(this.panStart, endPoint);

    // Determine gesture type
    if (distance < this.config.swipeThreshold && duration < 300) {
      // Tap
      this.emitGesture({
        type: 'tap',
        distance: 0,
        velocity: 0,
        duration,
        startPoint: this.panStart,
        endPoint,
        target: event.target,
      });
    } else if (distance >= this.config.swipeThreshold && velocity >= this.config.velocityThreshold) {
      // Swipe
      this.emitGesture({
        type: 'swipe',
        direction,
        distance,
        velocity,
        duration,
        startPoint: this.panStart,
        endPoint,
        target: event.target,
      });

      // Check for matching swipe actions
      this.handleSwipeAction(direction!, distance, velocity);
    }

    this.isTracking = false;
    this.panStart = null;
    this.touchHistory = [];
  }

  private handleTouchCancel(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.isTracking = false;
    this.panStart = null;
    this.touchHistory = [];
  }

  private handleMouseDown(event: MouseEvent): void {
    // For desktop testing - simulate touch
    const point: TouchPoint = {
      x: event.clientX,
      y: event.clientY,
      timestamp: Date.now(),
    };

    this.touchHistory = [point];
    this.panStart = point;
    this.isTracking = true;

    const handleMouseMove = (e: MouseEvent) => {
      if (!this.isTracking || !this.panStart) return;
      
      const movePoint: TouchPoint = {
        x: e.clientX,
        y: e.clientY,
        timestamp: Date.now(),
      };

      this.touchHistory.push(movePoint);

      const distance = this.getDistance(this.panStart, movePoint);
      if (distance > 10 && this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      if (!this.isTracking || !this.panStart) return;

      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }

      const endPoint: TouchPoint = {
        x: e.clientX,
        y: e.clientY,
        timestamp: Date.now(),
      };

      const distance = this.getDistance(this.panStart, endPoint);
      const velocity = this.getVelocity();
      const duration = endPoint.timestamp - this.panStart.timestamp;
      const direction = this.getDirection(this.panStart, endPoint);

      if (distance < this.config.swipeThreshold && duration < 300) {
        this.emitGesture({
          type: 'tap',
          distance: 0,
          velocity: 0,
          duration,
          startPoint: this.panStart,
          endPoint,
          target: event.target,
        });
      } else if (distance >= this.config.swipeThreshold && velocity >= this.config.velocityThreshold) {
        this.emitGesture({
          type: 'swipe',
          direction,
          distance,
          velocity,
          duration,
          startPoint: this.panStart,
          endPoint,
          target: event.target,
        });
        this.handleSwipeAction(direction!, distance, velocity);
      }

      this.isTracking = false;
      this.panStart = null;
      this.touchHistory = [];
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  private getDistance(start: TouchPoint, end: TouchPoint): number {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private getDirection(start: TouchPoint, end: TouchPoint): 'left' | 'right' | 'up' | 'down' | undefined {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx > absDy) {
      return dx > 0 ? 'right' : 'left';
    } else if (absDy > absDx) {
      return dy > 0 ? 'down' : 'up';
    }
    return undefined;
  }

  private getVelocity(): number {
    if (this.touchHistory.length < 2) return 0;

    const recent = this.touchHistory.slice(-5);
    const first = recent[0];
    const last = recent[recent.length - 1];

    const distance = this.getDistance(first, last);
    const time = last.timestamp - first.timestamp;

    return time > 0 ? distance / time : 0;
  }

  private handleSwipeAction(direction: 'left' | 'right' | 'up' | 'down', distance: number, velocity: number): void {
    for (const action of this.swipeActions) {
      if (action.direction === direction && distance >= (action.threshold || this.config.swipeThreshold)) {
        if (this.config.hapticFeedback && action.haptic) {
          this.triggerHaptic(action.haptic);
        }
        action.action();
        break;
      }
    }
  }

  private async handleEdgeSwipeBack(): Promise<void> {
    // Navigate back in browser history or app router
    if (window.history.length > 1) {
      window.history.back();
    }
  }

  private async handlePullToRefresh(): Promise<void> {
    // Dispatch custom event for app to handle
    window.dispatchEvent(new CustomEvent('pull-to-refresh'));
    
    // Show visual feedback
    this.showPullToRefreshIndicator();
  }

  private async handleTabSwipe(dir: 'next' | 'prev'): Promise<void> {
    // Dispatch custom event for tab navigation
    window.dispatchEvent(new CustomEvent('tab-swipe', { detail: { direction: dir } }));
  }

  private showPullToRefreshIndicator(): void {
    // Create or show pull-to-refresh UI
    let indicator = document.getElementById('pull-to-refresh-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'pull-to-refresh-indicator';
      indicator.style.cssText = `
        position: fixed;
        top: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 40px;
        height: 40px;
        background: var(--primary);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--primary-foreground);
        z-index: 9999;
        opacity: 0;
        transition: opacity 0.2s, transform 0.2s;
      `;
      indicator.innerHTML = '↻';
      document.body.appendChild(indicator);
    }

    // Animate
    indicator.style.opacity = '1';
    indicator.style.transform = 'translateX(-50%) translateY(20px)';
    
    setTimeout(() => {
      indicator.style.opacity = '0';
      indicator.style.transform = 'translateX(-50%) translateY(-20px)';
      setTimeout(() => indicator?.remove(), 300);
    }, 1000);
  }

  private triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'): void {
    if (!this.config.hapticFeedback) return;
    
    if ('vibrate' in navigator) {
      const patterns: Record<string, number | number[]> = {
        light: 10,
        medium: 20,
        heavy: 40,
        success: [10, 50, 10],
        warning: [30, 30, 30],
        error: [50, 50, 50, 50],
      };
      navigator.vibrate(patterns[type] || patterns.light);
    }
  }

  // Public API
  addSwipeAction(action: SwipeAction): void {
    this.swipeActions.push(action);
  }

  removeSwipeAction(direction: 'left' | 'right' | 'up' | 'down'): void {
    this.swipeActions = this.swipeActions.filter(a => a.direction !== direction);
  }

  clearSwipeActions(): void {
    this.swipeActions = [];
  }

  setConfig(config: Partial<GestureConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): GestureConfig {
    return { ...this.config };
  }

  enable(): void {
    this.config.enabled = true;
  }

  disable(): void {
    this.config.enabled = false;
  }

  onGesture(callback: (event: GestureEvent) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private emitGesture(event: GestureEvent): void {
    for (const sub of this.subscribers) {
      try { sub(event); } catch (e) { console.error('[Gesture] Subscriber error:', e); }
    }
  }

  // Utility: Prevent scroll during horizontal swipe
  static preventHorizontalScroll(element: HTMLElement): void {
    element.addEventListener('touchmove', (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const startX = (touch as any)._startX || touch.clientX;
        const dx = touch.clientX - startX;
        const dy = touch.clientY - (touch as any)._startY || touch.clientY;
        
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
          e.preventDefault();
        }
      }
    }, { passive: false });
  }
}

// Singleton
let gestureNavigationInstance: GestureNavigation | null = null;

export function getGestureNavigation(config?: Partial<GestureConfig>): GestureNavigation {
  if (!gestureNavigationInstance) {
    gestureNavigationInstance = new GestureNavigation(config);
  }
  return gestureNavigationInstance;
}

// React hook
export function useGestureNavigation(config?: Partial<GestureConfig>) {
  const gesture = getGestureNavigation(config);
  
  return {
    attachToElement: (element: HTMLElement) => gesture.attachToElement(element),
    detach: () => gesture.detach(),
    addSwipeAction: (action: SwipeAction) => gesture.addSwipeAction(action),
    removeSwipeAction: (direction: 'left' | 'right' | 'up' | 'down') => gesture.removeSwipeAction(direction),
    clearSwipeActions: () => gesture.clearSwipeActions(),
    setConfig: (config: Partial<GestureConfig>) => gesture.setConfig(config),
    getConfig: () => gesture.getConfig(),
    enable: () => gesture.enable(),
    disable: () => gesture.disable(),
    onGesture: (callback: (event: GestureEvent) => void) => gesture.onGesture(callback),
  };
}

export type { GestureConfig, TouchPoint, GestureEvent, SwipeAction };

// React component for easy integration
export function GestureArea({
  children,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onPullToRefresh,
  onLongPress,
  onTap,
  config,
}: {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onPullToRefresh?: () => void;
  onLongPress?: () => void;
  onTap?: () => void;
  config?: Partial<GestureConfig>;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const gesture = getGestureNavigation(config);

  React.useEffect(() => {
    if (ref.current) {
      gesture.attachToElement(ref.current);

      // Add custom actions
      if (onSwipeLeft) gesture.addSwipeAction({ direction: 'left', action: onSwipeLeft, haptic: 'light' });
      if (onSwipeRight) gesture.addSwipeAction({ direction: 'right', action: onSwipeRight, haptic: 'light' });
      if (onSwipeUp) gesture.addSwipeAction({ direction: 'up', action: onSwipeUp, haptic: 'light' });
      if (onSwipeDown) gesture.addSwipeAction({ direction: 'down', action: onSwipeDown, haptic: 'medium' });

      const unsubscribe = gesture.onGesture((event) => {
        if (event.type === 'long-press' && onLongPress) onLongPress();
        if (event.type === 'tap' && onTap) onTap();
      });

      return () => {
        gesture.detach();
        unsubscribe();
      };
    }
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onLongPress, onTap, config]);

  // Since we cannot use JSX in .ts file, we use React.createElement
  return React.createElement('div', { ref, style: { touchAction: 'manipulation' } }, children);
}

// Export types
export type { GestureConfig, TouchPoint, GestureEvent, SwipeAction };