'use client';

import {
  getEnvApiKey,
  getLangSmithEnvConfig,
  isApiKeyFromEnv,
  isLangSmithApiKeyFromEnv,
} from '@/env';
import { Button } from '@/lib/components/ui/button';
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '@/lib/components/ui/dialog';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import { Switch } from '@/lib/components/ui/switch';
import { useSDK } from '@/lib/contexts/sdk.context';
import { DEFAULT_LANGSMITH_ENDPOINT } from '@telegenie/config';
import { Activity, Check, Eye, EyeOff, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  getAllStoredApiKeys,
  getEffectiveLangSmithConfig,
  getLocalStorageApiKey,
  getLocalStorageLangSmithApiKey,
  getLocalStorageLangSmithEndpoint,
  getLocalStorageLangSmithTracingEnabled,
  setStoredApiKey,
  setStoredLangSmithApiKey,
  setStoredLangSmithEndpoint,
  setStoredLangSmithTracingEnabled,
} from './genie-api-keys';
import { DEFAULT_MODEL_ID, type LLMProvider } from './genie-models.constants';

export interface GenieConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeProvider?: LLMProvider;
  activeModel?: string;
}

function formatMaskedApiKey(key: string): string {
  if (!key) return '';
  const trimmed = key.trim();
  if (trimmed.length <= 4) return trimmed;
  const suffix = trimmed.slice(-4);
  return `${'•'.repeat(24)}${suffix}`;
}

export default function GenieConfigDialog({
  open,
  onOpenChange,
  activeProvider = 'OpenAI',
  activeModel,
}: GenieConfigDialogProps) {
  const sdk = useSDK();
  const [openaiKey, setOpenaiKey] = useState('');
  const [googleKey, setGoogleKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [langsmithKey, setLangsmithKey] = useState('');
  const [langsmithEnabled, setLangsmithEnabled] = useState(false);
  const [langsmithEndpoint, setLangsmithEndpoint] = useState('');
  const [showOpenai, setShowOpenai] = useState(false);
  const [showGoogle, setShowGoogle] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [showLangsmith, setShowLangsmith] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const openaiFromEnv = isApiKeyFromEnv('OpenAI');
  const googleFromEnv = isApiKeyFromEnv('Google');
  const anthropicFromEnv = isApiKeyFromEnv('Anthropic');
  const langsmithFromEnv = isLangSmithApiKeyFromEnv();
  const langsmithEnv = getLangSmithEnvConfig();

  useEffect(() => {
    if (open) {
      setOpenaiKey(getLocalStorageApiKey('OpenAI'));
      setGoogleKey(getLocalStorageApiKey('Google'));
      setAnthropicKey(getLocalStorageApiKey('Anthropic'));
      setLangsmithKey(getLocalStorageLangSmithApiKey());
      setLangsmithEnabled(getLocalStorageLangSmithTracingEnabled());
      setLangsmithEndpoint(getLocalStorageLangSmithEndpoint() || DEFAULT_LANGSMITH_ENDPOINT);
      setIsSaved(false);
    }
  }, [open]);

  const handleSave = async () => {
    if (!openaiFromEnv) setStoredApiKey('OpenAI', openaiKey);
    if (!googleFromEnv) setStoredApiKey('Google', googleKey);
    if (!anthropicFromEnv) setStoredApiKey('Anthropic', anthropicKey);
    setStoredLangSmithTracingEnabled(langsmithEnabled);
    if (!langsmithFromEnv) setStoredLangSmithApiKey(langsmithKey);
    if (langsmithEndpoint && langsmithEndpoint.trim() !== DEFAULT_LANGSMITH_ENDPOINT) {
      setStoredLangSmithEndpoint(langsmithEndpoint.trim());
    } else {
      setStoredLangSmithEndpoint('');
    }

    try {
      const apiKeys = getAllStoredApiKeys();
      const model =
        activeModel ||
        (activeProvider === 'Google'
          ? 'gemini-3.8'
          : activeProvider === 'Anthropic'
            ? 'claude-sonnet-5-5'
            : DEFAULT_MODEL_ID);

      await sdk.agent.configureModel({
        provider: activeProvider,
        model,
        apiKeys,
        langsmith: getEffectiveLangSmithConfig(),
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
                <Settings className="size-4" />
              </div>
              <DialogTitle>Genie Configuration</DialogTitle>
            </div>
            <DialogDescription>
              Configure API keys and preferences for Genie. Keys configured in{' '}
              <code className="px-1 py-0.5 rounded bg-muted text-foreground text-[11px]">.env</code>{' '}
              take precedence over localStorage.
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
                    placeholder="sk-..."
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    className="text-xs font-mono pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenai(!showOpenai)}
                    className="absolute right-2 text-muted-foreground hover:text-foreground"
                  >
                    {showOpenai ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
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
                    placeholder="AIza..."
                    value={googleKey}
                    onChange={(e) => setGoogleKey(e.target.value)}
                    className="text-xs font-mono pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGoogle(!showGoogle)}
                    className="absolute right-2 text-muted-foreground hover:text-foreground"
                  >
                    {showGoogle ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
              )}
            </div>

            {/* Anthropic Claude */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="anthropic-key" className="text-xs font-medium">
                Anthropic API Key
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
                  <button
                    type="button"
                    onClick={() => setShowAnthropic(!showAnthropic)}
                    className="absolute right-2 text-muted-foreground hover:text-foreground"
                  >
                    {showAnthropic ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Telemetry / Quality Improvement Configuration */}
            <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 mt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-primary" />
                  <div>
                    <Label htmlFor="langsmith-toggle" className="text-xs font-semibold cursor-pointer">
                      Help us make TeleGenie better
                    </Label>
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      Share anonymous diagnostics to improve AI quality and performance
                    </p>
                  </div>
                </div>
                <Switch
                  id="langsmith-toggle"
                  checked={langsmithEnabled}
                  onCheckedChange={setLangsmithEnabled}
                />
              </div>

              {langsmithEnabled && (
                <div className="flex flex-col gap-3 pt-2 border-t border-border/40">
                  {/* Diagnostics Key */}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="langsmith-key" className="text-[11px] font-medium text-foreground/80">
                      Diagnostics Key (optional)
                    </Label>
                    {langsmithFromEnv ? (
                      <Input
                        id="langsmith-key"
                        type="text"
                        readOnly
                        disabled
                        value={formatMaskedApiKey(langsmithEnv.apiKey)}
                        className="text-xs font-mono bg-muted/40 text-foreground/90 cursor-default select-all"
                      />
                    ) : (
                      <div className="relative flex items-center">
                        <Input
                          id="langsmith-key"
                          type={showLangsmith ? 'text' : 'password'}
                          placeholder="Optional custom key"
                          value={langsmithKey}
                          onChange={(e) => setLangsmithKey(e.target.value)}
                          className="text-xs font-mono pr-8"
                        />
                        <button
                          type="button"
                          onClick={() => setShowLangsmith(!showLangsmith)}
                          className="absolute right-2 text-muted-foreground hover:text-foreground"
                        >
                          {showLangsmith ? (
                            <EyeOff className="size-3.5" />
                          ) : (
                            <Eye className="size-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Diagnostics Endpoint */}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="langsmith-endpoint" className="text-[11px] font-medium text-foreground/80">
                      Endpoint (optional)
                    </Label>
                    <Input
                      id="langsmith-endpoint"
                      type="text"
                      placeholder={DEFAULT_LANGSMITH_ENDPOINT}
                      value={langsmithEndpoint}
                      onChange={(e) => setLangsmithEndpoint(e.target.value)}
                      className="text-xs font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="px-6 pb-4">
            <DialogClose render={<Button variant="outline" size="sm" />}>Cancel</DialogClose>
            <Button size="sm" onClick={handleSave} disabled={isSaved} className="gap-1.5">
              {isSaved ? (
                <>
                  <Check className="size-3.5" />
                  Saved
                </>
              ) : (
                'Save Settings'
              )}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
