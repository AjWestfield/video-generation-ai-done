import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // Return an empty response without performing any processing
  console.log("Sound effect generation is disabled");
  
  return NextResponse.json({
    soundEffectUrl: "" // Return empty sound effect URL
  }, { status: 200 });
} 