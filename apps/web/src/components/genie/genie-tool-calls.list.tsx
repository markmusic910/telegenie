'use client';

import { AlertCircle, Check, ChevronDown, ChevronRight, Loader2, Wrench } from 'lucide-react';
import { useState } from 'react';

export interface GenieToolCallItem {
  toolCallId: string;
  toolName: string;
  args?: Record<string, unknown>;
  result?: unknown;
  isError?: boolean;
  /** True while the tool call has started and has not produced a result or error yet. */
  isRunning?: boolean;
}

const TOOL_DISPLAY_LABELS: Record<string, string> = {
  get_dialog_memory_sync: 'Dialog Memory Sync',
  suggest_input_completions: 'Suggest Input Completions',
};

function formatToolLabel(name: string): string {
  if (TOOL_DISPLAY_LABELS[name]) return TOOL_DISPLAY_LABELS[name];
  return name
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatJsonPreview(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function safeExtractToolCalls(content: unknown): GenieToolCallItem[] {
  if (!Array.isArray(content)) return [];
  const items: GenieToolCallItem[] = [];
  for (const part of content) {
    if (!part || typeof part !== 'object') continue;
    const rec = part as Record<string, unknown>;
    if (rec.type !== 'tool-call') continue;
    const toolCallId = typeof rec.toolCallId === 'string' ? rec.toolCallId : `tc_${items.length}`;
    const toolName = typeof rec.toolName === 'string' ? rec.toolName : 'tool';
    const hasResult = 'result' in rec && rec.result !== undefined;
    const isError = Boolean(rec.isError);
    items.push({
      toolCallId,
      toolName,
      args: rec.args && typeof rec.args === 'object' ? (rec.args as Record<string, unknown>) : undefined,
      result: rec.result,
      isError,
      isRunning: !hasResult && !isError,
    });
  }
  return items;
}

function GenieToolCallRow({ item }: { item: GenieToolCallItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border/70 bg-muted/40 text-xs">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-start text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        {expanded ? (
          <ChevronDown className="size-3 shrink-0" />
        ) : (
          <ChevronRight className="size-3 shrink-0" />
        )}
        <Wrench className="size-3 shrink-0 text-muted-foreground/80" />
        <span className="min-w-0 flex-1 truncate font-medium text-foreground/90">
          {formatToolLabel(item.toolName)}
        </span>
        {item.isRunning ? (
          <Loader2 className="size-3 shrink-0 animate-spin text-primary" aria-label="Running" />
        ) : item.isError ? (
          <AlertCircle className="size-3 shrink-0 text-destructive" aria-label="Failed" />
        ) : (
          <Check className="size-3 shrink-0 text-emerald-500" aria-label="Completed" />
        )}
      </button>

      {expanded ? (
        <div className="space-y-1.5 border-t border-border/60 px-2.5 py-2 font-mono text-[11px] text-muted-foreground">
          {item.args && Object.keys(item.args).length > 0 ? (
            <div>
              <div className="mb-0.5 text-[10px] font-sans uppercase tracking-wider text-muted-foreground/70">
                Arguments
              </div>
              <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-background/60 p-1.5">
                {formatJsonPreview(item.args)}
              </pre>
            </div>
          ) : null}
          {item.result !== undefined ? (
            <div>
              <div className="mb-0.5 text-[10px] font-sans uppercase tracking-wider text-muted-foreground/70">
                {item.isError ? 'Error' : 'Result'}
              </div>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-background/60 p-1.5">
                {formatJsonPreview(item.result)}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function GenieToolCallsList({ toolCalls }: { toolCalls: GenieToolCallItem[] }) {
  if (toolCalls.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      {toolCalls.map((item) => (
        <GenieToolCallRow key={item.toolCallId} item={item} />
      ))}
    </div>
  );
}
