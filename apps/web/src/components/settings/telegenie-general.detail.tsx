'use client';

import {
  getAllStoredApiKeys,
  getLocalStorageApiKey,
  setStoredApiKey,
} from '@/components/genie/genie-api-keys';
import { DEFAULT_MODEL_ID } from '@/components/genie/genie-models.constants';
import {
  getUserIdentity,
  getUserMdTemplate,
  saveUserIdentity,
} from '@/components/genie/genie-user-identity.storage';
import TeleGenieTabsNav from '@/components/settings/telegenie-tabs.nav';
import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import { Switch } from '@/lib/components/ui/switch';
import { Textarea } from '@/lib/components/ui/textarea';
import { useSDK, useStore } from '@/lib/contexts/sdk.context';
import { fallbackPeerDisplay, peerProfileDisplay } from '@telegenie/sdk';
import {
  Activity,
  AlertCircle,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Key,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';

const TeleGenieGeneralDetail = observer(function TeleGenieGeneralDetail() {
  const sdk = useSDK();
  const globalStore = useStore('global');
  const userStore = useStore('user');
  const { auth } = globalStore;

  const self = auth.currentUser;
  const selfEntity = self?.id ? userStore.get(self.id) : undefined;
  const display = selfEntity ? peerProfileDisplay(selfEntity) : fallbackPeerDisplay(self?.id ?? '');

  const [isSyncingBackend, setIsSyncingBackend] = useState(false);
  const [isUpdatingTracing, setIsUpdatingTracing] = useState(false);
  const [openaiKey, setOpenaiKey] = useState('');
  const [googleKey, setGoogleKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [userIdentity, setUserIdentity] = useState('');
  const [showOpenai, setShowOpenai] = useState(false);
  const [showGoogle, setShowGoogle] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const tracingEnabled = auth.backendUserProfile?.enableTracing ?? false;

  useEffect(() => {
    setOpenaiKey(getLocalStorageApiKey('OpenAI'));
    setGoogleKey(getLocalStorageApiKey('Google'));
    setAnthropicKey(getLocalStorageApiKey('Anthropic'));
    setUserIdentity(getUserIdentity());
  }, []);

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

  const handleInsertTemplate = () => {
    if (
      userIdentity.trim() &&
      typeof window !== 'undefined' &&
      !window.confirm('Replace current User Identity with the standard USER.md template?')
    ) {
      return;
    }
    const template = getUserMdTemplate(display.name);
    setUserIdentity(template);
  };

  const handleSave = async () => {
    setStoredApiKey('OpenAI', openaiKey);
    setStoredApiKey('Google', googleKey);
    setStoredApiKey('Anthropic', anthropicKey);
    saveUserIdentity(userIdentity);

    try {
      const apiKeys = getAllStoredApiKeys();
      await sdk.agent.configureModel({
        provider: 'OpenAI',
        model: DEFAULT_MODEL_ID,
        apiKeys,
      });
      await sdk.agent.configureUserIdentity(userIdentity);
    } catch (e) {
      console.warn('Failed to configure model in worker:', e);
    }

    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
    }, 2000);
  };

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">TeleGenie Config</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Configure personal API keys (BYOK) or use TeleGenie Cloud with free credits. Personal keys are stored securely in your browser.
        </p>
      </div>

      <TeleGenieTabsNav activeTab="general" />

      {/* User Identity (USER.md) */}
      <section className="rounded-xl border border-border/70 bg-card/60 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <User className="size-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <span>User Identity</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground border border-border/50">
                  USER.md
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Information about yourself (name, preferences, etc) to let agent know who is he serving.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleInsertTemplate}
            className="h-7 text-xs px-2.5 gap-1.5"
            title="Insert standard USER.md template"
          >
            <FileText className="size-3 text-muted-foreground" />
            <span>Template</span>
          </Button>
        </div>

        <div className="flex flex-col gap-1.5 pt-1">
          <Textarea
            id="user-identity"
            value={userIdentity}
            onChange={(e) => setUserIdentity(e.target.value)}
            placeholder={getUserMdTemplate(display.name || 'Your Name')}
            className="text-xs font-mono min-h-36 resize-y leading-relaxed"
            rows={7}
          />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
            <span>Conforms to USER.md conventions. Synced into agent context.</span>
            <span>{userIdentity.length} chars</span>
          </div>
        </div>
      </section>

      {/* TeleGenie Cloud Service status & credits */}
      <section className="rounded-xl border border-border/70 bg-card/60 p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                TeleGenie Cloud Service
              </div>
              <div className="text-[11px] text-muted-foreground font-mono truncate max-w-[240px]">
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
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div className="rounded-lg bg-background/70 border border-border/50 p-2.5 text-center">
              <div className="text-[10px] text-muted-foreground">Daily Free Credits</div>
              <div className="text-sm font-semibold text-foreground mt-0.5">
                {auth.backendUserProfile.credits.dailyFreeRemaining} / {auth.backendUserProfile.credits.dailyFreeLimit}
              </div>
            </div>
            <div className="rounded-lg bg-background/70 border border-border/50 p-2.5 text-center">
              <div className="text-[10px] text-muted-foreground">Paid Balance</div>
              <div className="text-sm font-semibold text-foreground mt-0.5">
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
            <span className="text-[11px] text-muted-foreground">
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
      </section>

      {/* API Keys Configuration */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Bring Your Own Keys (BYOK)
        </h2>

        {/* OpenAI API Key */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="openai-key" className="text-xs font-medium">
              OpenAI API Key
            </Label>
            {openaiKey.trim() ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <Key className="size-2.5" />
                BYOK (Direct)
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground flex items-center gap-1">
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
              className="absolute right-2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {showOpenai ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          </div>
        </div>

        {/* Google AI Studio API Key */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="google-key" className="text-xs font-medium">
              Google AI Studio API Key
            </Label>
            {googleKey.trim() ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <Key className="size-2.5" />
                BYOK (Direct)
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground flex items-center gap-1">
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
              className="absolute right-2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {showGoogle ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          </div>
        </div>

        {/* Anthropic Claude API Key */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="anthropic-key" className="text-xs font-medium">
              Anthropic Claude API Key
            </Label>
            {anthropicKey.trim() ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <Key className="size-2.5" />
                BYOK (Direct)
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground flex items-center gap-1">
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
              className="absolute right-2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {showAnthropic ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          </div>
        </div>
      </section>

      {/* Help make TeleGenie better toggle */}
      <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Activity className="size-4 text-primary shrink-0" />
            <div>
              <Label htmlFor="tracing-toggle" className="text-xs font-semibold cursor-pointer">
                Help make TeleGenie better
              </Label>
              <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                {auth.backendAuthStatus === 'authenticated'
                  ? 'Share anonymous diagnostic data to help improve TeleGenie performance and fix issues.'
                  : 'Connect TeleGenie Cloud above to enable.'}
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
      </section>

      <div className="pt-2 flex justify-end">
        <Button
          size="sm"
          onClick={handleSave}
          className="gap-1.5 min-w-[90px]"
        >
          {isSaved ? (
            <>
              <Check className="size-3.5 text-emerald-500" />
              <span>Saved</span>
            </>
          ) : (
            <span>Save Settings</span>
          )}
        </Button>
      </div>
    </div>
  );
});

export default TeleGenieGeneralDetail;

