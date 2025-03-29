import { TimedImage } from '@/types';

export interface SoundEffect {
  timestamp: number;
  prompt: string;
  url?: string;
}

/**
 * Generate sound effect prompts based on the script and images
 */
export async function generateSoundEffectPrompts(
  script: string,
  timedImages: TimedImage[]
): Promise<SoundEffect[]> {
  try {
    const response = await fetch('/api/openrouter/generate-sound-effect-prompts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        script,
        timedImages,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate sound effect prompts');
    }

    const data = await response.json();
    return data.soundEffects;
  } catch (error) {
    console.error('Error generating sound effect prompts:', error);
    throw error;
  }
}

/**
 * Generate a sound effect from a prompt using Tango model
 */
export async function generateSoundEffect(prompt: string): Promise<string> {
  try {
    const response = await fetch('/api/replicate/generate-sound-effect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate sound effect');
    }

    const data = await response.json();
    return data.soundEffectUrl;
  } catch (error) {
    console.error('Error generating sound effect:', error);
    throw error;
  }
}

/**
 * Generate sound effects for all provided prompts
 */
export async function generateAllSoundEffects(
  soundEffects: SoundEffect[]
): Promise<SoundEffect[]> {
  const results: SoundEffect[] = [];
  
  for (const effect of soundEffects) {
    try {
      const url = await generateSoundEffect(effect.prompt);
      results.push({
        ...effect,
        url
      });
    } catch (error) {
      console.error(`Error generating sound effect for prompt "${effect.prompt}":`, error);
      // Continue with other sound effects even if one fails
    }
  }
  
  return results;
} 