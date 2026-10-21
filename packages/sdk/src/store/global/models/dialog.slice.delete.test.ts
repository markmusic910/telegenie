import { GlobalStore } from '../global.store';
import { MAIN_THREAD_ID } from './thread.state';

describe('GlobalStore dialog delete', () => {
  it('deleteDialog removes the dialog UI map entry', () => {
    const global = new GlobalStore();
    global.getOrCreateThreadUI('7', MAIN_THREAD_ID);
    global.getOrCreateThreadUI('8', MAIN_THREAD_ID);
    expect(global.getDialogUI('7')).toBeDefined();

    global.deleteDialog('7');
    expect(global.getDialogUI('7')).toBeUndefined();
    expect(global.getDialogUI('8')).toBeDefined();
  });

  it('deleteThread drops one thread and removes an empty dialog', () => {
    const global = new GlobalStore();
    global.getOrCreateThreadUI('7', MAIN_THREAD_ID);
    global.getOrCreateThreadUI('7', '42');
    global.getOrCreateDialogUI('7').setActiveThreadId('42');

    global.deleteThread('7', '42');
    expect(global.getThreadUI('7', '42')).toBeUndefined();
    expect(global.getDialogUI('7')?.activeThreadId).toBe(MAIN_THREAD_ID);
    expect(global.getThreadUI('7', MAIN_THREAD_ID)).toBeDefined();

    global.deleteThread('7', MAIN_THREAD_ID);
    expect(global.getDialogUI('7')).toBeUndefined();
  });
});
