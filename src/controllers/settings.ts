import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../types';
import { encrypt, decrypt } from '../config/encryption';
import axios from 'axios';

const ALLOWED_PROVIDERS = ['openai', 'lmstudio', 'ollama', 'custom'];

/**
 * Helper to mask API keys returning first 5 and last 4 characters, asterisks in middle.
 */
function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length >= 9) {
    const stars = '*'.repeat(Math.max(3, key.length - 9));
    return `${key.substring(0, 5)}${stars}${key.substring(key.length - 4)}`;
  }
  return '*****';
}

/**
 * Saves or updates user AI configuration (PUT /api/ai-config).
 */
export async function saveAiConfig(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { provider_type, base_url, api_key, model, use_client_side } = req.body;

  if (!provider_type || !base_url || !model) {
    return res.status(400).json({ error: 'provider_type, base_url, and model are required fields' });
  }

  if (!ALLOWED_PROVIDERS.includes(provider_type)) {
    return res.status(400).json({ error: `Invalid provider type. Allowed: ${ALLOWED_PROVIDERS.join(', ')}` });
  }

  try {
    let encryptedKey: string | null = null;
    const isMasked = api_key && (api_key.includes('*') || api_key.includes('•') || api_key.includes('…'));

    if (api_key && !isMasked) {
      encryptedKey = encrypt(api_key);
    } else {
      // Keep existing key if not changed or if masked key was passed back
      const existing = await prisma.aiConfig.findUnique({
        where: { userId },
      });
      encryptedKey = existing?.apiKeyEncrypted || null;
    }

    const config = await prisma.aiConfig.upsert({
      where: { userId },
      update: {
        providerType: provider_type,
        baseUrl: base_url,
        apiKeyEncrypted: encryptedKey,
        model,
        useClientSide: typeof use_client_side === 'boolean' ? use_client_side : false,
      },
      create: {
        userId,
        providerType: provider_type,
        baseUrl: base_url,
        apiKeyEncrypted: encryptedKey,
        model,
        useClientSide: typeof use_client_side === 'boolean' ? use_client_side : false,
      },
    });

    return res.json({
      success: true,
      message: 'AI Configuration saved successfully',
      config: {
        provider_type: config.providerType,
        base_url: config.baseUrl,
        model: config.model,
        use_client_side: config.useClientSide,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Retrieves the current AI configuration details (GET /api/ai-config).
 */
export async function getAiConfig(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const config = await prisma.aiConfig.findUnique({
      where: { userId },
    });

    if (!config) {
      return res.json({ configured: false });
    }

    const decryptedKey = config.apiKeyEncrypted ? decrypt(config.apiKeyEncrypted) : '';
    const api_key_masked = decryptedKey ? maskApiKey(decryptedKey) : null;

    return res.json({
      configured: true,
      provider_type: config.providerType,
      base_url: config.baseUrl,
      api_key_masked,
      model: config.model,
      use_client_side: config.useClientSide,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Tests connection to an AI provider by making a minimal request (POST /api/ai-config/test).
 */
export async function testAiConfig(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { provider_type, base_url, api_key, model } = req.body;

  if (!provider_type || !base_url || !model) {
    return res.status(400).json({ error: 'provider_type, base_url, and model are required for testing' });
  }

  if (!ALLOWED_PROVIDERS.includes(provider_type)) {
    return res.status(400).json({ error: `Invalid provider type. Allowed: ${ALLOWED_PROVIDERS.join(', ')}` });
  }

  try {
    let testApiKey = '';
    const isMasked = api_key && (api_key.includes('*') || api_key.includes('•') || api_key.includes('…'));

    if (api_key && !isMasked) {
      testApiKey = api_key;
    } else {
      // Use existing key if not provided or if masked key was passed
      const existing = await prisma.aiConfig.findUnique({
        where: { userId },
      });
      if (existing?.apiKeyEncrypted) {
        testApiKey = decrypt(existing.apiKeyEncrypted);
      }
    }

    // Clean trailing slashes on base url
    const cleanUrl = base_url.endsWith('/') ? base_url.slice(0, -1) : base_url;
    const endpoint = `${cleanUrl}/chat/completions`;

    console.log(`Testing AI connectivity to endpoint: ${endpoint}`);

    // Make minimal request to test connection
    const response = await axios.post(
      endpoint,
      {
        model: model,
        messages: [{ role: 'user', content: 'Ping' }],
        max_tokens: 5,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          ...(testApiKey ? { Authorization: `Bearer ${testApiKey}` } : {}),
        },
        timeout: 10000, // 10 second timeout for diagnostic ping checks
      }
    );

    if (response.status >= 200 && response.status < 300) {
      return res.json({
        success: true,
        message: 'Connection verified successfully!',
      });
    } else {
      return res.status(400).json({
        success: false,
        error: `Provider returned status code ${response.status}`,
      });
    }
  } catch (error: any) {
    const apiError = error?.response?.data?.error?.message || error.message;
    console.error('AI Connection verification test failed:', apiError);
    return res.status(400).json({
      success: false,
      error: `Connection test failed: ${apiError}`,
    });
  }
}
