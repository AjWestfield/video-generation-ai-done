# AI Video Creator

This is a web application that generates videos from ideas using AI. It leverages multiple AI services to create engaging videos with minimal user input.

## Features

- Input a simple video idea or concept
- Generate a professional script using OpenRouter's Gemini AI
- Choose between standard script or storytelling mode with various narrative structures
- Create high-quality voice overs with ElevenLabs
- Generate stunning visuals with Replicate's Flux Pro model
- Animate static images into dynamic 4-second video clips using Replicate's Kling model
- Create background music to match the mood
- Professional audio mixing with broadcast-standard levels
- Combine everything into a video using FFmpeg - with optional animated clips

## Recent Updates

- **Added Image Animation**: Integrated the Kling model to animate static images into dynamic 4-second video clips
- **Improved Video Creation**: Enhanced video generation to use animated clips instead of static images
- **Added Video Modal View**: Implemented a focus view to play animated clips with their motion prompts
- **Storyboard Toggle**: Added ability to switch between static images and animated clips in the storyboard
- **Added Negative Prompt Support**: Improved image generation by adding support for negative prompts throughout the application
- **Fixed TypeScript Errors**: Resolved type issues across multiple components for better code reliability
- **Added VS Code Settings**: Created settings to fix Tailwind CSS linting issues
- **Updated Voice Selection**: Replaced Amelia voice with Yomi for better voice clarity and natural cadence
- **Upgraded to Flux 1.1 Pro**: Successfully changed image model to black-forest-labs/flux-1.1-pro for higher quality image generation
- **Added Storytelling Mode**: New narrative generation with five different story structures (Three-Act, Hero's Journey, Problem-Solution, Inverted Pyramid, Circular Narrative)
- **Enhanced Image Regeneration**: Added ability to regenerate individual images from focus view modal
- **Fixed Music Generation Workflow**: Improved music generation component to properly use voiceover audio duration
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
  - OpenRouter (Google Gemini 2.0 Flash) for script generation and motion prompts
  - ElevenLabs for text-to-speech
  - Replicate (Flux 1.1 Pro model) for image generation
  - Replicate (Kling v1.6 Standard model) for image animation
  - Replicate (MusicGen) for background music generation
- **Video Processing**: FFmpeg for combining images/videos and audio into final videos
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
REPLICATE_IMAGE_MODEL_ID=black-forest-labs/flux-1.1-pro:b744535cf2bf3c4cf2130d0cc75cd4795b280215f8275b041015fb4f9917cbcd
REPLICATE_ANIMATION_MODEL_ID=kwaivgi/kling-v1.6-standard:7e324e5fcb9479696f15ab6da262390cddf5a1efa2e11374ef9d1f85fc0f82da

# FFmpeg Configuration (if not in standard path)
FFMPEG_PATH=/path/to/ffmpeg
```
4. Make sure FFmpeg is installed on your system
5. Run the development server with `npm run dev`
6. Visit `http://localhost:3000` in your browser

## How It Works

1. Users enter a video idea or concept and can toggle storytelling mode for narrative-focused scripts
2. The application uses Google Gemini to generate a script and image prompts
   - In storytelling mode, it creates structured narratives with clear beginning, middle, and end
3. ElevenLabs converts the script to a natural-sounding voiceover
4. Replicate's Flux 1.1 Pro model creates photorealistic images based on the generated prompts
5. (Optional) Animate the static images into dynamic video clips using Replicate's Kling model
6. Replicate's MusicGen creates background music that matches the mood
7. Professional audio processing applies broadcast-standard normalization to voice and music
8. FFmpeg combines the static images or animated clips with mixed audio into a complete video
9. Users can download or share the final video

## Animation Feature

The application now supports animating static images into dynamic 4-second video clips:

- Uses Replicate's Kling v1.6 Standard model
- Motion prompts are intelligently generated using Google Gemini based on the original image context
- Batch processing with proper rate-limiting to handle large storyboards
- Animated clips can be viewed in a modal with motion prompt details
- Final video can use either static images or animated clips
- Toggle between showing static images or animations in the storyboard view

## Narrative Structures

The application supports five different story structures in storytelling mode:

- **Three-Act Structure**: Classic beginning, middle, and end structure
- **Hero's Journey**: Character transformation and growth journey
- **Problem-Solution**: Presents challenge then builds to solution
- **Inverted Pyramid**: Most important info first, details follow
- **Circular Narrative**: Begins and ends at the same place with new insight

## Image Generation

The application uses Replicate's black-forest-labs/flux-1.1-pro model with optimized parameters:
- Native 16:9 aspect ratio for cinematic visuals
- High-quality PNG output format
- Prompt upsampling for improved results
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
- `/src/app/api/animate` - API routes for image animation
- `/src/components` - React components for each step of the video creation process
- `/public/videos` - Storage for generated videos
- `/public/temp` - Temporary storage for processing files

## License

This project is licensed under the MIT License.

## Credits

This project uses:
- OpenRouter API for accessing Google Gemini
- ElevenLabs for text-to-speech
- Replicate for image, animation, and music generation
- FFmpeg for video processing and audio mixing