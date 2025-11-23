import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  SUPPORTED_LANGUAGES,
  SupportedLanguageCode,
} from './dto/translate.dto';

interface GroqChatCompletion {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);
  private readonly apiKey = process.env.GROQ_API_KEY;
  private readonly apiUrl = 'https://api.groq.com/openai/v1/chat/completions';

  async translateText(
    text: string,
    targetLanguage: SupportedLanguageCode,
  ): Promise<string> {
    if (!this.apiKey) {
      this.logger.error('GROQ_API_KEY is not configured');
      throw new HttpException(
        'Translation service unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const languageName = SUPPORTED_LANGUAGES[targetLanguage] ?? 'English';

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          temperature: 0.3,
          max_tokens: 500,
          messages: [
            {
              role: 'system',
              content:
                'You are a translation assistant. Translate the user message accurately without adding explanations.',
            },
            {
              role: 'user',
              content: `Translate the following text to ${languageName}. If the text is already in ${languageName}, return it as-is. Only return the translation, no explanations:\n\n${text}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.text();
        this.logger.error(
          `Groq API error: status=${response.status} target=${targetLanguage} payload=${errorPayload}`,
        );

        if (response.status === HttpStatus.TOO_MANY_REQUESTS) {
          throw new HttpException(
            'Translation rate limit exceeded',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }

        throw new HttpException(
          'Translation service unavailable',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const payload = (await response.json()) as GroqChatCompletion;
      const translation = payload.choices?.[0]?.message?.content?.trim();

      if (!translation) {
        this.logger.warn('Groq API returned empty translation response');
        throw new HttpException(
          'Translation service unavailable',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      return translation;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new HttpException(
          'Translation request timed out',
          HttpStatus.REQUEST_TIMEOUT,
        );
      }

      this.logger.error('Unexpected Groq translation error', error as Error);
      throw new HttpException(
        'Translation service unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
