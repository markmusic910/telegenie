import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import CopyButton from './copy.button';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

describe('CopyButton', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  const writeTextMock = jest.fn<Promise<void>, [string]>(() => Promise.resolve());

  beforeEach(() => {
    writeTextMock.mockClear();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container.remove();
    root = null;
  });

  it('copies value to clipboard and displays "Copied!" tooltip before resetting', async () => {
    console.warn('STEP 1: render');
    act(() => {
      root?.render(<CopyButton value="@Poolitzer" aria-label="Copy username" resetDelayMs={40} />);
    });
    console.warn('STEP 2: rendered');

    const btn = container.querySelector('button[aria-label="Copy username"]') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(document.body.textContent).not.toContain('Copied!');

    console.warn('STEP 3: before click');
    await act(async () => {
      btn.click();
    });
    console.warn('STEP 4: after click');

    expect(writeTextMock).toHaveBeenCalledWith('@Poolitzer');
    expect(document.body.textContent).toContain('Copied!');

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });

    expect(container.querySelector('svg.lucide-copy')).not.toBeNull();
  });
});
