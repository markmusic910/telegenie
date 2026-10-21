import { flatListItemContainsMessageId, type FlatListItem } from './message-grouper';

export function findFlatMessageIndex(
  items: FlatListItem[],
  messageId: string,
): number | undefined {
  const index = items.findIndex((item) => flatListItemContainsMessageId(item, messageId));
  return index >= 0 ? index : undefined;
}
