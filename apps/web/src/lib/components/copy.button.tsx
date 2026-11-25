'use client';

import { Check, Copy } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button, type ButtonProps } from '@/lib/components/ui/button';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/lib/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface CopyButtonProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  value: string;
  copiedLabel?: string;
  resetDelayMs?: number;
  side?: 'top' | 'bottom' | 'left' | 'right';
  iconClassName?: string;
  onCopied?: (value: string) => void;
  onCopyError?: (error: unknown) => void;
}

export default function CopyButton({
  value,
  copiedLabel = 'Copied!',
  resetDelayMs = 1600,
  side = 'top',
  variant = 'ghost',
  size = 'icon',
  type = 'button',
  className,
  iconClassName,
  'aria-label': ariaLabel = 'Copy to clipboard',
  onCopied,
  onCopyError,
  ...buttonProps
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleClick = useCallback(() => {
    if (!value) return;
    if (!navigator.clipboard?.writeText) {
      onCopyError?.(new Error('Clipboard API unavailable'));
      return;
    }

    void navigator.clipboard
      .writeText(value)
      .then(() => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        setCopied(true);
        onCopied?.(value);
        timerRef.current = setTimeout(() => {
          setCopied(false);
          timerRef.current = null;
        }, resetDelayMs);
      })
      .catch((err: unknown) => {
        onCopyError?.(err);
      });
  }, [onCopied, onCopyError, resetDelayMs, value]);

  return (
    <Tooltip open={copied} disableHoverablePopup>
      <TooltipTrigger
        render={
          <Button
            type={type}
            variant={variant}
            size={size}
            aria-label={ariaLabel}
            onClick={handleClick}
            className={cn(
              'size-8 shrink-0 text-primary hover:bg-primary/10 hover:text-primary',
              className,
            )}
            {...buttonProps}
          />
        }
      >
        {copied ? (
          <Check className={cn('size-4', iconClassName)} aria-hidden="true" />
        ) : (
          <Copy className={cn('size-4', iconClassName)} aria-hidden="true" />
        )}
      </TooltipTrigger>
      <TooltipPopup side={side}>{copiedLabel}</TooltipPopup>
    </Tooltip>
  );
}
