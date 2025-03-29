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
      soundEffectVolume = 1.0, // Default: 100% volume (increased from 0.7)
      musicVolume = 0.5        // Default: 50% volume (increased from 0.2)
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
    
    // Download and save sound effects if provided
    let soundEffectPaths: {path: string, timestamp: number}[] = [];
    if (soundEffects && Array.isArray(soundEffects) && soundEffects.length > 0) {
      console.log(`Processing ${soundEffects.length} sound effects`);
      try {
        for (let i = 0; i < soundEffects.length; i++) {
          const effect = soundEffects[i];
          if (effect.url) {
            console.log(`Downloading sound effect ${i} from:`, effect.url);
            // Download the sound effect file
            const effectResponse = await fetch(effect.url);
            if (!effectResponse.ok) {
              console.error(`Failed to download sound effect ${i}: ${effectResponse.statusText}`);
              continue;
            }
            
            const effectBuffer = await effectResponse.arrayBuffer();
            const effectPath = path.join(tempDir, `effect_${i.toString().padStart(3, '0')}.wav`);
            await fs.writeFile(effectPath, Buffer.from(effectBuffer));
            
            // Verify the file exists and has content
            const effectStats = await fs.stat(effectPath);
            if (effectStats.size === 0) {
              console.error(`Downloaded sound effect ${i} file is empty`);
              continue;
            }
            
            soundEffectPaths.push({
              path: effectPath,
              timestamp: effect.timestamp || 0
            });
            
            console.log(`Sound effect ${i} saved to: ${effectPath} (timestamp: ${effect.timestamp}s)`);
          }
        }
      } catch (error) {
        console.error("Error downloading sound effects:", error);
        // Continue with any successfully downloaded sound effects
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

    // Applying more aggressive normalization with dynamic range compression to the voiceover
    // This ensures consistent volume levels throughout the entire voiceover
    const normalizedVoiceoverPath = path.join(tempDir, "audio_normalized.mp3");
    const normalizeCommand = `${process.env.FFMPEG_PATH || 'ffmpeg'} -y -i ${audioPath} -filter_complex "loudnorm=I=-16:TP=-1.5:LRA=7:print_format=summary,dynaudnorm=f=150:g=15:p=0.55:m=5" -c:a libmp3lame -q:a 3 ${normalizedVoiceoverPath}`;
    console.log("Normalizing voiceover audio with improved consistency:", normalizeCommand);
    await execPromise(normalizeCommand);

    // Then adjust volume to a more moderate level
    // Adjusted voice volume to be more consistent
    const voiceoverProcessedPath = path.join(tempDir, "audio_processed.mp3");
    const defaultVoiceVolume = 0.85; // Slightly reduced default volume
    const effectiveVoiceVolume = voiceVolume * defaultVoiceVolume;
    
    const adjustVoiceCommand = `${process.env.FFMPEG_PATH || 'ffmpeg'} -y -i ${normalizedVoiceoverPath} -filter:a "volume=${effectiveVoiceVolume}" -c:a libmp3lame -q:a 3 ${voiceoverProcessedPath}`;
    console.log("Adjusting voiceover volume:", adjustVoiceCommand);
    await execPromise(adjustVoiceCommand);

    // Mix sound effects with voiceover if any sound effects exist
    let finalAudioPath = voiceoverProcessedPath;
    console.log(`Number of sound effects to process: ${soundEffectPaths.length}`);
    if (soundEffectPaths.length > 0) {
      const mixedWithEffectsPath = path.join(tempDir, "audio_with_effects.mp3");
      
      // First, normalize and add fade in/out to each sound effect for smoother transitions
      for (let i = 0; i < soundEffectPaths.length; i++) {
        try {
          console.log(`Processing sound effect ${i}: ${soundEffectPaths[i].path}`);
          // Check if the sound effect file exists before processing
          try {
            await fs.access(soundEffectPaths[i].path);
          } catch (err) {
            console.error(`Sound effect file ${i} does not exist or is not accessible`);
            soundEffectPaths[i].path = '';
            continue;
          }
          
          const normalizedEffectPath = path.join(tempDir, `effect_${i.toString().padStart(3, '0')}_normalized.wav`);
          // Apply both normalization and a fade in/out effect to make transitions smoother
          const normalizeEffectCommand = `${process.env.FFMPEG_PATH || 'ffmpeg'} -y -i ${soundEffectPaths[i].path} -filter:a "loudnorm=I=-22:TP=-1.5:LRA=7,afade=t=in:st=0:d=0.5,afade=t=out:d=0.7" ${normalizedEffectPath}`;
          
          console.log(`Normalizing sound effect ${i} with command:`, normalizeEffectCommand);
          await execPromise(normalizeEffectCommand);
          
          // Verify the normalized file exists
          try {
            await fs.access(normalizedEffectPath);
            soundEffectPaths[i].path = normalizedEffectPath;
            console.log(`Sound effect ${i} normalized successfully`);
          } catch (err) {
            throw new Error(`Normalized sound effect file ${i} does not exist after processing`);
          }
        } catch (error) {
          console.warn(`Warning: Failed to process sound effect ${i}:`, error);
          
          // If normalization fails, try a simpler approach with just volume adjustment
          try {
            const simpleNormalizedPath = path.join(tempDir, `effect_${i.toString().padStart(3, '0')}_simple.wav`);
            const simpleCommand = `${process.env.FFMPEG_PATH || 'ffmpeg'} -y -i ${soundEffectPaths[i].path} -filter:a "volume=0.5" ${simpleNormalizedPath}`;
            
            console.log(`Trying simpler normalization for sound effect ${i}`);
            await execPromise(simpleCommand);
            
            // Verify the simple normalized file exists
            try {
              await fs.access(simpleNormalizedPath);
              soundEffectPaths[i].path = simpleNormalizedPath;
              console.log(`Sound effect ${i} normalized with simple approach`);
            } catch (err) {
              throw new Error(`Simple normalized sound effect file ${i} does not exist after processing`);
            }
          } catch (fallbackError) {
            console.error(`Error processing sound effect ${i}, removing it from mix:`, fallbackError);
            // Set this item to be filtered out
            soundEffectPaths[i].path = '';
          }
        }
      }
      
      // Filter out any failed sound effects
      const originalCount = soundEffectPaths.length;
      soundEffectPaths = soundEffectPaths.filter(effect => effect.path !== '');
      console.log(`Using ${soundEffectPaths.length} sound effects after filtering (${originalCount - soundEffectPaths.length} removed)`);
      
      if (soundEffectPaths.length > 0) {
        // Create a complex filter for mixing sound effects at specific timestamps
        let filterParts: string[] = [];
        
        // Add each sound effect as an input and create delay+volume filter
        // Use a higher base volume for sound effects to make them clearly audible
        const defaultSoundEffectVolume = 1.5; // Increased from 1.2 to 1.5 to make sound effects more prominent
        const effectiveEffectVolume = soundEffectVolume * defaultSoundEffectVolume;
        
        soundEffectPaths.forEach((effect, index) => {
          // Apply a delay to align with timestamp, apply higher volume, and proper crossfade
          filterParts.push(`[${index + 1}:a]adelay=${Math.round(effect.timestamp * 1000)}|${Math.round(effect.timestamp * 1000)},volume=${effectiveEffectVolume}[e${index}]`);
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
        
        // Add the final mix command with better balancing that preserves sound effect volume
        // Use volume adjustments before amix to ensure sound effects are clearly audible
        // Boost voiceover track to maintain speech clarity
        filterParts.push(`[0:a]volume=1.0[boosted_voice];[boosted_voice]${mixInputs.slice(1).join('')}amix=inputs=${soundEffectPaths.length + 1}:duration=longest:dropout_transition=3:normalize=0[out]`);
        
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
          '-q:a', '3', // Better quality audio
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
        
        // Verify the mixed file exists
        try {
          await fs.access(mixedWithEffectsPath);
          console.log("Sound effects successfully mixed with voiceover");
          
          // Apply another normalization pass to ensure consistent levels after mixing
          const finalNormalizedPath = path.join(tempDir, "effects_mix_normalized.mp3");
          const normalizeEffectsMixCommand = `${process.env.FFMPEG_PATH || 'ffmpeg'} -y -i ${mixedWithEffectsPath} -filter:a "volume=1.2,dynaudnorm=f=150:g=15:p=0.55:m=5" -c:a libmp3lame -q:a 3 ${finalNormalizedPath}`;
          await execPromise(normalizeEffectsMixCommand);
          
          // Verify the normalized mixed file exists
          try {
            await fs.access(finalNormalizedPath);
            finalAudioPath = finalNormalizedPath;
            console.log("Voiceover with sound effects normalized");
          } catch (err) {
            console.error("Failed to normalize the mixed audio file, using non-normalized version");
            finalAudioPath = mixedWithEffectsPath;
          }
        } catch (err) {
          console.error("Failed to mix sound effects with voiceover, using voiceover only:", err);
          finalAudioPath = voiceoverProcessedPath;
        }
      }
    }
    
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
        
        // Normalize the music and add gentle fade in
        const normalizedMusicPath = path.join(tempDir, "music_normalized.mp3");
        const normalizeMusicCommand = `${process.env.FFMPEG_PATH || 'ffmpeg'} -y -i ${musicPath} -filter:a "loudnorm=I=-23:TP=-1.5:LRA=7,afade=t=in:st=0:d=1.5" -c:a libmp3lame -q:a 3 ${normalizedMusicPath}`;
        
        console.log("Normalizing background music with command:", normalizeMusicCommand);
        try {
          await execPromise(normalizeMusicCommand);
          
          // Verify the normalized music file exists
          try {
            await fs.access(normalizedMusicPath);
            console.log("Background music normalized successfully");
            
            // Use a higher default music volume
            const defaultMusicVolume = 0.8; // Increased from 0.4 to 0.8 for better audibility
            const effectiveMusicVolume = musicVolume * defaultMusicVolume;
            
            // Using a more balanced mixing approach that preserves sound effects
            // More balanced weights (3:2 ratio) to make music more audible
            const mixFinalAudioCommand = `${process.env.FFMPEG_PATH || 'ffmpeg'} -y -i ${finalAudioPath} -i ${normalizedMusicPath} -filter_complex "[1:a]volume=${effectiveMusicVolume},afade=t=out:st=${Math.max(0, voiceoverDuration-3)}:d=3[music];[0:a][music]amix=inputs=2:duration=longest:weights=3 2" -c:a libmp3lame -q:a 3 ${finalMixedAudioPath}`;
            
            console.log("Executing final audio mix command:", mixFinalAudioCommand);
            await execPromise(mixFinalAudioCommand);
            
            // Verify the mixed file exists
            try {
              await fs.access(finalMixedAudioPath);
              console.log("Background music successfully mixed with audio");
              
              // Final normalization pass to ensure all audio is consistent
              const finalConsistentPath = path.join(tempDir, "final_consistent_audio.mp3");
              const finalNormCommand = `${process.env.FFMPEG_PATH || 'ffmpeg'} -y -i ${finalMixedAudioPath} -filter:a "loudnorm=I=-14:TP=-1:LRA=11" -c:a libmp3lame -q:a 2 ${finalConsistentPath}`;
              
              await execPromise(finalNormCommand);
              
              // Verify the final normalized file exists
              try {
                await fs.access(finalConsistentPath);
                finalAudioPath = finalConsistentPath;
                console.log("Final audio with background music normalized");
              } catch (err) {
                console.error("Failed to normalize the final audio, using non-normalized version");
                finalAudioPath = finalMixedAudioPath;
              }
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