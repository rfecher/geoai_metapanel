/**
 * Avatar Generation Service
 *
 * This service provides functionality to generate alternative avatar images
 * using AI image generation APIs based on persona descriptions.
 *
 * Currently supports:
 * - Placeholder generation (for development)
 * - Future: DALL-E, Stable Diffusion, Midjourney integration
 */

import { Persona } from '../data/personas';

export type AvatarGenerationProvider = 'placeholder' | 'dalle' | 'stable-diffusion' | 'stable-diffusion-local';

export interface AvatarGenerationConfig {
  provider: AvatarGenerationProvider;
  apiKey?: string;
  apiEndpoint?: string;
}

/**
 * Generate a prompt for avatar image generation based on persona description
 */
export function generateAvatarPrompt(persona: Persona): string {
  if (persona.imagePrompt && persona.imagePrompt.trim().length > 0) {
    return persona.imagePrompt;
  }
  // Extract key details from persona for image generation
  const prompt = `Professional portrait photograph of ${persona.name}, ${persona.shortBio}.
High quality headshot, neutral background, professional lighting, photorealistic,
detailed facial features, confident expression, business casual attire.
Style: corporate headshot, LinkedIn profile photo quality.`;

  return prompt;
}

/**
 * Generate avatar using placeholder service (for development)
 * Uses a service like UI Avatars or similar
 */
function generatePlaceholderAvatar(persona: Persona): string {
  // Use UI Avatars API or similar service
  const name = encodeURIComponent(persona.name);
  const color = persona.color.replace('#', '');
  const background = 'f0f0f0';

  // Multiple placeholder options:

  // Option 1: UI Avatars
  const uiAvatarsUrl = `https://ui-avatars.com/api/?name=${name}&size=512&background=${color.substring(0, 6)}&color=fff&bold=true&format=png`;

  // Option 2: DiceBear (more varied styles)
  const diceBearUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}&backgroundColor=${color.substring(0, 6)}`;

  // Option 3: Boring Avatars
  const boringAvatarsUrl = `https://source.boringavatars.com/beam/512/${name}?colors=${color.substring(0, 6)},264653,2a9d8f,e9c46a,f4a261`;

  // Return UI Avatars by default (most reliable)
  return uiAvatarsUrl;
}

/**
 * Generate avatar using DALL-E API
 * Requires OpenAI API key
 */
async function generateDalleAvatar(persona: Persona, apiKey: string): Promise<string> {
  const prompt = generateAvatarPrompt(persona);

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
      }),
    });

    if (!response.ok) {
      throw new Error(`DALL-E API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].url;
  } catch (error) {
    console.error('Failed to generate DALL-E avatar:', error);
    throw error;
  }
}

/**
 * Generate avatar using Stable Diffusion API
 * Requires Stability AI API key
 */
async function generateStableDiffusionAvatar(persona: Persona, apiKey: string): Promise<string> {
  const prompt = generateAvatarPrompt(persona);

  try {
    const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        text_prompts: [
          {
            text: prompt,
            weight: 1,
          },
        ],
        cfg_scale: 7,
        height: 1024,
        width: 1024,
        samples: 1,
        steps: 30,
      }),
    });

    if (!response.ok) {
      throw new Error(`Stable Diffusion API error: ${response.statusText}`);
    }

    const data = await response.json();
    // Convert base64 to data URL
    return `data:image/png;base64,${data.artifacts[0].base64}`;
  } catch (error) {
    console.error('Failed to generate Stable Diffusion avatar:', error);
    throw error;
  }
}

/**
 * Generate avatar using a local Stable Diffusion server (Automatic1111 API)
 * No API key required, but endpoint must be reachable (default: http://127.0.0.1:7860)
 */
async function generateStableDiffusionLocalAvatar(persona: Persona, endpoint?: string): Promise<string> {
  const prompt = generateAvatarPrompt(persona);
  const url = `${(endpoint || 'http://127.0.0.1:7860').replace(/\/$/, '')}/sdapi/v1/txt2img`;

  const negativePrompt = 'low quality, worst quality, jpeg artifacts, blurry, distorted, deformed face, extra limbs, extra fingers, bad anatomy, watermark, text';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        negative_prompt: negativePrompt,
        steps: 24,
        width: 512,
        height: 512,
        cfg_scale: 5.5,
        sampler_name: 'Euler a',
        batch_size: 1,
        n_iter: 1,
        restore_faces: false,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Local SD API error: ${response.status} ${response.statusText} - ${text}`);
    }

    const data = await response.json();
    const base64 = (data.images && data.images[0]) as string;
    if (!base64) throw new Error('Local SD returned no images');
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error('Failed to generate local Stable Diffusion avatar:', error);
    throw error;
  }
}


/**
 * Main function to generate avatar based on configuration
 */
export async function generateAvatar(
  persona: Persona,
  config: AvatarGenerationConfig
): Promise<string> {
  switch (config.provider) {
    case 'placeholder':
      return generatePlaceholderAvatar(persona);

    case 'dalle':
      if (!config.apiKey) {
        throw new Error('DALL-E requires an API key');
      }
      return await generateDalleAvatar(persona, config.apiKey);

    case 'stable-diffusion':
      if (!config.apiKey) {
        throw new Error('Stable Diffusion requires an API key');
      }
      return await generateStableDiffusionAvatar(persona, config.apiKey);

    case 'stable-diffusion-local':
      return await generateStableDiffusionLocalAvatar(persona, config.apiEndpoint);

    default:
      throw new Error(`Unknown avatar generation provider: ${config.provider}`);
  }
}

/**
 * Cache generated avatars in localStorage
 */
export function cacheGeneratedAvatar(personaId: string, avatarUrl: string): void {
  try {
    const cache = JSON.parse(localStorage.getItem('generatedAvatars') || '{}');
    cache[personaId] = {
      url: avatarUrl,
      timestamp: Date.now(),
    };
    localStorage.setItem('generatedAvatars', JSON.stringify(cache));
  } catch (error) {
    console.error('Failed to cache avatar:', error);
  }
}

/**
 * Retrieve cached avatar from localStorage
 */
export function getCachedAvatar(personaId: string): string | null {
  try {
    const cache = JSON.parse(localStorage.getItem('generatedAvatars') || '{}');
    const cached = cache[personaId];

    if (cached) {
      // Check if cache is less than 7 days old
      const age = Date.now() - cached.timestamp;
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

      if (age < maxAge) {
        return cached.url;
      }
    }

    return null;
  } catch (error) {
    console.error('Failed to retrieve cached avatar:', error);
    return null;
  }
}

/**
 * Clear all cached avatars
 */
export function clearAvatarCache(): void {
  try {
    localStorage.removeItem('generatedAvatars');
  } catch (error) {
    console.error('Failed to clear avatar cache:', error);
  }
}

