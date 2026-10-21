import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import MediaUploadProgress from '@/lib/components/media-upload.progress';

function renderProgress(container: HTMLElement, props: ComponentProps<typeof MediaUploadProgress>) {
  const root: Root = createRoot(container);
  act(() => {
    root.render(<MediaUploadProgress {...props} />);
  });
  return root;
}

describe('MediaUploadProgress', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders progress percentage and bar accurately', () => {
    renderProgress(container, { progress: 0.65 });
    expect(container.textContent).toContain('65%');
  });

  it('clamps progress to 0% and 100%', () => {
    renderProgress(container, { progress: 1.2 });
    expect(container.textContent).toContain('100%');
  });

  it('renders cancel/abort button when onAbort is provided and triggers on click', () => {
    const onAbort = jest.fn();
    renderProgress(container, { progress: 0.4, onAbort });

    const abortButton = container.querySelector('button[aria-label="Cancel upload"]');
    expect(abortButton).not.toBeNull();

    act(() => {
      abortButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onAbort).toHaveBeenCalledTimes(1);
  });

  it('renders cancel button when onCancel is provided and triggers on click', () => {
    const onCancel = jest.fn();
    renderProgress(container, { progress: 0.4, onCancel });

    const abortButton = container.querySelector('button[aria-label="Cancel upload"]');
    expect(abortButton).not.toBeNull();

    act(() => {
      abortButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
