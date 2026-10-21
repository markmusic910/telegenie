import { notificationCenter } from '@telegenie/libs/foundation/notification';

export default class BaseStore {
  protected subscribeNotification(event: string, listener: (...args: any[]) => void) {
    notificationCenter.on(event, listener);
  }
}
