import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
// Remove the basic Transcription type, we'll define a more specific one
// import { Transcription } from "openai/resources/audio/transcriptions";

const openai = new OpenAI();

// Define interface for the verbose JSON response structure
interface WhisperSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

interface VerboseTranscription {
  text: string;
  language: string;
  duration: number;
  segments: WhisperSegment[];
  // Potentially add 'words' array here if word-level granularity is needed later
}


// Helper function to ensure directory exists
const ensureDirectoryExistence = (filePath: string) => {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  fs.mkdirSync(dirname, { recursive: true });
};

export async function POST(req: Request) {
  let filePath: string | null = null; // Declare filePath outside the try block

  try {
    const body = await req.json();
    const base64Audio = body.audio;

    if (!base64Audio) {
      return NextResponse.json({ error: "No audio data provided" }, { status: 400 });
    }

    // Convert the base64 audio data to a Buffer
    const audio = Buffer.from(base64Audio, "base64");

    // Define the file path for storing the temporary WAV file
    const tempDir = path.join(process.cwd(), "tmp");
    // Assign value to the outer scope variable
    filePath = path.join(tempDir, `input-${Date.now()}.wav`);

    // Ensure the temporary directory exists
    ensureDirectoryExistence(filePath);

    // Write the audio data to a temporary WAV file (convert Buffer to Uint8Array)
    fs.writeFileSync(filePath, new Uint8Array(audio));

    // Create a readable stream from the temporary WAV file
    const readStream = fs.createReadStream(filePath);

    // Request verbose JSON with segment timestamps and cast result appropriately
    const data = (await openai.audio.transcriptions.create({
      file: readStream,
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    })) as any as VerboseTranscription; // Cast to any first, then to our interface

    // Clean up the temporary file
    try {
      fs.unlinkSync(filePath);
    } catch (unlinkError) {
      console.error("Error removing temporary audio file:", unlinkError);
      // Continue even if cleanup fails
    }

    // Return the segments array (already checked by VerboseTranscription type)
    return NextResponse.json({ segments: data.segments });

  } catch (error: any) {
    console.error("Error processing audio transcription:", error);
    // Clean up temp file in case of error during transcription
    // Check if filePath was assigned before trying to access it
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (unlinkError) {
         console.error("Error removing temporary audio file after error:", unlinkError);
      }
    }
    return NextResponse.json({ error: error.message || "Failed to transcribe audio" }, { status: 500 });
  }
}
