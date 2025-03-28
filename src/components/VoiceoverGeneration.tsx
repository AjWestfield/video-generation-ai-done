import React, { useState, useEffect, useRef } from 'react';

const VOICES: Voice[] = [
  // Premium storytelling voices
  {
    id: "XrExE9yKIg1WjnnlVkGX",
    name: "Matilda",
    description: "Warm, young female voice with an American accent",
    category: 'premium',
    tags: ['storytelling', 'warm', 'young'],
    previewText: "Welcome to this haunting tale of mystery and suspense."
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
    id: "piTKgcLEGmPE4e6mEKli",
    name: "Nicole",
    description: "Whispering, young female voice with an American accent",
    category: 'premium',
    tags: ['storytelling', 'whispering', 'intimate'],
    previewText: "The shadows moved in ways that defied explanation."
  },
  {
    id: "5Q0t7uMcjvnagumLfvZi",
    name: "Paul",
    description: "Middle-aged male voice with an American accent, ground reporter style",
    category: 'premium',
    tags: ['storytelling', 'documentary', 'reporter'],
    previewText: "In the shadows of that old house, something waited for me."
  },
  // Indian accent voices
  {
    id: "h0A6a0TUzCiIJVF6gGpS",
    name: "Aditi",
    description: "Female voice with an Indian accent",
    category: 'premium',
    tags: ['indian', 'clear', 'storytelling'],
    previewText: "Let me tell you a story that has been passed down through generations in my family."
  },
  {
    id: "d3JMQzUUFmPQxDcbIu5h",
    name: "Raveena",
    description: "Female voice with an Indian accent",
    category: 'premium',
    tags: ['indian', 'warm', 'engaging'],
    previewText: "The ancient temple held secrets that no one had uncovered for centuries."
  },
  {
    id: "LcfcDJNUP1GQjBMG4kle",
    name: "Shreya",
    description: "Male voice with an Indian accent",
    category: 'premium',
    tags: ['indian', 'authoritative', 'clear'],
    previewText: "What happened that night changed my understanding of reality forever."
  },
  {
    id: "Xb0fHLKU84iR5WFasswZ",
    name: "Aveek",
    description: "Male voice with an Indian accent",
    category: 'premium',
    tags: ['indian', 'deep', 'professional'],
    previewText: "The wind carried whispers of forgotten stories through the valleys."
  },
  // African accent voice
  {
    id: "kgG9JrKzS4YmIIwqLpfi",
    name: "Ayandra",
    description: "Female voice with a South African accent",
    category: 'premium',
    tags: ['african', 'storytelling', 'warm'],
    previewText: "From across the savanna came a sound none of us had ever heard before."
  },
  // Standard voices
  // ... existing code ...
] 

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
  const [filterCategory, setFilterCategory] = useState<'all' | 'premium' | 'standard' | 'indian' | 'african'>('all');
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<{ [key: string]: HTMLAudioElement }>({});
  const [previewData, setPreviewData] = useState<{ [key: string]: string }>({});
  const [shortPreview, setShortPreview] = useState(true);
  // New states for script analysis
  const [scriptAnalysis, setScriptAnalysis] = useState<any>(null);
  const [analyzingScript, setAnalyzingScript] = useState(false);
  const [recommendedVoices, setRecommendedVoices] = useState<Voice[]>([]);
  
  // States for play/pause controls
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [previewPlayState, setPreviewPlayState] = useState<{ [key: string]: boolean }>({});
  
  // New states for audio player
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const progressBarRef = useRef<HTMLDivElement>(null);

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

  // Existing useEffect for cleanup...

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
          script,
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

  // Filter voices based on category selection
  const filteredVoices = filterCategory === 'all' 
    ? recommendedVoices.length > 0 && scriptAnalysis ? recommendedVoices : VOICES 
    : filterCategory === 'indian'
    ? VOICES.filter(voice => voice.tags && voice.tags.includes('indian'))
    : filterCategory === 'african'
    ? VOICES.filter(voice => voice.tags && voice.tags.includes('african'))
    : VOICES.filter(voice => voice.category === filterCategory);

  useEffect(() => {
    // Auto-generate with default voice if autoGenerate is true
    if (autoGenerate && !loading && !audioData && !error && selectedVoice) {
      generateVoiceover(selectedVoice);
    }
  }, [autoGenerate, selectedVoice]);

  // Existing event listener useEffect code...

  // Existing function implementations...

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">Generate Voiceover</h2>
        <p className="text-gray-400 mt-2">
          Choose a voice for your video narration
        </p>
        {scriptAnalysis && (
          <div className="mt-2 text-sm text-gray-300 bg-gray-800 p-3 rounded-lg inline-block">
            <p className="mb-1"><strong>Script Analysis:</strong> {scriptAnalysis.explanation}</p>
            <p className="mb-1"><strong>Narrator Gender:</strong> {scriptAnalysis.gender}</p>
            <p className="mb-1"><strong>Tone:</strong> {scriptAnalysis.tone.join(', ')}</p>
            {scriptAnalysis.accent && (
              <p><strong>Recommended Accent:</strong> {scriptAnalysis.accent}</p>
            )}
          </div>
        )}
        {recommendedVoices.length > 0 && (
          <div className="mt-2">
            <p className="text-green-400 text-sm">
              {recommendedVoices.length} recommended voices found based on script analysis
            </p>
          </div>
        )}
        <div className="flex justify-center mt-2">
          <button
            onClick={() => setShortPreview(!shortPreview)}
            className="text-xs px-3 py-1 bg-gray-700 text-gray-300 rounded-full hover:bg-gray-600 transition-colors"
          >
            {shortPreview ? "Using short previews" : "Using full previews"}
          </button>
        </div>
      </div>

      {loading ? (
        // ... loading state content
      ) : error ? (
        // ... error state content
      ) : (
        <>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
            <div className="mb-4 flex justify-center space-x-4">
              <button
                onClick={() => setFilterCategory('all')}
                className={`px-3 py-1 rounded-md ${filterCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
              >
                All Voices
              </button>
              <button
                onClick={() => setFilterCategory('premium')}
                className={`px-3 py-1 rounded-md ${filterCategory === 'premium' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
              >
                Premium
              </button>
              <button
                onClick={() => setFilterCategory('standard')}
                className={`px-3 py-1 rounded-md ${filterCategory === 'standard' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
              >
                Standard
              </button>
              <button
                onClick={() => setFilterCategory('indian')}
                className={`px-3 py-1 rounded-md ${filterCategory === 'indian' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
              >
                Indian
              </button>
              <button
                onClick={() => setFilterCategory('african')}
                className={`px-3 py-1 rounded-md ${filterCategory === 'african' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
              >
                African
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Voice cards will go here */}
            </div>
          </div>

          {/* Rest of the component... */}
        </>
      )}
    </div>
  );
};

export default VoiceoverGeneration; 