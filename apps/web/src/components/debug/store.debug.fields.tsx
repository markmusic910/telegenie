'use client';

import { Button } from '@/lib/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/lib/components/ui/field';
import { Input } from '@/lib/components/ui/input';
import { Switch } from '@/lib/components/ui/switch';
import { Textarea } from '@/lib/components/ui/textarea';
import { useEffect, useId, useState, type ReactNode } from 'react';

export function stringifyJson(value: unknown): string {
  if (value === undefined) return '';
  return JSON.stringify(value, null, 2);
}

function FieldRow({
  htmlFor,
  label,
  stacked,
  children,
}: {
  htmlFor: string;
  label: string;
  stacked?: boolean;
  children: ReactNode;
}) {
  return (
    <Field
      className={
        stacked
          ? 'gap-1 py-1'
          : 'flex-row items-center justify-between gap-2 py-0.5'
      }
    >
      <FieldLabel
        className="w-[11.5rem] shrink-0 truncate font-mono text-[11px]"
        htmlFor={htmlFor}
        title={label}
      >
        {label}
      </FieldLabel>
      {children}
    </Field>
  );
}

export function BooleanField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <FieldRow htmlFor={id} label={label}>
      <Switch
        checked={value}
        id={id}
        onCheckedChange={(checked) => onChange(checked === true)}
      />
    </FieldRow>
  );
}

export function PrimitiveField({
  label,
  type,
  value,
  onCommit,
}: {
  label: string;
  type: 'text' | 'number';
  value: string;
  onCommit: (raw: string) => boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(value);
      setInvalid(false);
    }
  }, [focused, value]);

  const commit = () => {
    const ok = onCommit(draft);
    setInvalid(!ok);
    return ok;
  };

  return (
    <FieldRow htmlFor={id} label={label}>
      <div className="min-w-0 flex-1">
        <Input
          aria-invalid={invalid || undefined}
          id={id}
          name={label}
          onBlur={() => {
            commit();
            setFocused(false);
          }}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            commit();
          }}
          size="sm"
          type={type}
          value={draft}
        />
      </div>
    </FieldRow>
  );
}

export function JsonField({
  label,
  value,
  lengthHint,
  maxHeight,
  onCommit,
  onWrite,
}: {
  label: string;
  value: unknown;
  lengthHint?: string;
  maxHeight?: boolean;
  onCommit: (raw: string) => unknown;
  onWrite: (next: unknown) => void;
}) {
  const id = useId();
  const serialized = stringifyJson(value);
  const [draft, setDraft] = useState(serialized);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!focused && error == null) setDraft(serialized);
  }, [error, focused, serialized]);

  const apply = () => {
    if (draft === serialized) {
      setError(null);
      return true;
    }
    try {
      onWrite(onCommit(draft));
      setError(null);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Invalid JSON');
      return false;
    }
  };

  return (
    <FieldRow htmlFor={id} label={label} stacked>
      <Textarea
        aria-invalid={error ? true : undefined}
        className={
          maxHeight
            ? 'max-h-40 overflow-y-auto font-mono text-[11px] [&_[data-slot=textarea]]:max-h-40 [&_[data-slot=textarea]]:overflow-y-auto'
            : 'font-mono text-[11px]'
        }
        id={id}
        name={label}
        onBlur={() => {
          apply();
          setFocused(false);
        }}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
        }}
        onFocus={() => setFocused(true)}
        size="sm"
        value={draft}
      />
      {lengthHint ? (
        <p className="font-mono text-[10px] text-muted-foreground">{lengthHint}</p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        {error ? <FieldError>{error}</FieldError> : <span />}
        <Button
          onClick={() => {
            apply();
          }}
          size="xs"
          type="button"
          variant="ghost"
        >
          Apply
        </Button>
      </div>
    </FieldRow>
  );
}
