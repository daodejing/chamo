'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/lib/contexts/language-context';
import { t } from '@/lib/translations';
import { useAuth } from '@/lib/contexts/auth-context';
import { storePrivateKey } from '@/lib/crypto/secure-storage';
import { decodePublicKey } from '@/lib/crypto/keypair';
import {
  parsePayload,
  decryptKeyFromTransfer,
  verifyKeyPair,
  KeyTransferError,
  MAX_PIN_ATTEMPTS,
  type TransferPayload,
} from '@/lib/crypto/key-transfer';
import { AlertCircle, Camera, CheckCircle, Loader2, Keyboard } from 'lucide-react';

type KeyTransferImportProps = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

type ImportStep = 'scan' | 'pin' | 'verifying' | 'success' | 'error';

export function KeyTransferImport({ open, onClose, onSuccess }: KeyTransferImportProps) {
  const { language } = useLanguage();
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState<ImportStep>('scan');
  const [payload, setPayload] = useState<TransferPayload | null>(null);
  const [pin, setPin] = useState('');
  const [pinAttempts, setPinAttempts] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStep('scan');
      setPayload(null);
      setPin('');
      setPinAttempts(0);
      setError(null);
      setCameraError(false);
      setShowManualEntry(false);
      setManualInput('');
    }
  }, [open]);

  // Focus PIN input when entering PIN step
  useEffect(() => {
    if (step === 'pin' && pinInputRef.current) {
      pinInputRef.current.focus();
    }
  }, [step]);

  // Handle QR code scan
  const handleScan = useCallback((result: { rawValue: string }[]) => {
    if (!result || result.length === 0 || step !== 'scan') return;

    const data = result[0].rawValue;
    try {
      const parsedPayload = parsePayload(data);
      setPayload(parsedPayload);
      setStep('pin');
      setError(null);
    } catch (err) {
      if (err instanceof KeyTransferError) {
        setError(t('keyTransfer.error.invalidQR', language));
      } else {
        setError(t('keyTransfer.error.invalidQR', language));
      }
    }
  }, [step, language]);

  // Handle manual QR data entry
  const handleManualSubmit = useCallback(() => {
    try {
      const parsedPayload = parsePayload(manualInput.trim());
      setPayload(parsedPayload);
      setStep('pin');
      setError(null);
      setShowManualEntry(false);
    } catch {
      setError(t('keyTransfer.error.invalidQR', language));
    }
  }, [manualInput, language]);

  // Handle PIN submission
  const handlePinSubmit = useCallback(async () => {
    if (!payload || !user || pin.length !== 6) return;

    setStep('verifying');
    setError(null);

    try {
      // Decrypt the private key
      const privateKey = await decryptKeyFromTransfer(payload, pin);

      // Verify the decrypted private key matches the public key in the payload
      const payloadPublicKey = decodePublicKey(payload.publicKey);
      if (!verifyKeyPair(privateKey, payloadPublicKey)) {
        throw new KeyTransferError('KEY_MISMATCH', t('keyTransfer.error.mismatch', language));
      }

      // Store the private key
      await storePrivateKey(user.id, privateKey);

      // Refresh auth context to pick up the new key
      if (refreshUser) {
        await refreshUser();
      }

      setStep('success');

      // Notify parent after a short delay
      setTimeout(() => {
        onSuccess?.();
      }, 1500);
    } catch (err) {
      const newAttempts = pinAttempts + 1;
      setPinAttempts(newAttempts);
      setPin('');

      if (err instanceof KeyTransferError) {
        if (err.code === 'PAYLOAD_EXPIRED') {
          setError(t('keyTransfer.error.expired', language));
          setStep('error');
        } else if (err.code === 'KEY_MISMATCH') {
          setError(t('keyTransfer.error.mismatch', language));
          setStep('error');
        } else if (err.code === 'INVALID_PIN') {
          if (newAttempts >= MAX_PIN_ATTEMPTS) {
            setError(t('keyTransfer.error.maxAttempts', language));
            setStep('error');
          } else {
            const remaining = MAX_PIN_ATTEMPTS - newAttempts;
            setError(t('keyTransfer.error.wrongPin', language, { remaining: String(remaining) }));
            setStep('pin');
          }
        } else {
          setError(err.message);
          setStep('error');
        }
      } else {
        console.error('Import error:', err);
        setError(err instanceof Error ? err.message : 'Import failed');
        setStep('error');
      }
    }
  }, [payload, user, pin, pinAttempts, language, onSuccess, refreshUser]);

  // Handle PIN input change (only allow digits)
  const handlePinChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setPin(digits);
    setError(null);
  };

  // Handle camera error
  const handleCameraError = () => {
    setCameraError(true);
    setError(t('keyTransfer.error.camera', language));
  };

  const handleClose = () => {
    // Clear sensitive data
    setPayload(null);
    setPin('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('keyTransfer.importTitle', language)}</DialogTitle>
          <DialogDescription>
            {step === 'scan' && t('keyTransfer.scanPrompt', language)}
            {step === 'pin' && t('keyTransfer.enterPin', language)}
            {step === 'verifying' && t('keyTransfer.verifying', language)}
            {step === 'success' && t('keyTransfer.success', language)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center space-y-4 py-4">
          {/* Scanning step */}
          {step === 'scan' && !showManualEntry && (
            <>
              {!cameraError ? (
                <div className="w-full aspect-square max-w-[300px] rounded-xl overflow-hidden bg-black">
                  <Scanner
                    onScan={handleScan}
                    onError={handleCameraError}
                    styles={{
                      container: { width: '100%', height: '100%' },
                      video: { width: '100%', height: '100%', objectFit: 'cover' },
                    }}
                    components={{
                      torch: false,
                      finder: true,
                    }}
                  />
                </div>
              ) : (
                <div className="w-full aspect-square max-w-[300px] rounded-xl bg-muted flex flex-col items-center justify-center gap-4">
                  <Camera className="w-12 h-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground text-center px-4">
                    {t('keyTransfer.error.camera', language)}
                  </p>
                </div>
              )}

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button
                variant="ghost"
                className="text-sm"
                onClick={() => setShowManualEntry(true)}
              >
                <Keyboard className="w-4 h-4 mr-2" />
                {t('keyTransfer.manualEntry', language)}
              </Button>
            </>
          )}

          {/* Manual entry */}
          {step === 'scan' && showManualEntry && (
            <div className="w-full space-y-4">
              <div className="space-y-2">
                <Label htmlFor="manual-qr">{t('keyTransfer.manualEntry', language)}</Label>
                <textarea
                  id="manual-qr"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder={t('keyTransfer.manualEntryPlaceholder', language)}
                  className="w-full h-32 p-3 text-sm font-mono rounded-xl border bg-background resize-none"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowManualEntry(false);
                    setError(null);
                  }}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleManualSubmit}
                  disabled={!manualInput.trim()}
                  className="flex-1"
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* PIN entry step */}
          {step === 'pin' && (
            <div className="w-full space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pin">{t('keyTransfer.enterPin', language)}</Label>
                <Input
                  ref={pinInputRef}
                  id="pin"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => handlePinChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && pin.length === 6) {
                      handlePinSubmit();
                    }
                  }}
                  className="text-center text-2xl font-mono tracking-widest"
                  placeholder="000000"
                  aria-label="6-digit PIN"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}

              <Button
                onClick={handlePinSubmit}
                disabled={pin.length !== 6}
                className="w-full"
              >
                Continue
              </Button>
            </div>
          )}

          {/* Verifying step */}
          {step === 'verifying' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {t('keyTransfer.verifying', language)}
              </p>
            </div>
          )}

          {/* Success step */}
          {step === 'success' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle className="w-12 h-12 text-green-500" />
              <p className="text-lg font-medium text-center">
                {t('keyTransfer.success', language)}
              </p>
            </div>
          )}

          {/* Error step */}
          {step === 'error' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <AlertCircle className="w-12 h-12 text-destructive" />
              <p className="text-sm text-destructive text-center">{error}</p>
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
