/**
 * Twitter/X Monitor
 * Simulates monitoring Twitter for crypto-related tweets, sentiment, and alerts.
 * In a production app, this would integrate with Twitter API v2 or a third-party service.
 */

export interface Tweet {
  id: string;
  text: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatar?: string;
  createdAt: number; // timestamp
  likes: number;
  retweets: number;
  replies: number;
  mentions: string[]; // cashtags like $SOL, $BTC
  hashtags: string[];
  url: string;
}

export interface TwitterMention {
  tweet: Tweet;
  sentiment: 'positive' | 'negative' | 'neutral';
  relevanceScore: number; // 0-100
  matchedKeywords: string[];
}

export interface TwitterAlert {
  id: string;
  keyword: string; // e.g., '$SOL' or 'Solana'
  trigger: 'mention' | 'sentiment' | 'volume';
  threshold: number; // for sentiment: -1 to 1, for volume: count per hour
  channels: ('push' | 'email' | 'telegram' | 'discord')[];
  active: boolean;
  lastTriggered?: number;
}

class TwitterMonitor {
  private readonly BEARER_TOKEN = import.meta.env.VITE_TWITTER_BEARER_TOKEN ?? 'demo-token';
  private readonly BASE_URL = 'https://api.twitter.com/2';
  
  // In-memory cache for demo
  private tweetCache: Tweet[] = [];
  private mentionsCache: TwitterMention[] = [];
  private alerts: TwitterAlert[] = [];
  
  // Followed crypto accounts (demo)
  private readonly followedAccounts = [
    'aeyakovenko', // Anatoly Yakovenko
    'SBF_FTX', // SBF (example)
    'VitalikButerin',
    'cz_binance',
    'BrianArmstrong',
    'sbftx',
    'gusdavis',
    'tai_zen',
    'AltcoinSherpa',
    'CryptoCred',
    'TheCryptoLark',
    'IvanOnTech',
    'CryptoCred',
    'rektguy',
    'Cobie',
    'BloombergCrypto',
    'coinDesk',
    'TheBlock__',
  ];

  constructor() {
    // In a real app, we would set up streaming API or periodic polling
    // For demo, we'll generate mock data
    this.generateMockData();
    
    // Refresh mock data every 30 seconds
    setInterval(() => this.generateMockData(), 30_000);
  }

  /**
   * Generate mock tweet data for demonstration
   */
  private generateMockData(): void {
    const now = Date.now();
    const tokens = ['SOL', 'BTC', 'ETH', 'WIF', 'BONK', 'JUP', 'IO', 'MNGO', 'RAY'];
    const adjectives = ['bullish', 'bearish', 'pumping', 'dumping', 'mooning', 'crashing', 'accumulating', 'distributing'];
    const actions = ['bought', 'sold', 'holding', 'long', 'short', 'accumulating', 'distributing'];
    
    const newTweets: Tweet[] = [];
    
    // Generate 5-15 new tweets
    const tweetCount = Math.floor(Math.random() * 11) + 5;
    for (let i = 0; i < tweetCount; i++) {
      const authorIdx = Math.floor(Math.random() * this.followedAccounts.length);
      const author = this.followedAccounts[authorIdx];
      const token = tokens[Math.floor(Math.random() * tokens.length)];
      
      const isPositive = Math.random() > 0.4;
      const sentimentWord = isPositive ? adjectives[Math.floor(Math.random() * 4)] : adjectives[Math.floor(Math.random() * 4) + 4];
      const action = actions[Math.floor(Math.random() * actions.length)];
      
      const text = `@${author} Just ${action} $${token}! Feeling ${sentimentWord} about it. #crypto #${token.toLowerCase()}`;
      
      const tweet: Tweet = {
        id: `tweet_${now}_${i}`,
        text,
        authorUsername: author,
        authorDisplayName: this.getDisplayName(author),
        authorAvatar: `https://ui-avatars.com/api/?name=${author}&background=random`,
        createdAt: now - Math.floor(Math.random() * 300_000), // last 5 minutes
        likes: Math.floor(Math.random() * 1000),
        retweets: Math.floor(Math.random() * 200),
        replies: Math.floor(Math.random() * 50),
        mentions: [`$${token}`],
        hashtags: [`${token.toLowerCase()}`, 'crypto', 'bitcoin'], // simplified
        url: `https://twitter.com/${author}/status/tweet_${now}_${i}`,
      };
      
      newTweets.push(tweet);
    }
    
    // Update cache (keep last 100)
    this.tweetCache = [...newTweets, ...this.tweetCache].slice(0, 100);
    
    // Recalculate mentions
    this.updateMentions();
  }

  private getDisplayName(username: string): string {
    const map: Record<string, string> = {
      'aeyakovenko': 'Anatoly Yakovenko',
      'SBF_FTX': 'Sam Bankman-Fried',
      'VitalikButerin': 'Vitalik Buterin',
      'cz_binance': 'Changpeng Zhao',
      'BrianArmstrong': 'Brian Armstrong',
      'sbftx': 'SBF (alt)',
      'gusdavis': 'Gus Davis',
      'tai_zen': 'Tai Zen',
      'AltcoinSherpa': 'Altcoin Sherpa',
      'CryptoCred': 'Crypto Cred',
      'TheCryptoLark': 'The Crypto Lark',
      'IvanOnTech': 'Ivan on Tech',
      'CryptoCred': 'Crypto Cred (dup)',
      'rektguy': 'Rekt Guy',
      'Cobie': 'Cobie',
      'BloombergCrypto': 'Bloomberg Crypto',
      'coinDesk': 'CoinDesk',
      'TheBlock__': 'The Block',
    };
    return map[username] || username;
  }

  /**
   * Update mentions based on cached tweets and keywords
   */
  private updateMentions(): void {
    // For demo, we'll just check for cashtags
    const mentions: TwitterMention[] = [];
    
    for (const tweet of this.tweetCache) {
      const dollarSignMatches = [...tweet.text.matchAll(/\$[A-Z]{2,10}/g)].map(m => m[0]);
      if (dollarSignMatches.length === 0) continue;
      
      // Simple sentiment: count positive/negative words
      const positiveWords = ['bullish', 'buy', 'long', 'moon', 'pump', 'gain', 'profit', 'up'];
      const negativeWords = ['bearish', 'sell', 'short', 'dump', 'crash', 'loss', 'down', 'risk'];
      
      const lowerText = tweet.text.toLowerCase();
      let score = 0;
      positiveWords.forEach(w => { if (lowerText.includes(w)) score++; });
      negativeWords.forEach(w => { if (lowerText.includes(w)) score--; });
      
      let sentiment: 'positive' | 'negative' | 'neutral';
      if (score > 0) sentiment = 'positive';
      else if (score < 0) sentiment = 'negative';
      else sentiment = 'neutral';
      
      const relevanceScore = Math.min(100, Math.abs(score) * 20 + 50); // 0-100
      
      mentions.push({
        tweet,
        sentiment,
        relevanceScore,
        matchedKeywords: dollarSignMatches,
      });
    }
    
    this.mentionsCache = mentions;
    
    // Check alerts
    this.checkAlerts();
  }

  /**
   * Check if any alerts should be triggered
   */
  private checkAlerts(): void {
    const now = Date.now();
    
    for (const alert of this.alerts) {
      if (!alert.active) continue;
      
      // Cool down: don't trigger same alert more than once per hour
      if (alert.lastTriggered && now - alert.lastTriggered < 3_600_000) {
        continue;
      }
      
      let triggered = false;
      
      switch (alert.trigger) {
        case 'mention':
          // Check if any mention contains the keyword
          triggered = this.mentionsCache.some(m => 
            m.matchedKeywords.some(k => k.toUpperCase() === alert.keyword.toUpperCase())
          );
          break;
        case 'sentiment':
          // Average sentiment for keyword
          const relevantMentions = this.mentionsCache.filter(m => 
            m.matchedKeywords.some(k => k.toUpperCase() === alert.keyword.toUpperCase())
          );
          if (relevantMentions.length > 0) {
            const avgSentiment = relevantMentions.reduce((sum, m) => {
              return sum + (m.sentiment === 'positive' ? 1 : m.sentiment === 'negative' ? -1 : 0);
            }, 0) / relevantMentions.length;
            // threshold is between -1 and 1
            triggered = alert.threshold > 0 ? avgSentiment > alert.threshold : avgSentiment < alert.threshold;
          }
          break;
        case 'volume':
          // Count mentions in last hour
          const recentMentions = this.mentionsCache.filter(m => 
            m.matchedKeywords.some(k => k.toUpperCase() === alert.keyword.toUpperCase()) &&
            m.tweet.createdAt > now - 3_600_000
          );
          triggered = recentMentions.length >= alert.threshold;
          break;
      }
      
      if (triggered) {
        alert.lastTriggered = now;
        this.triggerAlert(alert);
      }
    }
  }

  /**
   * Trigger an alert (in real app, send notification)
   */
  private triggerAlert(alert: TwitterAlert): void {
    console.log('[Twitter Alert] Triggered:', alert);
    // In a real app, we would use the notification system from moby-store
    // For now, just log
    
    // TODO: Integrate with Moby's alert system
    // This would require access to the zustand store
  }

  /**
   * Get recent tweets (optionally filtered)
   */
  getRecentTweets(options: {
    limit?: number;
    since?: number; // timestamp
    usernames?: string[];
    keywords?: string[];
  } = {}): Tweet[] {
    let result = [...this.tweetCache];
    
    if (options.since) {
      result = result.filter(t => t.createdAt >= options.since);
    }
    if (options.usernames && options.usernames.length > 0) {
      const lowerUsernames = options.usernames.map(u => u.toLowerCase().replace(/^@/, ''));
      result = result.filter(t => lowerUsernames.includes(t.authorUsername.toLowerCase()));
    }
    if (options.keywords && options.keywords.length > 0) {
      const lowerKeywords = options.keywords.map(k => k.toLowerCase());
      result = result.filter(t => 
        lowerKeywords.some(k => t.text.toLowerCase().includes(k))
      );
    }
    
    // Sort by newest first
    result.sort((a, b) => b.createdAt - a.createdAt);
    
    if (options.limit) {
      return result.slice(0, options.limit);
    }
    return result;
  }

  /**
   * Get mentions for a specific keyword
   */
  getMentionsForKeyword(keyword: string): TwitterMention[] {
    const upper = keyword.toUpperCase();
    return this.mentionsCache.filter(m => 
      m.matchedKeywords.some(k => k.toUpperCase() === upper)
    );
  }

  /**
   * Add a new alert
   */
  addAlert(alert: Omit<TwitterAlert, 'id' | 'lastTriggered'>): string {
    const newAlert: TwitterAlert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      lastTriggered: undefined,
    };
    this.alerts.push(newAlert);
    return newAlert.id;
  }

  /**
   * Remove an alert
   */
  removeAlert(id: string): boolean {
    const index = this.alerts.findIndex(a => a.id === id);
    if (index === -1) return false;
    this.alerts.splice(index, 1);
    return true;
  }

  /**
   * Update an alert
   */
  updateAlert(id: string, updates: Partial<TwitterAlert>): boolean {
    const index = this.alerts.findIndex(a => a.id === id);
    if (index === -1) return false;
    this.alerts[index] = { ...this.alerts[index], ...updates };
    return true;
  }

  /**
   * Get all alerts
   */
  getAlerts(): TwitterAlert[] {
    return [...this.alerts];
  }

  /**
   * Clear cache (for testing)
   */
  clearCache(): void {
    this.tweetCache = [];
    this.mentionsCache = [];
  }
}

// Singleton instance
let twitterMonitorInstance: TwitterMonitor | null = null;

/**
 * Get the Twitter monitor singleton
 */
export function getTwitterMonitor(): TwitterMonitor {
  if (!twitterMonitorInstance) {
    twitterMonitorInstance = new TwitterMonitor();
  }
  return twitterMonitorInstance;
}

/**
 * React hook to use Twitter monitor
 */
export function useTwitterMonitor() {
  const monitor = getTwitterMonitor();
  const [mentions, setMentions] = React.useState<TwitterMention[]>([]);
  const [tweets, setTweets] = React.useState<Tweet[]>([]);
  const [alerts, setAlerts] = React.useState<TwitterAlert[]>([]);

  React.useEffect(() => {
    const update = () => {
      setMentions(monitor.getMentionsForKeyword('$SOL')); // example, could be made configurable
      setTweets(monitor.getRecentTweets({ limit: 20 }));
      setAlerts(monitor.getAlerts());
    };
    
    // Initial load
    update();
    
    // Subscribe to updates (in real app, we'd use websockets or polling)
    const interval = setInterval(update, 10_000); // every 10 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  return {
    mentions,
    tweets,
    alerts,
    addAlert: monitor.addAlert.bind(monitor),
    removeAlert: monitor.removeAlert.bind(monitor),
    updateAlert: monitor.updateAlert.bind(monitor),
    getRecentTweets: monitor.getRecentTweets.bind(monitor),
    getMentionsForKeyword: monitor.getMentionsForKeyword.bind(monitor),
  };
}

import React from 'react';

// Export types
export type { Tweet, TwitterMention, TwitterAlert };