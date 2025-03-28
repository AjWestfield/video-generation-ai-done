import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "The OPENROUTER_API_KEY environment variable is not set. See README.md for instructions on how to set it."
    );
  }

  const { script } = await request.json();

  try {
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
            content: `You are an expert voice selection AI that analyzes scripts to determine the most appropriate voice characteristics.

            Your task is to analyze the provided script and determine:
            1. The gender perspective of the narrator (male, female, or neutral)
            2. The emotional tone of the script (e.g., professional, warm, serious, dramatic, humorous, etc.)
            3. Any specific voice qualities that would enhance narration (e.g., deep, soft, authoritative)
            4. Any accent preferences that would be appropriate (e.g., American, British, Indian, African)
            
            Look for first-person pronouns (I, me, my) or any explicit gender self-identification within the script.
            For example, phrases like "As a woman..." or "Being a man..." or "28-year-old male" clearly indicate the gender.
            
            Your response must be a valid JSON object with this structure:
            {
              "gender": "male" | "female" | "neutral",
              "tone": ["primary_tone", "secondary_tone"],
              "qualities": ["quality1", "quality2"],
              "accent": "preferred_accent",
              "explanation": "brief explanation of your analysis"
            }
            
            IMPORTANT: The response MUST be valid JSON without any additional text or commentary.`
          },
          {
            role: "user",
            content: script,
          },
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `OpenRouter API error: ${response.status} ${JSON.stringify(errorData)}`
      );
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse the JSON response
    try {
      const scriptAnalysis = JSON.parse(content);
      return NextResponse.json(scriptAnalysis, { status: 200 });
    } catch (parseError) {
      console.error("Error parsing script analysis:", parseError);
      throw new Error("Failed to parse script analysis response");
    }
  } catch (error) {
    console.error("Error analyzing script:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
} 