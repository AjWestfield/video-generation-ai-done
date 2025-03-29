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
    const { 
      images, 
      timedImages, 
      audioBase64, 
      backgroundMusic,
      duration = 5
    } = await request.json();
    
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
        console.log("Downloading background music from:", backgroundMusic);
        const musicResponse = await fetch(backgroundMusic);
        if (!musicResponse.ok) {
          throw new Error(`Failed to download music: ${musicResponse.statusText}`);
        }
        const musicBuffer = await musicResponse.arrayBuffer();
        musicPath = path.join(tempDir, "music.mp3");
        await fs.writeFile(musicPath, Buffer.from(musicBuffer));
        console.log("Background music saved to:", musicPath);
        
        // Verify the file exists and has content
        const musicStats = await fs.stat(musicPath);
        if (musicStats.size === 0) {
          console.error("Downloaded music file is empty");
          musicPath = null;
        }
      } catch (error) {
        console.error("Error downloading background music:", error);
        musicPath = null; // Explicitly set to null to ensure it's not used
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
    
    // First, analyze the audio duration to apply proper timing
    const analyzeVoiceoverCommand = `${process.env.FFMPEG_PATH?.replace('ffmpeg', 'ffprobe') || 'ffprobe'} -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${audioPath}`;
    const { stdout: voiceoverDurationStr } = await execPromise(analyzeVoiceoverCommand);
    const voiceoverDuration = parseFloat(voiceoverDurationStr.trim());

    console.log(`Voiceover duration: ${voiceoverDuration} seconds`);

    // Applying normalization to the voiceover using broadcast standards
    const normalizedVoiceoverPath = path.join(tempDir, "audio_normalized.mp3");
    const normalizeCommand = `${process.env.FFMPEG_PATH || 'ffmpeg'} -y -i ${audioPath} -filter_complex "loudnorm=i=-16:lra=11:tp=-1.5:print_format=summary" -c:a libmp3lame -q:a 3 ${normalizedVoiceoverPath}`;
    console.log("Normalizing voiceover audio to broadcast standard:", normalizeCommand);
    await execPromise(normalizeCommand);

    // Set final audio path to normalized voiceover
    let finalAudioPath = normalizedVoiceoverPath;
    
    // Mix with background music if provided
    if (musicPath) {
      console.log("Processing background music:", musicPath);
      // Check if the music file exists and is accessible
      try {
        await fs.access(musicPath);
      } catch (err) {
        console.error("Background music file does not exist or is not accessible");
        musicPath = null;
      }
      
      if (musicPath) {
        const finalMixedAudioPath = path.join(tempDir, "final_mixed_audio.mp3");
        
        // Normalize the music to broadcast standards (-24 LUFS, 8dB lower than voice)
        // Also add gentle fade in/out
        const normalizedMusicPath = path.join(tempDir, "music_normalized.mp3");
        const normalizeMusicCommand = `${process.env.FFMPEG_PATH || 'ffmpeg'} -y -i ${musicPath} -filter_complex "loudnorm=i=-24:lra=7:tp=-2.0:print_format=summary,afade=t=in:st=0:d=1.5" -c:a libmp3lame -q:a 3 ${normalizedMusicPath}`;
        
        console.log("Normalizing background music to broadcast standard:", normalizeMusicCommand);
        try {
          await execPromise(normalizeMusicCommand);
          
          // Verify the normalized music file exists
          try {
            await fs.access(normalizedMusicPath);
            console.log("Background music normalized successfully");
            
            // Mix voice and music with optimal broadcast weights
            // Using proper ducking to ensure voice clarity
            const mixFinalAudioCommand = `${process.env.FFMPEG_PATH || 'ffmpeg'} -y -i ${normalizedVoiceoverPath} -i ${normalizedMusicPath} -filter_complex "[1:a]afade=t=out:st=${Math.max(0, voiceoverDuration-3)}:d=3[music];[0:a][music]amix=inputs=2:duration=longest:weights=1 0.5" -c:a libmp3lame -q:a 0 ${finalMixedAudioPath}`;
            
            console.log("Executing final audio mix command with broadcast standards:", mixFinalAudioCommand);
            await execPromise(mixFinalAudioCommand);
            
            // Verify the mixed file exists
            try {
              await fs.access(finalMixedAudioPath);
              console.log("Background music successfully mixed with audio using broadcast standards");
              finalAudioPath = finalMixedAudioPath;
            } catch (err) {
              console.error("Failed to mix background music with audio, using audio without music:", err);
            }
          } catch (err) {
            console.error("Normalized music file does not exist after processing:", err);
          }
        } catch (error) {
          console.error("Failed to normalize the background music:", error);
        }
      }
    }
    
    // Log the final audio path being used
    console.log("Final audio path for video:", finalAudioPath);
    
    // Create the final video with the mixed audio
    const ffmpegCommand = `${process.env.FFMPEG_PATH || 'ffmpeg'} -y -f concat -safe 0 -i ${inputListPath} -i ${finalAudioPath} -c:v libx264 -vf "zoompan=z='min(zoom+0.0015,1.05)':d=100:s=1920x1080" -c:a aac -b:a 320k -shortest ${outputVideoPath}`;
    
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