'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogPopup,
  DialogTitle,
} from '@/lib/components/ui/dialog';
import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import {
  getLocalStorageApiKey,
  setStoredApiKey,
  isApiKeyFromEnv,
  getEnvApiKey,
  getAllStoredApiKeys,
} from './genie-api-keys';
import { useSDK } from '@/lib/contexts/sdk.context';
import { KeyRound, Check, Sparkles, Eye, EyeOff } from 'lucide-react';
import type { LLMProvider } from './genie-models.constants';

export interface GenieApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeProvider?: LLMProvider;
}

function formatMaskedApiKey(key: string): string {
  if (!key) return '';
  const trimmed = key.trim();
  if (trimmed.length <= 4) return trimmed;
  const suffix = trimmed.slice(-4);
  return `${'•'.repeat(24)}${suffix}`;
}

export default function GenieApiKeyDialog({
  open,
  onOpenChange,
  activeProvider = 'OpenAI',
}: GenieApiKeyDialogProps) {
  const sdk = useSDK();
  const [openaiKey, setOpenaiKey] = useState('');
  const [googleKey, setGoogleKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [showOpenai, setShowOpenai] = useState(false);
  const [showGoogle, setShowGoogle] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const openaiFromEnv = isApiKeyFromEnv('OpenAI');
  const googleFromEnv = isApiKeyFromEnv('Google');
  const anthropicFromEnv = isApiKeyFromEnv('Anthropic');

  useEffect(() => {
    if (open) {
      setOpenaiKey(getLocalStorageApiKey('OpenAI'));
      setGoogleKey(getLocalStorageApiKey('Google'));
      setAnthropicKey(getLocalStorageApiKey('Anthropic'));
      setIsSaved(false);
    }
  }, [open]);

  const handleSave = async () => {
    if (!openaiFromEnv) setStoredApiKey('OpenAI', openaiKey);
    if (!googleFromEnv) setStoredApiKey('Google', googleKey);
    if (!anthropicFromEnv) setStoredApiKey('Anthropic', anthropicKey);

    // Sync effective keys (.env taking precedence) to active agent worker
    try {
      const apiKeys = getAllStoredApiKeys();
      await sdk.agent.configureModel({
        provider: activeProvider,
        model:
          activeProvider === 'OpenAI'
            ? 'gpt-4o'
            : activeProvider === 'Google'
              ? 'gemini-3.8'
              : 'claude-sonnet-5-5',
        apiKeys,
      });
    } catch (e) {
      console.warn('Failed to configure model in worker:', e);
    }

    setIsSaved(true);
    setTimeout(() => {
      onOpenChange(false);
    }, 600);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="max-w-md w-full">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <KeyRound className="size-4" />
              </div>
              <DialogTitle>AI Model API Keys</DialogTitle>
            </div>
            <DialogDescription>
              Configure API keys for your preferred LLM providers. Keys configured in <code className="px-1 py-0.5 rounded bg-muted text-foreground text-[11px]">.env</code> take precedence over localStorage.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 px-6 py-3">
            {/* OpenAI (Default) */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="openai-key" className="text-xs font-medium">
                OpenAI API Key (Default)
              </Label>
              {openaiFromEnv ? (
                <Input
                  id="openai-key"
                  type="text"
                  readOnly
                  disabled
                  value={formatMaskedApiKey(getEnvApiKey('OpenAI'))}
                  className="text-xs font-mono bg-muted/40 text-foreground/90 cursor-default select-all"
                />
              ) : (
                <div className="relative flex items-center">
                  <Input
                    id="openai-key"
                    type={showOpenai ? 'text' : 'password'}
                    placeholder="sk-proj-..."
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    className="text-xs font-mono pr-8"
                  />
                  {openaiKey && (
                    <button
                      type="button"
                      onClick={() => setShowOpenai(!showOpenai)}
                      className="absolute right-2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
                      title={showOpenai ? 'Hide key' : 'Show key'}
                    >
                      {showOpenai ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Google Gemini */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="google-key" className="text-xs font-medium">
                Google Gemini API Key
              </Label>
              {googleFromEnv ? (
                <Input
                  id="google-key"
                  type="text"
                  readOnly
                  disabled
                  value={formatMaskedApiKey(getEnvApiKey('Google'))}
                  className="text-xs font-mono bg-muted/40 text-foreground/90 cursor-default select-all"
                />
              ) : (
                <div className="relative flex items-center">
                  <Input
                    id="google-key"
                    type={showGoogle ? 'text' : 'password'}
                    placeholder="AIzaSy..."
                    value={googleKey}
                    onChange={(e) => setGoogleKey(e.target.value)}
                    className="text-xs font-mono pr-8"
                  />
                  {googleKey && (
                    <button
                      type="button"
                      onClick={() => setShowGoogle(!showGoogle)}
                      className="absolute right-2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
                      title={showGoogle ? 'Hide key' : 'Show key'}
                    >
                      {showGoogle ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Anthropic Claude */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="anthropic-key" className="text-xs font-medium">
                Anthropic Claude API Key
              </Label>
              {anthropicFromEnv ? (
                <Input
                  id="anthropic-key"
                  type="text"
                  readOnly
                  disabled
                  value={formatMaskedApiKey(getEnvApiKey('Anthropic'))}
                  className="text-xs font-mono bg-muted/40 text-foreground/90 cursor-default select-all"
                />
              ) : (
                <div className="relative flex items-center">
                  <Input
                    id="anthropic-key"
                    type={showAnthropic ? 'text' : 'password'}
                    placeholder="sk-ant-..."
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    className="text-xs font-mono pr-8"
                  />
                  {anthropicKey && (
                    <button
                      type="button"
                      onClick={() => setShowAnthropic(!showAnthropic)}
                      className="absolute right-2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
                      title={showAnthropic ? 'Hide key' : 'Show key'}
                    >
                      {showAnthropic ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between gap-2">
            <DialogClose render={<Button variant="outline" size="sm" type="button" />}>
              Cancel
            </DialogClose>
            <Button
              size="sm"
              type="button"
              onClick={handleSave}
              className="gap-1.5"
            >
              {isSaved ? (
                <>
                  <Check className="size-3.5 text-green-400" />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5" />
                  <span>Save Keys</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
