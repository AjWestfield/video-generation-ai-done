import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import crypto from "crypto";

const execPromise = promisify(exec);

// Ensure temporary directories exist
async function ensureDirExists(dirPath: string) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    console.error(`Error creating directory ${dirPath}:`, error);
  }
}

export async function POST(request: Request) {
  try {
    const { images, timedImages, audioBase64, backgroundMusic, duration = 5 } = await request.json();
    
    // Use either timedImages (with timestamps) or fallback to regular images
    const hasTimedImages = timedImages && Array.isArray(timedImages) && timedImages.length > 0;
    
    if ((!images || images.length === 0) && !hasTimedImages) {
      return NextResponse.json(
        { error: "No images provided" },
        { status: 400 }
      );
    }

    if (!audioBase64) {
      return NextResponse.json(
        { error: "No audio provided" },
        { status: 400 }
      );
    }

    // Generate a unique ID for this video
    const videoId = crypto.randomUUID();
    
    // Define directories for temporary files
    const publicDir = path.join(process.cwd(), "public");
    const tempDir = path.join(publicDir, "temp", videoId);
    const outputDir = path.join(publicDir, "videos");
    
    // Ensure directories exist
    await ensureDirExists(tempDir);
    await ensureDirExists(outputDir);
    
    // Save audio file
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const audioPath = path.join(tempDir, "audio.mp3");
    await fs.writeFile(audioPath, audioBuffer);
    
    // Save background music file if provided
    let musicPath = null;
    if (backgroundMusic) {
      try {
        // Download the background music file from the URL
        const musicResponse = await fetch(backgroundMusic);
        if (!musicResponse.ok) {
          throw new Error(`Failed to download music: ${musicResponse.statusText}`);
        }
        const musicBuffer = await musicResponse.arrayBuffer();
        musicPath = path.join(tempDir, "music.mp3");
        await fs.writeFile(musicPath, Buffer.from(musicBuffer));
        console.log("Background music saved to:", musicPath);
      } catch (error) {
        console.error("Error downloading background music:", error);
        // Continue without background music if there's an error
      }
    }
    
    // Save images
    const imagePaths = [];
    let timestamps: number[] = [];
    
    if (hasTimedImages) {
      // Sort timedImages by timestamp
      const sortedTimedImages = [...timedImages].sort((a, b) => a.timestamp - b.timestamp);
      
      console.log(`Processing ${sortedTimedImages.length} images for video generation`);
      
      for (let i = 0; i < sortedTimedImages.length; i++) {
        const item = sortedTimedImages[i];
        const imgData = item.imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const imgBuffer = Buffer.from(imgData, 'base64');
        const imgPath = path.join(tempDir, `image_${i.toString().padStart(3, '0')}.jpg`);
        await fs.writeFile(imgPath, imgBuffer);
        imagePaths.push(imgPath);
        timestamps.push(item.timestamp);
      }
    } else {
      // Fallback to evenly spaced regular images
      for (let i = 0; i < images.length; i++) {
        const imgData = images[i].replace(/^data:image\/\w+;base64,/, "");
        const imgBuffer = Buffer.from(imgData, 'base64');
        const imgPath = path.join(tempDir, `image_${i.toString().padStart(3, '0')}.jpg`);
        await fs.writeFile(imgPath, imgBuffer);
        imagePaths.push(imgPath);
        
        // Calculate estimated timestamp for this image
        const estimatedTimestamp = (i * duration) / images.length;
        timestamps.push(estimatedTimestamp);
      }
    }
    
    // Create FFmpeg input file for images with precise durations
    const inputListPath = path.join(tempDir, "input.txt");
    let inputListContent = "";
    
    // Calculate durations between timestamps
    for (let i = 0; i < imagePaths.length; i++) {
      const currentTime = timestamps[i];
      const nextTime = i < imagePaths.length - 1 ? timestamps[i + 1] : duration;
      const imageDuration = Math.max(nextTime - currentTime, 0.5); // Minimum 0.5 seconds per image
      
      inputListContent += `file '${imagePaths[i]}'\nduration ${imageDuration}\n`;
    }
    
    // Add the last image again (required by FFmpeg)
    if (imagePaths.length > 0) {
      inputListContent += `file '${imagePaths[imagePaths.length - 1]}'\n`;
    }
    
    await fs.writeFile(inputListPath, inputListContent);
    
    // Output video path
    const outputVideoPath = path.join(outputDir, `${videoId}.mp4`);
    const publicVideoPath = `/videos/${videoId}.mp4`;
    
    // FFmpeg command for video creation
    let ffmpegCommand;
    
    if (musicPath) {
      // First, analyze the audio duration to apply proper fade-out
      const analyzeVoiceoverCommand = `${process.env.FFMPEG_PATH?.replace('ffmpeg', 'ffprobe') || 'ffprobe'} -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${audioPath}`;
      const { stdout: voiceoverDurationStr } = await execPromise(analyzeVoiceoverCommand);
      const voiceoverDuration = parseFloat(voiceoverDurationStr.trim());

      console.log(`Voiceover duration: ${voiceoverDuration} seconds, applying fade-out to music`);

      // Add fade-out effect to music at the end of the voiceover duration
      // The 3 in afade=t=out:st=${voiceoverDuration-3}:d=3 means fade out over the last 3 seconds
      const mixedAudioPath = path.join(tempDir, "mixed_audio.mp3");
      
      // First, mix the audio tracks
      const mixAudioCommand = `${process.env.FFMPEG_PATH || 'ffmpeg'} -y -i ${audioPath} -i ${musicPath} -filter_complex "[1:a]volume=0.2,afade=t=out:st=${Math.max(0, voiceoverDuration-3)}:d=3[music];[0:a][music]amix=inputs=2:duration=longest" -c:a libmp3lame ${mixedAudioPath}`;
      
      console.log("Executing audio mix command:", mixAudioCommand);
      await execPromise(mixAudioCommand);
      
      // Then create the video with the mixed audio
      ffmpegCommand = `${process.env.FFMPEG_PATH || 'ffmpeg'} -y -f concat -safe 0 -i ${inputListPath} -i ${mixedAudioPath} -c:v libx264 -vf "scale=1920:1080:force_original_aspect_ratio=1,setsar=1:1,zoompan=z='min(zoom+0.0015,1.05)':d=100:s=1920x1080" -pix_fmt yuv420p -preset fast -r 24 -c:a aac -b:a 192k -shortest ${outputVideoPath}`;
    } else {
      // Standard command with just the voiceover
      ffmpegCommand = `${process.env.FFMPEG_PATH || 'ffmpeg'} -y -f concat -safe 0 -i ${inputListPath} -i ${audioPath} -c:v libx264 -vf "scale=1920:1080:force_original_aspect_ratio=1,setsar=1:1,zoompan=z='min(zoom+0.0015,1.05)':d=100:s=1920x1080" -pix_fmt yuv420p -preset fast -r 24 -c:a aac -b:a 192k -shortest ${outputVideoPath}`;
    }
    
    console.log("Executing FFmpeg command:", ffmpegCommand);
    
    // Execute FFmpeg command
    try {
      const result = await execPromise(ffmpegCommand);
      console.log("Video generation complete. Output info:", result.stdout);
      
      // Get video metadata to verify dimensions
      const probeCommand = `${process.env.FFMPEG_PATH?.replace('ffmpeg', 'ffprobe') || 'ffprobe'} -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 ${outputVideoPath}`;
      const { stdout } = await execPromise(probeCommand);
      console.log(`Generated video dimensions: ${stdout.trim()}`);
      
    } catch (error) {
      console.error("FFmpeg execution error:", error);
      throw error;
    }
    
    // Return the URL to the generated video
    return NextResponse.json({ 
      videoUrl: publicVideoPath,
      videoId: videoId
    }, { status: 200 });
    
  } catch (error) {
    console.error("Error generating video:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
} 