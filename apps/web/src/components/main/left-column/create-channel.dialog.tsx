'use client';

import { useDialogPeer, useSDK } from '@/lib/contexts/sdk.context';
import { ALL_CHATS_FOLDER_ID, fallbackPeerDisplay } from '@telegenie/sdk';
import PeerAvatar from '@/lib/components/peer.avatar';
import { ArrowLeft, ArrowRight, Camera, Check, Copy, Globe, Lock, RadioReceiver } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/lib/components/ui/button';
import {
  Dialog,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '@/lib/components/ui/dialog';
import { Input } from '@/lib/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/lib/components/ui/input-group';
import { RadioGroup, RadioGroupItem } from '@/lib/components/ui/radio-group';
import { Switch } from '@/lib/components/ui/switch';
import { Textarea } from '@/lib/components/ui/textarea';

interface CreateChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateChannelDialog = observer(({ open, onOpenChange }: CreateChannelDialogProps) => {
  const sdk = useSDK();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');

  // Channel settings options
  const [isPublic, setIsPublic] = useState(false);
  const [username, setUsername] = useState('');
  const [restrictSavingContent, setRestrictSavingContent] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdChannel, setCreatedChannel] = useState<any | null>(null);
  const [generatedInviteLink, setGeneratedInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const createdPeer = useDialogPeer(createdChannel?.id);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setStep(1);
      setName('');
      setDescription('');
      setPhotoFile(null);
      setPhotoPreview('');
      setIsPublic(false);
      setUsername('');
      setRestrictSavingContent(false);
      setCreatedChannel(null);
      setGeneratedInviteLink('');
      setCopied(false);
      setErrorMsg('');
    }
  }, [open]);

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleNextStep = () => {
    if (name.trim()) {
      setErrorMsg('');
      setStep(2);
    }
  };

  const handlePrevStep = () => {
    setErrorMsg('');
    setStep(1);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setErrorMsg('');

    try {
      // Create Channel with settings options
      const channel = await sdk.channel.createChannel(
        name,
        description,
        {
          isPublic,
          username: isPublic ? username.trim() : undefined,
          restrictSavingContent,
        }
      );

      // Upload channel photo if selected
      if (photoFile && channel.id) {
        try {
          await sdk.chat.editPhoto(channel.id, photoFile, channel.accessHash);
        } catch (photoErr: any) {
          console.error('[CreateChannelDialog] failed to upload photo', photoErr);
          const errStr = String(photoErr?.message || photoErr);
          const errName = String(photoErr?.name || photoErr?.constructor?.name || '');
          const combined = `${errName} ${errStr}`;
          let photoMsg = 'Channel created, but failed to upload photo.';
          if (combined.includes('PhotoExtInvalidError') || combined.includes('The extension of the photo is invalid')) {
            photoMsg = 'Channel created, but the photo extension is invalid. Please use a PNG or JPG.';
          }
          setErrorMsg(photoMsg);

          const link = isPublic
            ? `https://t.me/${username.trim()}`
            : await sdk.channel.exportInviteLink(channel.id, channel.accessHash);

          setCreatedChannel(channel);
          setGeneratedInviteLink(link);
          setStep(3);
          return;
        }
      }

      if (isPublic) {
        completeCreation(channel.id);
      } else {
        const link = await sdk.channel.exportInviteLink(channel.id, channel.accessHash);
        setCreatedChannel(channel);
        setGeneratedInviteLink(link);
        setStep(3);
      }
    } catch (err: any) {
      console.error('[CreateChannelDialog] failed to create channel', err);
      let message = 'An error occurred while creating the channel. Please try again.';
      const errStr = String(err?.message || err);
      const errName = String(err?.name || err?.constructor?.name || '');
      const combined = `${errName} ${errStr}`;
      if (combined.includes('PhotoExtInvalidError') || combined.includes('The extension of the photo is invalid')) {
        message = 'The photo extension is invalid. Please use a PNG or JPG.';
      } else if (combined.includes('UsernameInvalidError') || combined.includes('username is not valid')) {
        message = 'The public username is invalid.';
      } else if (combined.includes('UsernameOccupiedError') || combined.includes('username is already taken')) {
        message = 'The public username is already taken.';
      } else if (combined.includes('ChannelsAdminPublicTooMuchError')) {
        message = 'You have created too many public channels.';
      }
      setErrorMsg(message);
    } finally {
      setCreating(false);
    }
  };

  const completeCreation = (channelId: string) => {
    onOpenChange(false);
    sdk.dialogFilter.selectFolder(ALL_CHATS_FOLDER_ID);
    void sdk.messageLoad.selectDialog(channelId);
  };

  const handleGoToChannel = () => {
    if (createdChannel?.id) {
      completeCreation(createdChannel.id);
    }
  };

  const handleCopyLink = () => {
    if (!generatedInviteLink) return;
    void navigator.clipboard.writeText(generatedInviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup showCloseButton={false} className="max-w-md h-[530px] flex flex-col rounded-2xl border bg-background shadow-lg outline-none">
        <DialogHeader className="px-6 py-4 flex flex-row items-center justify-between border-b border-border">
          <div className="flex items-center gap-3">
            <RadioReceiver className="size-5 text-primary" />
            <DialogTitle className="text-lg font-bold text-foreground">
              {step === 1 ? 'New Channel' : step === 2 ? 'Channel Settings' : 'Channel Created'}
            </DialogTitle>
          </div>
          <div>
            {step === 1 ? (
              <Button
                size="sm"
                onClick={handleNextStep}
                disabled={!name.trim()}
                variant="outline"
                className="gap-1"
              >
                Next <ArrowRight className="size-4" />
              </Button>
            ) : step === 2 ? (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={handlePrevStep} className="p-2">
                  <ArrowLeft className="size-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={creating || (isPublic && !username.trim())}
                  loading={creating}
                >
                  Done
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={handleGoToChannel}
              >
                Done
              </Button>
            )}
          </div>
        </DialogHeader>

        <DialogPanel className="flex-1 flex flex-col p-6 overflow-y-auto" scrollFade={false}>
          {step === 1 ? (
            <div className="flex flex-col gap-5 mt-4 mb-4">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium text-left">
                  {errorMsg}
                </div>
              )}
              {/* Photo & Name */}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handlePhotoClick}
                  className="relative size-16 rounded-full bg-accent border border-border flex items-center justify-center cursor-pointer overflow-hidden group hover:bg-accent/80 transition-colors duration-150 shrink-0"
                  aria-label="Upload channel photo"
                >
                  {photoPreview ? (
                    <img src={photoPreview} alt="Channel preview" className="absolute inset-0 size-full object-cover" />
                  ) : (
                    <Camera className="size-6 text-muted-foreground group-hover:text-foreground transition-colors duration-150" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-150">
                    <Camera className="size-5 text-white" />
                  </div>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoChange}
                  accept="image/*"
                  className="hidden"
                />
                <div className="flex-1">
                  <Input
                    placeholder="Channel name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-base font-semibold px-3 py-2 border rounded-md"
                    autoFocus
                  />
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Description
                </label>
                <Textarea
                  placeholder="You can write a description for your channel here."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-24 resize-none"
                />
              </div>
            </div>
          ) : step === 2 ? (
            <div className="flex flex-col gap-6 mt-4 mb-4">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium text-left">
                  {errorMsg}
                </div>
              )}
              {/* Channel Type */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Channel Type
                </span>
                <RadioGroup
                  value={isPublic ? 'public' : 'private'}
                  onValueChange={(val) => setIsPublic(val === 'public')}
                  className="gap-4"
                >
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-border/40 hover:bg-accent/40 transition-colors duration-100">
                    <RadioGroupItem value="public" />
                    <div className="flex items-center gap-2">
                      <Globe className="size-4 text-primary" />
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-foreground">Public Channel</span>
                        <span className="text-xs text-muted-foreground">
                          Anyone can find the channel in search.
                        </span>
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-border/40 hover:bg-accent/40 transition-colors duration-100">
                    <RadioGroupItem value="private" />
                    <div className="flex items-center gap-2">
                      <Lock className="size-4 text-primary" />
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-foreground">Private Channel</span>
                        <span className="text-xs text-muted-foreground">
                          People can only join via invite link.
                        </span>
                      </div>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              {/* Permanent Link Input (only for public channels) */}
              {isPublic && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Permanent Link
                  </span>
                  <InputGroup className="w-full">
                    <InputGroupAddon align="inline-start" className="bg-accent/40 border-r text-sm text-muted-foreground px-3">
                      t.me/
                    </InputGroupAddon>
                    <InputGroupInput
                      placeholder="linkname"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </InputGroup>
                </div>
              )}

              {/* Restrict Saving Content */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/40 hover:bg-accent/40 transition-colors duration-100">
                <div className="flex flex-col min-w-0 pr-4">
                  <span className="text-sm font-semibold text-foreground">Restrict Saving Content</span>
                  <span className="text-xs text-muted-foreground">
                    Subscribers won't be able to copy, save or forward content.
                  </span>
                </div>
                <Switch
                  checked={restrictSavingContent}
                  onCheckedChange={setRestrictSavingContent}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center gap-5 py-4">
              {errorMsg && (
                <div className="w-full p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium text-left">
                  {errorMsg}
                </div>
              )}
              {/* Success Checkmark */}
              <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                <Check className="size-8" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">Channel Created!</h3>
                <p className="text-sm text-muted-foreground">
                  Your channel has been successfully created.
                </p>
              </div>

              {/* Channel Card Preview */}
              <div className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-accent/20">
                {createdChannel ? (
                  <PeerAvatar
                    peerId={createdChannel.id}
                    display={createdPeer?.display ?? createdChannel.display ?? fallbackPeerDisplay(createdChannel.id)}
                    photo={createdPeer?.photo ?? createdChannel.photo}
                    className="size-12 text-sm shrink-0"
                  />
                ) : photoPreview ? (
                  <img src={photoPreview} alt={name} className="size-12 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="size-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <RadioReceiver className="size-6 text-primary" />
                  </div>
                )}
                <div className="flex flex-col text-left min-w-0">
                  <span className="text-sm font-semibold truncate text-foreground">{name}</span>
                  {description && (
                    <span className="text-xs text-muted-foreground truncate">{description}</span>
                  )}
                </div>
              </div>

              {/* Generated Invite Link Box */}
              <div className="w-full space-y-2 text-left">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Invite Link
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0 p-3 bg-accent/40 rounded-lg border border-border/40 font-mono text-sm text-foreground truncate select-all h-9 flex items-center">
                    {generatedInviteLink}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyLink}
                    className="shrink-0 gap-1.5 h-9"
                  >
                    {copied ? (
                      <>
                        <Check className="size-4 text-emerald-500" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-4" />
                        <span>Copy</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Go to Chat Button */}
              <Button
                onClick={handleGoToChannel}
                className="w-full mt-2"
              >
                Go to Channel
              </Button>
            </div>
          )}
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
});

CreateChannelDialog.displayName = 'CreateChannelDialog';
export default CreateChannelDialog;
