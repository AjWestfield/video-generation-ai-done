import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "The OPENROUTER_API_KEY environment variable is not set. See README.md for instructions on how to set it."
    );
  }

  const { script, audioDuration, interval = 4 } = await request.json();

  try {
    // Calculate how many images we need based on the audio duration and interval
    const numImages = Math.max(1, Math.ceil(audioDuration / interval));
    
    // Generate timestamps for each image
    const timestamps = Array.from({ length: numImages }, (_, i) => {
      return {
        startTime: i * interval,
        endTime: Math.min((i + 1) * interval, audioDuration)
      };
    });

    // Prepare the request for the AI to generate prompts
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://localhost:3000",
        "X-Title": "AI Video Creator"
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL_ID || "google/gemini-2.0-flash-001",
        messages: [
          {
            role: "system",
            content: `You are a specialized AI Image Prompt Generator that creates detailed, timestamped prompts for voice-synchronized visuals.

            First, analyze the provided script thoroughly to identify:
            1. Core narrative elements and emotional tone
            2. Key characters, settings, and objects mentioned
            3. Atmospheric details (lighting, weather, mood)
            4. Visual metaphors and symbolism potential
            5. The narrative arc with key moments
            
            Based on this deep analysis, create exactly ${numImages} highly detailed photorealistic image prompts that perfectly match the voiceover at each timestamp.
            
            For each prompt:
            1. Begin with "photo realistic" to ensure cinematic quality
            2. Write EXTREMELY detailed descriptions (minimum 40-50 words each)
            3. Include specific composition details like "close-up", "medium shot", "establishing shot", etc.
            4. Specify facial expressions, positioning, lighting conditions, and environmental details
            5. Focus on what would be spoken at that EXACT timestamp in the script
            6. Use 16:9 landscape aspect ratio, cinematic composition, and lighting terminology
            7. NEVER include instructions that would generate text, words, numbers or labels within the images
            8. Maintain narrative continuity between sequential images
            
            Your response must be a valid JSON object with this structure:
            {"imagePrompts": [{"timestamp": number, "prompt": "photo realistic detailed description"}]}
            
            The timestamp value represents the number of seconds into the voiceover when this image should appear.
            
            IMPORTANT: 
            - Every prompt MUST begin with "photo realistic"
            - Use detailed cinematography language (e.g., "shallow depth of field," "golden hour lighting")
            - Create a cohesive visual narrative with consistent style/characters throughout
            - NEVER suggest text, titles, labels, or captions in the image
            - Generate prompts for the ENTIRE duration of the voiceover, not just the beginning`
          },
          {
            role: "user",
            content: script,
          },
        ],
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `OpenRouter API error: ${response.status} ${JSON.stringify(errorData)}`
      );
    }

    const data = await response.json();
    
    return NextResponse.json(data.choices[0].message.content, { status: 200 });
  } catch (error) {
    console.error("Error generating timed image prompts:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
} 