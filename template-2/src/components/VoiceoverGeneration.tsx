import React, { useState, useEffect, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import TranscriptImagePromptReview from "./TranscriptImagePromptReview"; // Import the review component

// Define structure for transcript/prompt data
interface TranscriptPromptData {
  start: number;
  end: number;
  transcriptSegment: string;
  imagePrompt: string;
  negativePrompt?: string; // Add optional negativePrompt field
}

// Update Props: Replace onVoiceoverGenerated with the combined callback
interface VoiceoverGenerationProps {
  script: string;
  // Update the finalPrompts type here to include transcriptSegment and negativePrompt
  onVoiceoverAndPromptsGenerated: (data: { 
    voiceover: { audioBase64: string; voiceId: string; script: string };
    finalPrompts: { timestamp: number; imagePrompt: string; negativePrompt: string; transcriptSegment: string }[]; 
  }) => void;
  onBack: () => void;
  autoGenerate?: boolean;
}

interface Voice {
  id: string;
  name: string;
  description: string;
  category: 'standard' | 'premium';
  preview?: string;
  tags?: string[];
  previewText?: string;
  recommended?: boolean;
}

// Expanded voice options including a variety of styles
const VOICES: Voice[] = [
      {
    id: "TxGEqnHWrfWFTfGW9XjX",
    name: "Michael C. Vincent",
    description: "Clear male voice with an authoritative tone",
    category: 'standard',
    tags: ['clear', 'authoritative', 'storytelling'],
    previewText: "What I'm about to tell you defies all logical explanation.",
    recommended: true
  },
  {
    id: "21m00Tcm4TlvDq8ikWAM",
    name: "Rachel",
    description: "Calm, young female voice with an American accent",
    category: 'premium',
    tags: ['storytelling', 'calm', 'young'],
    previewText: "I never believed in ghosts until that night."
  },
  {
    id: "onwK4e9ZLuTAKqWW03F9",
    name: "Josh",
    description: "Deep male voice with a smooth delivery",
    category: 'standard',
    tags: ['deep', 'smooth', 'storytelling'],
    previewText: "The night was dark, and the winds howled through the trees."
  },
  {
    id: "fCxG8OHm4STbIsWe4aT9",
    name: "Adam",
    description: "Professional male voice with natural intonation",
    category: 'premium',
    tags: ['professional', 'clear', 'natural'],
    previewText: "The technology we're developing today will shape our tomorrow."
  },
  {
    id: "j9jfwdrw7BRfcR43Qohk",
    name: "Frederick Surrey",
    description: "Expressive male voice with emotional range",
    category: 'premium',
    tags: ['expressive', 'emotional', 'storytelling'],
    previewText: "Every memory holds a piece of who we truly are."
  },
  {
    id: "EiNlNiXeDU1pqqOPrYMO",
    name: "Daniel",
    description: "Warm male voice with a conversational tone",
    category: 'standard',
    tags: ['warm', 'conversational', 'friendly'],
    previewText: "Let me tell you about an incredible discovery we made last week."
  },
  {
    id: "NFG5qt843uXKj4pFvR7C",
    name: "Adam Stone",
    description: "Professional male voice with a confident delivery",
    category: 'premium',
    tags: ['professional', 'confident', 'clear'],
    previewText: "Breathe deeply and let your worries fade away as we begin."
  },
  {
    id: "x86DtpnPPuq2BpEiKPRy",
    name: "Yomi",
    description: "Versatile female voice with natural cadence and clarity",
    category: 'standard',
    tags: ['versatile', 'clear', 'natural'],
    previewText: "The world opens up to those who seek knowledge and understanding."
  }
];

const VoiceoverGeneration: React.FC<VoiceoverGenerationProps> = ({
  script,
  onVoiceoverAndPromptsGenerated, // Use the new prop name
  onBack,
  autoGenerate = false,
}) => {
  const [loading, setLoading] = useState(false); // For ElevenLabs generation
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [audioData, setAudioData] = useState<string | null>(null); // Base64 audio from ElevenLabs
  const [audioUrl, setAudioUrl] = useState<string | null>(null); // URL for the generated audio player
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<'all' | 'premium' | 'standard'>('all');
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<{ [key: string]: HTMLAudioElement }>({});
  const [previewData, setPreviewData] = useState<{ [key: string]: string }>({});
  const [shortPreview, setShortPreview] = useState(true);
  const [scriptAnalysis, setScriptAnalysis] = useState<any>(null);
  const [analyzingScript, setAnalyzingScript] = useState(false);
  const [recommendedVoices, setRecommendedVoices] = useState<Voice[]>([]);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [previewPlayState, setPreviewPlayState] = useState<{ [key: string]: boolean }>({});
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [editableScript, setEditableScript] = useState<string>(script);
  const [showScriptEditor, setShowScriptEditor] = useState<boolean>(false);
  const [scriptWordCount, setScriptWordCount] = useState<number>(0);
  // New state for the transcription/prompt generation flow
  const [transcriptPromptsData, setTranscriptPromptsData] = useState<TranscriptPromptData[] | null>(null);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false); // Loading state for transcription/prompt gen
  const [processingStatusMessage, setProcessingStatusMessage] = useState('');

  const progressBarRef = useRef<HTMLDivElement>(null);

  // Define handleAudioEvents at the component scope using useCallback
  const handleAudioEvents = useCallback((audioEl: HTMLAudioElement, voiceId: string) => {
    const playHandler = () => { setIsPlaying(voiceId); setPreviewPlayState(prev => ({ ...prev, [voiceId]: true })); };
    const pauseHandler = () => { if (isPlaying === voiceId) setIsPlaying(null); setPreviewPlayState(prev => ({ ...prev, [voiceId]: false })); };
    const endedHandler = () => { if (isPlaying === voiceId) setIsPlaying(null); setPreviewPlayState(prev => ({ ...prev, [voiceId]: false })); };
    audioEl.addEventListener('play', playHandler);
    audioEl.addEventListener('pause', pauseHandler);
    audioEl.addEventListener('ended', endedHandler);
    return () => { // Return cleanup function
      audioEl.removeEventListener('play', playHandler);
      audioEl.removeEventListener('pause', pauseHandler);
      audioEl.removeEventListener('ended', endedHandler);
    };
  }, [isPlaying]); // Add isPlaying to dependency array

  // --- Script Analysis Logic (defined before useEffect that uses it) ---
  const findMatchingVoices = useCallback((analysis: any): Voice[] => {
    if (!analysis) return [];
    const { gender, tone, qualities, accent } = analysis;
    let matches = [...VOICES];
    if (gender === 'male') matches = matches.filter(voice => voice.description.toLowerCase().includes('male') && !voice.description.toLowerCase().includes('female'));
    else if (gender === 'female') matches = matches.filter(voice => voice.description.toLowerCase().includes('female'));
    // Keep accent filtering if needed, but don't use it for category filter
    if (accent) {
        const accentLower = accent.toLowerCase();
        if (accentLower.includes('indian')) matches = matches.filter(voice => voice.tags?.includes('indian'));
        else if (accentLower.includes('african')) matches = matches.filter(voice => voice.tags?.includes('african'));
        else if (accentLower.includes('british')) matches = matches.filter(voice => voice.tags?.includes('british'));
    }
    if (tone && Array.isArray(tone) && tone.length > 0) { // Check if tone is an array
        const toneMatches = matches.filter(voice => {
            const voiceDesc = voice.description.toLowerCase();
            const voiceTags = voice.tags || [];
            return tone.some((t: string) => voiceDesc.includes(t.toLowerCase()) || voiceTags.some(tag => tag.toLowerCase().includes(t.toLowerCase())));
        });
        if (toneMatches.length > 0) matches = toneMatches;
    }
    if (matches.length === 0) return VOICES; // Return all if no matches
    return matches;
   }, []); // Empty dependency array as it doesn't depend on component state/props

  const analyzeScript = useCallback(async () => {
    setAnalyzingScript(true);
    try {
      const response = await fetch("/api/openrouter/analyze-script", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ script: editableScript || script }) });
      if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || "Failed to analyze script"); }
      const data = await response.json();
      setScriptAnalysis(data);
      const filteredVoices = findMatchingVoices(data);
      setRecommendedVoices(filteredVoices);
      if (filteredVoices.length > 0 && autoGenerate && !selectedVoice) {
        const recommendedVoice = filteredVoices[0];
        setSelectedVoice(recommendedVoice.id);
        // Set filter category based on recommended voice category, not accent tag
        setFilterCategory(recommendedVoice.category);
      }
    } catch (err) {
      console.error("Error analyzing script:", err);
      if (autoGenerate && !selectedVoice) { const defaultVoice = VOICES.find(voice => voice.category === 'premium')?.id; if (defaultVoice) setSelectedVoice(defaultVoice); }
    } finally { setAnalyzingScript(false); }
   }, [editableScript, script, autoGenerate, selectedVoice, findMatchingVoices]); // Added dependencies

  // --- Existing useEffect hooks ---
  useEffect(() => {
    setEditableScript(script);
    setScriptWordCount(script.trim().split(/\s+/).length);
  }, [script]);

  useEffect(() => {
    // Only analyze if script changes and we are not already showing the review step
    if (script && !scriptAnalysis && !analyzingScript && !transcriptPromptsData) {
      analyzeScript();
    }
    // Add analyzeScript and its own dependencies to this useEffect's array
  }, [script, editableScript, transcriptPromptsData, scriptAnalysis, analyzingScript, analyzeScript]); // Added dependencies

  useEffect(() => {
    if (scriptAnalysis && recommendedVoices.length > 0 && !selectedVoice) {
      const recommendedVoice = recommendedVoices[0]?.id;
      if (recommendedVoice) {
        setSelectedVoice(recommendedVoice);
      }
    }
  }, [scriptAnalysis, recommendedVoices, selectedVoice]); // Added selectedVoice

  useEffect(() => {
    return () => {
      if (audioElement) audioElement.pause();
      Object.values(previewAudio).forEach(audio => audio.pause());
      // Clean up object URLs
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioElement, previewAudio, audioUrl]);

  useEffect(() => {
    if (autoGenerate && !loading && !audioData && !error && !analyzingScript && !scriptAnalysis && !isProcessingAudio) {
      const defaultVoice = VOICES.find(voice => voice.category === 'premium')?.id;
      if (defaultVoice) {
        setSelectedVoice(defaultVoice);
      }
    }
  }, [autoGenerate, script, analyzingScript, scriptAnalysis, loading, audioData, error, isProcessingAudio]);

  // --- Audio Player Event Listeners ---
  useEffect(() => {
    if (audioElement) {
      const cleanup = handleAudioEvents(audioElement, 'main');
      return cleanup;
    }
  }, [audioElement, handleAudioEvents]); // Use component-scoped function

  useEffect(() => {
    const cleanups: (() => void)[] = [];
    Object.entries(previewAudio).forEach(([voiceId, audio]) => { cleanups.push(handleAudioEvents(audio, voiceId)); });
    return () => { cleanups.forEach(cleanup => cleanup()); };
  }, [previewAudio, handleAudioEvents]); // Use component-scoped function

  useEffect(() => {
    if (audioElement) {
      const timeUpdateHandler = () => { setCurrentTime(audioElement.currentTime); };
      const loadedMetadataHandler = () => { setAudioDuration(audioElement.duration); };
      audioElement.addEventListener('timeupdate', timeUpdateHandler);
      audioElement.addEventListener('loadedmetadata', loadedMetadataHandler);
      return () => {
        audioElement.removeEventListener('timeupdate', timeUpdateHandler);
        audioElement.removeEventListener('loadedmetadata', loadedMetadataHandler);
      };
    } return () => {};
  }, [audioElement]);

  // --- Helper Functions ---
  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
   };
  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioElement || !progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * audioDuration;
    audioElement.currentTime = newTime;
    setCurrentTime(newTime);
   };

  // --- Voice Preview Logic ---
  const generateVoicePreview = async (voiceId: string) => {
        if (previewData[voiceId]) {
      const audio = previewAudio[voiceId];
      if (audio) {
        if (previewPlayState[voiceId]) { audio.pause(); return; }
        Object.values(previewAudio).forEach(a => a.pause());
        audio.currentTime = 0;
        audio.play().catch(e => console.error("Audio playback error:", e));
        return;
      }
    }
    setPreviewLoading(voiceId);
    try {
      const voice = VOICES.find(v => v.id === voiceId);
      if (!voice || !voice.previewText) throw new Error("Voice or preview text not found");
      const previewText = shortPreview ? voice.previewText.split(" ").slice(0, 10).join(" ") : voice.previewText;
      const response = await fetch("/api/elevenlabs/text-to-speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: previewText, voiceId: voiceId }) });
      if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || "Failed to generate voice preview"); }
      const data = await response.json();
      if (!data.audioBase64) throw new Error("No audio data received");
      setPreviewData(prev => ({ ...prev, [voiceId]: data.audioBase64 }));
      const audio = new Audio(`data:audio/mp3;base64,${data.audioBase64}`);
      setPreviewAudio(prev => ({ ...prev, [voiceId]: audio }));
      Object.values(previewAudio).forEach(a => a.pause());
      audio.play().catch(e => console.error("Audio playback error:", e));
      setPreviewPlayState(prev => ({ ...prev, [voiceId]: true }));
    } catch (err) { console.error("Error generating voice preview:", err); toast.error("Failed to preview voice. Please try again."); }
    finally { setPreviewLoading(null); }
   };

  // --- Script Editing Logic ---
  const handleScriptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newScript = e.target.value;
    setEditableScript(newScript);
    setScriptWordCount(newScript.trim().split(/\s+/).length);
    if (audioData) { setAudioData(null); setAudioUrl(null); if (audioElement) { audioElement.pause(); setAudioElement(null); } }
    setTranscriptPromptsData(null); // Also clear prompts if script changes
   };
  const handleScriptSave = () => {
    if (audioData) { setAudioData(null); setAudioUrl(null); if (audioElement) { audioElement.pause(); setAudioElement(null); } }
    setTranscriptPromptsData(null); // Also clear prompts if script changes
    if (editableScript !== script) { setScriptAnalysis(null); setAnalyzingScript(false); analyzeScript(); }
   };

  // --- Modified Voiceover Generation ---
  const generateVoiceover = async (voiceId: string = selectedVoice || "") => {
    if (!voiceId) {
      toast.error("Please select a voice first");
      return;
    }
    setLoading(true); // Loading for ElevenLabs
    setError(null);
    setTranscriptPromptsData(null); // Clear previous prompts
    setAudioData(null); // Clear previous audio data
    if (audioElement) audioElement.pause(); // Stop existing audio
    setAudioElement(null);
    setAudioUrl(null);

    try {
      // 1. Generate audio with ElevenLabs
      const response = await fetch("/api/elevenlabs/text-to-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editableScript, voiceId: voiceId }),
      });
      if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || "Failed to generate voiceover"); }
      const data = await response.json();
      if (!data.audioBase64) throw new Error("No audio data received from ElevenLabs");

      const generatedAudioBase64 = data.audioBase64;
      setAudioData(generatedAudioBase64); // Store base64

      // Create audio element and URL for preview
      const audioBlob = new Blob([Buffer.from(generatedAudioBase64, 'base64')], { type: 'audio/mp3' });
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url); // Set URL for the player
      const audio = new Audio(url);
      setAudioElement(audio);

      // Wait for metadata to load to get duration reliably
      audio.addEventListener('loadedmetadata', async () => {
        const duration = audio.duration;
        setAudioDuration(duration); // Update state as well

        if (duration > 0) {
          // 2. Trigger transcription and prompt generation ONLY after duration is known
          await processGeneratedAudio(generatedAudioBase64, duration); // Pass duration
        } else {
          // Handle case where duration is still not available (should be rare)
          throw new Error("Failed to get audio duration even after metadata loaded.");
        }
      });

      // Handle potential errors during audio loading itself
      audio.addEventListener('error', (e) => {
         console.error("Error loading generated audio:", e);
         throw new Error("Failed to load generated audio file.");
      });

      // No longer call processGeneratedAudio directly here
      // await processGeneratedAudio(generatedAudioBase64);

    } catch (err) {
      console.error("Error in voiceover generation process:", err);
      setError((err as Error).message);
      toast.error(`Voiceover generation failed: ${(err as Error).message}`);
    } finally {
      setLoading(false); // Finished ElevenLabs part
    }
  };

  // --- Updated Function: Process Audio -> Transcribe -> Generate Prompts ---
  // Now accepts duration as a parameter
  const processGeneratedAudio = async (audioBase64: string, duration: number) => {
    setIsProcessingAudio(true); // Start processing loader
    setProcessingStatusMessage('Transcribing audio...');
    setError(null); // Clear previous errors
    try {
      // 1. Call Transcription API
      const transcribeResponse = await fetch('/api/openai/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: audioBase64 }),
      });
      if (!transcribeResponse.ok) { const errorData = await transcribeResponse.json(); throw new Error(`Transcription failed: ${errorData.error || transcribeResponse.statusText}`); }
      const transcriptionData = await transcribeResponse.json();
      const originalSegments: { start: number; end: number; text: string }[] = transcriptionData.segments;
      if (!originalSegments || originalSegments.length === 0) throw new Error('Transcription returned no segments.');

      // --- NEW: Process segments into 4-second intervals ---
      setProcessingStatusMessage('Aligning transcript to 4-second intervals...');

      // Remove the unreliable fallback duration check - use the passed 'duration'
      // if (!audioDuration || audioDuration <= 0) { ... }

      if (!duration || duration <= 0) {
         // This check should ideally not fail now, but keep as safeguard
         throw new Error("Audio duration is invalid or zero.");
      }

      const interval = 4; // 4 seconds
      const fourSecondSegments: { start: number; end: number; text: string }[] = [];
      // Use the passed 'duration' for the loop boundary
      for (let currentTime = 0; currentTime < duration; currentTime += interval) {
        const intervalStart = currentTime;
        const intervalEnd = Math.min(currentTime + interval, duration); // Use passed duration
        let intervalText = "";

        // Find text from original segments that falls within this interval
        originalSegments.forEach(seg => {
          // Calculate overlap duration
          const overlapStart = Math.max(intervalStart, seg.start);
          const overlapEnd = Math.min(intervalEnd, seg.end);
          const overlapDuration = Math.max(0, overlapEnd - overlapStart);

          // Include segment text if it overlaps significantly (e.g., > 0.1 seconds)
          if (overlapDuration > 0.1) {
             // Simple concatenation for now, could be improved
             intervalText += seg.text.trim() + " ";
          }
        });

        // Only add if there's text for the interval
        if (intervalText.trim()) {
          fourSecondSegments.push({
            start: intervalStart,
            end: intervalEnd,
            text: intervalText.trim(),
          });
        }
      }

      if (fourSecondSegments.length === 0) {
         throw new Error("No text segments could be aligned to 4-second intervals.");
      }
      // --- END NEW ---

      setProcessingStatusMessage('Generating image prompts for 4s intervals...');

      // 2. Call Prompt Generation API with the NEW 4-second segments
      const promptGenResponse = await fetch('/api/openrouter/generate-prompts-from-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send the processed 4-second segments instead of original ones
        body: JSON.stringify({ segments: fourSecondSegments }),
      });
      if (!promptGenResponse.ok) { const errorData = await promptGenResponse.json(); throw new Error(`Prompt generation failed: ${errorData.error || promptGenResponse.statusText}`); }
      const promptGenData = await promptGenResponse.json();
      // Ensure promptsData is correctly typed here
      const promptsData: TranscriptPromptData[] = promptGenData.prompts;
      if (!promptsData || promptsData.length === 0) throw new Error('Prompt generation returned no prompts.');

      setTranscriptPromptsData(promptsData); // Set state to trigger review UI
      setProcessingStatusMessage(''); // Clear status
      toast.success('Transcription and prompts generated!');

    } catch (error) {
      console.error('Error processing generated audio:', error);
      setError(`Processing failed: ${(error as Error).message}`);
      toast.error(`Processing failed: ${(error as Error).message}`);
      setTranscriptPromptsData(null); // Clear prompts on error
    } finally {
      setIsProcessingAudio(false); // Finish processing loader
    }
  };

  // --- New Handler for Finalized Prompts ---
  // Update the type definition for the finalPrompts parameter here
  const handlePromptsFinalized = (finalPrompts: { timestamp: number; imagePrompt: string; negativePrompt: string; transcriptSegment: string }[]) => {
    if (audioData && selectedVoice) {
      // Package up the data for the parent component
      onVoiceoverAndPromptsGenerated({
        voiceover: {
          audioBase64: audioData,
          voiceId: selectedVoice,
          script: editableScript || script
        },
        finalPrompts // Pass the finalized prompts with timestamps
      });
    } else {
      toast.error("Please generate voiceover audio first");
    }
  };


  const handleVoiceSelect = (voiceId: string) => {
    setSelectedVoice(voiceId);
    setAudioData(null); // Clear previous audio
    setAudioUrl(null);
    setTranscriptPromptsData(null); // Clear prompts
    if (audioElement) { audioElement.pause(); setAudioElement(null); }
    setCurrentTime(0);
    setAudioDuration(0);
  };

  // Remove handleContinue - logic is now in handlePromptsFinalized

  const handlePlayPauseAudio = () => {
    if (audioElement) {
      if (audioElement.paused) {
        Object.values(previewAudio).forEach(audio => audio.pause());
        audioElement.play().catch(e => console.error("Audio playback error:", e));
      } else {
        audioElement.pause();
      }
    }
   };

  const filteredVoices = filterCategory === 'all'
    ? VOICES
    : VOICES.filter(voice => voice.category === filterCategory);

  // --- Updated Return Statement ---
  return (
    <div className="space-y-3 md:space-y-4">
      {/* Conditionally render Review Component or Voice Selection UI */}
      {transcriptPromptsData && audioUrl ? (
        <TranscriptImagePromptReview
          voiceoverAudioUrl={audioUrl}
          initialPromptsData={transcriptPromptsData}
          onPromptsFinalized={handlePromptsFinalized}
          onBack={() => { // Custom back logic for this state
            setTranscriptPromptsData(null); // Clear prompts to go back
            // Keep audio data/url so user doesn't have to regenerate voiceover
          }}
        />
      ) : (
        // Original Voice Selection UI
        <>
          <div className="text-center">
            <h2 className="text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[rgba(var(--accent-cyan),1)] to-[rgba(var(--accent-blue),1)] text-glow">
              Generate Voiceover & Prompts
            </h2>
            <p className="text-gray-300 mt-1 text-xs md:text-sm">
              Choose a voice, generate audio, and review image prompts.
            </p>
             <div className="flex justify-center mt-2 space-x-2">
               {/* Placeholder classNames for brevity */}
               <button onClick={() => setShortPreview(!shortPreview)} className="text-xs px-2 py-1 bg-[rgba(20,25,40,0.8)] text-gray-300 rounded-full hover:bg-[rgba(30,35,50,0.9)] transition-all border border-[rgba(var(--accent-blue),0.3)]">
                 {shortPreview ? "Using short previews" : "Using full previews"}
               </button>
               <button onClick={() => setShowScriptEditor(!showScriptEditor)} className="text-xs px-2 py-1 bg-[rgba(20,25,40,0.8)] text-gray-300 rounded-full hover:bg-[rgba(30,35,50,0.9)] transition-all border border-[rgba(var(--accent-blue),0.3)]">
                 {showScriptEditor ? "Hide script editor" : "Show script editor"}
               </button>
             </div>
          </div>

          {showScriptEditor && (
             <div className="bg-glass-darker rounded-lg p-3 border border-[rgba(var(--accent-blue),0.2)] box-glow relative">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(var(--accent-cyan),0.3)] to-transparent"></div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-base font-medium text-[rgba(var(--accent-cyan),1)]">Script Editor</h3>
                  <div className="text-xs text-gray-300">Word count: <span className="text-[rgba(var(--accent-cyan),0.9)]">{scriptWordCount}</span></div>
                </div>
                <textarea value={editableScript} onChange={handleScriptChange} className="w-full h-48 bg-[rgba(15,20,35,0.5)] text-gray-200 border border-[rgba(var(--accent-blue),0.3)] rounded-lg p-2 text-sm focus:border-[rgba(var(--accent-cyan),0.8)] focus:ring-1 focus:ring-[rgba(var(--accent-cyan),0.5)] focus:outline-none custom-scrollbar" placeholder="Your script content..." />
                <div className="mt-2 flex justify-end">
                  <button onClick={handleScriptSave} className="px-3 py-1.5 bg-[rgba(var(--accent-blue),0.8)] text-white text-xs font-medium rounded-lg hover:bg-[rgba(var(--accent-blue),1)] transition-all duration-300 button-glow">Update Script</button>
                </div>
             </div>
          )}

          {/* Loading/Error States */}
          {(loading || isProcessingAudio) && (
            <div className="space-y-3 text-center">
               <p className="text-gray-300 mt-1 text-sm">{loading ? 'Generating voiceover...' : processingStatusMessage}</p>
               <div className="flex justify-center my-4"><div className="flex space-x-4">
                 <div className="h-10 w-10 bg-[rgba(var(--accent-blue),0.8)] rounded-full animate-bounce"></div>
                 <div className="h-10 w-10 bg-[rgba(var(--accent-cyan),0.8)] rounded-full animate-bounce animation-delay-200"></div>
                 <div className="h-10 w-10 bg-[rgba(var(--accent-purple),0.8)] rounded-full animate-bounce animation-delay-400"></div>
               </div></div>
            </div>
          )}
          {error && !loading && !isProcessingAudio && (
             <div className="space-y-3">
               <p className="text-red-400 mt-1 text-sm text-center">{error}</p>
               <div className="flex gap-2">
                 <button onClick={onBack} className="flex-1 py-2 px-3 bg-[rgba(60,70,85,0.8)] text-white text-xs md:text-sm font-medium rounded-lg hover:bg-[rgba(70,80,95,0.9)] transition-all duration-300">Back</button>
                 <button onClick={() => selectedVoice && generateVoiceover()} className="flex-1 py-2 px-3 bg-[rgba(var(--accent-blue),0.8)] text-white text-xs md:text-sm font-medium rounded-lg hover:bg-[rgba(var(--accent-blue),1)] transition-all duration-300 button-glow" disabled={!selectedVoice}>Try Again</button>
               </div>
             </div>
          )}

          {/* Voice Selection UI (only show if not loading/processing and no error) */}
          {!loading && !isProcessingAudio && !error && (
            <>
              <div className="bg-glass-darker rounded-lg p-3 border border-[rgba(var(--accent-blue),0.2)] box-glow relative">
                 <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(var(--accent-cyan),0.3)] to-transparent"></div>
                 <div className="mb-3 flex justify-center space-x-2"> {/* Filter Buttons */}
                    <button onClick={() => setFilterCategory('all')} className={`px-3 py-1 rounded-md text-xs ${filterCategory === 'all' ? 'bg-[rgba(var(--accent-blue),0.8)] text-white' : 'bg-[rgba(40,45,60,0.8)] text-gray-300 border border-[rgba(var(--accent-blue),0.15)]'} transition-all duration-300`}>All Voices</button>
                    <button onClick={() => setFilterCategory('premium')} className={`px-3 py-1 rounded-md text-xs ${filterCategory === 'premium' ? 'bg-[rgba(var(--accent-purple),0.8)] text-white' : 'bg-[rgba(40,45,60,0.8)] text-gray-300 border border-[rgba(var(--accent-blue),0.15)]'} transition-all duration-300`}>Premium</button>
                    <button onClick={() => setFilterCategory('standard')} className={`px-3 py-1 rounded-md text-xs ${filterCategory === 'standard' ? 'bg-[rgba(var(--accent-cyan),0.8)] text-white' : 'bg-[rgba(40,45,60,0.8)] text-gray-300 border border-[rgba(var(--accent-blue),0.15)]'} transition-all duration-300`}>Standard</button>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                   {filteredVoices.map((voice) => (
                     <div key={voice.id} className={`p-3 rounded-lg cursor-pointer transition-all ${selectedVoice === voice.id ? "bg-[rgba(var(--accent-blue),0.2)] border border-[rgba(var(--accent-blue),0.5)] box-glow" : "bg-[rgba(20,25,40,0.5)] border border-[rgba(40,50,80,0.2)] hover:border-[rgba(var(--accent-blue),0.3)]"}`} onClick={() => handleVoiceSelect(voice.id)}>
                        <div className="flex justify-between items-center"> {/* Voice Name & Category */}
                           <div className="flex items-center">
                              <h3 className="font-medium text-sm text-white">{voice.name}</h3>
                              {/* Recommended/Premium Badges */}
                              {voice.recommended && <span className="ml-2 bg-[rgba(0,180,120,0.2)] text-xs text-[rgba(120,255,200,1)] px-2 py-0.5 rounded-full border border-[rgba(0,180,120,0.3)]">Recommended</span>}
                           </div>
                           {voice.category === 'premium' && <span className="bg-[rgba(var(--accent-purple),0.2)] text-xs text-[rgba(var(--accent-purple),1)] px-2 py-0.5 rounded-full border border-[rgba(var(--accent-purple),0.3)]">Premium</span>}
                        </div>
                        <p className="text-xs text-gray-300 mt-1">{voice.description}</p>
                        <div className="mt-1 flex flex-wrap gap-1">{voice.tags && voice.tags.slice(0, 3).map(tag => (<span key={tag} className="text-xs bg-[rgba(30,40,60,0.6)] text-gray-300 px-1.5 py-0.5 rounded-full">{tag}</span>))}</div>
                        <div className="mt-2 flex justify-between items-center"> {/* Preview & Select */}
                           <button onClick={(e) => { e.stopPropagation(); generateVoicePreview(voice.id); }} className="text-xs px-2 py-1 bg-[rgba(var(--accent-cyan),0.8)] text-white rounded-md hover:bg-[rgba(var(--accent-cyan),0.9)] transition-all duration-300 flex items-center space-x-1" disabled={previewLoading === voice.id}>
                              {/* Preview Button Content */}
                              {previewLoading === voice.id ? (<><span>Loading...</span> <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin ml-1"></div></>) : previewData[voice.id] ? (previewPlayState[voice.id] ? (<><span>Pause</span> <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></>) : (<><span>Play</span> <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></>)) : (<><span>Preview</span> <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></>)}
                           </button>
                           {selectedVoice === voice.id ? <span className="text-xs px-2 py-1 bg-[rgba(var(--accent-blue),0.8)] text-white rounded-md">Selected</span> : <span className="text-xs px-2 py-1 bg-[rgba(40,50,70,0.8)] text-white rounded-md">Select</span>}
                        </div>
                     </div>
                   ))}
                 </div>
              </div>

              {/* Generated Audio Preview (if available) */}
              {audioData && audioUrl && (
                 <div className="bg-glass-darker rounded-lg p-3 border border-[rgba(var(--accent-blue),0.2)] box-glow relative">
                   <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(var(--accent-cyan),0.3)] to-transparent"></div>
                   <h3 className="font-medium text-sm text-[rgba(var(--accent-cyan),1)] mb-2">Full Voiceover Preview</h3>
                   <div className="flex flex-col space-y-2">
                     <div className="flex items-center space-x-2">
                       <button onClick={handlePlayPauseAudio} className="p-1.5 rounded-full bg-[rgba(var(--accent-blue),0.8)] text-white hover:bg-[rgba(var(--accent-blue),1)] transition-all duration-300"> {/* Play/Pause Icon */}
                         {audioElement && !audioElement.paused ? (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>) : (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>)}
                       </button>
                       <div className="flex-1">
                         <div ref={progressBarRef} className="h-2 bg-[rgba(20,30,50,0.5)] rounded-full cursor-pointer" onClick={handleProgressBarClick}>
                           <div className="h-full bg-gradient-to-r from-[rgba(var(--accent-blue),0.9)] to-[rgba(var(--accent-cyan),0.9)] rounded-full" style={{ width: `${audioDuration ? (currentTime / audioDuration) * 100 : 0}%` }}></div>
                         </div>
                       </div>
                       <div className="text-xs text-gray-300 w-16 text-right">{formatTime(currentTime)} / {formatTime(audioDuration)}</div>
                     </div>
                   </div>
                 </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button onClick={onBack} className="flex-1 py-2 px-3 bg-[rgba(60,70,85,0.8)] text-white text-xs md:text-sm font-medium rounded-lg hover:bg-[rgba(70,80,95,0.9)] transition-all duration-300">Back</button>
                {selectedVoice && ( // Show Generate button only if a voice is selected
                  <button onClick={() => generateVoiceover()} className="flex-1 py-2 px-3 bg-[rgba(var(--accent-cyan),0.8)] text-white text-xs md:text-sm font-medium rounded-lg hover:bg-[rgba(var(--accent-cyan),0.9)] transition-all duration-300 button-glow" disabled={loading || isProcessingAudio}>
                    {loading ? 'Generating Audio...' : isProcessingAudio ? 'Processing Audio...' : 'Generate & Create Prompts'}
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default VoiceoverGeneration;
