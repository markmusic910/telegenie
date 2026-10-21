'use client';

import { cn } from '@/lib/utils';

interface MessageEmptyProps {
  className?: string;
}

export default function MessageEmpty({ className }: MessageEmptyProps) {
  return (
    <div className={cn('flex flex-1 items-center justify-center p-6 text-center', className)}>
      <div className="flex flex-col items-center gap-2 max-w-sm">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
          <svg
            className="size-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
            />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-foreground">No messages yet</h3>
        <p className="text-xs text-muted-foreground">
          Send a message below to start the conversation.
        </p>
      </div>
    </div>
  );
}
