import { TranslationResolver } from './translation.resolver';
import { TranslationService } from './translation.service';

describe('TranslationResolver', () => {
  const translationService = {
    getCachedTranslation: jest.fn(),
    cacheTranslation: jest.fn(),
  } as unknown as jest.Mocked<TranslationService>;

  const resolver = new TranslationResolver(
    translationService as unknown as TranslationService,
  );

  const user = {
    id: 'user-1',
    activeFamilyId: 'family-1',
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates messageTranslation query to service', async () => {
    translationService.getCachedTranslation.mockResolvedValue({
      id: 'translation-1',
    } as any);

    const result = await resolver.messageTranslation(
      { messageId: 'msg-1', targetLanguage: 'en' },
      user,
    );

    expect(translationService.getCachedTranslation).toHaveBeenCalledWith({
      messageId: 'msg-1',
      targetLanguage: 'en',
      userId: 'user-1',
      familyId: 'family-1',
    });
    expect(result).toEqual({ id: 'translation-1' });
  });

  it('delegates cacheMessageTranslation mutation to service', async () => {
    translationService.cacheTranslation.mockResolvedValue({
      id: 'translation-1',
    } as any);

    const result = await resolver.cacheMessageTranslation(
      {
        messageId: 'msg-1',
        targetLanguage: 'en',
        encryptedTranslation: 'ciphertext',
      },
      user,
    );

    expect(translationService.cacheTranslation).toHaveBeenCalledWith({
      messageId: 'msg-1',
      targetLanguage: 'en',
      encryptedTranslation: 'ciphertext',
      userId: 'user-1',
      familyId: 'family-1',
    });
    expect(result).toEqual({ id: 'translation-1' });
  });
});
