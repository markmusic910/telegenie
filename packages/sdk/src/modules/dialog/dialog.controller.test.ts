import { DialogController } from './dialog.controller';

describe('DialogController.reorderPinned', () => {
  it('calls dialog.reorderPinned on the worker', async () => {
    const call = jest.fn().mockResolvedValue(undefined);
    const dialog = new DialogController({
      sm: {} as never,
      worker: { call } as never,
      ensureMessageStore: () => ({}) as never,
    });

    await dialog.reorderPinned(['2', '1'], 0);

    expect(call).toHaveBeenCalledWith('dialog.reorderPinned', [['2', '1'], 0]);
  });
});
