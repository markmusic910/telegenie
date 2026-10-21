import { Api } from '@telegenie/teleproto';
import { MessageReactionService } from './message-reaction.service';

describe('MessageReactionService.setDefaultReaction', () => {
  it('sends ReactionEmoji to messages.SetDefaultReaction', async () => {
    const invoke = jest.fn().mockResolvedValue(true);
    const service = new MessageReactionService({
      transportService: { client: { invoke } } as never,
    });
    await service.setDefaultReaction('👍');
    expect(invoke).toHaveBeenCalledWith(expect.any(Api.messages.SetDefaultReaction));
    const call = invoke.mock.calls[0][0] as Api.messages.SetDefaultReaction;
    expect(call.reaction).toBeInstanceOf(Api.ReactionEmoji);
    expect((call.reaction as Api.ReactionEmoji).emoticon).toBe('👍');
  });
});
