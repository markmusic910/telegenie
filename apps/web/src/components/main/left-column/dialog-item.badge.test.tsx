import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import DialogItemBadge from '@/components/main/left-column/dialog-item.badge';

function renderBadge(container: HTMLElement, props: ComponentProps<typeof DialogItemBadge>) {
  const root: Root = createRoot(container);
  act(() => {
    root.render(<DialogItemBadge {...props} />);
  });
  return root;
}

describe('DialogItemBadge', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows only the mention badge when unread mentions exist without unread messages', () => {
    renderBadge(container, { unreadCount: 0, unreadMentionsCount: 2 });

    expect(container.querySelector('[aria-label="Unread mentions"]')).not.toBeNull();
    expect(container.querySelector('[aria-label*="unread messages"]')).toBeNull();
  });

  it('shows only the unread count badge when unread messages exist without mentions', () => {
    renderBadge(container, { unreadCount: 6, unreadMentionsCount: 0 });

    expect(container.querySelector('[aria-label="6 unread messages"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Unread mentions"]')).toBeNull();
  });

  it('shows separate mention and unread count badges when both apply', () => {
    renderBadge(container, { unreadCount: 6, unreadMentionsCount: 1 });

    expect(container.querySelector('[aria-label="Unread mentions"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="6 unread messages"]')).not.toBeNull();
    expect(container.querySelectorAll('[aria-label]').length).toBe(2);
  });

  it('hides the mention badge when hideMentions is set', () => {
    renderBadge(container, { unreadCount: 3, unreadMentionsCount: 2, hideMentions: true });

    expect(container.querySelector('[aria-label="Unread mentions"]')).toBeNull();
    expect(container.querySelector('[aria-label="3 unread messages"]')).not.toBeNull();
  });

  it('shows the reaction badge beside mentions', () => {
    renderBadge(container, { unreadCount: 0, unreadMentionsCount: 1, unreadReactionsCount: 2 });

    expect(container.querySelector('[aria-label="Unread mentions"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Unread reactions"]')).not.toBeNull();
  });
});
