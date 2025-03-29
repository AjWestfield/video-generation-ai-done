import { NextResponse } from "next/server";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error(
      "The REPLICATE_API_TOKEN environment variable is not set. See README.md for instructions on how to set it."
    );
  }

  const { prompt } = await request.json();

  try {
    const output = await replicate.run(
      process.env.REPLICATE_IMAGE_MODEL_ID || "black-forest-labs/flux-schnell",
      {
        input: {
          prompt: prompt,
          aspect_ratio: "16:9",
          output_format: "png",
          output_quality: 100,
          go_fast: true,
          megapixels: "1",
          num_outputs: 1,
          num_inference_steps: 4,
          negative_prompt: "blurry, low quality, cartoon, 3d, painting, drawing, low resolution, square format, portrait orientation",
        },
      }
    );

    return NextResponse.json({ output }, { status: 200 });
  } catch (error) {
    console.error("Error from Replicate API:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
