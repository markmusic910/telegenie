'use client';

import { observer } from 'mobx-react-lite';
import Link from 'next/link';
import type { FormEvent } from 'react';
import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { OTPField, OTPFieldInput } from '@/components/ui/otp-field';
import { useSDK, useStore } from '@/lib/contexts/sdk.context';
import { AlertCircle, Check, CheckCircle2, Copy } from 'lucide-react';

const AuthForm = observer(() => {
  const { auth: authModule } = useSDK();
  const globalStore = useStore('global');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);

  const handlePhoneSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await authModule.submitPhone(phone);
  };

  const handleCodeSubmit = async (valueToSubmit: string) => {
    await authModule.submitCode(valueToSubmit);
  };

  const handleCodeChange = async (val: string) => {
    setCode(val);
    if (val.length === 5) {
      await handleCodeSubmit(val);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await authModule.submitPassword(password);
  };

  const { auth } = globalStore;

  const handleCopySession = async () => {
    if (!auth.authSessionString) {
      return;
    }

    await navigator.clipboard.writeText(auth.authSessionString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const truncatedSession =
    auth.authSessionString && auth.authSessionString.length > 48
      ? `${auth.authSessionString.slice(0, 24)}...${auth.authSessionString.slice(-24)}`
      : auth.authSessionString;

  return (
    <Card className="w-full max-w-md shadow-lg border-muted/20">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Telegram Login</CardTitle>
        <CardDescription>
          {auth.authStep === 'success'
            ? 'Connection successful!'
            : 'Sign in with your phone number to connect your Telegram account.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {auth.authError && (
          <Alert variant="error">
            <AlertCircle className="size-4" />
            <AlertTitle>Authentication Error</AlertTitle>
            <AlertDescription className="mt-1 flex flex-col gap-2">
              <span className="leading-relaxed">{auth.authError}</span>
              {auth.authStep === 'error' && (
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => authModule.reset()}
                  className="self-start"
                >
                  Try again
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {auth.authStep === 'phone' && (
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            <Field>
              <FieldLabel htmlFor="phone">Phone number</FieldLabel>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+1234567890"
                disabled={auth.authIsLoading}
                className="w-full animate-fade-in"
              />
              <FieldDescription>
                Include country code prefix (e.g. +1)
              </FieldDescription>
            </Field>
            <Button
              type="submit"
              loading={auth.authIsLoading}
              className="w-full"
            >
              Send code
            </Button>
          </form>
        )}

        {auth.authStep === 'code' && (
          <form onSubmit={(e) => { e.preventDefault(); handleCodeSubmit(code); }} className="space-y-6">
            <div className="text-center space-y-1">
              <p className="text-sm text-muted-foreground">
                {auth.authIsCodeViaApp
                  ? 'Enter the code sent to your Telegram app.'
                  : 'Enter the code sent via SMS.'}
              </p>
            </div>
            <Field className="items-center">
              <FieldLabel htmlFor="code-otp" className="mb-2">Verification Code</FieldLabel>
              <OTPField
                id="code-otp"
                length={5}
                value={code}
                onValueChange={handleCodeChange}
                disabled={auth.authIsLoading}
                className="justify-center"
              >
                <OTPFieldInput />
                <OTPFieldInput />
                <OTPFieldInput />
                <OTPFieldInput />
                <OTPFieldInput />
              </OTPField>
            </Field>
            <div className="space-y-3">
              <Button
                type="submit"
                loading={auth.authIsLoading}
                className="w-full"
              >
                Verify code
              </Button>
              <Button
                variant="ghost"
                onClick={() => authModule.reset()}
                disabled={auth.authIsLoading}
                className="w-full text-sm text-muted-foreground"
              >
                Use a different phone number
              </Button>
            </div>
          </form>
        )}

        {auth.authStep === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="text-center space-y-1">
              <p className="text-sm text-muted-foreground">
                Two-step verification is enabled for this account.
              </p>
              {auth.authPasswordHint && (
                <p className="text-xs font-medium text-warning-foreground">
                  Hint: {auth.authPasswordHint}
                </p>
              )}
            </div>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={auth.authIsLoading}
                className="w-full"
                placeholder="Enter 2FA password"
              />
            </Field>
            <Button
              type="submit"
              loading={auth.authIsLoading}
              className="w-full"
            >
              Sign in
            </Button>
          </form>
        )}

        {auth.authStep === 'success' && (
          <div className="space-y-6">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-success-foreground">
                You are now connected to Telegram.
              </p>
            </div>

            {truncatedSession && (
              <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Session string
                  </span>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={handleCopySession}
                    className="h-7 gap-1.5 px-2 text-[10px] uppercase font-semibold tracking-wider"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 text-success" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs font-mono break-all text-muted-foreground/80 bg-background/60 p-2.5 rounded-lg border border-border/40 max-h-24 overflow-y-auto">
                  {auth.authSessionString}
                </p>
              </div>
            )}

            <Button render={<Link href="/" />} className="w-full">
              Go to home
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

export default AuthForm;
