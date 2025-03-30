import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // Return an empty response without performing any processing
  console.log("Sound effect prompt generation is disabled");
  
  return NextResponse.json({ 
    soundEffects: [] // Return empty array of sound effects
  }, { status: 200 });
} 