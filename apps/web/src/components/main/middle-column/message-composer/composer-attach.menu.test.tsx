import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import ComposerAttachMenu from './composer-attach.menu';

describe('ComposerAttachMenu', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    document.body.innerHTML = '';
  });

  function renderMenu(props: ComponentProps<typeof ComposerAttachMenu>) {
    root = createRoot(container);
    act(() => {
      root.render(<ComposerAttachMenu {...props} />);
    });
  }

  it('renders attach button and hidden inputs', () => {
    const onSendFiles = jest.fn();
    renderMenu({ onSendFiles });

    const attachButton = container.querySelector('button[aria-label="Attach"]');
    expect(attachButton).not.toBeNull();

    const inputs = document.querySelectorAll('input[type="file"]');
    expect(inputs).toHaveLength(2);
    expect((inputs[0] as HTMLInputElement).accept).toBe('image/*,video/*');
    expect((inputs[1] as HTMLInputElement).accept).toBe('');
  });

  it('triggers onSendFiles with forceDocument=false when photo/video files are picked', () => {
    const onSendFiles = jest.fn();
    renderMenu({ onSendFiles });

    const photoInput = document.querySelector('input[accept="image/*,video/*"]') as HTMLInputElement;
    const file = new File(['content'], 'test.png', { type: 'image/png' });

    Object.defineProperty(photoInput, 'files', {
      value: [file],
      writable: true,
    });

    act(() => {
      photoInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(onSendFiles).toHaveBeenCalledTimes(1);
    expect(onSendFiles).toHaveBeenCalledWith([file], false);
  });

  it('triggers onSendFiles with forceDocument=true when file input is picked', () => {
    const onSendFiles = jest.fn();
    renderMenu({ onSendFiles });

    const inputs = document.querySelectorAll('input[type="file"]');
    const fileInput = inputs[1] as HTMLInputElement;
    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });

    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: true,
    });

    act(() => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(onSendFiles).toHaveBeenCalledTimes(1);
    expect(onSendFiles).toHaveBeenCalledWith([file], true);
  });
});
