import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error(
      "The ELEVENLABS_API_KEY environment variable is not set. See README.md for instructions on how to set it."
    );
  }

  const { text, voiceId = "21m00Tcm4TlvDq8ikWAM" } = await request.json();

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} ${errorText}`);
    }

    // Get audio data as ArrayBuffer
    const audioBuffer = await response.arrayBuffer();
    
    // Convert to base64 for easier handling in frontend
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    return NextResponse.json({ 
      audioBase64: base64Audio 
    }, { 
      status: 200 
    });
  } catch (error) {
    console.error("Error from ElevenLabs API:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
} 