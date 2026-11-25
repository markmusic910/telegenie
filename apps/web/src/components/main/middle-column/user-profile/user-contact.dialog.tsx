'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/lib/components/ui/button';
import { Checkbox } from '@/lib/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '@/lib/components/ui/dialog';
import { Field, FieldLabel } from '@/lib/components/ui/field';
import { Input } from '@/lib/components/ui/input';
import { useSDK } from '@/lib/contexts/sdk.context';

export interface UserContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  initialFirstName?: string;
  initialLastName?: string;
  phone?: string;
  isEdit?: boolean;
  defaultSharePhone?: boolean;
}

export default function UserContactDialog({
  open,
  onOpenChange,
  userId,
  initialFirstName = '',
  initialLastName = '',
  phone,
  isEdit = false,
  defaultSharePhone = false,
}: UserContactDialogProps) {
  const sdk = useSDK();
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [sharePhone, setSharePhone] = useState(defaultSharePhone);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFirstName(initialFirstName);
    setLastName(initialLastName);
    setSharePhone(defaultSharePhone);
  }, [defaultSharePhone, initialFirstName, initialLastName, open]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedFirst = firstName.trim();
    if (!trimmedFirst || saving) return;

    setSaving(true);
    try {
      await sdk.user.addContact({
        userId,
        firstName: trimmedFirst,
        lastName: lastName.trim(),
        phone,
        addPhonePrivacyException: sharePhone,
      });
      toast.success(isEdit ? 'Contact updated' : 'Added to contacts');
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to save contact:', err);
      toast.error(isEdit ? 'Failed to update contact' : 'Failed to add contact');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update how this contact appears in your chats.'
              : 'Save this user to your Telegram contacts.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="contents">
          <DialogPanel className="flex flex-col gap-4">
            <Field>
              <FieldLabel>First name</FieldLabel>
              <Input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="First name"
                autoComplete="given-name"
                required
                autoFocus
              />
            </Field>

            <Field>
              <FieldLabel>Last name</FieldLabel>
              <Input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Last name (optional)"
                autoComplete="family-name"
              />
            </Field>

            {!isEdit ? (
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground select-none">
                <Checkbox
                  checked={sharePhone}
                  onCheckedChange={(checked) => setSharePhone(Boolean(checked))}
                />
                <span>Share my phone number</span>
              </label>
            ) : null}
          </DialogPanel>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" disabled={saving} />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={!firstName.trim() || saving}>
              {saving ? 'Saving…' : isEdit ? 'Save' : 'Done'}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
