const { exec } = require('child_process');
const { promises: fs } = require('fs');
const path = require('path');

// Test basic FFmpeg functionality
async function testFFmpeg() {
  console.log('Testing FFmpeg installation...');
  
  try {
    const { stdout } = await execPromise('ffmpeg -version');
    console.log('FFmpeg is installed:');
    console.log(stdout.split('\n')[0]);
    return true;
  } catch (err) {
    console.error('FFmpeg is not properly installed or not in PATH');
    console.error(err);
    return false;
  }
}

// Create a basic image to video test
async function testImageToVideo() {
  console.log('\nTesting basic image to video conversion...');
  
  const testDir = path.join(__dirname, 'test-ffmpeg');
  await ensureDir(testDir);
  
  try {
    // Create test image (a simple colored square)
    console.log('Creating test image...');
    const testImagePath = path.join(testDir, 'test-image.png');
    await execPromise(`ffmpeg -f lavfi -i color=c=blue:s=640x480:d=1 -vframes 1 "${testImagePath}"`);
    
    // Create simple video from the image
    console.log('Creating video from image...');
    const testVideoPath = path.join(testDir, 'test-video.mp4');
    const result = await execPromise(
      `ffmpeg -loop 1 -i "${testImagePath}" -t 5 -c:v libx264 -pix_fmt yuv420p "${testVideoPath}"`
    );
    
    console.log('Successfully created test video');
    return true;
  } catch (err) {
    console.error('Failed to create test video:');
    console.error(err);
    return false;
  }
}

// Test concat demuxer functionality
async function testConcatDemuxer() {
  console.log('\nTesting concat demuxer functionality...');
  
  const testDir = path.join(__dirname, 'test-ffmpeg');
  await ensureDir(testDir);
  
  try {
    // Create multiple test images with different colors
    console.log('Creating test images...');
    const colors = ['blue', 'red', 'green', 'yellow'];
    const testImagePaths = [];
    
    for (let i = 0; i < colors.length; i++) {
      const imgPath = path.join(testDir, `test-image-${i}.png`);
      await execPromise(`ffmpeg -f lavfi -i color=c=${colors[i]}:s=640x480:d=1 -vframes 1 "${imgPath}"`);
      testImagePaths.push(imgPath);
    }
    
    // Create filelist.txt for concat demuxer
    const filelistPath = path.join(testDir, 'filelist.txt');
    let filelistContent = '';
    
    testImagePaths.forEach(imgPath => {
      filelistContent += `file '${imgPath}'\n`;
      filelistContent += `duration 1\n`;
    });
    // Add the last image again without duration
    filelistContent += `file '${testImagePaths[testImagePaths.length - 1]}'`;
    
    await fs.writeFile(filelistPath, filelistContent);
    
    // Create video using concat demuxer
    console.log('Creating video using concat demuxer...');
    const concatVideoPath = path.join(testDir, 'concat-video.mp4');
    await execPromise(
      `ffmpeg -f concat -safe 0 -i "${filelistPath}" -c:v libx264 -pix_fmt yuv420p "${concatVideoPath}"`
    );
    
    console.log('Successfully created concat demuxer video');
    return true;
  } catch (err) {
    console.error('Failed to create concat demuxer video:');
    console.error(err);
    return false;
  }
}

// Test full video generation with audio
async function testVideoWithAudio() {
  console.log('\nTesting video generation with audio...');
  
  const testDir = path.join(__dirname, 'test-ffmpeg');
  await ensureDir(testDir);
  
  try {
    // Create test audio using a tone generator
    console.log('Creating test audio...');
    const testAudioPath = path.join(testDir, 'test-audio.mp3');
    await execPromise(
      `ffmpeg -f lavfi -i "sine=frequency=440:duration=5" -c:a mp3 "${testAudioPath}"`
    );
    
    // Create test image
    console.log('Creating test image...');
    const testImagePath = path.join(testDir, 'test-image-audio.png');
    await execPromise(`ffmpeg -f lavfi -i color=c=purple:s=640x480:d=1 -vframes 1 "${testImagePath}"`);
    
    // Create video with audio
    console.log('Creating video with audio...');
    const videoWithAudioPath = path.join(testDir, 'video-with-audio.mp4');
    await execPromise(
      `ffmpeg -loop 1 -i "${testImagePath}" -i "${testAudioPath}" -c:v libx264 -c:a aac -b:a 192k -pix_fmt yuv420p -shortest "${videoWithAudioPath}"`
    );
    
    console.log('Successfully created video with audio');
    return true;
  } catch (err) {
    console.error('Failed to create video with audio:');
    console.error(err);
    return false;
  }
}

// Helper functions
async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw err;
    }
  }
}

function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stderr });
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

// Run all tests
async function runAllTests() {
  console.log('Starting FFmpeg tests...');
  
  const ffmpegInstalled = await testFFmpeg();
  if (!ffmpegInstalled) {
    console.error('Cannot proceed with tests. FFmpeg is not properly installed.');
    return;
  }
  
  const tests = [
    { name: 'Image to Video', test: testImageToVideo },
    { name: 'Concat Demuxer', test: testConcatDemuxer },
    { name: 'Video with Audio', test: testVideoWithAudio },
  ];
  
  const results = [];
  
  for (const { name, test } of tests) {
    try {
      const success = await test();
      results.push({ name, success });
    } catch (err) {
      results.push({ name, success: false, error: err });
    }
  }
  
  console.log('\n--- TEST RESULTS ---');
  results.forEach(result => {
    console.log(`${result.name}: ${result.success ? '✅ PASS' : '❌ FAIL'}`);
    if (!result.success && result.error) {
      console.error(`  Error: ${result.error.message || JSON.stringify(result.error)}`);
    }
  });
  
  const allPassed = results.every(r => r.success);
  console.log(`\nOverall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
}

// Run the tests
runAllTests(); 