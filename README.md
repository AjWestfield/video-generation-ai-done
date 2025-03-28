# AI Video Creator

This is a web application that generates videos from ideas using AI. It leverages multiple AI services to create engaging videos with minimal user input.

## Features

- Input a simple video idea or concept
- Generate a professional script using OpenRouter's Gemini AI
- Create high-quality voice overs with ElevenLabs
- Generate stunning visuals with Replicate's Flux model
- Combine everything into a video using FFmpeg

## Tech Stack

- **Frontend**: Next.js 14, React, TailwindCSS
- **AI Services**:
  - OpenRouter (Google Gemini 2.0 Flash) for script generation
  - ElevenLabs for text-to-speech
  - Replicate (Flux model) for image generation
- **Video Processing**: FFmpeg for combining images and audio into videos

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
5. FFmpeg combines the images and audio into a complete video
6. Users can download or share the final video

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
- Replicate for image generation
- FFmpeg for video processing