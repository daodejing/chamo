import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LanguageSelector } from '@/components/settings/language-selector';
import { LanguageProvider } from '@/lib/contexts/language-context';
import { toast } from 'sonner';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
  },
}));

// Mock window.location.reload
const mockReload = vi.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true,
});

describe('LanguageSelector', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();

    // Mock setTimeout to execute immediately
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders both language options', () => {
    render(
      <LanguageProvider>
        <LanguageSelector />
      </LanguageProvider>
    );

    expect(screen.getByText('日本語')).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
  });

  it('highlights the currently selected language', () => {
    // Set initial language to Japanese
    localStorage.setItem('appLanguage', 'ja');

    render(
      <LanguageProvider>
        <LanguageSelector />
      </LanguageProvider>
    );

    const japaneseButton = screen.getByText('日本語').closest('button');
    const englishButton = screen.getByText('English').closest('button');

    // Japanese button should have 'default' variant (highlighted)
    expect(japaneseButton).toHaveClass('bg-gradient-to-r');

    // English button should have 'outline' variant (not highlighted)
    expect(englishButton).not.toHaveClass('bg-gradient-to-r');
  });

  it('shows toast and triggers page reload when language changes', async () => {
    render(
      <LanguageProvider>
        <LanguageSelector />
      </LanguageProvider>
    );

    const japaneseButton = screen.getByText('日本語');

    fireEvent.click(japaneseButton);

    // Should show toast notification
    expect(toast.info).toHaveBeenCalledWith('新しい言語を適用するためにリロードしています');

    // Should update localStorage
    expect(localStorage.getItem('appLanguage')).toBe('ja');

    // Fast-forward time to trigger reload
    await vi.advanceTimersByTimeAsync(500);

    // Should trigger page reload after 500ms delay
    expect(mockReload).toHaveBeenCalled();
  });

  it('does not reload when clicking the same language', () => {
    localStorage.setItem('appLanguage', 'en');

    render(
      <LanguageProvider>
        <LanguageSelector />
      </LanguageProvider>
    );

    const englishButton = screen.getByText('English');

    fireEvent.click(englishButton);

    // Should NOT show toast or reload
    expect(toast.info).not.toHaveBeenCalled();
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('persists language selection to localStorage', () => {
    render(
      <LanguageProvider>
        <LanguageSelector />
      </LanguageProvider>
    );

    const japaneseButton = screen.getByText('日本語');

    fireEvent.click(japaneseButton);

    // Should save to localStorage
    expect(localStorage.getItem('appLanguage')).toBe('ja');
  });

  it('switches from Japanese to English correctly', async () => {
    localStorage.setItem('appLanguage', 'ja');

    render(
      <LanguageProvider>
        <LanguageSelector />
      </LanguageProvider>
    );

    const englishButton = screen.getByText('English');

    fireEvent.click(englishButton);

    // Should show English toast message
    expect(toast.info).toHaveBeenCalledWith('Reloading to apply new language');

    // Should update localStorage
    expect(localStorage.getItem('appLanguage')).toBe('en');

    // Fast-forward time and wait for async operations
    await vi.advanceTimersByTimeAsync(500);

    // Should trigger reload
    expect(mockReload).toHaveBeenCalled();
  });
});
