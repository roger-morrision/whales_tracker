// Vitest test setup
import React from 'react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// Mock zustand
vi.mock('zustand', async () => {
  const actual = await vi.importActual('zustand');
  return {
    ...actual,
    create: vi.fn((fn) => fn(set => ({}), get => ({}), api => ({}))),
  };
});

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => React.createElement('div', props, children),
    button: ({ children, ...props }: any) => React.createElement('button', props, children),
    span: ({ children, ...props }: any) => React.createElement('span', props, children),
  },
  AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
  lazy: (fn: any) => fn(),
}));

// Mock lucide-react
vi.mock('lucide-react', () => {
  const icons = [
    'X', 'Menu', 'Search', 'Bell', 'Wallet', 'Settings', 'User', 'TrendingUp',
    'TrendingDown', 'ArrowUp', 'ArrowDown', 'Plus', 'Minus', 'Check', 'AlertCircle',
    'Loader2', 'Zap', 'Target', 'Shield', 'Eye', 'EyeOff', 'Copy', 'Share2',
    'Download', 'Upload', 'RefreshCw', 'RotateCcw', 'ChevronDown', 'ChevronUp',
    'ChevronLeft', 'ChevronRight', 'MoreHorizontal', 'MoreVertical', 'Filter',
    'SlidersHorizontal', 'BarChart2', 'PieChart', 'Activity', 'Heart', 'Star',
    'Flag', 'Tag', 'Link', 'ExternalLink', 'Mail', 'MessageSquare', 'Phone',
    'Globe', 'Lock', 'Unlock', 'Key', 'Hash', 'DollarSign', 'Bitcoin', 'Coins',
  ];
  const mockIcons: Record<string, React.FC> = {};
  icons.forEach(name => {
    mockIcons[name] = ({ className, ...props }: any) =>
      React.createElement('svg', { className, ...props, 'data-testid': `icon-${name.toLowerCase()}` });
  });
  return mockIcons;
});

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    promise: vi.fn(),
    dismiss: vi.fn(),
  },
  Toaster: () => React.createElement('div', { 'data-testid': 'toaster' }),
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

// Suppress console.error in tests (optional - remove if you want to see errors)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
