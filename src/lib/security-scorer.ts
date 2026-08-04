/**
 * Token Security Scoring Engine
 * Composite score (0-100) based on multiple risk factors
 */

export interface SecurityFactor {
  name: string;
  category: 'authority' | 'liquidity' | 'holder' | 'contract' | 'market' | 'social';
  score: number; // 0-100 (higher = safer)
  weight: number; // Weight in final score
  description: string;
  details: string;
  status: 'pass' | 'warn' | 'fail';
  data: any; // Raw data for UI
}

export interface SecurityScore {
  tokenMint: string;
  tokenSymbol: string;
  overallScore: number; // 0-100
  grade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
  riskLevel: 'very_low' | 'low' | 'medium' | 'high' | 'very_high' | 'extreme';
  factors: SecurityFactor[];
  summary: {
    passed: number;
    warnings: number;
    failed: number;
    criticalIssues: string[];
  };
  recommendations: string[];
  timestamp: number;
}

class TokenSecurityScorer {
  private cache: Map<string, { score: SecurityScore; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes

  // Weights for each category (must sum to 1.0)
  private readonly CATEGORY_WEIGHTS = {
    authority: 0.25,    // Mint/freeze authority, renounced
    liquidity: 0.20,    // LP lock, depth, concentration
    holder: 0.20,       // Top holder concentration, distribution
    contract: 0.15,     // Honeypot, open source, proxy
    market: 0.10,       // Volume, market cap, age
    social: 0.10,       // Verified socials, website, community
  };

  async getSecurityScore(tokenMint: string): Promise<SecurityScore | null> {
    const cached = this.cache.get(tokenMint);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.score;
    }

    try {
      // Fetch data from multiple sources
      const [gmgnSecurity, gmgnToken, dexscreenerData] = await Promise.allSettled([
        this.fetchGmgnSecurity(tokenMint),
        this.fetchGmgnToken(tokenMint),
        this.fetchDexScreenerData(tokenMint),
      ]);

      const securityData = gmgnSecurity.status === 'fulfilled' ? gmgnSecurity.value : null;
      const tokenData = gmgnToken.status === 'fulfilled' ? gmgnToken.value : null;
      const dsData = dexscreenerData.status === 'fulfilled' ? dexscreenerData.value : null;

      // Calculate factors
      const factors = this.calculateFactors(securityData, tokenData, dsData);
      
      // Calculate overall score
      const overallScore = this.calculateOverallScore(factors);
      const grade = this.scoreToGrade(overallScore);
      const riskLevel = this.scoreToRiskLevel(overallScore);
      
      // Generate summary
      const passed = factors.filter(f => f.status === 'pass').length;
      const warnings = factors.filter(f => f.status === 'warn').length;
      const failed = factors.filter(f => f.status === 'fail').length;
      const criticalIssues = factors
        .filter(f => f.status === 'fail' && f.weight >= 0.15)
        .map(f => f.name);

      // Generate recommendations
      const recommendations = this.generateRecommendations(factors);

      const score: SecurityScore = {
        tokenMint,
        tokenSymbol: tokenData?.symbol || dsData?.symbol || 'UNKNOWN',
        overallScore,
        grade,
        riskLevel,
        factors,
        summary: { passed, warnings, failed, criticalIssues },
        recommendations,
        timestamp: Date.now(),
      };

      this.cache.set(tokenMint, { score, timestamp: Date.now() });
      return score;
    } catch (error) {
      console.error('[SecurityScorer] Error:', error);
      return null;
    }
  }

  private async fetchGmgnSecurity(tokenMint: string) {
    const response = await fetch(`/api/gmgn/security?address=${tokenMint}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('GMGN security fetch failed');
    return response.json();
  }

  private async fetchGmgnToken(tokenMint: string) {
    const response = await fetch(`/api/gmgn/token?address=${tokenMint}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('GMGN token fetch failed');
    return response.json();
  }

  private async fetchDexScreenerData(tokenMint: string) {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('DexScreener fetch failed');
    const data = await response.json();
    const pairs = (data.pairs || []).filter((p: any) => p.chainId === 'solana');
    if (pairs.length === 0) throw new Error('No Solana pairs');
    
    // Return best pair (highest liquidity)
    return pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
  }

  private calculateFactors(
    securityData: any,
    tokenData: any,
    dsData: any
  ): SecurityFactor[] {
    const factors: SecurityFactor[] = [];

    // ========== AUTHORITY FACTORS ==========
    
    // Mint Authority
    const mintRevoked = securityData?.is_mint_authority_revoked ?? 
                        tokenData?.renounced_mint ?? 
                        false;
    factors.push({
      name: 'Mint Authority Revoked',
      category: 'authority',
      score: mintRevoked ? 100 : 0,
      weight: 0.15,
      description: 'Whether the token creator can mint new tokens',
      details: mintRevoked 
        ? 'Mint authority has been renounced - no new tokens can be created'
        : 'MINT AUTHORITY ACTIVE - Creator can mint unlimited new tokens',
      status: mintRevoked ? 'pass' : 'fail',
      data: { mintRevoked },
    });

    // Freeze Authority
    const freezeRevoked = securityData?.is_freeze_authority_revoked ?? 
                          tokenData?.renounced_freeze_account ?? 
                          false;
    factors.push({
      name: 'Freeze Authority Revoked',
      category: 'authority',
      score: freezeRevoked ? 100 : 0,
      weight: 0.10,
      description: 'Whether the token creator can freeze token accounts',
      details: freezeRevoked
        ? 'Freeze authority renounced - accounts cannot be frozen'
        : 'FREEZE AUTHORITY ACTIVE - Creator can freeze any token account',
      status: freezeRevoked ? 'pass' : 'fail',
      data: { freezeRevoked },
    });

    // ========== LIQUIDITY FACTORS ==========

    // LP Locked
    const lpLocked = securityData?.liquidity_locked ?? false;
    const lpLockedRatio = securityData?.lp_locked_ratio ?? 0;
    factors.push({
      name: 'Liquidity Locked',
      category: 'liquidity',
      score: lpLocked ? Math.min(100, lpLockedRatio * 100) : 0,
      weight: 0.15,
      description: 'Whether LP tokens are locked/burned',
      details: lpLocked
        ? `${(lpLockedRatio * 100).toFixed(1)}% of LP locked`
        : 'LIQUIDITY NOT LOCKED - Rug pull risk: creator can withdraw LP',
      status: lpLocked ? (lpLockedRatio > 0.8 ? 'pass' : 'warn') : 'fail',
      data: { lpLocked, lpLockedRatio },
    });

    // Liquidity Depth
    const liquidityUsd = dsData?.liquidity?.usd ?? tokenData?.liquidity ?? 0;
    const liquidityScore = Math.min(100, (liquidityUsd / 1000000) * 50); // $1M = 50, $2M = 100
    factors.push({
      name: 'Liquidity Depth',
      category: 'liquidity',
      score: liquidityScore,
      weight: 0.05,
      description: 'Total liquidity in USD across all pools',
      details: `$${(liquidityUsd / 1e6).toFixed(2)}M total liquidity`,
      status: liquidityScore > 50 ? 'pass' : liquidityScore > 20 ? 'warn' : 'fail',
      data: { liquidityUsd },
    });

    // ========== HOLDER FACTORS ==========

    // Top 10 Holder Concentration
    const top10Rate = securityData?.top10_holder_rate ?? tokenData?.top_10_holder_rate ?? 0;
    const top10Score = Math.max(0, 100 - top10Rate * 2); // 50% = 0 score
    factors.push({
      name: 'Top 10 Holder Concentration',
      category: 'holder',
      score: top10Score,
      weight: 0.12,
      description: 'Percentage of supply held by top 10 wallets',
      details: `${top10Rate.toFixed(1)}% held by top 10 holders`,
      status: top10Rate < 20 ? 'pass' : top10Rate < 40 ? 'warn' : 'fail',
      data: { top10Rate },
    });

    // Dev Holder Rate
    const devRate = securityData?.dev_holder_rate ?? tokenData?.dev_holder_rate ?? 0;
    const devScore = Math.max(0, 100 - devRate * 5); // 20% = 0 score
    factors.push({
      name: 'Developer Holdings',
      category: 'holder',
      score: devScore,
      weight: 0.08,
      description: 'Percentage of supply held by developer/team',
      details: `${devRate.toFixed(1)}% held by developer`,
      status: devRate < 5 ? 'pass' : devRate < 15 ? 'warn' : 'fail',
      data: { devRate },
    });

    // ========== CONTRACT FACTORS ==========

    // Honeypot Check
    const isHoneypot = securityData?.is_honeypot ?? tokenData?.is_honeypot ?? false;
    factors.push({
      name: 'Honeypot Detection',
      category: 'contract',
      score: isHoneypot ? 0 : 100,
      weight: 0.15,
      description: 'Whether token can be bought but not sold',
      details: isHoneypot 
        ? 'HONEYPOT DETECTED - Cannot sell tokens'
        : 'No honeypot detected - sell transactions work',
      status: isHoneypot ? 'fail' : 'pass',
      data: { isHoneypot },
    });

    // Open Source
    const isOpenSource = securityData?.is_open_source ?? false;
    factors.push({
      name: 'Contract Open Source',
      category: 'contract',
      score: isOpenSource ? 100 : 50,
      weight: 0.03,
      description: 'Whether contract source code is verified',
      details: isOpenSource 
        ? 'Contract verified on explorer'
        : 'Contract not verified - cannot audit code',
      status: isOpenSource ? 'pass' : 'warn',
      data: { isOpenSource },
    });

    // Proxy Contract
    const isProxy = securityData?.is_proxy ?? false;
    factors.push({
      name: 'Proxy Contract',
      category: 'contract',
      score: isProxy ? 30 : 100,
      weight: 0.02,
      description: 'Whether contract is upgradeable (proxy)',
      details: isProxy
        ? 'Upgradeable proxy - logic can change'
        : 'Immutable contract - logic cannot change',
      status: isProxy ? 'warn' : 'pass',
      data: { isProxy },
    });

    // Rug Ratio
    const rugRatio = tokenData?.rug_ratio ?? 0;
    const rugScore = Math.max(0, 100 - rugRatio * 100);
    factors.push({
      name: 'Rug Pull Risk Score',
      category: 'contract',
      score: rugScore,
      weight: 0.10,
      description: 'GMGN calculated rug pull probability',
      details: `${(rugRatio * 100).toFixed(1)}% rug ratio`,
      status: rugRatio < 0.2 ? 'pass' : rugRatio < 0.5 ? 'warn' : 'fail',
      data: { rugRatio },
    });

    // ========== MARKET FACTORS ==========

    // Market Cap
    const marketCap = dsData?.marketCap ?? tokenData?.market_cap ?? 0;
    const mcScore = Math.min(100, Math.log10(Math.max(1, marketCap / 10000)) * 20);
    factors.push({
      name: 'Market Capitalization',
      category: 'market',
      score: mcScore,
      weight: 0.04,
      description: 'Total market value of circulating supply',
      details: `$${(marketCap / 1e6).toFixed(2)}M market cap`,
      status: marketCap > 1e7 ? 'pass' : marketCap > 1e6 ? 'warn' : 'fail',
      data: { marketCap },
    });

    // Volume / Liquidity Ratio
    const volume24h = dsData?.volume?.h24 ?? tokenData?.volume_24h ?? 0;
    const volLiqRatio = liquidityUsd > 0 ? volume24h / liquidityUsd : 0;
    const volScore = Math.min(100, volLiqRatio * 100); // 1.0 ratio = 100
    factors.push({
      name: 'Volume / Liquidity Ratio',
      category: 'market',
      score: volScore,
      weight: 0.03,
      description: '24h trading volume relative to liquidity',
      details: `${volLiqRatio.toFixed(2)}x turnover (${volume24h / 1e6}vol / ${liquidityUsd / 1e6}liq)`,
      status: volLiqRatio > 0.5 ? 'pass' : volLiqRatio > 0.1 ? 'warn' : 'fail',
      data: { volume24h, volLiqRatio },
    });

    // Token Age
    const createTimestamp = tokenData?.create_timestamp ?? (dsData?.pairCreatedAt ? new Date(dsData.pairCreatedAt).getTime() / 1000 : 0);
    const ageDays = createTimestamp ? (Date.now() / 1000 - createTimestamp) / 86400 : 0;
    const ageScore = Math.min(100, ageDays / 365 * 50); // 2 years = 100
    factors.push({
      name: 'Token Age',
      category: 'market',
      score: ageScore,
      weight: 0.03,
      description: 'Time since token creation/pool creation',
      details: `${ageDays.toFixed(0)} days old`,
      status: ageDays > 365 ? 'pass' : ageDays > 90 ? 'warn' : 'fail',
      data: { ageDays },
    });

    // ========== SOCIAL FACTORS ==========

    // Social Presence
    const hasTwitter = !!(tokenData?.twitter || dsData?.info?.socials?.find((s: any) => s.type === 'twitter'));
    const hasWebsite = !!(tokenData?.website || dsData?.info?.websites?.length);
    const hasTelegram = !!(tokenData?.telegram || dsData?.info?.socials?.find((s: any) => s.type === 'telegram'));
    const socialCount = [hasTwitter, hasWebsite, hasTelegram].filter(Boolean).length;
    const socialScore = (socialCount / 3) * 100;
    factors.push({
      name: 'Social Presence',
      category: 'social',
      score: socialScore,
      weight: 0.05,
      description: 'Verified social media and website presence',
      details: `${socialCount}/3 channels (Twitter: ${hasTwitter ? '✓' : '✗'}, Website: ${hasWebsite ? '✓' : '✗'}, Telegram: ${hasTelegram ? '✓' : '✗'})`,
      status: socialCount === 3 ? 'pass' : socialCount >= 2 ? 'warn' : 'fail',
      data: { hasTwitter, hasWebsite, hasTelegram },
    });

    // Smart Money / KOL Holders
    const smartMoneyCount = tokenData?.smart_degen_count ?? 0;
    const kolCount = tokenData?.renowned_count ?? 0;
    const smartScore = Math.min(100, (smartMoneyCount + kolCount) * 5);
    factors.push({
      name: 'Smart Money / KOL Holders',
      category: 'social',
      score: smartScore,
      weight: 0.05,
      description: 'Number of tracked smart money and KOL wallets holding',
      details: `${smartMoneyCount} smart money + ${kolCount} KOL holders`,
      status: smartMoneyCount + kolCount > 10 ? 'pass' : smartMoneyCount + kolCount > 3 ? 'warn' : 'fail',
      data: { smartMoneyCount, kolCount },
    });

    return factors;
  }

  private calculateOverallScore(factors: SecurityFactor[]): number {
    // Group by category and calculate weighted average
    const categoryScores: Record<string, { score: number; weight: number }> = {};
    
    for (const factor of factors) {
      if (!categoryScores[factor.category]) {
        categoryScores[factor.category] = { score: 0, weight: 0 };
      }
      categoryScores[factor.category].score += factor.score * factor.weight;
      categoryScores[factor.category].weight += factor.weight;
    }

    // Normalize within each category
    for (const cat of Object.keys(categoryScores)) {
      if (categoryScores[cat].weight > 0) {
        categoryScores[cat].score /= categoryScores[cat].weight;
      }
    }

    // Apply category weights
    let totalScore = 0;
    let totalWeight = 0;
    
    for (const [category, data] of Object.entries(categoryScores)) {
      const catWeight = this.CATEGORY_WEIGHTS[category as keyof typeof this.CATEGORY_WEIGHTS] || 0;
      totalScore += data.score * catWeight;
      totalWeight += catWeight;
    }

    return Math.round(totalScore / totalWeight);
  }

  private scoreToGrade(score: number): SecurityScore['grade'] {
    if (score >= 97) return 'A+';
    if (score >= 93) return 'A';
    if (score >= 90) return 'A-';
    if (score >= 87) return 'B+';
    if (score >= 83) return 'B';
    if (score >= 80) return 'B-';
    if (score >= 77) return 'C+';
    if (score >= 73) return 'C';
    if (score >= 70) return 'C-';
    if (score >= 60) return 'D';
    return 'F';
  }

  private scoreToRiskLevel(score: number): SecurityScore['riskLevel'] {
    if (score >= 90) return 'very_low';
    if (score >= 75) return 'low';
    if (score >= 60) return 'medium';
    if (score >= 45) return 'high';
    if (score >= 30) return 'very_high';
    return 'extreme';
  }

  private generateRecommendations(factors: SecurityFactor[]): string[] {
    const recommendations: string[] = [];
    
    const failedCritical = factors.filter(f => f.status === 'fail' && f.weight >= 0.1);
    const warnings = factors.filter(f => f.status === 'warn');
    
    if (failedCritical.some(f => f.name === 'Mint Authority Revoked')) {
      recommendations.push('⚠️ CRITICAL: Mint authority not revoked - creator can inflate supply infinitely');
    }
    if (failedCritical.some(f => f.name === 'Freeze Authority Revoked')) {
      recommendations.push('⚠️ CRITICAL: Freeze authority not revoked - creator can freeze your tokens');
    }
    if (failedCritical.some(f => f.name === 'Liquidity Locked')) {
      recommendations.push('⚠️ HIGH RISK: Liquidity not locked - rug pull possible at any time');
    }
    if (failedCritical.some(f => f.name === 'Honeypot Detection')) {
      recommendations.push('🚫 AVOID: Honeypot detected - you can buy but cannot sell');
    }
    if (failedCritical.some(f => f.name === 'Rug Pull Risk Score')) {
      recommendations.push('⚠️ HIGH RISK: Elevated rug pull probability per GMGN analysis');
    }
    if (failedCritical.some(f => f.name === 'Top 10 Holder Concentration')) {
      recommendations.push('⚠️ High concentration risk - top 10 holders control majority supply');
    }
    if (failedCritical.some(f => f.name === 'Developer Holdings')) {
      recommendations.push('⚠️ Large developer holdings - potential for team dump');
    }

    if (warnings.some(f => f.name === 'Proxy Contract')) {
      recommendations.push('ℹ️ Contract is upgradeable - logic can change post-audit');
    }
    if (warnings.some(f => f.name === 'Contract Open Source')) {
      recommendations.push('ℹ️ Contract not verified - cannot independently audit code');
    }
    if (warnings.some(f => f.name === 'Social Presence')) {
      recommendations.push('ℹ️ Limited social presence - harder to verify project legitimacy');
    }
    if (warnings.some(f => f.name === 'Token Age')) {
      recommendations.push('ℹ️ New token (<90 days) - higher volatility and risk');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ No critical issues found - token passes basic security checks');
    }

    return recommendations;
  }
}

// Singleton
let securityScorerInstance: TokenSecurityScorer | null = null;

export function getSecurityScorer(): TokenSecurityScorer {
  if (!securityScorerInstance) {
    securityScorerInstance = new TokenSecurityScorer();
  }
  return securityScorerInstance;
}

// React hook
export function useSecurityScore(tokenMint: string) {
  const scorer = getSecurityScorer();
  
  return {
    getScore: () => scorer.getSecurityScore(tokenMint),
  };
}

export type { SecurityFactor, SecurityScore };