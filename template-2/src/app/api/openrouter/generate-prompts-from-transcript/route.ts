import { NextResponse } from "next/server";
import OpenAI from "openai"; // Using OpenAI client for OpenRouter compatibility

// Define interface for the expected input segment structure
interface InputSegment {
  start: number;
  end: number;
  text: string;
}

// Define interface for the output structure
interface PromptResult {
  start: number;
  end: number;
  transcriptSegment: string;
  imagePrompt: string;
}

// Initialize OpenRouter client
// Ensure OPENROUTER_API_KEY is set in your .env.local
const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000", // Replace with your actual app URL if deployed
    "X-Title": "Video Generator App", // Replace with your app name
  },
});

const GEMINI_MODEL = "google/gemini-flash-1.5"; // Using recommended flash model

export async function POST(req: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: "OpenRouter API key not configured" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const segments: InputSegment[] = body.segments;

    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json({ error: "Invalid or empty segments array provided" }, { status: 400 });
    }

    const results: PromptResult[] = [];
    let attempt = 0;
    const maxAttempts = 3;

    // Keep track of the previous prompt to help maintain context
    let previousPromptContext = "The video starts."; 

    for (const segment of segments) {
      // Further refined system prompt emphasizing characters and context
      const systemPrompt = `You are an expert image prompt generator creating prompts for a continuous video storyboard. Your goal is to create prompts that are visually descriptive, maintain narrative consistency, and focus on the characters mentioned. 
Instructions:
1.  Analyze the 'Current transcript segment' and the 'Previous context'.
2.  Identify key characters, actions, settings, and mood.
3.  If characters are mentioned or implied, make them the central focus of the prompt.
4.  Maintain visual consistency with the 'Previous context'.
5.  The prompt MUST start exactly with "photo realistic ".
6.  Keep the prompt concise and focused on visual details.
7.  Do NOT include timestamps or the original transcript text in your output.
8.  Output only the generated image prompt itself.`;

      // Include previous context in the user prompt
      const userPrompt = `Previous context: "${previousPromptContext}"\n\nCurrent transcript segment (Time: ${segment.start.toFixed(2)}s - ${segment.end.toFixed(2)}s):\n"${segment.text}"\n\nGenerate the image prompt (must start with 'photo realistic ' and focus on characters if present):`;

      let promptGenerated = false;
      attempt = 0; // Reset attempts for each segment

      while (!promptGenerated && attempt < maxAttempts) {
        attempt++;
        console.log(`Generating prompt for segment ${segment.start.toFixed(2)}s (Attempt ${attempt})...`);
        try {
          const response = await openrouter.chat.completions.create({
            model: GEMINI_MODEL,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.7, // Adjust temperature as needed
            max_tokens: 150, // Limit prompt length
          });

          const imagePrompt = response.choices[0]?.message?.content?.trim();

          if (!imagePrompt) {
            throw new Error("OpenRouter returned an empty prompt.");
          }

          // Basic cleanup (remove potential quotes or markdown) and ensure prefix
          let finalImagePrompt = imagePrompt.replace(/^["'`]+|["'`]+$/g, '').trim();
          if (!finalImagePrompt.toLowerCase().startsWith("photo realistic ")) {
            finalImagePrompt = "photo realistic " + finalImagePrompt;
          }

          results.push({
            start: segment.start,
            end: segment.end,
            transcriptSegment: segment.text, // Keep original segment text for modal
            imagePrompt: finalImagePrompt,
          });
          promptGenerated = true; // Mark as successful
          previousPromptContext = `The last scene showed: ${finalImagePrompt}`; // Update context for next iteration

        } catch (error: any) {
          console.error(`Error generating prompt for segment ${segment.start.toFixed(2)}s (Attempt ${attempt}):`, error);
          previousPromptContext = `Error generating prompt for the previous segment. Original text was: ${segment.text}`; // Update context on error
          if (attempt >= maxAttempts) {
            // Add a placeholder or skip if max attempts reached
            results.push({
              start: segment.start,
              end: segment.end,
              transcriptSegment: segment.text,
              imagePrompt: `Error: Could not generate prompt for this segment. Original text: ${segment.text}`,
            });
          } else {
             await new Promise(resolve => setTimeout(resolve, 500 * attempt)); // Exponential backoff
          }
        }
      }
       // Add a small delay between segments if needed
       // await new Promise(resolve => setTimeout(resolve, 100));
    }

    return NextResponse.json({ prompts: results });

  } catch (error: any) {
    console.error("Error processing prompt generation request:", error);
    return NextResponse.json({ error: error.message || "Failed to generate prompts" }, { status: 500 });
  }
}
