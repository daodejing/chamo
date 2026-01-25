'use client';

import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/contexts/language-context';
import { t } from '@/lib/translations';
import { useAuth } from '@/lib/contexts/auth-context';
import { getPrivateKey, hasPrivateKey } from '@/lib/crypto/secure-storage';
import { derivePublicKeyFromSecretKey } from '@/lib/crypto/keypair';
import {
  generateTransferPIN,
  encryptKeyForTransfer,
  serializePayload,
} from '@/lib/crypto/key-transfer';
import { AlertCircle, RefreshCw, Loader2 } from 'lucide-react';

type KeyTransferExportProps = {
  open: boolean;
  onClose: () => void;
};

type TransferState = {
  pin: string;
  qrPayload: string;
  expiresAt: number;
};

export function KeyTransferExport({ open, onClose }: KeyTransferExportProps) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [transferState, setTransferState] = useState<TransferState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<{ minutes: number; seconds: number } | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  // Check if user has a private key
  useEffect(() => {
    if (!open || !user) return;

    async function checkKey() {
      const exists = await hasPrivateKey(user!.id);
      setHasKey(exists);
    }

    checkKey();
  }, [open, user]);

  // Generate QR code with encrypted key
  const generateTransfer = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);
    setIsExpired(false);

    try {
      // Get private key from IndexedDB
      const privateKey = await getPrivateKey(user.id);
      if (!privateKey) {
        setError(t('keyTransfer.noKeyToExport', language));
        setIsLoading(false);
        return;
      }

      // Derive public key from the private key
      const publicKey = derivePublicKeyFromSecretKey(privateKey);

      // Generate PIN and encrypt
      const pin = generateTransferPIN();
      const payload = await encryptKeyForTransfer(privateKey, publicKey, pin);
      const serialized = serializePayload(payload);

      setTransferState({
        pin,
        qrPayload: serialized,
        expiresAt: payload.expiresAt,
      });
    } catch (err) {
      console.error('Failed to generate transfer:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate transfer');
    } finally {
      setIsLoading(false);
    }
  }, [user, language]);

  // Generate on open
  useEffect(() => {
    if (open && hasKey && !transferState && !isLoading) {
      generateTransfer();
    }
  }, [open, hasKey, transferState, isLoading, generateTransfer]);

  // Countdown timer
  useEffect(() => {
    if (!transferState) return;

    const updateTimer = () => {
      const remaining = transferState.expiresAt - Date.now();
      if (remaining <= 0) {
        setIsExpired(true);
        setTimeRemaining(null);
      } else {
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        setTimeRemaining({ minutes, seconds });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [transferState]);

  // Clear state on close
  useEffect(() => {
    if (!open) {
      // Security: Clear sensitive data from memory
      setTransferState(null);
      setError(null);
      setIsExpired(false);
      setTimeRemaining(null);
    }
  }, [open]);

  const handleRegenerate = () => {
    setTransferState(null);
    generateTransfer();
  };

  const handleClose = () => {
    // Security: Clear sensitive data
    setTransferState(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('keyTransfer.exportTitle', language)}</DialogTitle>
          <DialogDescription>
            {t('keyTransfer.exportDescription', language)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center space-y-4 py-4">
          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col items-center gap-2 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Generating...</p>
            </div>
          )}

          {/* No key available */}
          {hasKey === false && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
              <p className="text-sm text-muted-foreground">
                {t('keyTransfer.noKeyToExport', language)}
              </p>
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" onClick={handleRegenerate} className="mt-2">
                <RefreshCw className="w-4 h-4 mr-2" />
                {t('keyTransfer.regenerate', language)}
              </Button>
            </div>
          )}

          {/* QR Code display */}
          {transferState && !isExpired && !error && (
            <>
              <div className="p-4 bg-white rounded-xl">
                <QRCodeSVG
                  value={transferState.qrPayload}
                  size={200}
                  level="M"
                  includeMargin
                />
              </div>

              {/* PIN Display */}
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t('keyTransfer.pinLabel', language)}
                </p>
                <div className="font-mono text-3xl font-bold tracking-widest text-primary" aria-label={`PIN: ${transferState.pin.split('').join(' ')}`}>
                  {transferState.pin}
                </div>
              </div>

              {/* Countdown timer */}
              {timeRemaining && (
                <p className="text-sm text-muted-foreground">
                  {t('keyTransfer.expiresIn', language, {
                    minutes: String(timeRemaining.minutes).padStart(2, '0'),
                    seconds: String(timeRemaining.seconds).padStart(2, '0'),
                  })}
                </p>
              )}
            </>
          )}

          {/* Expired state */}
          {isExpired && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="p-4 bg-muted rounded-xl opacity-50">
                <div className="w-[200px] h-[200px] flex items-center justify-center">
                  <AlertCircle className="w-12 h-12 text-muted-foreground" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                {t('keyTransfer.expired', language)}
              </p>
              <Button onClick={handleRegenerate}>
                <RefreshCw className="w-4 h-4 mr-2" />
                {t('keyTransfer.regenerate', language)}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
