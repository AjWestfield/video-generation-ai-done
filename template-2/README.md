# AI Video Creator

This is a web application that generates videos from ideas using AI. It leverages multiple AI services to create engaging videos with minimal user input.

## Features

- Input a simple video idea or concept
- Generate a professional script using OpenRouter's Gemini AI
- Create high-quality voice overs with ElevenLabs
- Generate stunning visuals with Replicate's Flux model
- Add contextual sound effects with Tango AI sound generator
- Customize audio with volume controls for voice, sound effects, and music
- Create background music to match the mood
- Professional audio mixing with automatic ducking for clear speech
- Combine everything into a video using FFmpeg

## Tech Stack

- **Frontend**: Next.js 14, React, TailwindCSS
- **AI Services**:
  - OpenRouter (Google Gemini 2.0 Flash) for script generation and sound effect analysis
  - ElevenLabs for text-to-speech
  - Replicate (Flux model) for image generation
  - Replicate (Tango model) for sound effect generation
  - Replicate (MusicGen) for background music generation
- **Video Processing**: FFmpeg for combining images, audio, and sound effects into videos
- **Audio Processing**: Advanced audio mixing with volume controls and dynamic audio ducking

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
5. Google Gemini analyzes the script and images to identify opportunities for sound effects
6. Replicate's Tango model generates custom sound effects for key moments
7. Replicate's MusicGen creates background music that matches the mood
8. Advanced audio mixing combines voiceover, sound effects, and background music with optimal levels
9. FFmpeg combines the images and mixed audio into a complete video
10. Users can download or share the final video

## Audio Controls

The application now features advanced audio controls:

- **Voice Volume**: Adjust the prominence of the narration
- **Sound Effects Volume**: Control the intensity of sound effects 
- **Background Music Volume**: Set the appropriate level for background music
- **Audio Mixing Presets**: Choose from Voice Focus, Balanced, or Cinematic audio profiles

The audio engine automatically applies ducking to ensure speech clarity while maintaining an immersive soundtrack.

## Project Structure

- `/src/app/api` - API routes for AI services and video generation
- `/src/app/api/openrouter/generate-sound-effect-prompts` - AI analysis for contextual sound effects
- `/src/app/api/replicate/generate-sound-effect` - Sound effect generation service
- `/src/components` - React components for each step of the video creation process
- `/src/components/AudioVolumeControls.tsx` - UI controls for audio mixing
- `/src/components/SoundEffectGeneration.tsx` - Sound effect generation interface
- `/public/videos` - Storage for generated videos
- `/public/temp` - Temporary storage for processing files

## License

This project is licensed under the MIT License.

## Credits

This project uses:
- OpenRouter API for accessing Google Gemini
- ElevenLabs for text-to-speech
- Replicate for image, sound effect, and music generation
- FFmpeg for video processing and audio mixing