import axios from 'axios';
import prisma from '../config/db';
import { decrypt } from '../config/encryption';
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_API_KEY = process.env.DEFAULT_OPENAI_API_KEY || 'mock-default-key-for-local-runs';
const DEFAULT_BASE_URL = process.env.DEFAULT_OPENAI_BASE_URL || 'https://api.openai.com/v1';
const DEFAULT_MODEL = process.env.DEFAULT_OPENAI_MODEL || 'gpt-4o-mini';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Calls an OpenAI-compatible chat completion endpoint using either a custom user AI config,
 * a temporary override (e.g. for external API custom headers), or the default fallback model.
 */
export async function callAIForUser(
  userId: string,
  systemPrompt: string,
  userMessage: string,
  conversationHistory: ChatMessage[] = [],
  configOverride?: { apiKey: string; baseUrl: string; model: string }
): Promise<{ text: string; modelUsed: string }> {
  let apiKey = DEFAULT_API_KEY;
  let baseUrl = DEFAULT_BASE_URL;
  let model = DEFAULT_MODEL;

  // 1. Determine config source
  if (configOverride) {
    apiKey = configOverride.apiKey;
    baseUrl = configOverride.baseUrl;
    model = configOverride.model;
  } else {
    const customConfig = await prisma.aiConfig.findUnique({
      where: { userId },
    });

    if (customConfig) {
      apiKey = customConfig.apiKeyEncrypted ? decrypt(customConfig.apiKeyEncrypted) : '';
      baseUrl = customConfig.baseUrl;
      model = customConfig.model;
      
      // If the provider type is lmstudio or ollama, we allow empty API key
      if (!apiKey && (customConfig.providerType === 'lmstudio' || customConfig.providerType === 'ollama')) {
        apiKey = '';
      } else if (!apiKey) {
        throw new Error('AI service has no API key configured. Set your default key or configure user settings.');
      }
    }
  }

  if (!configOverride && !apiKey && !DEFAULT_API_KEY) {
    throw new Error('AI service has no API key configured. Set your default key or configure user settings.');
  }

  // 2. Build standard chat history array
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  // Clean trailing slashes on base url
  const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const endpoint = `${cleanUrl}/chat/completions`;

  try {
    const response = await axios.post(
      endpoint,
      {
        model,
        messages,
        temperature: 0.3, // Lower temp for more precise/grounded Q&A
      },
      {
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        timeout: 45000, // 45 seconds timeout for slower models
      }
    );

    const text = response.data?.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('No content returned in choices from AI completion response');
    }

    return { text, modelUsed: model };
  } catch (error: any) {
    const errorDetails = error?.response?.data || error.message;
    console.error('AI call failure:', errorDetails);
    
    // Extract provider specific message if available
    const specificMessage = error?.response?.data?.error?.message || error.message;
    throw new Error(`AI Provider Failure: ${specificMessage}`);
  }
}
