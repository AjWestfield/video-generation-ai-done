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
    // Use the full model identifier with version hash
    const versionId = "b744535cf2bf3c4cf2130d0cc75cd4795b280215f8275b041015fb4f9917cbcd"; // Extracted version hash
    const modelOwner = "black-forest-labs";
    const modelName = "flux-1.1-pro";

    // Use create and wait pattern instead of run
    const prediction = await replicate.predictions.create({
      version: versionId,
      input: {
        prompt: prompt,
        // Re-add valid optional parameters if desired, start minimal
        aspect_ratio: "16:9",
        output_format: "png",
        output_quality: 100,
        prompt_upsampling: true,
      },
    });

    // Wait for the prediction to complete using the top-level wait function
    const completedPrediction = await replicate.wait(prediction);

    // Check for errors in the completed prediction
    if (completedPrediction.status === "failed" || completedPrediction.status === "canceled") {
      console.error("Replicate prediction failed:", completedPrediction.error);
      return NextResponse.json({ error: completedPrediction.error || "Prediction failed or canceled" }, { status: 500 });
    }

    // Extract the output
    // Extract the output (which should be a single URL string for this model)
    const outputUrl = completedPrediction.output as string;
    console.log("Final output URL from Replicate:", outputUrl);

    // Ensure the response format matches frontend expectation (array of URLs)
    const responseOutput = outputUrl ? [outputUrl] : [];

    return NextResponse.json({ output: responseOutput }, { status: 200 });
  } catch (error) {
    console.error("Error from Replicate API:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
