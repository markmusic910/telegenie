'use client';

import { Dialog } from '@telegenie/sdk';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';

import { useSDK, useStoreEntities } from '@/lib/contexts/sdk.context';
import DialogInfoMemberRow from './dialog-info.member.row';

export interface DialogInfoTabMembersProps {
  peerId: string;
}

const DialogInfoTabMembers = observer(function DialogInfoTabMembers({
  peerId,
}: DialogInfoTabMembersProps) {
  const sdk = useSDK();
  const peerKind = Dialog.peerKindFromId(peerId);
  const chatFull = useStoreEntities('chatFull', peerKind === 'chat' ? peerId : null);
  const [channelUserIds, setChannelUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (peerKind !== 'channel') return;
    setLoading(true);
    void sdk.channel
      .getParticipants(peerId)
      .then((result) => {
        setChannelUserIds(result.userIds);
      })
      .finally(() => setLoading(false));
  }, [peerId, peerKind, sdk.channel]);

  if (peerKind === 'chat') {
    const participants =
      chatFull?.participants && 'participants' in chatFull.participants
        ? chatFull.participants.participants
        : [];
    const ids = participants
      .map((p) => ('userId' in p ? p.userId : undefined))
      .filter((id): id is string => Boolean(id));

    if (!chatFull && ids.length === 0) {
      return <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>;
    }
    if (ids.length === 0) {
      return (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">No members to show.</p>
      );
    }

    return (
      <div className="flex flex-col gap-0.5 pb-4">
        {ids.map((userId) => (
          <DialogInfoMemberRow key={userId} userId={userId} />
        ))}
      </div>
    );
  }

  if (loading && channelUserIds.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  if (channelUserIds.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">No members to show.</p>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 pb-4">
      {channelUserIds.map((userId) => (
        <DialogInfoMemberRow key={userId} userId={userId} />
      ))}
    </div>
  );
});

export default DialogInfoTabMembers;