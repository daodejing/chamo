'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import QRCode from '@/vendor/qrcode';
import { Button } from '@/components/ui/button';
import { generateInviteLink } from '@/lib/invite/generate-invite-link';
import { Language, t } from '@/lib/translations';

interface InviteQrCodeProps {
  language?: Language;
  familyName?: string;
}

export function InviteQrCode({ language = 'en', familyName }: InviteQrCodeProps) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const displayFamilyName = useMemo(() => {
    if (familyName && familyName.trim().length > 0) {
      return familyName;
    }

    return t('invite.defaultFamilyName', language);
  }, [familyName, language]);

  const instruction = useMemo(
    () => t('invite.qrInstructions', language, { familyName: displayFamilyName }),
    [language, displayFamilyName],
  );

  const altText = useMemo(
    () => t('invite.qrAlt', language, { familyName: displayFamilyName }),
    [language, displayFamilyName],
  );

  const loadQrCode = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const inviteLink = await generateInviteLink();
      const url = await QRCode.toDataURL(inviteLink, {
        width: 320,
        margin: 2,
        color: {
          dark: '#111111',
          light: '#ffffff00',
        },
      });

      setQrUrl(url);
    } catch (err) {
      console.error('[InviteQrCode] Failed to generate QR', err);
      setError(t('invite.qrError', language));
      setQrUrl(null);
    } finally {
      setIsLoading(false);
    }
  }, [language]);

  useEffect(() => {
    void loadQrCode();
  }, [loadQrCode]);

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-muted-foreground/40 bg-muted/20 p-6 text-center">
      {isLoading && (
        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span>{t('invite.qrLoading', language)}</span>
        </div>
      )}

      {!isLoading && qrUrl && (
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL from QR generator */}
          <img
            src={qrUrl}
            alt={altText}
            className="h-56 w-56 rounded-xl border border-muted bg-white p-4 shadow-sm"
          />
          <p className="text-sm text-muted-foreground">{instruction}</p>
        </div>
      )}

      {!isLoading && error && (
        <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
          <Button variant="outline" onClick={() => loadQrCode()} className="rounded-xl">
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('invite.qrRetry', language)}
          </Button>
        </div>
      )}
    </div>
  );
}
