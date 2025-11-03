import { Test, TestingModule } from '@nestjs/testing';
import { TranslationController } from './translation.controller';
import { TranslationService } from './translation.service';
import { TranslateDto } from './dto/translate.dto';

describe('TranslationController', () => {
  let controller: TranslationController;
  let service: TranslationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TranslationController],
      providers: [
        {
          provide: TranslationService,
          useValue: {
            translate: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<TranslationController>(TranslationController);
    service = module.get<TranslationService>(TranslationService);
  });

  it('returns payload from translation service', async () => {
    const dto: TranslateDto = {
      messageId: 'msg-1',
      targetLanguage: 'ja',
      text: 'Hello',
    };

    const user = {
      id: 'user-1',
      familyId: 'family-1',
    } as any;

    (service.translate as jest.Mock).mockResolvedValue({
      cached: false,
      translation: 'こんにちは',
      targetLanguage: 'ja',
    });

    const result = await controller.translate(dto, user);

    expect(service.translate).toHaveBeenCalledWith({
      messageId: 'msg-1',
      targetLanguage: 'ja',
      text: 'Hello',
      userId: 'user-1',
      familyId: 'family-1',
    });

    expect(result).toEqual({
      messageId: 'msg-1',
      cached: false,
      translation: 'こんにちは',
      targetLanguage: 'ja',
    });
  });
});
