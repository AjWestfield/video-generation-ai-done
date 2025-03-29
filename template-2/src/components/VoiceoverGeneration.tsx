import React, { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";

interface VoiceoverGenerationProps {
  script: string;
  onVoiceoverGenerated: (data: { audioBase64: string; voiceId: string; script: string }) => void;
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

// Reduced to 6 best storytelling voices including Michael C. Vincent and Josh
const VOICES: Voice[] = [
  // Premium storytelling voices
  {
    id: "XrExE9yKIg1WjnnlVkGX",
    name: "Matilda",
    description: "Warm, young female voice with an American accent",
    category: 'premium',
    tags: ['storytelling', 'warm', 'young'],
    previewText: "Welcome to this haunting tale of mystery and suspense.",
    recommended: true
  },
  {
    id: "flq6f7yk4E4fJM5XTYuZ",
    name: "Michael",
    description: "Old male voice with an American accent",
    category: 'premium',
    tags: ['storytelling', 'old', 'deep'],
    previewText: "Listen closely as I share a story that will touch your heart."
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
    id: "TxGEqnHWrfWFTfGW9XjX",
    name: "Michael C. Vincent",
    description: "Clear male voice with an authoritative tone",
    category: 'standard',
    tags: ['clear', 'authoritative', 'storytelling'],
    previewText: "What I'm about to tell you defies all logical explanation.",
    recommended: true
  },
  {
    id: "5Q0t7uMcjvnagumLfvZi",
    name: "Paul",
    description: "Middle-aged male voice with an American accent, reporter style",
    category: 'premium',
    tags: ['storytelling', 'documentary', 'reporter'],
    previewText: "In the shadows of that old house, something waited for me."
  }
];

const VoiceoverGeneration: React.FC<VoiceoverGenerationProps> = ({
  script,
  onVoiceoverGenerated,
  onBack,
  autoGenerate = true,
}) => {
  const [loading, setLoading] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [audioData, setAudioData] = useState<string | null>(null);
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
  
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Set initial script and word count
  useEffect(() => {
    setEditableScript(script);
    setScriptWordCount(script.trim().split(/\s+/).length);
  }, [script]);

  // Analyze script for gender and tone on component mount
  useEffect(() => {
    if (script && !scriptAnalysis && !analyzingScript) {
      analyzeScript();
    }
  }, [script]);

  // Auto-select recommended voice based on script analysis
  useEffect(() => {
    if (scriptAnalysis && recommendedVoices.length > 0 && !selectedVoice && autoGenerate) {
      const recommendedVoice = recommendedVoices[0]?.id;
      if (recommendedVoice) {
        setSelectedVoice(recommendedVoice);
        if (autoGenerate) {
          generateVoiceover(recommendedVoice);
        }
      }
    }
  }, [scriptAnalysis, recommendedVoices]);

  useEffect(() => {
    // Cleanup audio element on unmount
    return () => {
      if (audioElement) {
        audioElement.pause();
      }
      // Also cleanup any preview audio elements
      Object.values(previewAudio).forEach(audio => {
        audio.pause();
      });
    };
  }, [audioElement, previewAudio]);

  useEffect(() => {
    // Auto-generate with default voice if autoGenerate is true
    if (autoGenerate && !loading && !audioData && !error && !analyzingScript && !scriptAnalysis) {
      // Use the first premium voice by default
      const defaultVoice = VOICES.find(voice => voice.category === 'premium')?.id;
      if (defaultVoice) {
        setSelectedVoice(defaultVoice);
        generateVoiceover(defaultVoice);
      }
    }
  }, [autoGenerate, script, analyzingScript, scriptAnalysis]);

  // Add event listeners for play/pause to all audio elements
  useEffect(() => {
    const handleAudioEvents = (audioEl: HTMLAudioElement, voiceId: string) => {
      const playHandler = () => {
        setIsPlaying(voiceId);
        setPreviewPlayState(prev => ({ ...prev, [voiceId]: true }));
      };
      
      const pauseHandler = () => {
        if (isPlaying === voiceId) setIsPlaying(null);
        setPreviewPlayState(prev => ({ ...prev, [voiceId]: false }));
      };
      
      const endedHandler = () => {
        if (isPlaying === voiceId) setIsPlaying(null);
        setPreviewPlayState(prev => ({ ...prev, [voiceId]: false }));
      };
      
      audioEl.addEventListener('play', playHandler);
      audioEl.addEventListener('pause', pauseHandler);
      audioEl.addEventListener('ended', endedHandler);
      
      // Return cleanup function
      return () => {
        audioEl.removeEventListener('play', playHandler);
        audioEl.removeEventListener('pause', pauseHandler);
        audioEl.removeEventListener('ended', endedHandler);
      };
    };
    
    // Setup event listeners for main audio
    if (audioElement) {
      const cleanup = handleAudioEvents(audioElement, 'main');
      return cleanup;
    }
  }, [audioElement, isPlaying]);
  
  // Setup event listeners for preview audios
  useEffect(() => {
    const cleanups: (() => void)[] = [];
    
    Object.entries(previewAudio).forEach(([voiceId, audio]) => {
      cleanups.push(handleAudioEvents(audio, voiceId));
    });
    
    return () => {
      cleanups.forEach(cleanup => cleanup());
    };
  }, [previewAudio]);
  
  // Add time update event listener for main audio
  useEffect(() => {
    if (audioElement) {
      const timeUpdateHandler = () => {
        setCurrentTime(audioElement.currentTime);
      };
      
      const loadedMetadataHandler = () => {
        setAudioDuration(audioElement.duration);
      };
      
      audioElement.addEventListener('timeupdate', timeUpdateHandler);
      audioElement.addEventListener('loadedmetadata', loadedMetadataHandler);
      
      return () => {
        audioElement.removeEventListener('timeupdate', timeUpdateHandler);
        audioElement.removeEventListener('loadedmetadata', loadedMetadataHandler);
      };
    }
    
    return () => {};
  }, [audioElement]);
  
  const handleAudioEvents = (audioEl: HTMLAudioElement, voiceId: string) => {
    const playHandler = () => {
      setIsPlaying(voiceId);
      setPreviewPlayState(prev => ({ ...prev, [voiceId]: true }));
    };
    
    const pauseHandler = () => {
      if (isPlaying === voiceId) setIsPlaying(null);
      setPreviewPlayState(prev => ({ ...prev, [voiceId]: false }));
    };
    
    const endedHandler = () => {
      if (isPlaying === voiceId) setIsPlaying(null);
      setPreviewPlayState(prev => ({ ...prev, [voiceId]: false }));
    };
    
    audioEl.addEventListener('play', playHandler);
    audioEl.addEventListener('pause', pauseHandler);
    audioEl.addEventListener('ended', endedHandler);
    
    // Return cleanup function
    return () => {
      audioEl.removeEventListener('play', playHandler);
      audioEl.removeEventListener('pause', pauseHandler);
      audioEl.removeEventListener('ended', endedHandler);
    };
  };

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

  const generateVoicePreview = async (voiceId: string) => {
    // If we already have this preview cached, just play or pause it
    if (previewData[voiceId]) {
      const audio = previewAudio[voiceId];
      if (audio) {
        // If this audio is already playing, pause it
        if (previewPlayState[voiceId]) {
          audio.pause();
          return;
        }
        
        // Stop any currently playing previews
        Object.values(previewAudio).forEach(a => a.pause());
        
        // Play this preview
        audio.currentTime = 0;
        audio.play().catch(e => console.error("Audio playback error:", e));
        return;
      }
    }

    setPreviewLoading(voiceId);
    
    try {
      const voice = VOICES.find(v => v.id === voiceId);
      if (!voice || !voice.previewText) {
        throw new Error("Voice or preview text not found");
      }

      const previewText = shortPreview 
        ? voice.previewText.split(" ").slice(0, 10).join(" ") // Just first 10 words for quick preview
        : voice.previewText;

      const response = await fetch("/api/elevenlabs/text-to-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: previewText,
          voiceId: voiceId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate voice preview");
      }

      const data = await response.json();
      
      if (!data.audioBase64) {
        throw new Error("No audio data received");
      }
      
      // Cache the preview data
      setPreviewData(prev => ({
        ...prev,
        [voiceId]: data.audioBase64
      }));
      
      // Create audio element for preview
      const audio = new Audio(`data:audio/mp3;base64,${data.audioBase64}`);
      
      // Cache the audio element
      setPreviewAudio(prev => ({
        ...prev,
        [voiceId]: audio
      }));
      
      // Stop any currently playing previews
      Object.values(previewAudio).forEach(a => a.pause());
      
      // Play this preview
      audio.play().catch(e => console.error("Audio playback error:", e));
      
      // Initialize play state
      setPreviewPlayState(prev => ({
        ...prev,
        [voiceId]: true
      }));
    } catch (err) {
      console.error("Error generating voice preview:", err);
      toast.error("Failed to preview voice. Please try again.");
    } finally {
      setPreviewLoading(null);
    }
  };

  const handleScriptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newScript = e.target.value;
    setEditableScript(newScript);
    setScriptWordCount(newScript.trim().split(/\s+/).length);
    // Clear generated audio when script changes
    if (audioData) {
      setAudioData(null);
      if (audioElement) {
        audioElement.pause();
        setAudioElement(null);
      }
    }
  };

  const handleScriptSave = () => {
    // Clear any existing audio since the script changed
    if (audioData) {
      setAudioData(null);
      if (audioElement) {
        audioElement.pause();
        setAudioElement(null);
      }
    }
    
    // Re-analyze script if it has changed significantly
    if (editableScript !== script) {
      setScriptAnalysis(null);
      setAnalyzingScript(false);
      analyzeScript();
    }
  };

  // Analyze script for gender and tone
  const analyzeScript = async () => {
    setAnalyzingScript(true);
    try {
      const response = await fetch("/api/openrouter/analyze-script", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          script: editableScript || script,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to analyze script");
      }

      const data = await response.json();
      setScriptAnalysis(data);
      
      // Filter voices based on analysis
      const filteredVoices = findMatchingVoices(data);
      setRecommendedVoices(filteredVoices);
      
      // If auto-generate is enabled, select the first recommended voice
      if (filteredVoices.length > 0 && autoGenerate && !selectedVoice) {
        setSelectedVoice(filteredVoices[0].id);
        // Set the filter category to match the recommended voice type
        if (filteredVoices[0].tags?.includes('indian')) {
          setFilterCategory('indian');
        } else if (filteredVoices[0].tags?.includes('african')) {
          setFilterCategory('african');
        } else {
          setFilterCategory(filteredVoices[0].category);
        }
      }
    } catch (err) {
      console.error("Error analyzing script:", err);
      // Fall back to default behavior if analysis fails
      if (autoGenerate && !selectedVoice) {
        const defaultVoice = VOICES.find(voice => voice.category === 'premium')?.id;
        if (defaultVoice) {
          setSelectedVoice(defaultVoice);
        }
      }
    } finally {
      setAnalyzingScript(false);
    }
  };

  // Find matching voices based on script analysis
  const findMatchingVoices = (analysis: any): Voice[] => {
    if (!analysis) return [];
    
    const { gender, tone, qualities, accent } = analysis;
    
    // Start with all voices
    let matches = [...VOICES];
    
    // Filter by gender if specified
    if (gender === 'male') {
      matches = matches.filter(voice => 
        voice.description.toLowerCase().includes('male') && 
        !voice.description.toLowerCase().includes('female')
      );
    } else if (gender === 'female') {
      matches = matches.filter(voice => 
        voice.description.toLowerCase().includes('female')
      );
    }
    
    // Filter by accent if specified
    if (accent) {
      const accentLower = accent.toLowerCase();
      if (accentLower.includes('indian')) {
        matches = matches.filter(voice => voice.tags?.includes('indian'));
      } else if (accentLower.includes('african')) {
        matches = matches.filter(voice => voice.tags?.includes('african'));
      } else if (accentLower.includes('british')) {
        matches = matches.filter(voice => voice.tags?.includes('british'));
      }
    }
    
    // Filter by tone/qualities if specified
    if (tone && tone.length > 0) {
      const toneMatches = matches.filter(voice => {
        const voiceDesc = voice.description.toLowerCase();
        const voiceTags = voice.tags || [];
        return tone.some((t: string) => 
          voiceDesc.includes(t.toLowerCase()) || 
          voiceTags.some(tag => tag.toLowerCase().includes(t.toLowerCase()))
        );
      });
      
      // Only apply this filter if we get results, otherwise keep original matches
      if (toneMatches.length > 0) {
        matches = toneMatches;
      }
    }
    
    // If no matches, return all voices
    if (matches.length === 0) {
      return VOICES;
    }
    
    return matches;
  };

  const generateVoiceover = async (voiceId: string = selectedVoice || "") => {
    if (!voiceId) {
      toast.error("Please select a voice first");
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/elevenlabs/text-to-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: editableScript, // Use the editable script instead of the original
          voiceId: voiceId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate voiceover");
      }

      const data = await response.json();
      
      if (!data.audioBase64) {
        throw new Error("No audio data received");
      }
      
      setAudioData(data.audioBase64);
      
      // Create audio element for preview
      const audio = new Audio(`data:audio/mp3;base64,${data.audioBase64}`);
      setAudioElement(audio);
      
      // Set up event listeners for duration info
      audio.addEventListener('loadedmetadata', () => {
        setAudioDuration(audio.duration);
      });
      
      // Auto-play the audio
      audio.play().catch(e => console.error("Audio playback error:", e));
      setIsPlaying('main');
    } catch (err) {
      console.error("Error generating voiceover:", err);
      setError((err as Error).message);
      toast.error("Failed to generate voiceover. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceSelect = (voiceId: string) => {
    setSelectedVoice(voiceId);
    setAudioData(null); // Clear previous audio when selecting a new voice
    if (audioElement) {
      audioElement.pause();
      setAudioElement(null);
    }
    setCurrentTime(0);
    setAudioDuration(0);
  };

  const handleContinue = () => {
    if (audioData && selectedVoice) {
      onVoiceoverGenerated({
        audioBase64: audioData,
        voiceId: selectedVoice,
        script: editableScript, // Pass the potentially edited script
      });
    } else {
      toast.error("Please generate a voiceover first");
    }
  };

  const handlePlayPauseAudio = () => {
    if (audioElement) {
      if (audioElement.paused) {
        // Stop any preview audio that might be playing
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

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="text-center">
        <h2 className="text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[rgba(var(--accent-cyan),1)] to-[rgba(var(--accent-blue),1)] text-glow">
          Generate Voiceover
        </h2>
        <p className="text-gray-300 mt-1 text-xs md:text-sm">
          Choose a voice for your video narration
        </p>
        <div className="flex justify-center mt-2 space-x-2">
          <button
            onClick={() => setShortPreview(!shortPreview)}
            className="text-xs px-2 py-1 bg-[rgba(20,25,40,0.8)] text-gray-300 rounded-full hover:bg-[rgba(30,35,50,0.9)] transition-all border border-[rgba(var(--accent-blue),0.3)]"
          >
            {shortPreview ? "Using short previews" : "Using full previews"}
          </button>
          <button
            onClick={() => setShowScriptEditor(!showScriptEditor)}
            className="text-xs px-2 py-1 bg-[rgba(20,25,40,0.8)] text-gray-300 rounded-full hover:bg-[rgba(30,35,50,0.9)] transition-all border border-[rgba(var(--accent-blue),0.3)]"
          >
            {showScriptEditor ? "Hide script editor" : "Show script editor"}
          </button>
        </div>
      </div>

      {/* Script Editor Section */}
      {showScriptEditor && (
        <div className="bg-glass-darker rounded-lg p-3 border border-[rgba(var(--accent-blue),0.2)] box-glow relative">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(var(--accent-cyan),0.3)] to-transparent"></div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-base font-medium text-[rgba(var(--accent-cyan),1)]">Script Editor</h3>
            <div className="text-xs text-gray-300">
              Word count: <span className="text-[rgba(var(--accent-cyan),0.9)]">{scriptWordCount}</span>
            </div>
          </div>
          <textarea
            value={editableScript}
            onChange={handleScriptChange}
            className="w-full h-48 bg-[rgba(15,20,35,0.5)] text-gray-200 border border-[rgba(var(--accent-blue),0.3)] rounded-lg p-2 text-sm focus:border-[rgba(var(--accent-cyan),0.8)] focus:ring-1 focus:ring-[rgba(var(--accent-cyan),0.5)] focus:outline-none custom-scrollbar"
            placeholder="Your script content..."
          />
          <div className="mt-2 flex justify-end">
            <button
              onClick={handleScriptSave}
              className="px-3 py-1.5 bg-[rgba(var(--accent-blue),0.8)] text-white text-xs font-medium rounded-lg hover:bg-[rgba(var(--accent-blue),1)] transition-all duration-300 button-glow"
            >
              Update Script
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="text-center">
            <p className="text-gray-300 mt-1 text-sm">
              Generating voiceover...
            </p>
          </div>

          <div className="flex justify-center my-4">
            <div className="flex space-x-4">
              <div className="h-10 w-10 bg-[rgba(var(--accent-blue),0.8)] rounded-full animate-bounce"></div>
              <div className="h-10 w-10 bg-[rgba(var(--accent-cyan),0.8)] rounded-full animate-bounce animation-delay-200"></div>
              <div className="h-10 w-10 bg-[rgba(var(--accent-purple),0.8)] rounded-full animate-bounce animation-delay-400"></div>
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="space-y-3">
          <div className="text-center">
            <p className="text-red-400 mt-1 text-sm">
              {error}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onBack}
              className="flex-1 py-2 px-3 bg-[rgba(60,70,85,0.8)] text-white text-xs md:text-sm font-medium rounded-lg hover:bg-[rgba(70,80,95,0.9)] transition-all duration-300"
            >
              Back
            </button>
            <button
              onClick={() => selectedVoice && generateVoiceover()}
              className="flex-1 py-2 px-3 bg-[rgba(var(--accent-blue),0.8)] text-white text-xs md:text-sm font-medium rounded-lg hover:bg-[rgba(var(--accent-blue),1)] transition-all duration-300 button-glow"
              disabled={!selectedVoice}
            >
              Try Again
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-glass-darker rounded-lg p-3 border border-[rgba(var(--accent-blue),0.2)] box-glow relative">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(var(--accent-cyan),0.3)] to-transparent"></div>
            
            <div className="mb-3 flex justify-center space-x-2">
              <button
                onClick={() => setFilterCategory('all')}
                className={`px-3 py-1 rounded-md text-xs ${filterCategory === 'all' 
                  ? 'bg-[rgba(var(--accent-blue),0.8)] text-white' 
                  : 'bg-[rgba(40,45,60,0.8)] text-gray-300 border border-[rgba(var(--accent-blue),0.15)]'} transition-all duration-300`}
              >
                All Voices
              </button>
              <button
                onClick={() => setFilterCategory('premium')}
                className={`px-3 py-1 rounded-md text-xs ${filterCategory === 'premium' 
                  ? 'bg-[rgba(var(--accent-purple),0.8)] text-white' 
                  : 'bg-[rgba(40,45,60,0.8)] text-gray-300 border border-[rgba(var(--accent-blue),0.15)]'} transition-all duration-300`}
              >
                Premium
              </button>
              <button
                onClick={() => setFilterCategory('standard')}
                className={`px-3 py-1 rounded-md text-xs ${filterCategory === 'standard' 
                  ? 'bg-[rgba(var(--accent-cyan),0.8)] text-white' 
                  : 'bg-[rgba(40,45,60,0.8)] text-gray-300 border border-[rgba(var(--accent-blue),0.15)]'} transition-all duration-300`}
              >
                Standard
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredVoices.map((voice) => (
                <div
                  key={voice.id}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    selectedVoice === voice.id
                      ? "bg-[rgba(var(--accent-blue),0.2)] border border-[rgba(var(--accent-blue),0.5)] box-glow"
                      : "bg-[rgba(20,25,40,0.5)] border border-[rgba(40,50,80,0.2)] hover:border-[rgba(var(--accent-blue),0.3)]"
                  }`}
                >
                  <div 
                    className="flex justify-between items-center"
                    onClick={() => handleVoiceSelect(voice.id)}
                  >
                    <div className="flex items-center">
                      <h3 className="font-medium text-sm text-white">{voice.name}</h3>
                      {voice.recommended && (
                        <span className="ml-2 bg-[rgba(0,180,120,0.2)] text-xs text-[rgba(120,255,200,1)] px-2 py-0.5 rounded-full border border-[rgba(0,180,120,0.3)]">
                          Recommended
                        </span>
                      )}
                    </div>
                    {voice.category === 'premium' && (
                      <span className="bg-[rgba(var(--accent-purple),0.2)] text-xs text-[rgba(var(--accent-purple),1)] px-2 py-0.5 rounded-full border border-[rgba(var(--accent-purple),0.3)]">
                        Premium
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-300 mt-1">{voice.description}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {voice.tags && voice.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-xs bg-[rgba(30,40,60,0.6)] text-gray-300 px-1.5 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between items-center">
                    <button
                      onClick={() => generateVoicePreview(voice.id)}
                      className="text-xs px-2 py-1 bg-[rgba(var(--accent-cyan),0.8)] text-white rounded-md hover:bg-[rgba(var(--accent-cyan),0.9)] transition-all duration-300 flex items-center space-x-1"
                      disabled={previewLoading === voice.id}
                    >
                      {previewLoading === voice.id ? (
                        <><span>Loading...</span> <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin ml-1"></div></>
                      ) : previewData[voice.id] ? (
                        previewPlayState[voice.id] ? (
                          <><span>Pause</span> <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg></>
                        ) : (
                          <><span>Play</span> <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg></>
                        )
                      ) : (
                        <><span>Preview</span> <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg></>
                      )}
                    </button>
                    <button
                      onClick={() => handleVoiceSelect(voice.id)}
                      className={`text-xs px-2 py-1 ${
                        selectedVoice === voice.id 
                          ? 'bg-[rgba(var(--accent-blue),0.8)]' 
                          : 'bg-[rgba(40,50,70,0.8)]'
                      } text-white rounded-md hover:bg-opacity-90 transition-all duration-300`}
                    >
                      {selectedVoice === voice.id ? "Selected" : "Select"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {audioData && (
            <div className="bg-glass-darker rounded-lg p-3 border border-[rgba(var(--accent-blue),0.2)] box-glow relative">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(var(--accent-cyan),0.3)] to-transparent"></div>
              <h3 className="font-medium text-sm text-[rgba(var(--accent-cyan),1)] mb-2">Full Voiceover Preview</h3>
              <div className="flex flex-col space-y-2">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handlePlayPauseAudio}
                    className="p-1.5 rounded-full bg-[rgba(var(--accent-blue),0.8)] text-white hover:bg-[rgba(var(--accent-blue),1)] transition-all duration-300"
                  >
                    {audioElement && !audioElement.paused ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1">
                    <div 
                      ref={progressBarRef}
                      className="h-2 bg-[rgba(20,30,50,0.5)] rounded-full cursor-pointer"
                      onClick={handleProgressBarClick}
                    >
                      <div 
                        className="h-full bg-gradient-to-r from-[rgba(var(--accent-blue),0.9)] to-[rgba(var(--accent-cyan),0.9)] rounded-full"
                        style={{ width: `${audioDuration ? (currentTime / audioDuration) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-300 w-16 text-right">
                    {formatTime(currentTime)} / {formatTime(audioDuration)}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onBack}
              className="flex-1 py-2 px-3 bg-[rgba(60,70,85,0.8)] text-white text-xs md:text-sm font-medium rounded-lg hover:bg-[rgba(70,80,95,0.9)] transition-all duration-300"
            >
              Back
            </button>
            {selectedVoice && !audioData && (
              <button
                onClick={() => generateVoiceover()}
                className="flex-1 py-2 px-3 bg-[rgba(var(--accent-cyan),0.8)] text-white text-xs md:text-sm font-medium rounded-lg hover:bg-[rgba(var(--accent-cyan),0.9)] transition-all duration-300 button-glow"
              >
                Generate
              </button>
            )}
            {audioData && (
              <button
                onClick={handleContinue}
                className="flex-1 py-2 px-3 bg-[rgba(var(--accent-blue),0.8)] text-white text-xs md:text-sm font-medium rounded-lg hover:bg-[rgba(var(--accent-blue),1)] transition-all duration-300 button-glow"
              >
                Continue
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default VoiceoverGeneration; 