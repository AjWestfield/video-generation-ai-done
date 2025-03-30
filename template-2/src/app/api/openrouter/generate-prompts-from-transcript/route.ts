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

    for (const segment of segments) {
      const systemPrompt = `You are an expert image prompt generator. Given a transcript segment from a voiceover, create a concise, visually descriptive image prompt suitable for a text-to-image model like Flux Pro. The prompt should accurately reflect the content and mood of the transcript segment for the given timestamp. Focus on visual elements, actions, setting, and atmosphere. Do not include timestamps or segment text in the output. Output only the generated image prompt itself, nothing else.`;

      const userPrompt = `Transcript segment (Time: ${segment.start.toFixed(2)}s - ${segment.end.toFixed(2)}s):\n"${segment.text}"\n\nGenerate the image prompt:`;

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

          // Basic cleanup (remove potential quotes or markdown)
          const cleanedImagePrompt = imagePrompt.replace(/^["'`]+|["'`]+$/g, '');

          results.push({
            start: segment.start,
            end: segment.end,
            transcriptSegment: segment.text,
            imagePrompt: cleanedImagePrompt,
          });
          promptGenerated = true; // Mark as successful

        } catch (error: any) {
          console.error(`Error generating prompt for segment ${segment.start.toFixed(2)}s (Attempt ${attempt}):`, error);
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
