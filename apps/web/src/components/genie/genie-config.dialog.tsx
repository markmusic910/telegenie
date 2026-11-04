'use client';

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
import { useSDK, useStore } from '@/lib/contexts/sdk.context';
import { Activity, AlertCircle, Check, ExternalLink, Eye, EyeOff, Key, RefreshCw, Settings, ShieldCheck, Sparkles } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import {
  getAllStoredApiKeys,
  getLocalStorageApiKey,
  setStoredApiKey,
} from './genie-api-keys';
import { DEFAULT_MODEL_ID, type LLMProvider } from './genie-models.constants';

export interface GenieConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeProvider?: LLMProvider;
  activeModel?: string;
}

const GenieConfigDialog = observer(function GenieConfigDialog({
  open,
  onOpenChange,
  activeProvider = 'OpenAI',
  activeModel,
}: GenieConfigDialogProps) {
  const sdk = useSDK();
  const globalStore = useStore('global');
  const { auth } = globalStore;

  const [isSyncingBackend, setIsSyncingBackend] = useState(false);
  const [isUpdatingTracing, setIsUpdatingTracing] = useState(false);
  const [openaiKey, setOpenaiKey] = useState('');
  const [googleKey, setGoogleKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [showOpenai, setShowOpenai] = useState(false);
  const [showGoogle, setShowGoogle] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const tracingEnabled = auth.backendUserProfile?.enableTracing ?? false;

  const handleSyncBackend = async () => {
    setIsSyncingBackend(true);
    try {
      await sdk.auth.authenticateBackend({ force: true });
    } finally {
      setIsSyncingBackend(false);
    }
  };

  const handleToggleTracing = async (enabled: boolean) => {
    setIsUpdatingTracing(true);
    try {
      await sdk.auth.setEnableTracing(enabled);
    } finally {
      setIsUpdatingTracing(false);
    }
  };

  useEffect(() => {
    if (open) {
      setOpenaiKey(getLocalStorageApiKey('OpenAI'));
      setGoogleKey(getLocalStorageApiKey('Google'));
      setAnthropicKey(getLocalStorageApiKey('Anthropic'));
      setIsSaved(false);
    }
  }, [open]);

  const handleSave = async () => {
    setStoredApiKey('OpenAI', openaiKey);
    setStoredApiKey('Google', googleKey);
    setStoredApiKey('Anthropic', anthropicKey);

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
              Configure personal API keys (BYOK) or use TeleGenie Cloud AI proxy with free credits. Personal keys are stored securely in your browser.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 px-6 py-3">
            {/* TeleGenie Cloud Backend Service */}
            <div className="rounded-xl border border-border/70 bg-card/60 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
                    <ShieldCheck className="size-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      TeleGenie Cloud Service
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono truncate max-w-[200px]">
                      {sdk.auth.getBackendBaseUrl()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className={`size-2 rounded-full ${
                      auth.backendAuthStatus === 'authenticated'
                        ? 'bg-emerald-500 animate-pulse'
                        : auth.backendAuthStatus === 'verifying' || auth.backendAuthStatus === 'challenging'
                          ? 'bg-amber-500 animate-pulse'
                          : 'bg-muted-foreground/40'
                    }`}
                  />
                  <span className="text-[11px] font-medium capitalize text-muted-foreground">
                    {auth.backendAuthStatus === 'authenticated'
                      ? 'Connected'
                      : auth.backendAuthStatus === 'verifying'
                        ? 'Verifying...'
                        : auth.backendAuthStatus === 'challenging'
                          ? 'Connecting...'
                          : auth.backendAuthStatus === 'error'
                            ? 'Error'
                            : 'Idle'}
                  </span>
                </div>
              </div>

              {auth.backendUserProfile ? (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="rounded-lg bg-background/70 border border-border/50 p-2 text-center">
                    <div className="text-[10px] text-muted-foreground">Daily Free Credits</div>
                    <div className="text-xs font-semibold text-foreground">
                      {auth.backendUserProfile.credits.dailyFreeRemaining} / {auth.backendUserProfile.credits.dailyFreeLimit}
                    </div>
                  </div>
                  <div className="rounded-lg bg-background/70 border border-border/50 p-2 text-center">
                    <div className="text-[10px] text-muted-foreground">Paid Balance</div>
                    <div className="text-xs font-semibold text-foreground">
                      {auth.backendUserProfile.credits.paidCredits}
                    </div>
                  </div>
                </div>
              ) : null}

              {auth.backendAuthError && (
                <div className="text-[11px] text-destructive bg-destructive/10 rounded-md p-2 flex items-start gap-1.5">
                  <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                  <span className="leading-tight">{auth.backendAuthError}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                {auth.backendChallengeNonce ? (
                  <a
                    href={sdk.auth.getDeepLinkUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                  >
                    <span>Open @{auth.backendBotUsername}</span>
                    <ExternalLink className="size-3" />
                  </a>
                ) : (
                  <span className="text-[10px] text-muted-foreground">
                    Zero-trust MTProto identity sync
                  </span>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncBackend}
                  disabled={isSyncingBackend || auth.backendAuthStatus === 'challenging' || auth.backendAuthStatus === 'verifying'}
                  className="h-7 text-xs px-2.5 gap-1.5"
                >
                  <RefreshCw className={`size-3 ${isSyncingBackend || auth.backendAuthStatus === 'challenging' || auth.backendAuthStatus === 'verifying' ? 'animate-spin' : ''}`} />
                  <span>{auth.backendAuthStatus === 'authenticated' ? 'Refresh' : 'Connect'}</span>
                </Button>
              </div>
            </div>

            {/* OpenAI API Key */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="openai-key" className="text-xs font-medium flex items-center gap-1.5">
                  <span>OpenAI API Key</span>
                  {activeProvider === 'OpenAI' && (
                    <span className="size-1.5 rounded-full bg-primary" />
                  )}
                </Label>
                {openaiKey.trim() ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <Key className="size-2.5" />
                    BYOK (Direct)
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1">
                    <Sparkles className="size-2.5" />
                    Cloud Free Credits
                  </span>
                )}
              </div>
              <div className="relative flex items-center">
                <Input
                  id="openai-key"
                  type={showOpenai ? 'text' : 'password'}
                  placeholder="Optional: sk-..."
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  className="text-xs font-mono pr-8"
                />
                <button
                  type="button"
                  onClick={() => setShowOpenai(!showOpenai)}
                  className="absolute right-2 text-muted-foreground hover:text-foreground"
                >
                  {showOpenai ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Google Gemini API Key */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="google-key" className="text-xs font-medium flex items-center gap-1.5">
                  <span>Google AI Studio API Key</span>
                  {activeProvider === 'Google' && (
                    <span className="size-1.5 rounded-full bg-primary" />
                  )}
                </Label>
                {googleKey.trim() ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <Key className="size-2.5" />
                    BYOK (Direct)
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1">
                    <Sparkles className="size-2.5" />
                    Cloud Free Credits
                  </span>
                )}
              </div>
              <div className="relative flex items-center">
                <Input
                  id="google-key"
                  type={showGoogle ? 'text' : 'password'}
                  placeholder="Optional: AIzaSy..."
                  value={googleKey}
                  onChange={(e) => setGoogleKey(e.target.value)}
                  className="text-xs font-mono pr-8"
                />
                <button
                  type="button"
                  onClick={() => setShowGoogle(!showGoogle)}
                  className="absolute right-2 text-muted-foreground hover:text-foreground"
                >
                  {showGoogle ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Anthropic API Key */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="anthropic-key" className="text-xs font-medium flex items-center gap-1.5">
                  <span>Anthropic Claude API Key</span>
                  {activeProvider === 'Anthropic' && (
                    <span className="size-1.5 rounded-full bg-primary" />
                  )}
                </Label>
                {anthropicKey.trim() ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <Key className="size-2.5" />
                    BYOK (Direct)
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1">
                    <Sparkles className="size-2.5" />
                    Cloud Free Credits
                  </span>
                )}
              </div>
              <div className="relative flex items-center">
                <Input
                  id="anthropic-key"
                  type={showAnthropic ? 'text' : 'password'}
                  placeholder="Optional: sk-ant-..."
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
            </div>

            {/* Agent Tracing & Diagnostics */}
            <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 mt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-primary" />
                  <div>
                    <Label htmlFor="tracing-toggle" className="text-xs font-semibold cursor-pointer">
                      Agent Tracing & Diagnostics
                    </Label>
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      {auth.backendAuthStatus === 'authenticated'
                        ? 'Enable Cloudflare AI Gateway & Agent Tracing to record session replays and debug queries'
                        : 'Connect TeleGenie Cloud above to enable Agent Tracing & diagnostics'}
                    </p>
                  </div>
                </div>
                <Switch
                  id="tracing-toggle"
                  checked={tracingEnabled}
                  disabled={isUpdatingTracing || auth.backendAuthStatus !== 'authenticated'}
                  onCheckedChange={handleToggleTracing}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4">
            <DialogClose render={<Button type="button" variant="outline" size="sm" />}>
              Cancel
            </DialogClose>
            <Button
              size="sm"
              onClick={handleSave}
              className="gap-1.5 min-w-[80px]"
            >
              {isSaved ? (
                <>
                  <Check className="size-3.5 text-emerald-500" />
                  <span>Saved</span>
                </>
              ) : (
                <span>Save</span>
              )}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
});

export default GenieConfigDialog;
