import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/contexts/language-context';
import { t } from '@/lib/translations';
import { KeyTransferImport } from '@/components/settings/KeyTransferImport';
import { Smartphone } from 'lucide-react';

const MODAL_STORAGE_KEY = 'lost_key_modal_seen';
const MODAL_EXPIRY_MS = 1000 * 60 * 60 * 24; // 24 hours

type LostKeyFlag = {
  userId: string;
  timestamp: number;
};

export function LostKeyModal({
  open,
  onContinue,
}: {
  open: boolean;
  onContinue: () => void;
}) {
  const { language } = useLanguage();
  const [showImport, setShowImport] = useState(false);

  const handleTransferSuccess = () => {
    setShowImport(false);
    onContinue();
  };

  return (
    <>
      <Dialog open={open && !showImport}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('lostKey.title', language)}</DialogTitle>
            <DialogDescription>{t('lostKey.message', language)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>{t('lostKey.warning', language)}</p>
            <p>{t('lostKey.helpText', language)}</p>
          </div>
          <DialogFooter className="flex flex-col gap-3 sm:flex-col">
            <Button
              onClick={() => setShowImport(true)}
              variant="outline"
              className="w-full"
              data-testid="lost-key-modal-transfer"
            >
              <Smartphone className="w-4 h-4 mr-2" />
              {t('lostKey.transferOption', language)}
            </Button>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 w-full">
              <Button asChild variant="link" className="px-0 text-primary w-full sm:w-auto">
                <a href="/help/encryption-keys" target="_blank" rel="noreferrer">
                  {t('lostKey.learnMore', language)}
                </a>
              </Button>
              <Button onClick={onContinue} className="w-full sm:w-auto" data-testid="lost-key-modal-continue">
                {t('lostKey.continue', language)}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <KeyTransferImport
        open={showImport}
        onClose={() => setShowImport(false)}
        onSuccess={handleTransferSuccess}
      />
    </>
  );
}

export function markLostKeyModalShown(userId: string) {
  try {
    const payload: LostKeyFlag = { userId, timestamp: Date.now() };
    localStorage.setItem(MODAL_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Failed to store LostKey modal flag', error);
  }
}

export function hasSeenLostKeyModal(userId: string): boolean {
  try {
    const raw = localStorage.getItem(MODAL_STORAGE_KEY);
    if (!raw) return false;
    const payload = JSON.parse(raw) as LostKeyFlag;
    if (payload.userId !== userId) {
      return false;
    }
    return Date.now() - payload.timestamp < MODAL_EXPIRY_MS;
  } catch {
    return false;
  }
}

export function clearLostKeyModalFlag(userId?: string) {
  try {
    if (!localStorage.getItem(MODAL_STORAGE_KEY)) {
      return;
    }
    if (userId) {
      const raw = localStorage.getItem(MODAL_STORAGE_KEY);
      if (raw) {
        const payload = JSON.parse(raw) as LostKeyFlag;
        if (payload.userId !== userId) {
          return;
        }
      }
    }
    localStorage.removeItem(MODAL_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear LostKey modal flag', error);
  }
}
