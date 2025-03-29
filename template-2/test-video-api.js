// Simple test script for video generation API

const testVideoGeneration = async () => {
  try {
    // Create a dummy base64 image (1x1 white pixel)
    const dummyImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';
    
    // Create a dummy base64 audio (empty wav - more compatible with ffmpeg)
    const dummyAudio = 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
    
    // Prepare request data
    const requestData = {
      images: [dummyImage, dummyImage], // Two dummy images
      audioBase64: dummyAudio,
      hasDynamicTiming: false
    };
    
    // Make the API call
    const response = await fetch('http://localhost:3001/api/video/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });
    
    const result = await response.json();
    
    console.log('API Response:', response.status);
    console.log('Response data:', result);
    
    if (response.ok) {
      console.log('Video generation successful!');
    } else {
      console.error('Video generation failed:', result.error);
      if (result.details) {
        console.error('Error details:', result.details);
      }
      if (result.command) {
        console.error('Command used:', result.command);
      }
    }
  } catch (error) {
    console.error('Error testing video generation API:', error);
  }
};

// Run the test
testVideoGeneration(); 