"use client";

import { useState, useCallback } from "react";
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
  const [step, setStep] = useState(1);
  const [videoIdea, setVideoIdea] = useState<string>("");
  const [videoLength, setVideoLength] = useState<string>("short");
  const [scriptData, setScriptData] = useState<{ script: string; title: string }>({ script: "", title: "" });
  const [voiceoverData, setVoiceoverData] = useState<{ audioBase64: string; voiceId: string; script: string } | null>(null);
  const [imageData, setImageData] = useState<{ timestamp: number; imageBase64: string }[]>([]);
  const [musicData, setMusicData] = useState<string | null>(null);
  const [soundEffectsData, setSoundEffectsData] = useState<Array<{ timestamp: number; type: string; audioBase64: string }>>([]);
  const [videoData, setVideoData] = useState<any>(null);

  // Steps of the workflow
  const steps = [
    "Video Idea",
    "Script Generation",
    "Voiceover Generation",
    "Image Generation",
    "Music Generation",
    "Video Creation",
  ];

  // Function to handle navigation to prevent image regeneration
  const handleNavigate = useCallback((targetStep: number) => {
    setStep(targetStep);
  }, []);

  const handleVideoIdeaSubmit = useCallback((idea: string, length: string) => {
    setVideoIdea(idea);
    setVideoLength(length);
    setStep(2);
  }, []);

  const handleScriptGenerated = useCallback((data: { script: string; title: string }) => {
    setScriptData(data);
    setStep(3);
  }, []);

  const handleVoiceoverGenerated = useCallback((data: { audioBase64: string; voiceId: string; script: string }) => {
    setVoiceoverData(data);
    setStep(4);
  }, []);

  const handleImagesGenerated = useCallback((images: { timestamp: number; imageBase64: string }[]) => {
    setImageData(images);
    setStep(5);
  }, []);

  const handleMusicGenerated = useCallback((data: { musicUrl: string; musicPrompt: string }) => {
    setMusicData(data.musicUrl);
    setStep(6);
  }, []);

  const handleSoundEffectsGenerated = useCallback((soundEffects: Array<{ timestamp: number; type: string; audioBase64: string }>) => {
    setSoundEffectsData(soundEffects);
    setStep(7);
  }, []);

  // Handle video generation completion
  const handleVideoGenerated = (data: any) => {
    setVideoData(data);
    setStep(8);
  };

  // Reset the workflow
  const handleReset = () => {
    setVideoIdea("");
    setVideoLength("short");
    setScriptData({ script: "", title: "" });
    setVoiceoverData(null);
    setImageData([]);
    setMusicData(null);
    setSoundEffectsData([]);
    setVideoData(null);
    setStep(1);
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
          currentStep={step} 
          onStepClick={handleNavigate} 
        />

        <div className="bg-glass rounded-xl p-3 md:p-5 shadow-xl border border-[rgba(var(--accent-blue),0.15)] box-glow relative">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(var(--accent-cyan),0.5)] to-transparent"></div>
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(var(--accent-blue),0.3)] to-transparent"></div>
          
          {step === 1 && (
            <VideoIdeaForm onSubmit={handleVideoIdeaSubmit} />
          )}
          
          {step === 2 && (
            <ScriptGeneration 
              videoIdea={videoIdea}
              videoLength={videoLength}
              onScriptGenerated={handleScriptGenerated}
              onBack={() => setStep(1)}
            />
          )}
          
          {step === 3 && scriptData && (
            <VoiceoverGeneration 
              script={scriptData.script} 
              onVoiceoverGenerated={handleVoiceoverGenerated}
              onBack={() => setStep(2)}
              autoGenerate={false}
            />
          )}
          
          {step === 4 && scriptData && voiceoverData && (
            <TimedImageGeneration 
              script={scriptData.script}
              audioBase64={voiceoverData.audioBase64}
              onImagesGenerated={handleImagesGenerated}
              onBack={() => setStep(3)}
            />
          )}
          
          {step === 5 && scriptData && imageData.length > 0 && (
            <MusicGeneration 
              script={scriptData.script}
              audioBase64={voiceoverData?.audioBase64}
              onMusicGenerated={handleMusicGenerated}
              onBack={() => setStep(4)}
            />
          )}
          
          {step === 6 && imageData.length > 0 && musicData && (
            <SoundEffectGeneration
              script={scriptData.script}
              voiceoverAudio={voiceoverData?.audioBase64}
              onSoundEffectsGenerated={handleSoundEffectsGenerated}
              onBack={() => setStep(5)}
            />
          )}
          
          {step === 7 && imageData.length > 0 && musicData && (
            <VideoGeneration 
              script={scriptData.script}
              title={scriptData.title}
              voiceoverAudio={voiceoverData?.audioBase64}
              images={imageData}
              musicAudio={musicData}
              soundEffects={soundEffectsData}
              onVideoGenerated={handleVideoGenerated}
              onBack={() => setStep(6)}
            />
          )}
          
          {step === 8 && videoData && (
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
