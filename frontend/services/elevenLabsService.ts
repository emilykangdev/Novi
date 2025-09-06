import { ElevenLabsApi, ElevenLabsApiConfig } from '@elevenlabs/client';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

/**
 * ElevenLabs Service for React Native Frontend
 * 
 * Handles text-to-speech generation and audio playback in the mobile app.
 * Uses @elevenlabs/client for API integration and Expo AV for playback.
 */

interface AudioGenerationOptions {
  voiceId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

interface AudioPlaybackState {
  isPlaying: boolean;
  isLoaded: boolean;
  duration: number;
  position: number;
}

class ElevenLabsService {
  private client: ElevenLabsApi | null = null;
  private defaultVoiceId = 'pNInz6obpgDQGcFmaJgB'; // Default voice
  private currentSound: Audio.Sound | null = null;
  private playbackState: AudioPlaybackState = {
    isPlaying: false,
    isLoaded: false,
    duration: 0,
    position: 0,
  };

  constructor() {
    this.initialize();
  }

  private initialize() {
    const apiKey = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY;
    
    if (apiKey) {
      const config: ElevenLabsApiConfig = {
        apiKey: apiKey,
      };
      this.client = new ElevenLabsApi(config);
    }
  }

  /**
   * Check if ElevenLabs is configured
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Generate audio from text
   */
  async generateAudio(
    text: string, 
    options: AudioGenerationOptions = {}
  ): Promise<string | null> {
    if (!this.client) {
      console.warn('ElevenLabs not configured');
      return null;
    }

    try {
      const voiceId = options.voiceId || this.defaultVoiceId;
      
      const audioStream = await this.client.textToSpeech.convert(voiceId, {
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: options.stability ?? 0.5,
          similarity_boost: options.similarityBoost ?? 0.5,
          style: options.style ?? 0.0,
          use_speaker_boost: options.useSpeakerBoost ?? true,
        },
      });

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      const reader = audioStream.getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      // Combine chunks into single buffer
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const audioBuffer = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of chunks) {
        audioBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      // Save to temporary file
      const fileName = `audio_${Date.now()}.mp3`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      
      // Convert buffer to base64 for file system
      const base64Audio = this.arrayBufferToBase64(audioBuffer);
      await FileSystem.writeAsStringAsync(fileUri, base64Audio, {
        encoding: FileSystem.EncodingType.Base64,
      });

      return fileUri;

    } catch (error) {
      console.error('ElevenLabs audio generation error:', error);
      return null;
    }
  }

  /**
   * Play audio from URI
   */
  async playAudio(audioUri: string): Promise<void> {
    try {
      // Stop current audio if playing
      await this.stopAudio();

      // Load and play new audio
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true }
      );

      this.currentSound = sound;
      this.playbackState.isLoaded = true;
      this.playbackState.isPlaying = true;

      // Set up playback status updates
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          this.playbackState.duration = status.durationMillis || 0;
          this.playbackState.position = status.positionMillis || 0;
          this.playbackState.isPlaying = status.isPlaying || false;
        }
      });

    } catch (error) {
      console.error('Audio playback error:', error);
      throw new Error('Failed to play audio');
    }
  }

  /**
   * Stop current audio playback
   */
  async stopAudio(): Promise<void> {
    if (this.currentSound) {
      try {
        await this.currentSound.stopAsync();
        await this.currentSound.unloadAsync();
        this.currentSound = null;
        this.playbackState = {
          isPlaying: false,
          isLoaded: false,
          duration: 0,
          position: 0,
        };
      } catch (error) {
        console.error('Error stopping audio:', error);
      }
    }
  }

  /**
   * Pause current audio playback
   */
  async pauseAudio(): Promise<void> {
    if (this.currentSound && this.playbackState.isPlaying) {
      try {
        await this.currentSound.pauseAsync();
        this.playbackState.isPlaying = false;
      } catch (error) {
        console.error('Error pausing audio:', error);
      }
    }
  }

  /**
   * Resume audio playback
   */
  async resumeAudio(): Promise<void> {
    if (this.currentSound && !this.playbackState.isPlaying) {
      try {
        await this.currentSound.playAsync();
        this.playbackState.isPlaying = true;
      } catch (error) {
        console.error('Error resuming audio:', error);
      }
    }
  }

  /**
   * Get current playback state
   */
  getPlaybackState(): AudioPlaybackState {
    return { ...this.playbackState };
  }

  /**
   * Generate and play audio in one call
   */
  async generateAndPlayAudio(
    text: string, 
    options: AudioGenerationOptions = {}
  ): Promise<void> {
    const audioUri = await this.generateAudio(text, options);
    if (audioUri) {
      await this.playAudio(audioUri);
    } else {
      throw new Error('Failed to generate audio');
    }
  }

  /**
   * Get available voices
   */
  async getVoices(): Promise<any[]> {
    if (!this.client) {
      return [];
    }

    try {
      const voices = await this.client.voices.getAll();
      return voices.voices || [];
    } catch (error) {
      console.error('Failed to fetch voices:', error);
      return [];
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await this.stopAudio();
    
    // Clean up temporary audio files
    try {
      const documentDir = FileSystem.documentDirectory;
      if (documentDir) {
        const files = await FileSystem.readDirectoryAsync(documentDir);
        const audioFiles = files.filter(file => file.startsWith('audio_') && file.endsWith('.mp3'));
        
        for (const file of audioFiles) {
          await FileSystem.deleteAsync(`${documentDir}${file}`, { idempotent: true });
        }
      }
    } catch (error) {
      console.error('Error cleaning up audio files:', error);
    }
  }

  /**
   * Convert ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    
    return btoa(binary);
  }
}

export const elevenLabsService = new ElevenLabsService();
