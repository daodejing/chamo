'use client';

import { useState, useMemo } from 'react';
import { Share2, Loader2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/utils';
import { generateInviteLink } from '@/lib/invite/generate-invite-link';
import { t, type Language } from '@/lib/translations';

type ButtonProps = React.ComponentProps<typeof Button>;

interface InviteMemberButtonProps extends Omit<ButtonProps, 'onClick'> {
  language?: Language;
  familyName?: string;
  shareTitleKey?: string;
  shareTextKey?: string;
}

const DEFAULT_SHARE_TITLE_KEY = 'invite.shareTitle';
const DEFAULT_SHARE_TEXT_KEY = 'invite.shareText';

export function InviteMemberButton({
  language = 'en',
  familyName,
  shareTitleKey = DEFAULT_SHARE_TITLE_KEY,
  shareTextKey = DEFAULT_SHARE_TEXT_KEY,
  className,
  children,
  disabled,
  variant,
  size,
  ...buttonProps
}: InviteMemberButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const shareTitle = useMemo(
    () => t(shareTitleKey, language, { familyName }),
    [shareTitleKey, language, familyName],
  );

  const shareText = useMemo(
    () => t(shareTextKey, language, { familyName }),
    [shareTextKey, language, familyName],
  );

  const supportsShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  async function handleShare() {
    setIsLoading(true);

    try {
      const inviteLink = await generateInviteLink();
      const sharePayload = {
        title: shareTitle,
        text: shareText,
        url: inviteLink,
      };

      if (supportsShare) {
        await navigator.share(sharePayload);
        toast.success(t('toast.inviteShareSuccess', language));
        return;
      }

      await copyToClipboard(inviteLink);
      toast.success(t('toast.inviteLinkCopied', language));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast.info(t('toast.inviteShareCancelled', language));
      } else {
        toast.error(t('toast.inviteShareFailed', language));
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Button
      {...buttonProps}
      variant={variant}
      size={size}
      className={cn('rounded-xl', className)}
      disabled={disabled || isLoading}
      onClick={handleShare}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : supportsShare ? (
        <Share2 className="w-4 h-4" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
      <span>{children ?? t('invite.shareButtonLabel', language)}</span>
    </Button>
  );
}

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}
