import { NextResponse } from "next/server";

// Define interface for the *new* expected output structure
interface EnhancedImagePromptItem {
  timestamp: number; // Start time in seconds
  prompt: string; // The main visual prompt
  negativePrompt: string; // Combined negative prompts
  transcriptSegment: string; // The corresponding text
}

// Define Character Profiles (Hardcoded for now)
const character_profiles: { [key: string]: any } = {
    "CP-01": {
        "name": "Dr. Smith", // Added name for clarity if needed
        "age": "28",
        "height": "5'9\"",
        "build": "athletic slim",
        "hair": "dark brown wavy shoulder-length",
        "eyes": "hazel almond-shaped",
        "marks": "small mole on left cheekbone",
        "palette": ["navy", "charcoal", "cream"], // Use array for easier joining
        "accessories": ["silver wristwatch", "leather bracelet"] // Use array
    },
    // Add more profiles here as needed, e.g., CP-02, CP-03...
};


export async function POST(request: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "The OPENROUTER_API_KEY environment variable is not set. See README.md for instructions on how to set it."
    );
  }

  // Use fixed 4-second interval
  const { script, audioDuration } = await request.json();
  const interval = 4; 

  try {
    // Calculate how many images we need based on the audio duration and FIXED interval
    const maxImages = 1000; 
    const numImages = Math.max(1, Math.ceil(audioDuration / interval)); 
    // No need to cap numImages here, let it generate for the full duration
    
    // Remove actualInterval calculation
    
    // Generate timestamps for each image using fixed 4s interval
    const timestamps = Array.from({ length: numImages }, (_, i) => {
      const startTime = i * interval; // Strictly i * 4
      const endTime = startTime + interval; // Strictly start + 4
      return {
        startTime: startTime,
        endTime: endTime, // Note: endTime might exceed audioDuration, formatTimestamp handles display
        // Use the new HH:MM:SS formatTimestamp function
        formattedTime: formatTimestamp(startTime) + "-" + formatTimestamp(endTime) 
      };
    });

    console.log(`Generating ${numImages} image prompts at strict 4-second intervals.`);

    // Implement retry mechanism for API calls
    const maxRetries = 3;
    let retryCount = 0;
    let responseData = null;

    while (retryCount < maxRetries && !responseData) {
      try {
        console.log(`Attempt ${retryCount + 1} to generate image prompts...`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

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
                // System Prompt updated for Character Consistency Protocol & HH:MM:SS format
                content: `You are an Advanced Visual Storyboard Generator specialized in creating diverse, contextually appropriate image prompts from voiceover scripts, with a strong focus on character consistency. Your task is to:

1.  FIRST: Carefully analyze the provided transcript/audio and segment it into ${numImages} chunks based on the provided timestamps (each representing exactly 4 seconds).
2.  SECOND: For each segment, identify the distinct core concept being communicated and any characters involved.
3.  THIRD: Generate a unique, detailed photorealistic image prompt for each segment, adhering strictly to the output format below.

CHARACTER CONSISTENCY RULES:
1.  Reference Character Profiles: Use provided profiles (like CP-01) when generating prompts involving those characters.
2.  Maintain Immutable Traits: Ensure key traits (age, eye color, hair color/texture, distinctive marks) remain identical across all scenes for a character.
3.  Vary Mutable Traits: Change expressions, poses, actions, and specific clothing items (within the character's palette) to match the scene's context and ensure visual diversity.
4.  Lighting Consistency: Maintain consistent lighting temperature and direction across sequential scenes unless a narrative change justifies alteration.
5.  Negative Prompts: Include specific negative prompts to prevent character inconsistencies.

OUTPUT STRUCTURE (Strictly follow this multi-line format for EACH segment, using HH:MM:SS):

[TIMESTAMP: HH:MM:SS-HH:MM:SS]
CONTENT: "Transcript text for this segment"
CHARACTER PROFILE: [Profile ID (e.g., CP-01) if character present, otherwise "None"] | [Key immutable traits for consistency check, e.g., Age: 28 | Eyes: hazel almond-shaped | Hair: dark brown wavy]
SCENE SPECIFICS: [Describe current action, facial expression, and specific clothing items being worn from palette]
SCENE TYPE: [Establish a specific scene type that differs from adjacent segments, e.g., Establishing wide shot, Close-up detail shot, Outdoor action medium shot]
VISUAL PROMPT: [Generate 75-100 word detailed photorealistic description. Start with 'photo realistic'. Place character descriptors before scene descriptions. Reference profile ID if applicable. Include environment, lighting, perspective, mood, and ensure variety from previous scenes. End with '16:9 aspect ratio, landscape orientation'.]
NEGATIVE PROMPT: [10-15 specific elements to exclude, tailored to this scene type AND character consistency. Include base negatives implicitly.]

BASE NEGATIVE PROMPTS (Apply internally, DO NOT repeat in the NEGATIVE PROMPT field): low quality, bad anatomy, poorly drawn face, distorted facial features, blurry, pixelated, grainy, jpeg artifacts, watermark, text, unrealistic proportions, oversaturated colors, animation style, cartoon, drawing, illustration, painting, sketch, 3d render, artificial lighting, unnatural shadows.

CHARACTER NEGATIVE PROMPTS (Add relevant ones to the NEGATIVE PROMPT field): inconsistent facial features, mismatched eye color, disproportioned limbs, changing hairstyle mid-sequence, clothing color inconsistency, unnatural posture shifts, floating accessories.

SCENE-SPECIFIC NEGATIVE PROMPT EXAMPLES (Add 2-3 relevant ones to the NEGATIVE PROMPT field):
- Indoor scenes: "harsh shadows, cluttered background, uneven lighting"
- Outdoor scenes: "overexposed sky, unnatural colors, flat landscape"
- People: "extra limbs, fused fingers, asymmetrical features, unnatural pose"

Ensure you generate a block for each of the ${numImages} segments requested in the user message.`
              },
              {
                role: "user",
                // Updated user prompt to reflect HH:MM:SS format request
                content: `Script: ${script.substring(0, 5000)}
                
Audio duration: ${audioDuration} seconds

This script is about Superman from a first-person perspective. I need ${numImages} highly detailed, photorealistic image prompts for these segments (using HH:MM:SS format):
${timestamps.slice(0, 15).map(t => `- [${t.formattedTime}]: (Starts at ${t.startTime} seconds)`).join('\n')}
${numImages > 15 ? `...and ${numImages - 15} more segments` : ''}

Create prompts that precisely match what would be spoken at each timestamp in the script, with extensive visual detail (lighting, composition, emotion, setting, etc.). Remember to include Superman's iconic imagery in every relevant scene and maintain first-person perspective where appropriate. Keep visual continuity with adjacent segments. Ensure the output format uses HH:MM:SS for timestamps.`
              },
            ],
            max_tokens: 8000,
            temperature: 0.7,
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: "Failed to parse error response" }));
          throw new Error(
            `OpenRouter API error: ${response.status} ${JSON.stringify(errorData)}`
          );
        }

        const data = await response.json();
        responseData = data;
        break;
        
      } catch (error: any) { // Explicitly type error as any or Error
        retryCount++;
        console.error(`Attempt ${retryCount} failed:`, error);
        
        if (error.name === 'AbortError') {
          console.log('Request timed out, retrying...');
        }
        
        // If we've exhausted all retries, throw the error
        if (retryCount >= maxRetries) {
          throw error;
        }
        
        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        console.log(`Waiting ${delay}ms before retry ${retryCount + 1}...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    const data = responseData;
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      throw new Error("Unexpected response format from OpenRouter API");
    }
    
    const content = data.choices[0].message.content;
    console.log("Raw model response length:", content.length);
    console.log("Raw model response (truncated):", content.substring(0, 500) + "...");

    // --- Rewritten Parsing Logic for Character Consistency Protocol ---
    const baseNegativePrompt = "low quality, bad anatomy, poorly drawn face, distorted facial features, blurry, pixelated, grainy, jpeg artifacts, watermark, text, unrealistic proportions, oversaturated colors, animation style, cartoon, drawing, illustration, painting, sketch, 3d render, artificial lighting, unnatural shadows";
    const characterNegativePrompts = "inconsistent facial features, mismatched eye color, disproportioned limbs, changing hairstyle mid-sequence, clothing color inconsistency, unnatural posture shifts, floating accessories"; // Base character negatives
    const imagePrompts: EnhancedImagePromptItem[] = [];
    // Updated Regex to capture HH:MM:SS format
    const segmentRegex = /\[TIMESTAMP: (\d{2}:\d{2}:\d{2}-\d{2}:\d{2}:\d{2})\]\s*CONTENT: "([\s\S]*?)"\s*CHARACTER PROFILE: ([\s\S]*?)\s*SCENE SPECIFICS: ([\s\S]*?)\s*SCENE TYPE: ([\s\S]*?)\s*VISUAL PROMPT: ([\s\S]*?)\s*NEGATIVE PROMPT: ([\s\S]*?)(?=\n\[TIMESTAMP:|\n*$)/g;

    let match;
    while ((match = segmentRegex.exec(content)) !== null) {
        try {
            const timestampStr = match[1]; // HH:MM:SS-HH:MM:SS
            const transcriptSegment = match[2].trim();
            // const characterProfileInfo = match[3].trim(); 
            // const sceneSpecifics = match[4].trim(); 
            // const sceneType = match[5].trim(); 
            let visualPrompt = match[6].trim();
            let sceneNegativePrompt = match[7].trim();

            // Extract start time in seconds from HH:MM:SS
            const startTimeStr = timestampStr.split('-')[0]; // HH:MM:SS
            const [hours, minutes, seconds] = startTimeStr.split(':').map(Number);
            const timestampSeconds = hours * 3600 + minutes * 60 + seconds;

            // --- Prompt Cleaning ---
            // Ensure prompt starts with "photo realistic"
            if (!visualPrompt.startsWith("photo realistic")) {
                visualPrompt = `photo realistic ${visualPrompt}`;
            }
            // Ensure prompt ends with aspect ratio (handle potential trailing commas/periods)
            visualPrompt = visualPrompt.replace(/[,.]?$/, ''); // Remove trailing punctuation if any
            if (!visualPrompt.includes("16:9 aspect ratio")) {
                visualPrompt = `${visualPrompt}, 16:9 aspect ratio, landscape orientation`;
            }

            // --- Combine Negative Prompts ---
            const combinedNegativePrompt = `${baseNegativePrompt}, ${characterNegativePrompts}, ${sceneNegativePrompt}`;

            imagePrompts.push({
                timestamp: timestampSeconds,
                prompt: visualPrompt,
                negativePrompt: combinedNegativePrompt,
                transcriptSegment: transcriptSegment,
            });
        } catch (parseError) {
            console.error("Error parsing individual segment:", parseError, match[0].substring(0, 150) + "...");
        }
    }

    console.log(`Successfully parsed ${imagePrompts.length} prompts using new logic.`);

    // Fallback if parsing failed completely
    if (imagePrompts.length === 0) {
       console.warn("Parsing failed, using fallback prompt generation.");
       // Generate basic prompts as fallback using fixed interval
       const fallbackPrompts = timestamps.map((t, i) => { // Use index i
         const startTimeSeconds = i * interval; // Calculate start time based on index and fixed interval
         const scriptSegmentStart = Math.floor((script.length * startTimeSeconds) / audioDuration);
         const scriptSegmentEnd = Math.min(script.length, scriptSegmentStart + 200);
         const scriptSegment = script.substring(scriptSegmentStart, scriptSegmentEnd).split(" ").slice(0, 20).join(" ");
         const potentialProfileId = script.toLowerCase().includes("dr. smith") ? "CP-01" : null; 
         const fallbackNegative = potentialProfileId ? `${baseNegativePrompt}, ${characterNegativePrompts}` : baseNegativePrompt;

         return {
           timestamp: startTimeSeconds, // Use calculated start time
           prompt: `photo realistic detailed scene for "${scriptSegment}...". ${potentialProfileId ? `Featuring ${character_profiles[potentialProfileId]?.name || potentialProfileId}.` : ''} High-quality cinematographic composition with appropriate lighting and setting. 16:9 aspect ratio, landscape orientation`,
           negativePrompt: fallbackNegative,
           transcriptSegment: scriptSegment + "..."
         };
       });
       return NextResponse.json({ imagePrompts: fallbackPrompts }, { status: 200 });
    }

    // Sort by timestamp before returning
    imagePrompts.sort((a, b) => a.timestamp - b.timestamp);

    // Return the parsed and structured prompts
    return NextResponse.json({ imagePrompts }, { status: 200 });
    // --- End Rewritten Parsing Logic ---

  } catch (error: any) { // Ensure error is typed
    console.error("Error in generate-timed-image-prompts:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

// Helper function to format timestamps as HH:MM:SS
function formatTimestamp(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
