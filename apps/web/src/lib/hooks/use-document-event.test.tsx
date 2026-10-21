import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { useDocumentEvent } from '@/lib/hooks/use-document-event';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Probe({ onEvent }: { onEvent: () => void }) {
  useDocumentEvent('visibilitychange', onEvent);
  return null;
}

function Harness({
  first,
  second,
  showSecond,
}: {
  first: () => void;
  second: () => void;
  showSecond: boolean;
}) {
  return (
    <>
      <Probe onEvent={first} />
      {showSecond ? <Probe onEvent={second} /> : null}
    </>
  );
}

describe('useDocumentEvent', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  it('attaches one document listener and fans the event out to every subscriber', () => {
    const add = jest.spyOn(document, 'addEventListener');
    const remove = jest.spyOn(document, 'removeEventListener');
    const first = jest.fn();
    const second = jest.fn();

    act(() => {
      root.render(<Harness first={first} second={second} showSecond />);
    });

    const attached = add.mock.calls.filter(([type]) => type === 'visibilitychange');
    expect(attached).toHaveLength(1);

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    act(() => {
      root.render(<Harness first={first} second={second} showSecond={false} />);
    });
    expect(remove.mock.calls.filter(([type]) => type === 'visibilitychange')).toHaveLength(0);

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(1);

    act(() => {
      root.render(null);
    });
    expect(remove.mock.calls.filter(([type]) => type === 'visibilitychange')).toHaveLength(1);
  });
});
