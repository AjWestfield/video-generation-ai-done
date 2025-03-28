// Output video path
const outputVideoPath = path.join(outputDir, `${videoId}.mp4`);
const publicVideoPath = `/videos/${videoId}.mp4`;

// FFmpeg command to create video from images and audio with proper aspect ratio handling
const ffmpegCommand = `${process.env.FFMPEG_PATH || 'ffmpeg'} -y -f concat -safe 0 -i ${inputListPath} -i ${audioPath} -c:v libx264 -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1:1" -pix_fmt yuv420p -preset fast -r 24 -c:a aac -b:a 192k -shortest ${outputVideoPath}`;

console.log("Executing FFmpeg command:", ffmpegCommand);

// Execute FFmpeg command
await execPromise(ffmpegCommand);

// Return the URL to the generated video
return NextResponse.json({ 
  videoUrl: publicVideoPath,
  videoId: videoId
}, { status: 200 }); 