import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

// Initialize Replicate client
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || '',
});

// API endpoint to check prediction status
export async function POST(req: NextRequest) {
  try {
    const { predictionId } = await req.json();
    
    if (!predictionId) {
      return NextResponse.json(
        { error: 'Missing required parameter: predictionId' }, 
        { status: 400 }
      );
    }
    
    // Get prediction status from Replicate
    const prediction = await replicate.predictions.get(predictionId);
    
    // If completed, return the output URLs
    if (prediction.status === 'succeeded') {
      // Extract the mp4 URL from the output (Kling model returns multiple formats)
      let videoUrl = null;
      if (Array.isArray(prediction.output)) {
        // If output is an array, find the URL (typically first item)
        videoUrl = prediction.output[0];
      } else if (typeof prediction.output === 'object' && prediction.output !== null) {
        // If output is an object with format-specific URLs
        videoUrl = prediction.output.mp4 || prediction.output.video || Object.values(prediction.output)[0];
      } else {
        // If output is a direct URL
        videoUrl = prediction.output;
      }
      
      return NextResponse.json({
        status: 'complete',
        prediction: prediction,
        output: videoUrl
      });
    } 
    // If failed, return error information
    else if (prediction.status === 'failed') {
      return NextResponse.json({
        status: 'failed',
        error: prediction.error || 'Animation generation failed',
        prediction: prediction
      });
    }
    // If still processing, return current status
    else {
      return NextResponse.json({
        status: 'processing',
        prediction: prediction,
        progress: prediction.metrics?.predict_time || 0
      });
    }
  } catch (error: any) {
    console.error('Error checking prediction status:', error);
    return NextResponse.json(
      { error: `Failed to check prediction status: ${error.message}` }, 
      { status: 500 }
    );
  }
} 