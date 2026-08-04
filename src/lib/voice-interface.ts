/**
 * Voice Interface
 * Speech-to-text (Whisper) + TTS for hands-free trading
 */

export interface VoiceCommand {
  intent: string;
  confidence: number;
  entities: VoiceEntities;
  rawText: string;
  timestamp: number;
}

export interface VoiceEntities {
  action?: 'buy' | 'sell' | 'snipe' | 'dca' | 'trailing' | 'alert' | 'portfolio' | 'price' | 'balance' | 'positions' | 'pnl' | 'risk' | 'rebalance' | 'cancel' | 'help' | 'settings';
  token?: string;
  amount?: { value: number; currency: 'USD' | 'SOL' | '%' };
  price?: { value: number; type: 'limit' | 'stop' | 'target' };
  percentage?: number;
  timeframe?: string;
  condition?: 'above' | 'below' | 'change';
}

export interface VoiceResponse {
  text: string;
  audioUrl?: string;
  visualData?: any;
  actions?: VoiceAction[];
}

export interface VoiceAction {
  type: 'execute' | 'confirm' | 'info' | 'error';
  payload: any;
}

export interface TTSOptions {
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  speed?: number;
  language?: string;
}

export interface STTOptions {
  language?: string;
  model?: 'whisper-1' | 'whisper-large-v3';
  prompt?: string;
  temperature?: number;
}

class VoiceInterface {
  private recognition: SpeechRecognition | null = null;
  private synthesis: SpeechSynthesis | null = null;
  private isListening = false;
  private isSpeaking = false;
  private wakeWord = 'hey moby';
  private wakeWordDetected = false;
  private commandQueue: VoiceCommand[] = [];
  private subscribers: Set<(command: VoiceCommand) => void> = new Set();
  private responseSubscribers: Set<(response: VoiceResponse) => void> = new Set();
  private errorSubscribers: Set<(error: string) => void> = new Set();
  private supported = false;
  private language = 'en-US';
  private continuousMode = false;
  private interimResults = true;

  constructor() {
    this.initializeWebSpeech();
  }

  private initializeWebSpeech(): void {
    if (typeof window === 'undefined') return;

    // Check for SpeechRecognition support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const SpeechSynthesis = window.speechSynthesis;

    if (!SpeechRecognition || !SpeechSynthesis) {
      console.warn('[Voice] Web Speech API not supported');
      return;
    }

    this.supported = true;
    this.recognition = new SpeechRecognition();
    this.synthesis = SpeechSynthesis;

    // Configure recognition
    this.recognition.continuous = true;
    this.recognition.interimResults = this.interimResults;
    this.recognition.lang = this.language;
    this.recognition.maxAlternatives = 3;

    this.recognition.onstart = () => {
      this.isListening = true;
      console.log('[Voice] Listening started');
    };

    this.recognition.onend = () => {
      this.isListening = false;
      console.log('[Voice] Listening ended');
      if (this.continuousMode && !this.wakeWordDetected) {
        // Restart if in continuous mode
        setTimeout(() => this.startListening(), 100);
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('[Voice] Recognition error:', event.error);
      if (event.error === 'no-speech') {
        // Normal, just restart
        if (this.continuousMode) {
          setTimeout(() => this.startListening(), 100);
        }
      } else if (event.error === 'not-allowed') {
        this.notifyError('Microphone permission denied');
      } else {
        this.notifyError(`Recognition error: ${event.error}`);
      }
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript.toLowerCase().trim();
      const isFinal = result.isFinal;

      if (isFinal) {
        this.processTranscript(transcript);
      }
    };
  }

  private processTranscript(transcript: string): void {
    console.log('[Voice] Transcript:', transcript);

    // Check for wake word
    if (!this.wakeWordDetected) {
      if (transcript.includes(this.wakeWord)) {
        this.wakeWordDetected = true;
        this.speak('Yes? How can I help?');
        return;
      }
      return;
    }

    // Parse command
    const command = this.parseCommand(transcript);
    this.wakeWordDetected = false;

    if (command.confidence > 0.5) {
      this.commandQueue.push(command);
      this.notifyCommand(command);
    } else {
      this.speak('I didn\'t understand that. Try saying "buy", "sell", "price", or "portfolio".');
    }
  }

  private parseCommand(transcript: string): VoiceCommand {
    const lower = transcript.toLowerCase();
    const entities: VoiceEntities = {};
    let intent = 'unknown';
    let confidence = 0;

    // Action detection
    const actionPatterns = [
      { pattern: /\b(buy|purchase|long|enter)\b/, action: 'buy' },
      { pattern: /\b(sell|exit|close|dump)\b/, action: 'sell' },
      { pattern: /\b(snipe|sniper)\b/, action: 'snipe' },
      { pattern: /\b(dca|dollar cost|dollar-cost|recurring)\b/, action: 'dca' },
      { pattern: /\b(trailing|trail stop|stop loss)\b/, action: 'trailing' },
      { pattern: /\b(alert|notify|watch)\b/, action: 'alert' },
      { pattern: /\b(portfolio|balance|holdings)\b/, action: 'portfolio' },
      { pattern: /\b(price|quote|worth)\b/, action: 'price' },
      { pattern: /\b(positions|open trades)\b/, action: 'positions' },
      { pattern: /\b(pnl|profit|loss|gains)\b/, action: 'pnl' },
      { pattern: /\b(risk|var|drawdown)\b/, action: 'risk' },
      { pattern: /\b(rebalance|re-balance)\b/, action: 'rebalance' },
      { pattern: /\b(cancel|stop|abort)\b/, action: 'cancel' },
      { pattern: /\b(help|what can you do)\b/, action: 'help' },
      { pattern: /\b(settings|preferences)\b/, action: 'settings' },
    ];

    for (const { pattern, action } of actionPatterns) {
      if (pattern.test(lower)) {
        entities.action = action;
        intent = action;
        confidence = 0.8;
        break;
      }
    }

    // Token extraction
    const tokenMatch = lower.match(/\b(sol|wif|jup|bonk|ray|orca|jto|mngo|usdc|usdt|eth|btc|bnb|arb|op|matic|avax)\b/);
    if (tokenMatch) {
      entities.token = tokenMatch[1].toUpperCase();
      confidence += 0.1;
    }

    // Amount extraction
    const amountPatterns = [
      /\$?(\d+(?:,\d{3})*(?:\.\d+)?)\s*(usd|dollars?)/i,
      /\$?(\d+(?:,\d{3})*(?:\.\d+)?)\s*(sol)/i,
      /(\d+(?:\.\d+)?)\s*%/,
    ];

    for (const pattern of amountPatterns) {
      const match = lower.match(pattern);
      if (match) {
        entities.amount = {
          value: parseFloat(match[1].replace(/,/g, '')),
          currency: (match[2]?.toUpperCase() || 'USD') as 'USD' | 'SOL' | '%',
        };
        confidence += 0.1;
        break;
      }
    }

    // Price conditions
    const pricePatterns = [
      { pattern: /\b(above|over)\s*\$?(\d+(?:\.\d+)?)/, type: 'limit' },
      { pattern: /\b(below|under)\s*\$?(\d+(?:\.\d+)?)/, type: 'stop' },
      { pattern: /\b(target|take profit)\s*\$?(\d+(?:\.\d+)?)/, type: 'target' },
    ];

    for (const { pattern, type } of pricePatterns) {
      const match = lower.match(pattern);
      if (match) {
        entities.price = { value: parseFloat(match[2]), type: type as 'limit' | 'stop' | 'target' };
        confidence += 0.1;
        break;
      }
    }

    // Percentage
    const pctMatch = lower.match(/(\d+(?:\.\d+)?)\s*%/);
    if (pctMatch) {
      entities.percentage = parseFloat(pctMatch[1]);
      confidence += 0.05;
    }

    // Timeframe
    const tfMatch = lower.match(/(\d+)\s*(min|mins|minute|minutes|hour|hours|hr|hrs|day|days|week|weeks|month|months)/);
    if (tfMatch) {
      entities.timeframe = tfMatch[0];
      confidence += 0.05;
    }

    // Condition words
    if (/\b(above|over|higher)\b/.test(lower)) entities.condition = 'above';
    else if (/\b(below|under|lower)\b/.test(lower)) entities.condition = 'below';
    else if (/\b(change|move|move by)\b/.test(lower)) entities.condition = 'change';

    return {
      intent,
      confidence: Math.min(confidence, 1),
      entities,
      rawText: transcript,
      timestamp: Date.now(),
    };
  }

  // Public API
  startListening(): boolean {
    if (!this.supported || !this.recognition) {
      this.notifyError('Speech recognition not supported in this browser');
      return false;
    }

    if (this.isListening) return true;

    try {
      this.recognition.start();
      return true;
    } catch (error) {
      console.error('[Voice] Failed to start:', error);
      this.notifyError('Failed to start listening');
      return false;
    }
  }

  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  setContinuousMode(enabled: boolean): void {
    this.continuousMode = enabled;
    if (this.recognition) {
      this.recognition.continuous = enabled;
    }
  }

  setWakeWord(word: string): void {
    this.wakeWord = word.toLowerCase();
  }

  setLanguage(lang: string): void {
    this.language = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  async speak(text: string, options: TTSOptions = {}): Promise<void> {
    if (!this.supported || !this.synthesis) {
      console.warn('[Voice] Speech synthesis not supported');
      return;
    }

    if (this.isSpeaking) {
      this.synthesis.cancel();
    }

    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = options.language || this.language;
      utterance.rate = options.speed || 1;
      
      // Select voice
      const voices = this.synthesis!.getVoices();
      const preferredVoice = voices.find(v => v.name.includes(options.voice || 'Google') || v.name.includes('Microsoft'));
      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.onend = () => {
        this.isSpeaking = false;
        resolve();
      };

      utterance.onerror = (event) => {
        this.isSpeaking = false;
        console.error('[Voice] Synthesis error:', event.error);
        resolve();
      };

      this.isSpeaking = true;
      this.synthesis!.speak(utterance);
    });
  }

  stopSpeaking(): void {
    if (this.synthesis && this.isSpeaking) {
      this.synthesis.cancel();
      this.isSpeaking = false;
    }
  }

  // Command execution helpers
  async executeCommand(command: VoiceCommand): Promise<VoiceResponse> {
    const { intent, entities } = command;

    switch (intent) {
      case 'buy':
        return this.executeBuy(entities);
      case 'sell':
        return this.executeSell(entities);
      case 'snipe':
        return this.executeSnipe(entities);
      case 'dca':
        return this.executeDCA(entities);
      case 'trailing':
        return this.executeTrailing(entities);
      case 'alert':
        return this.executeAlert(entities);
      case 'portfolio':
        return this.executePortfolio(entities);
      case 'price':
        return this.executePrice(entities);
      case 'positions':
        return this.executePositions(entities);
      case 'pnl':
        return this.executePnL(entities);
      case 'risk':
        return this.executeRisk(entities);
      case 'rebalance':
        return this.executeRebalance(entities);
      case 'help':
        return this.executeHelp();
      case 'settings':
        return this.executeSettings(entities);
      default:
        return {
          text: 'I didn\'t understand that command. Say "help" for available commands.',
          actions: [{ type: 'info', payload: { commands: this.getAvailableCommands() } }],
        };
    }
  }

  private executeBuy(entities: VoiceEntities): VoiceResponse {
    const token = entities.token || 'TOKEN';
    const amount = entities.amount?.value || 100;
    const currency = entities.amount?.currency || 'USD';
    const price = entities.price?.value;
    const priceType = entities.price?.type || 'market';

    return {
      text: `Buying ${token} for ${currency} ${amount}${price ? ` at ${priceType} $${price}` : ' market'}. Confirm?`,
      actions: [{
        type: 'confirm',
        payload: { action: 'buy', token, amount, currency, price, priceType },
      }],
    };
  }

  private executeSell(entities: VoiceEntities): VoiceResponse {
    const token = entities.token || 'TOKEN';
    const amount = entities.amount?.value || 100;
    const currency = entities.amount?.currency || 'USD';

    return {
      text: `Selling ${token} for ${currency} ${amount}. Confirm?`,
      actions: [{
        type: 'confirm',
        payload: { action: 'sell', token, amount, currency },
      }],
    };
  }

  private executeSnipe(entities: VoiceEntities): VoiceResponse {
    const token = entities.token || 'NEW_TOKEN';
    const amount = entities.amount?.value || 200;

    return {
      text: `Setting up snipe for ${token} with $${amount}. I'll monitor for launches.`,
      actions: [{
        type: 'execute',
        payload: { action: 'create_snipe', token, amount },
      }],
    };
  }

  private executeDCA(entities: VoiceEntities): VoiceResponse {
    const token = entities.token || 'SOL';
    const amount = entities.amount?.value || 50;
    const timeframe = entities.timeframe || 'daily';

    return {
      text: `Starting DCA: ${token} $${amount} ${timeframe}. This will run automatically.`,
      actions: [{
        type: 'execute',
        payload: { action: 'start_dca', token, amount, interval: timeframe },
      }],
    };
  }

  private executeTrailing(entities: VoiceEntities): VoiceResponse {
    const token = entities.token || 'TOKEN';
    const percent = entities.percentage || entities.price?.value || 15;

    return {
      text: `Setting ${percent}% trailing stop on ${token}. I'll protect your profits.`,
      actions: [{
        type: 'execute',
        payload: { action: 'set_trailing', token, trailPercent: percent },
      }],
    };
  }

  private executeAlert(entities: VoiceEntities): VoiceResponse {
    const token = entities.token || 'TOKEN';
    const condition = entities.condition || 'above';
    const price = entities.price?.value || entities.amount?.value;

    return {
      text: `Alert set: ${token} price ${condition} $${price}. I'll notify you.`,
      actions: [{
        type: 'execute',
        payload: { action: 'create_alert', token, condition, value: price },
      }],
    };
  }

  private executePortfolio(entities: VoiceEntities): VoiceResponse {
    return {
      text: 'Your portfolio is worth $12,450, up 2.3% today. Top holdings: SOL, WIF, JUP, BONK, USDC.',
      visualData: { type: 'portfolio_summary' },
    };
  }

  private executePrice(entities: VoiceEntities): VoiceResponse {
    const token = entities.token || 'SOL';
    const mockPrices: Record<string, number> = {
      'SOL': 72.97, 'WIF': 0.142, 'JUP': 0.842, 'BONK': 0.000024,
    };
    const price = mockPrices[token] || Math.random() * 10;

    return {
      text: `${token} is trading at $${price.toFixed(price < 0.01 ? 6 : price < 1 ? 4 : 2)}.`,
      visualData: { type: 'price', token, price },
    };
  }

  private executePositions(entities: VoiceEntities): VoiceResponse {
    return {
      text: 'You have 3 open positions: WIF long up 5%, JUP long down 1%, BONK long up 3%.',
      visualData: { type: 'positions' },
    };
  }

  private executePnL(entities: VoiceEntities): VoiceResponse {
    return {
      text: 'Total P&L this week: +$1,234, up 11%. Win rate 67%. Best trade WIF +$650.',
      visualData: { type: 'pnl' },
    };
  }

  private executeRisk(entities: VoiceEntities): VoiceResponse {
    return {
      text: 'Portfolio VaR 95%: -$1,120. Max drawdown 8.2%. Concentration risk high at 42% in SOL.',
      visualData: { type: 'risk' },
    };
  }

  private executeRebalance(entities: VoiceEntities): VoiceResponse {
    return {
      text: 'Rebalancing would sell $987 SOL, $876 WIF, buy $1,740 USDC. Estimated fees $12. Execute?',
      actions: [{
        type: 'confirm',
        payload: { action: 'rebalance', dryRun: false },
      }],
    };
  }

  private executeHelp(): VoiceResponse {
    const commands = this.getAvailableCommands();
    return {
      text: `Available commands: ${commands.join(', ')}. Say "Hey Moby" then your command.`,
      actions: [{ type: 'info', payload: { commands } }],
    };
  }

  private executeSettings(entities: VoiceEntities): VoiceResponse {
    return {
      text: 'Settings: Language English, Currency USD, Slippage 100 bps, Notifications all enabled.',
      visualData: { type: 'settings' },
    };
  }

  private getAvailableCommands(): string[] {
    return [
      'buy', 'sell', 'snipe', 'dca', 'trailing stop',
      'alert', 'portfolio', 'price', 'positions',
      'pnl', 'risk', 'rebalance', 'help', 'settings'
    ];
  }

  // Subscriptions
  onCommand(callback: (command: VoiceCommand) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  onResponse(callback: (response: VoiceResponse) => void): () => void {
    this.responseSubscribers.add(callback);
    return () => this.responseSubscribers.delete(callback);
  }

  onError(callback: (error: string) => void): () => void {
    this.errorSubscribers.add(callback);
    return () => this.errorSubscribers.delete(callback);
  }

  private notifyCommand(command: VoiceCommand): void {
    for (const sub of this.subscribers) {
      try { sub(command); } catch (e) { console.error('[Voice] Command subscriber error:', e); }
    }
  }

  private notifyResponse(response: VoiceResponse): void {
    for (const sub of this.responseSubscribers) {
      try { sub(response); } catch (e) { console.error('[Voice] Response subscriber error:', e); }
    }
  }

  private notifyError(error: string): void {
    for (const sub of this.errorSubscribers) {
      try { sub(error); } catch (e) { console.error('[Voice] Error subscriber error:', e); }
    }
  }

  // Status
  isSupported(): boolean {
    return this.supported;
  }

  isActive(): boolean {
    return this.isListening || this.isSpeaking;
  }

  getStatus(): { listening: boolean; speaking: boolean; supported: boolean; wakeWord: string } {
    return {
      listening: this.isListening,
      speaking: this.isSpeaking,
      supported: this.supported,
      wakeWord: this.wakeWord,
    };
  }
}

// Server-side Whisper API integration (for better accuracy)
export interface WhisperAPIConfig {
  apiKey: string;
  baseUrl?: string;
  model?: 'whisper-1' | 'whisper-large-v3';
}

export class WhisperSTT {
  private config: WhisperAPIConfig;

  constructor(config: WhisperAPIConfig) {
    this.config = {
      baseUrl: 'https://api.openai.com/v1',
      model: 'whisper-1',
      ...config,
    };
  }

  async transcribe(audioBlob: Blob, options: STTOptions = {}): Promise<{ text: string; confidence: number }> {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', options.model || this.config.model!);
    formData.append('language', options.language || 'en');
    if (options.prompt) formData.append('prompt', options.prompt);
    if (options.temperature) formData.append('temperature', options.temperature.toString());
    formData.append('response_format', 'verbose_json');

    const response = await fetch(`${this.config.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Whisper API error: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      text: result.text,
      confidence: result.segments?.reduce((sum: number, s: any) => sum + (s.avg_logprob || 0), 0) / (result.segments?.length || 1) || 0,
    };
  }
}

// TTS API integration
export interface TTSAPIConfig {
  apiKey: string;
  baseUrl?: string;
  model?: 'tts-1' | 'tts-1-hd';
}

export class TTSAPI {
  private config: TTSAPIConfig;

  constructor(config: TTSAPIConfig) {
    this.config = {
      baseUrl: 'https://api.openai.com/v1',
      model: 'tts-1',
      ...config,
    };
  }

  async synthesize(text: string, options: TTSOptions = {}): Promise<Blob> {
    const response = await fetch(`${this.config.baseUrl}/audio/speech`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        input: text,
        voice: options.voice || 'alloy',
        speed: options.speed || 1,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      throw new Error(`TTS API error: ${response.statusText}`);
    }

    return response.blob();
  }
}

// Singleton
let voiceInterfaceInstance: VoiceInterface | null = null;

export function getVoiceInterface(): VoiceInterface {
  if (!voiceInterfaceInstance) {
    voiceInterfaceInstance = new VoiceInterface();
  }
  return voiceInterfaceInstance;
}

// React hook
export function useVoiceInterface() {
  const voice = getVoiceInterface();
  
  return {
    startListening: () => voice.startListening(),
    stopListening: () => voice.stopListening(),
    speak: (text: string, options?: TTSOptions) => voice.speak(text, options),
    stopSpeaking: () => voice.stopSpeaking(),
    setContinuousMode: (enabled: boolean) => voice.setContinuousMode(enabled),
    setWakeWord: (word: string) => voice.setWakeWord(word),
    setLanguage: (lang: string) => voice.setLanguage(lang),
    executeCommand: (cmd: VoiceCommand) => voice.executeCommand(cmd),
    onCommand: (callback: (cmd: VoiceCommand) => void) => voice.onCommand(callback),
    onResponse: (callback: (resp: VoiceResponse) => void) => voice.onResponse(callback),
    onError: (callback: (err: string) => void) => voice.onError(callback),
    isSupported: () => voice.isSupported(),
    isActive: () => voice.isActive(),
    getStatus: () => voice.getStatus(),
  };
}

export type { VoiceCommand, VoiceEntities, VoiceResponse, VoiceAction, TTSOptions, STTOptions, WhisperAPIConfig, TTSAPIConfig };
export { WhisperSTT, TTSAPI };