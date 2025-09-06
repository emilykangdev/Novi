import { useState, useEffect, useCallback } from 'react';
import { elevenLabsService } from '../services/elevenLabsService';

interface AudioPlaybackState {
  isPlaying: boolean;
  isLoaded: boolean;
  duration: number;
  position: number;
}

interface UseElevenLabsReturn {
  // State
  isGenerating: boolean;
  playbackState: AudioPlaybackState;
  isConfigured: boolean;
  error: string | null;
  
  // Actions
  generateAndPlay: (text: string, options?: any) => Promise<void>;
  generateAudio: (text: string, options?: any) => Promise<string | null>;
  playAudio: (audioUri: string) => Promise<void>;
  stopAudio: () => Promise<void>;
  pauseAudio: () => Promise<void>;
  resumeAudio: () => Promise<void>;
  clearError: () => void;
}

/**
 * React hook for using ElevenLabs text-to-speech functionality
 */
export function useElevenLabs(): UseElevenLabsReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [playbackState, setPlaybackState] = useState<AudioPlaybackState>({
    isPlaying: false,
    isLoaded: false,
    duration: 0,
    position: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [isConfigured] = useState(() => elevenLabsService.isConfigured());

  // Update playback state periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const currentState = elevenLabsService.getPlaybackState();
      setPlaybackState(currentState);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      elevenLabsService.cleanup();
    };
  }, []);

  const generateAndPlay = useCallback(async (text: string, options?: any) => {
    if (!isConfigured) {
      setError('ElevenLabs is not configured');
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);
      await elevenLabsService.generateAndPlayAudio(text, options);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate and play audio';
      setError(errorMessage);
      console.error('Generate and play error:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [isConfigured]);

  const generateAudio = useCallback(async (text: string, options?: any): Promise<string | null> => {
    if (!isConfigured) {
      setError('ElevenLabs is not configured');
      return null;
    }

    try {
      setIsGenerating(true);
      setError(null);
      const audioUri = await elevenLabsService.generateAudio(text, options);
      return audioUri;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate audio';
      setError(errorMessage);
      console.error('Generate audio error:', err);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [isConfigured]);

  const playAudio = useCallback(async (audioUri: string) => {
    try {
      setError(null);
      await elevenLabsService.playAudio(audioUri);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to play audio';
      setError(errorMessage);
      console.error('Play audio error:', err);
    }
  }, []);

  const stopAudio = useCallback(async () => {
    try {
      setError(null);
      await elevenLabsService.stopAudio();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop audio';
      setError(errorMessage);
      console.error('Stop audio error:', err);
    }
  }, []);

  const pauseAudio = useCallback(async () => {
    try {
      setError(null);
      await elevenLabsService.pauseAudio();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to pause audio';
      setError(errorMessage);
      console.error('Pause audio error:', err);
    }
  }, []);

  const resumeAudio = useCallback(async () => {
    try {
      setError(null);
      await elevenLabsService.resumeAudio();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resume audio';
      setError(errorMessage);
      console.error('Resume audio error:', err);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    isGenerating,
    playbackState,
    isConfigured,
    error,
    
    // Actions
    generateAndPlay,
    generateAudio,
    playAudio,
    stopAudio,
    pauseAudio,
    resumeAudio,
    clearError,
  };
}
