import axios from 'axios';
import type { AudioRequest, AudioResponse } from '../shared/types';

/**
 * ElevenLabs Text-to-Speech Service
 * 
 * Provides audio generation capabilities for Novi's voice responses.
 * Integrates with ElevenLabs API for high-quality speech synthesis.
 */

class ElevenLabsService {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';
  private defaultVoiceId: string;

  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY || '';
    this.defaultVoiceId = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'; // Default voice
  }

  /**
   * Check if ElevenLabs is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Generate audio from text
   */
  async generateAudio(request: AudioRequest): Promise<AudioResponse> {
    if (!this.isConfigured()) {
      throw new Error('ElevenLabs API key not configured');
    }

    try {
      const voiceId = request.voiceId || this.defaultVoiceId;
      
      const response = await axios.post(
        `${this.baseUrl}/text-to-speech/${voiceId}`,
        {
          text: request.text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
            style: 0.0,
            use_speaker_boost: true,
            ...request.options
          }
        },
        {
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey
          },
          responseType: 'arraybuffer'
        }
      );

      // Convert audio buffer to base64 for storage/transmission
      const audioBuffer = Buffer.from(response.data);
      const audioBase64 = audioBuffer.toString('base64');
      
      // In a real implementation, you'd upload this to a storage service
      // and return the URL. For now, we'll return a data URL.
      const audioUrl = `data:audio/mpeg;base64,${audioBase64}`;

      return {
        audioUrl: audioUrl,
        duration: this.estimateAudioDuration(request.text),
        format: 'mp3'
      };

    } catch (error) {
      console.error('ElevenLabs API error:', error);
      
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.detail?.message || error.message;
        
        if (status === 401) {
          throw new Error('Invalid ElevenLabs API key');
        } else if (status === 429) {
          throw new Error('ElevenLabs rate limit exceeded');
        } else if (status === 422) {
          throw new Error(`Invalid request: ${message}`);
        }
      }
      
      throw new Error('Failed to generate audio');
    }
  }

  /**
   * Get available voices
   */
  async getVoices(): Promise<any[]> {
    if (!this.isConfigured()) {
      throw new Error('ElevenLabs API key not configured');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey
        }
      });

      return response.data.voices;
    } catch (error) {
      console.error('Failed to fetch voices:', error);
      throw new Error('Failed to fetch available voices');
    }
  }

  /**
   * Get user subscription info
   */
  async getSubscriptionInfo(): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('ElevenLabs API key not configured');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/user/subscription`, {
        headers: {
          'xi-api-key': this.apiKey
        }
      });

      return response.data;
    } catch (error) {
      console.error('Failed to fetch subscription info:', error);
      throw new Error('Failed to fetch subscription information');
    }
  }

  /**
   * Estimate audio duration based on text length
   * Rough estimate: ~150 words per minute, ~5 characters per word
   */
  private estimateAudioDuration(text: string): number {
    const wordsPerMinute = 150;
    const charactersPerWord = 5;
    const estimatedWords = text.length / charactersPerWord;
    const durationMinutes = estimatedWords / wordsPerMinute;
    return Math.max(durationMinutes * 60, 1); // At least 1 second
  }

  /**
   * Validate voice ID
   */
  async validateVoiceId(voiceId: string): Promise<boolean> {
    try {
      const voices = await this.getVoices();
      return voices.some(voice => voice.voice_id === voiceId);
    } catch (error) {
      console.error('Voice validation error:', error);
      return false;
    }
  }
}

export const elevenLabsService = new ElevenLabsService();
