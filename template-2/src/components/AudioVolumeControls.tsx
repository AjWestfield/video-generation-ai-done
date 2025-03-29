import React from 'react';

interface AudioVolumeControlsProps {
  voiceVolume: number;
  soundEffectVolume: number;
  musicVolume: number;
  onVoiceVolumeChange: (value: number) => void;
  onSoundEffectVolumeChange: (value: number) => void;
  onMusicVolumeChange: (value: number) => void;
}

const AudioVolumeControls: React.FC<AudioVolumeControlsProps> = ({
  voiceVolume,
  soundEffectVolume,
  musicVolume,
  onVoiceVolumeChange,
  onSoundEffectVolumeChange,
  onMusicVolumeChange,
}) => {
  return (
    <div className="space-y-6 bg-gray-800/50 rounded-lg p-4 mb-4">
      <h3 className="text-lg font-medium text-white">Audio Balance</h3>
      
      <div className="space-y-4">
        <div>
          <div className="flex justify-between">
            <label htmlFor="voice-volume" className="text-white">
              Voiceover Volume: {Math.round(voiceVolume * 100)}%
            </label>
            <button 
              onClick={() => onVoiceVolumeChange(1.0)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Reset
            </button>
          </div>
          <input
            id="voice-volume"
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={voiceVolume}
            onChange={(e) => onVoiceVolumeChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Soft</span>
            <span>Balanced</span>
            <span>Loud</span>
          </div>
        </div>
        
        <div>
          <div className="flex justify-between">
            <label htmlFor="effect-volume" className="text-white">
              Sound Effects Volume: {Math.round(soundEffectVolume * 100)}%
            </label>
            <button 
              onClick={() => onSoundEffectVolumeChange(0.7)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Reset
            </button>
          </div>
          <input
            id="effect-volume"
            type="range"
            min="0"
            max="1.5"
            step="0.1"
            value={soundEffectVolume}
            onChange={(e) => onSoundEffectVolumeChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Off</span>
            <span>Balanced</span>
            <span>Prominent</span>
          </div>
        </div>
        
        <div>
          <div className="flex justify-between">
            <label htmlFor="music-volume" className="text-white">
              Background Music Volume: {Math.round(musicVolume * 100)}%
            </label>
            <button 
              onClick={() => onMusicVolumeChange(0.2)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Reset
            </button>
          </div>
          <input
            id="music-volume"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={musicVolume}
            onChange={(e) => onMusicVolumeChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Off</span>
            <span>Subtle</span>
            <span>Equal</span>
          </div>
        </div>
      </div>
      
      <div className="flex justify-between border-t border-gray-700 pt-3 text-sm">
        <button 
          onClick={() => {
            onVoiceVolumeChange(1.0);
            onSoundEffectVolumeChange(0.7);
            onMusicVolumeChange(0.2);
          }}
          className="text-blue-400 hover:text-blue-300"
        >
          Reset All
        </button>
        
        <div className="space-x-3">
          <button 
            onClick={() => {
              onVoiceVolumeChange(1.5);
              onSoundEffectVolumeChange(0.4);
              onMusicVolumeChange(0.15);
            }}
            className="text-green-400 hover:text-green-300"
          >
            Voice Focus
          </button>
          
          <button 
            onClick={() => {
              onVoiceVolumeChange(1.0);
              onSoundEffectVolumeChange(0.7);
              onMusicVolumeChange(0.2);
            }}
            className="text-blue-400 hover:text-blue-300"
          >
            Balanced
          </button>
          
          <button 
            onClick={() => {
              onVoiceVolumeChange(1.2);
              onSoundEffectVolumeChange(1.0);
              onMusicVolumeChange(0.4);
            }}
            className="text-purple-400 hover:text-purple-300"
          >
            Cinematic
          </button>
        </div>
      </div>
    </div>
  );
};

export default AudioVolumeControls; 