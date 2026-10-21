import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import MediaSpoiler from '@/lib/components/media.spoiler';

function renderSpoiler(container: HTMLElement, props: ComponentProps<typeof MediaSpoiler>) {
  const root: Root = createRoot(container);
  act(() => {
    root.render(<MediaSpoiler {...props} />);
  });
  return root;
}

describe('MediaSpoiler', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    jest.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = '';
  });

  it('renders spoiler when isVisible is true', () => {
    renderSpoiler(container, { isVisible: true, label: 'Photo Spoiler' });
    expect(container.querySelector('.media-spoiler-root')).not.toBeNull();
    expect(container.textContent).toContain('Photo Spoiler');
    expect(container.textContent).toContain('Click to reveal');
  });

  it('does not render when isVisible is false', () => {
    renderSpoiler(container, { isVisible: false });
    expect(container.querySelector('.media-spoiler-root')).toBeNull();
  });

  it('triggers circle-cut closing animation and calls onReveal on click', () => {
    const onReveal = jest.fn();
    renderSpoiler(container, { isVisible: true, onReveal });

    const spoilerEl = container.querySelector('.media-spoiler-root');
    expect(spoilerEl).not.toBeNull();

    act(() => {
      spoilerEl?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          clientX: 50,
          clientY: 50,
        }),
      );
    });

    // Should have closing class immediately
    expect(container.querySelector('.media-spoiler-closing')).not.toBeNull();
    expect(onReveal).not.toHaveBeenCalled();

    // Advance 500ms
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.media-spoiler-root')).toBeNull();
  });
});
