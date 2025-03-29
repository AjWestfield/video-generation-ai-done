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
      soundEffects, 
      duration = 5,
      // Add volume control parameters with defaults
      voiceVolume = 1.0,       // Default: 100% original volume
      soundEffectVolume = 0.7, // Default: 70% volume
      musicVolume = 0.2        // Default: 20% volume
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

    // Validate volume parameters
    if (voiceVolume < 0 || soundEffectVolume < 0 || musicVolume < 0) {
      return NextResponse.json(
        { error: "Volume values cannot be negative" },
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
    
    // Download and save sound effects if provided
    let soundEffectPaths: {path: string, timestamp: number}[] = [];
    if (soundEffects && Array.isArray(soundEffects) && soundEffects.length > 0) {
      try {
        for (let i = 0; i < soundEffects.length; i++) {
          const effect = soundEffects[i];
          if (effect.url) {
            // Download the sound effect file
            const effectResponse = await fetch(effect.url);
            if (!effectResponse.ok) {
              console.error(`Failed to download sound effect ${i}: ${effectResponse.statusText}`);
              continue;
            }
            
            const effectBuffer = await effectResponse.arrayBuffer();
            const effectPath = path.join(tempDir, `effect_${i.toString().padStart(3, '0')}.wav`);
            await fs.writeFile(effectPath, Buffer.from(effectBuffer));
            
            soundEffectPaths.push({
              path: effectPath,
              timestamp: effect.timestamp || 0
            });
            
            console.log(`Sound effect ${i} saved to: ${effectPath} (timestamp: ${effect.timestamp}s)`);
          }
        }
      } catch (error) {
        console.error("Error downloading sound effects:", error);
        // Continue without sound effects if there's an error
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

    // First normalize the voiceover audio for consistent volume throughout
    const normalizedVoiceoverPath = path.join(tempDir, "audio_normalized.mp3");
    const normalizeCommand = `${process.env.FFMPEG_PATH || 'ffmpeg'} -y -i ${audioPath} -filter:a "loudnorm=I=-16:TP=-1.5:LRA=11" -c:a libmp3lame ${normalizedVoiceoverPath}`;
    console.log("Normalizing voiceover audio:", normalizeCommand);
    await execPromise(normalizeCommand);

    // Then adjust volume if needed
    const voiceoverProcessedPath = path.join(tempDir, "audio_processed.mp3");
    if (voiceVolume !== 1.0) {
      const adjustVoiceCommand = `${process.env.FFMPEG_PATH || 'ffmpeg'} -y -i ${normalizedVoiceoverPath} -filter:a "volume=${voiceVolume}" -c:a libmp3lame ${voiceoverProcessedPath}`;
      console.log("Adjusting voiceover volume:", adjustVoiceCommand);
      await execPromise(adjustVoiceCommand);
    } else {
      // Just copy the file if no adjustment needed
      const copyVoiceCommand = `${process.env.FFMPEG_PATH || 'ffmpeg'} -y -i ${normalizedVoiceoverPath} -c copy ${voiceoverProcessedPath}`;
      await execPromise(copyVoiceCommand);
    }

    // Mix sound effects with voiceover if any sound effects exist
    let finalAudioPath = voiceoverProcessedPath;
    if (soundEffectPaths.length > 0) {
      const mixedWithEffectsPath = path.join(tempDir, "audio_with_effects.mp3");
      
      // First, normalize each sound effect for consistent volume
      for (let i = 0; i < soundEffectPaths.length; i++) {
        const normalizedEffectPath = path.join(tempDir, `effect_${i.toString().padStart(3, '0')}_normalized.wav`);
        const normalizeEffectCommand = `${process.env.FFMPEG_PATH || 'ffmpeg'} -y -i ${soundEffectPaths[i].path} -filter:a "loudnorm=I=-18:TP=-1.5:LRA=11" ${normalizedEffectPath}`;
        await execPromise(normalizeEffectCommand);
        soundEffectPaths[i].path = normalizedEffectPath;
      }
      
      // Create a complex filter for mixing sound effects at specific timestamps
      let filterParts: string[] = [];
      
      // Add each sound effect as an input and create delay+volume filter
      soundEffectPaths.forEach((effect, index) => {
        // Apply a delay to align with timestamp, and reduce volume appropriately
        filterParts.push(`[${index + 1}:a]adelay=${Math.round(effect.timestamp * 1000)}|${Math.round(effect.timestamp * 1000)},volume=${soundEffectVolume}[e${index}]`);
      });
      
      // Build the input list
      let inputs = [voiceoverProcessedPath];
      soundEffectPaths.forEach(effect => {
        inputs.push(effect.path);
      });
      
      // Build the mix part - start with main track
      let mixInputs = ['[0:a]'];
      
      // Add each sound effect to mix
      soundEffectPaths.forEach((_, index) => {
        mixInputs.push(`[e${index}]`);
      });
      
      // Add the final mix command with ducking for voice priority
      filterParts.push(`${mixInputs.join('')}amix=inputs=${soundEffectPaths.length + 1}:duration=longest:dropout_transition=2[out]`);
      
      // Combine all filter parts
      const filterComplex = filterParts.join(';');
      
      // Build the FFmpeg command - using array to avoid quote issues
      const ffmpegArgs = [
        '-y',
      ];
      
      // Add inputs
      inputs.forEach(input => {
        ffmpegArgs.push('-i', input);
      });
      
      // Add filter complex and output options
      ffmpegArgs.push(
        '-filter_complex', filterComplex,
        '-map', '[out]',
        '-c:a', 'libmp3lame',
        mixedWithEffectsPath
      );
      
      // Convert args to command line string, escaping properly
      const ffmpegCmd = (process.env.FFMPEG_PATH || 'ffmpeg') + ' ' + 
        ffmpegArgs.map(arg => {
          // If arg contains spaces or special chars, quote it
          if (arg.includes(' ') || arg.includes(';') || arg.includes('[') || arg.includes(']')) {
            return `"${arg.replace(/"/g, '\\"')}"`;
          }
          return arg;
        }).join(' ');
      
      console.log("Executing audio mix command with sound effects:", ffmpegCmd);
      await execPromise(ffmpegCmd);
      
      finalAudioPath = mixedWithEffectsPath;
    }
    
    // Mix with background music if provided
    if (musicPath) {
      const finalMixedAudioPath = path.join(tempDir, "final_mixed_audio.mp3");
      
      // Normalize the music first
      const normalizedMusicPath = path.join(tempDir, "music_normalized.mp3");
      const normalizeMusicCommand = `${process.env.FFMPEG_PATH || 'ffmpeg'} -y -i ${musicPath} -filter:a "loudnorm=I=-18:TP=-1.5:LRA=11" -c:a libmp3lame ${normalizedMusicPath}`;
      await execPromise(normalizeMusicCommand);
      
      // Using the amix filter with weights to prioritize speech while still having background music
      // Using a weight of 3:1 to ensure speech is 3x more prominent than music
      const mixFinalAudioCommand = `${process.env.FFMPEG_PATH || 'ffmpeg'} -y -i ${finalAudioPath} -i ${normalizedMusicPath} -filter_complex "[1:a]volume=${musicVolume},afade=t=out:st=${Math.max(0, voiceoverDuration-3)}:d=3[music];[0:a][music]amix=inputs=2:duration=longest:weights=3 1" -c:a libmp3lame ${finalMixedAudioPath}`;
      
      console.log("Executing final audio mix command:", mixFinalAudioCommand);
      await execPromise(mixFinalAudioCommand);
      
      finalAudioPath = finalMixedAudioPath;
    }
    
    // Create the final video with the mixed audio
    const ffmpegCommand = `${process.env.FFMPEG_PATH || 'ffmpeg'} -y -f concat -safe 0 -i ${inputListPath} -i ${finalAudioPath} -c:v libx264 -vf "scale=1920:1080:force_original_aspect_ratio=1,setsar=1:1,zoompan=z='min(zoom+0.0015,1.05)':d=100:s=1920x1080" -pix_fmt yuv420p -preset fast -r 24 -c:a aac -b:a 192k -shortest ${outputVideoPath}`;
    
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