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
      useAnimatedClips = false,
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
    await fs.writeFile(audioPath, new Uint8Array(audioBuffer.buffer, audioBuffer.byteOffset, audioBuffer.byteLength));
    
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
        const musicNodeBuffer = Buffer.from(musicBuffer); await fs.writeFile(musicPath, new Uint8Array(musicNodeBuffer.buffer, musicNodeBuffer.byteOffset, musicNodeBuffer.byteLength));
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
    
    // Save images or video clips
    const mediaPaths = [];
    let timestamps: number[] = [];
    let hasAnimatedClips = false;
    
    if (hasTimedImages) {
      // Sort timedImages by timestamp
      const sortedTimedImages = [...timedImages].sort((a, b) => a.timestamp - b.timestamp);
      
      console.log(`Processing ${sortedTimedImages.length} media items for video generation`);
      console.log(`Using animated clips: ${useAnimatedClips}`);
      
      for (let i = 0; i < sortedTimedImages.length; i++) {
        const item = sortedTimedImages[i];
        
        // Check if this item has a video URL and we should use animated clips
        if (useAnimatedClips && item.videoUrl) {
          try {
            console.log(`Downloading animated clip for scene ${i+1} from ${item.videoUrl}`);
            const videoResponse = await fetch(item.videoUrl);
            if (!videoResponse.ok) {
              throw new Error(`Failed to download clip: ${videoResponse.statusText}`);
            }
            
            const videoBuffer = await videoResponse.arrayBuffer();
            const videoPath = path.join(tempDir, `clip_${i.toString().padStart(3, '0')}.mp4`);
            const videoNodeBuffer = Buffer.from(videoBuffer);
            await fs.writeFile(videoPath, new Uint8Array(videoNodeBuffer.buffer, videoNodeBuffer.byteOffset, videoNodeBuffer.byteLength));
            
            mediaPaths.push({
              path: videoPath,
              type: 'video',
              duration: 4 // Default 4-second clip duration
            });
            hasAnimatedClips = true;
          } catch (error) {
            console.error(`Error downloading clip ${i+1}:`, error);
            // Fall back to using the static image
            const imgData = item.imageBase64.replace(/^data:image\/\w+;base64,/, "");
            const imgBuffer = Buffer.from(imgData, 'base64');
            const imgPath = path.join(tempDir, `image_${i.toString().padStart(3, '0')}.jpg`);
            await fs.writeFile(imgPath, new Uint8Array(imgBuffer.buffer, imgBuffer.byteOffset, imgBuffer.byteLength));
            
            mediaPaths.push({
              path: imgPath,
              type: 'image'
            });
          }
        } else {
          // Use static image
          const imgData = item.imageBase64.replace(/^data:image\/\w+;base64,/, "");
          const imgBuffer = Buffer.from(imgData, 'base64');
          const imgPath = path.join(tempDir, `image_${i.toString().padStart(3, '0')}.jpg`);
          await fs.writeFile(imgPath, new Uint8Array(imgBuffer.buffer, imgBuffer.byteOffset, imgBuffer.byteLength));
          
          mediaPaths.push({
            path: imgPath,
            type: 'image'
          });
        }
        
        timestamps.push(item.timestamp);
      }
    } else {
      // Fallback to evenly spaced regular images
      for (let i = 0; i < images.length; i++) {
        const imgData = images[i].replace(/^data:image\/\w+;base64,/, "");
        const imgBuffer = Buffer.from(imgData, 'base64');
        const imgPath = path.join(tempDir, `image_${i.toString().padStart(3, '0')}.jpg`);
        await fs.writeFile(imgPath, new Uint8Array(imgBuffer.buffer, imgBuffer.byteOffset, imgBuffer.byteLength));
        
        mediaPaths.push({
          path: imgPath,
          type: 'image'
        });
        
        // Calculate estimated timestamp for this image
        const estimatedTimestamp = (i * duration) / images.length;
        timestamps.push(estimatedTimestamp);
      }
    }
    
    // Create FFmpeg input file for images/videos with precise durations
    const inputListPath = path.join(tempDir, "input.txt");
    let inputListContent = "";
    
    // If we're using animated clips, we need a different approach for the FFmpeg command
    if (hasAnimatedClips) {
      console.log("Using animated clips in the final video");
      
      // Create complex filter for concatenating clips with images
      let filterComplex = "";
      let inputParts = [];
      
      for (let i = 0; i < mediaPaths.length; i++) {
        const mediaItem = mediaPaths[i];
        const currentTime = timestamps[i];
        const nextTime = i < mediaPaths.length - 1 ? timestamps[i + 1] : duration;
        
        if (mediaItem.type === 'video') {
          // For video clips, use clip as is
          inputParts.push(`file '${mediaItem.path}'`);
        } else {
          // For static images, calculate duration
          const imageDuration = Math.max(nextTime - currentTime, 0.5); // Minimum 0.5 seconds
          inputParts.push(`file '${mediaItem.path}'`);
          inputParts.push(`duration ${imageDuration}`);
        }
      }
      
      // Add the last image again if it's an image (required by FFmpeg)
      if (mediaPaths.length > 0 && mediaPaths[mediaPaths.length - 1].type === 'image') {
        inputParts.push(`file '${mediaPaths[mediaPaths.length - 1].path}'`);
      }
      
      inputListContent = inputParts.join('\n');
    } else {
      // Calculate durations between timestamps for static images
      for (let i = 0; i < mediaPaths.length; i++) {
        const currentTime = timestamps[i];
        const nextTime = i < mediaPaths.length - 1 ? timestamps[i + 1] : duration;
        const imageDuration = Math.max(nextTime - currentTime, 0.5); // Minimum 0.5 seconds per image
        
        inputListContent += `file '${mediaPaths[i].path}'\nduration ${imageDuration}\n`;
      }
      
      // Add the last image again (required by FFmpeg)
      if (mediaPaths.length > 0) {
        inputListContent += `file '${mediaPaths[mediaPaths.length - 1].path}'\n`;
      }
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
    const ffmpegCommand = `${process.env.FFMPEG_PATH || 'ffmpeg'} -y -f concat -safe 0 -i ${inputListPath} -i ${finalAudioPath} -c:v libx264 -vf "scale=1920:1080" -c:a aac -b:a 320k -shortest ${outputVideoPath}`;
    
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
