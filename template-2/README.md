# AI Video Creator

This is a web application that generates videos from ideas using AI. It leverages multiple AI services to create engaging videos with minimal user input.

## Features

- Input a simple video idea or concept
- Generate a professional script using OpenRouter's Gemini AI
- Create high-quality voice overs with ElevenLabs
- Generate stunning visuals with Replicate's Flux model
- Create background music to match the mood
- Professional audio mixing with broadcast-standard levels
- Combine everything into a video using FFmpeg

## Recent Updates

- **Removed Sound Effects Processing**: Simplified the audio pipeline by removing sound effects for better reliability
- **Optimized Audio Levels**: Implemented broadcast-standard audio levels (-16 LUFS for voice, -24 LUFS for music)
- **Streamlined Workflow**: Removed the sound effects step from the video creation process
- **Enhanced UI Design**: Modernized interface with futuristic aesthetics, improved responsiveness, and better user experience
- **Optimized Image Generation**: Updated Replicate Flux integration to use native 16:9 aspect ratio with high-quality PNG output
- **Improved Storyboard View**: Redesigned the storyboard with larger images and better grid layout across different screen sizes
- **Focus View Feature**: Added the ability to click on any generated image to see it in a larger view with its associated prompt
- **Compact Components**: Streamlined UI components to make better use of screen space

## Tech Stack

- **Frontend**: Next.js 14, React, TailwindCSS
- **AI Services**:
  - OpenRouter (Google Gemini 2.0 Flash) for script generation
  - ElevenLabs for text-to-speech
  - Replicate (Flux model) for image generation
  - Replicate (MusicGen) for background music generation
- **Video Processing**: FFmpeg for combining images and audio into videos
- **Audio Processing**: Professional broadcast-standard audio normalization and mixing

## Setup

1. Clone the repository
2. Install dependencies with `npm install`
3. Create a `.env.local` file with the following variables:
```
# Replicate API
REPLICATE_API_TOKEN=your_replicate_token

# OpenRouter API
OPENROUTER_API_KEY=your_openrouter_key

# Eleven Labs API
ELEVENLABS_API_KEY=your_elevenlabs_key

# Model IDs
OPENROUTER_MODEL_ID=google/gemini-2.0-flash-001
REPLICATE_IMAGE_MODEL_ID=black-forest-labs/flux-schnell

# FFmpeg Configuration (if not in standard path)
FFMPEG_PATH=/path/to/ffmpeg
```
4. Make sure FFmpeg is installed on your system
5. Run the development server with `npm run dev`
6. Visit `http://localhost:3000` in your browser

## How It Works

1. Users enter a video idea or concept
2. The application uses Google Gemini to generate a script and image prompts
3. ElevenLabs converts the script to a natural-sounding voiceover
4. Replicate's Flux model creates images based on the generated prompts
5. Replicate's MusicGen creates background music that matches the mood
6. Professional audio processing applies broadcast-standard normalization to voice and music
7. FFmpeg combines the images and mixed audio into a complete video
8. Users can download or share the final video

## Image Generation

The application uses Replicate's black-forest-labs/flux-schnell model with optimized parameters:
- Native 16:9 aspect ratio for cinematic visuals
- High-quality PNG output format
- Quantized fast inference for quick generation
- Customized negative prompts to prevent unwanted elements

## Audio Processing

The application now uses professional broadcast-standard audio processing:

- **Voice normalization**: -16 LUFS (Loudness Units Full Scale) - the professional standard for spoken content
- **Music normalization**: -24 LUFS - exactly 8dB lower than voice (optimal for background music)
- **Professional mixing**: Proper mixing weights (1:0.5) for voice and music
- **Auto fade-out**: Gentle music fade-out at the end of voiceover

These settings follow audio engineering best practices to ensure clear voice narration with pleasant background music.

## Project Structure

- `/src/app/api` - API routes for AI services and video generation
- `/src/components` - React components for each step of the video creation process
- `/public/videos` - Storage for generated videos
- `/public/temp` - Temporary storage for processing files

## License

This project is licensed under the MIT License.

## Credits

This project uses:
- OpenRouter API for accessing Google Gemini
- ElevenLabs for text-to-speech
- Replicate for image and music generation
- FFmpeg for video processing and audio mixing