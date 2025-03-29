"use client";

import { useState } from "react";
import VideoIdeaForm from "../components/VideoIdeaForm";
import ScriptGeneration from "../components/ScriptGeneration";
import VoiceoverGeneration from "../components/VoiceoverGeneration";
import ImagePromptGeneration from "../components/ImagePromptGeneration";
import ImageGeneration from "../components/ImageGeneration";
import TimedImageGeneration from "../components/TimedImageGeneration";
import MusicGeneration from "../components/MusicGeneration";
import SoundEffectGeneration from "../components/SoundEffectGeneration";
import VideoGeneration from "../components/VideoGeneration";
import VideoPreview from "../components/VideoPreview";
import ProgressStepper from "../components/ProgressStepper";
import { Toaster } from "react-hot-toast";
import { SoundEffect } from "@/services/soundEffectService";

export default function Home() {
  // Define the workflow states
  const [currentStep, setCurrentStep] = useState(0);
  const [videoIdea, setVideoIdea] = useState("");
  const [videoDuration, setVideoDuration] = useState(1); // Default 1 minute
  const [scriptData, setScriptData] = useState<any>(null);
  const [voiceoverData, setVoiceoverData] = useState<any>(null);
  const [imagePrompts, setImagePrompts] = useState<any[]>([]);
  const [timedImages, setTimedImages] = useState<{ timestamp: number; imageBase64: string }[]>([]);
  const [imageData, setImageData] = useState<string[]>([]);
  const [musicData, setMusicData] = useState<{ musicUrl: string; musicPrompt: string } | null>(null);
  const [soundEffectData, setSoundEffectData] = useState<SoundEffect[]>([]);
  const [videoData, setVideoData] = useState<any>(null);

  // Steps of the workflow
  const steps = [
    "Video Idea",
    "Script Generation",
    "Voiceover Generation",
    "Image Generation",
    "Music Generation",
    "Sound Effects",
    "Video Creation",
  ];

  // Handle form submission for video idea
  const handleVideoIdeaSubmit = (idea: string, duration: number) => {
    setVideoIdea(idea);
    setVideoDuration(duration);
    setCurrentStep(1);
  };

  // Handle script generation completion
  const handleScriptGenerated = (data: any) => {
    setScriptData(data);
    setCurrentStep(2);
  };

  // Handle voiceover generation completion
  const handleVoiceoverGenerated = (data: any) => {
    setVoiceoverData(data);
    // Update script data if it was edited in the voiceover generation step
    if (data.script && data.script !== scriptData.script) {
      setScriptData({
        ...scriptData,
        script: data.script
      });
    }
    setCurrentStep(3);
  };

  // Handle timed images generation completion
  const handleTimedImagesGenerated = (images: { timestamp: number; imageBase64: string }[]) => {
    setTimedImages(images);
    
    // Extract just the base64 images for the video generation step
    const imageStrings = images.map(img => img.imageBase64);
    setImageData(imageStrings);
    
    setCurrentStep(4);
  };

  // Handle music generation completion
  const handleMusicGenerated = (data: { musicUrl: string; musicPrompt: string }) => {
    setMusicData(data);
    setCurrentStep(5);
  };

  // Handle sound effect generation completion
  const handleSoundEffectsGenerated = (data: SoundEffect[]) => {
    setSoundEffectData(data);
    setCurrentStep(6);
  };

  // Handle video generation completion
  const handleVideoGenerated = (data: any) => {
    setVideoData(data);
    setCurrentStep(7);
  };

  // Reset the workflow
  const handleReset = () => {
    setVideoIdea("");
    setVideoDuration(1);
    setScriptData(null);
    setVoiceoverData(null);
    setImagePrompts([]);
    setTimedImages([]);
    setImageData([]);
    setMusicData(null);
    setSoundEffectData([]);
    setVideoData(null);
    setCurrentStep(0);
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-2 md:p-6 lg:p-8">
      <Toaster 
        position="bottom-right" 
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(20, 25, 45, 0.85)',
            color: '#fff',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(100, 130, 255, 0.2)',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3), 0 0 10px rgba(80, 130, 255, 0.3)'
          },
        }}
      />
      
      <div className="container max-w-5xl mx-auto space-y-4 md:space-y-6">
        <header className="text-center space-y-2">
          <div className="relative inline-block">
            <h1 className="text-3xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#50d2f0] via-[#4e7aff] to-[#a866ff] text-glow">
              AI Video Creator
            </h1>
            <div className="absolute -inset-4 bg-gradient-to-r from-[rgba(var(--accent-cyan),0.2)] via-[rgba(var(--accent-blue),0.1)] to-[rgba(var(--accent-purple),0.2)] blur-xl opacity-30 rounded-full -z-10"></div>
          </div>
          <p className="text-gray-300 max-w-2xl mx-auto text-sm md:text-base">
            Transform your ideas into stunning videos with the power of AI. Just enter your concept and watch it come to life.
          </p>
        </header>

        <ProgressStepper 
          steps={steps} 
          currentStep={currentStep} 
          onStepClick={(step) => {
            // Only allow going back to previous steps, not skipping ahead
            if (step < currentStep) {
              setCurrentStep(step);
            }
          }} 
        />

        <div className="bg-glass rounded-xl p-3 md:p-5 shadow-xl border border-[rgba(var(--accent-blue),0.15)] box-glow relative">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(var(--accent-cyan),0.5)] to-transparent"></div>
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(var(--accent-blue),0.3)] to-transparent"></div>
          
          {currentStep === 0 && (
            <VideoIdeaForm onSubmit={handleVideoIdeaSubmit} />
          )}
          
          {currentStep === 1 && (
            <ScriptGeneration 
              videoIdea={videoIdea}
              videoDuration={videoDuration}
              onScriptGenerated={handleScriptGenerated}
              onBack={() => setCurrentStep(0)}
            />
          )}
          
          {currentStep === 2 && scriptData && (
            <VoiceoverGeneration 
              script={scriptData.script} 
              onVoiceoverGenerated={handleVoiceoverGenerated}
              onBack={() => setCurrentStep(1)}
              autoGenerate={false}
            />
          )}
          
          {currentStep === 3 && scriptData && voiceoverData && (
            <TimedImageGeneration 
              script={scriptData.script}
              audioBase64={voiceoverData.audioBase64}
              onImagesGenerated={handleTimedImagesGenerated}
              onBack={() => setCurrentStep(2)}
            />
          )}
          
          {currentStep === 4 && scriptData && imageData.length > 0 && voiceoverData && (
            <MusicGeneration 
              script={scriptData.script}
              audioBase64={voiceoverData.audioBase64}
              onMusicGenerated={handleMusicGenerated}
              onBack={() => setCurrentStep(3)}
            />
          )}

          {currentStep === 5 && scriptData && timedImages.length > 0 && musicData && (
            <SoundEffectGeneration 
              script={scriptData.script}
              timedImages={timedImages}
              onSoundEffectsGenerated={handleSoundEffectsGenerated}
              onBack={() => setCurrentStep(4)}
              autoGenerate={true}
            />
          )}
          
          {currentStep === 6 && imageData.length > 0 && musicData && (
            <VideoGeneration 
              images={imageData} 
              audioBase64={voiceoverData.audioBase64}
              timedImages={timedImages}
              backgroundMusic={musicData.musicUrl}
              soundEffects={soundEffectData}
              onVideoGenerated={handleVideoGenerated}
              onBack={() => setCurrentStep(5)}
            />
          )}
          
          {currentStep === 7 && videoData && (
            <VideoPreview 
              videoUrl={videoData.videoUrl} 
              onReset={handleReset}
            />
          )}
        </div>
      </div>
      
      {/* Decorative elements - made smaller and less intrusive */}
      <div className="fixed top-20 right-10 w-24 h-24 bg-[rgba(var(--accent-purple),0.15)] rounded-full blur-3xl -z-10 animate-pulse-slow"></div>
      <div className="fixed bottom-10 left-10 w-32 h-32 bg-[rgba(var(--accent-blue),0.1)] rounded-full blur-3xl -z-10 animate-pulse-slow"></div>
      <div className="fixed top-1/3 left-20 w-16 h-16 bg-[rgba(var(--accent-cyan),0.15)] rounded-full blur-3xl -z-10 animate-pulse-slow"></div>
    </main>
  );
}
