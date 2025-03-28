import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { script, images } = await request.json();

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY is not set" },
        { status: 500 }
      );
    }

    if (!script) {
      return NextResponse.json(
        { error: "Script is required" },
        { status: 400 }
      );
    }

    const modelId = process.env.OPENROUTER_MODEL_ID || "google/gemini-2.0-flash-001";

    const systemPrompt = `
    You are a music prompt expert. Your task is to create detailed prompts for MusicGen, an AI music generation model.
    
    Analyze the script content provided and generate a music prompt that:
    1. Captures the tone, mood, and theme of the content
    2. Specifies the musical genre, instruments, tempo, and any other relevant details
    3. Creates an emotional backdrop that enhances the narrative
    4. Is specific and detailed enough to guide high-quality music generation
    5. Results in music that would feel natural alongside the visual elements and script
    
    Format your response as a single detailed music generation prompt paragraph.
    DO NOT include explanations, just provide the music prompt.
    `;

    console.log("Generating music prompt based on script content");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://www.futureai.dev",
        "X-Title": "AI Video Creator"
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: `Generate a detailed music prompt based on this script: 
            
            ${script}
            
            The music will be used as background for a video narrating this script.`
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to generate music prompt");
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      throw new Error("Invalid response from OpenRouter API");
    }

    const musicPrompt = data.choices[0].message.content.trim();
    console.log("Generated music prompt:", musicPrompt);

    return NextResponse.json({ 
      prompt: musicPrompt 
    }, { status: 200 });
    
  } catch (error) {
    console.error("Error generating music prompt:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
} 