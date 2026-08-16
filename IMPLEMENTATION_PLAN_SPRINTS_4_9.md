# Implementation Plan: Sprints 4-9 (Advanced Trading → AI/ML Intelligence)

## Sprint 4: Advanced Trading Features (Week 1-2)
**Priority: HIGH** - Direct monetization, immediate user value

### 4.1 Limit Orders
- **Store slice**: `limitOrders` (persisted), `addLimitOrder`, `cancelLimitOrder`, `updateLimitOrder`
- **API**: POST `/api/limit-orders` (create), DELETE `/api/limit-orders/:id` (cancel), GET `/api/limit-orders` (list)
- **Jupiter integration**: Use Jupiter Limit Order program (v2) or OpenBook/serum DEX
- **UI**: LimitOrderModal (token, side, price, amount, expiry: GTC/IOC/FOK/date), LimitOrdersTab in Portfolio
- **Expiry handling**: Background poller (30s) checks expired orders, auto-cancels

### 4.2 DCA Strategies
- **Store slice**: `dcaStrategies` (persisted), `addDcaStrategy`, `removeDcaStrategy`, `toggleDcaStrategy`, `executeDcaStep`
- **Config**: token, frequency (daily/weekly/monthly), amountUsd, maxSlippage, startDate, endDate?, maxTotalUsd?
- **API**: POST/GET/DELETE `/api/dca-strategies`, POST `/api/dca-strategies/:id/execute`
- **Poller**: Every hour, checks due strategies, executes via Jupiter swap
- **UI**: DcaStrategyModal (builder with frequency picker, amount slider, calendar), DcaStrategiesTab

### 4.3 Grid Trading Bot
- **Store slice**: `gridBots` (persisted), `addGridBot`, `removeGridBot`, `toggleGridBot`, `updateGridLevels`
- **Config**: token, rangeLow, rangeHigh, gridCount, amountPerGrid, side (neutral/long/short), autoRebalance
- **Execution**: Places limit orders at each grid level, rebalances on fill
- **API**: POST/GET/DELETE `/api/grid-bots`, POST `/api/grid-bots/:id/rebalance`
- **Poller**: Every 30s, checks fills, rebalances levels
- **UI**: GridBotModal (visual range slider, grid count, preview levels), GridBotsTab

### 4.4 OCO Orders (One-Cancels-Other)
- **Store slice**: `ocoOrders` (persisted), `addOcoOrder`, `cancelOcoOrder`
- **Config**: token, side, quantity, takeProfitPrice, stopLossPrice, expiry
- **Logic**: Places two limit orders (TP + SL), cancels other on fill
- **API**: POST/GET/DELETE `/api/oco-orders`
- **Poller**: Every 15s, monitors fills, cancels counterpart
- **UI**: OcoOrderModal (visual TP/SL lines on mini-chart), OcoOrdersTab

### 4.5 TWAP/VWAP Execution
- **Store slice**: `twapOrders` (persisted), `addTwapOrder`, `cancelTwapOrder`, `executeTwapSlice`
- **Config**: token, side, totalAmountUsd, durationMinutes, sliceCount, maxSlippage, priceLimit?
- **Execution**: Splits into N slices, executes every (duration/sliceCount) minutes
- **VWAP variant**: Uses volume profile to weight slices
- **API**: POST/GET/DELETE `/api/twap-orders`, POST `/api/twap-orders/:id/execute-slice`
- **Poller**: Every minute, executes due slices
- **UI**: TwapOrderModal (duration slider, slice count, preview schedule), TwapOrdersTab

### 4.6 Partial Fill Handling
- **UX**: Toast with "Partially filled: 60/100 SOL" + "Fill remainder" / "Cancel remainder" buttons
- **Store**: Track `filledAmount` on each order, `remainingAmount` computed
- **Actions**: `fillRemainder(orderId)`, `cancelRemainder(orderId)`
- **API**: PATCH `/api/orders/:id/fill-remainder`, PATCH `/api/orders/:id/cancel-remainder`

---

## Sprint 5: Social & Copy-Trade Marketplace (Week 3-4)

### 5.1 Verified Leaderboard
- **Verification**: On-chain PnL proof via Solana RPC + Jupiter trade history
- **KYC**: Optional Civic/Identity.com integration for "Verified" badge
- **Scoring**: 30d PnL %, win rate, Sharpe, max drawdown, consistency
- **API**: GET `/api/leaderboard?period=7d|30d|90d&verified=true`
- **UI**: LeaderboardView (tabs: All/Verified/Top PnL/Top Sharpe), pagination, filters

### 5.2 Copy-Trade Marketplace
- **Store**: `copyTradeConfigs` (existing), `subscriptions` (user->trader), `subscriptionFees`
- **Marketplace**: Browse traders, filter by metrics, one-click subscribe
- **Fee model**: 10% performance fee to trader, 5% platform fee
- **API**: GET `/api/copy-trade/traders`, POST `/api/copy-trade/subscribe`, DELETE `/api/copy-trade/unsubscribe`
- **UI**: MarketplaceView (cards with stats, risk badge, subscribe button), MySubscriptionsTab

### 5.3 Social Signals Feed
- **Store**: `socialPosts` (persisted), `createPost`, `likePost`, `commentPost`
- **Post types**: Token call, trade rationale, market analysis, question
- **Tagging**: Tokens, traders, strategies
- **API**: GET/POST `/api/social/posts`, POST `/api/social/posts/:id/like`
- **UI**: SocialFeedView (infinite scroll, real-time via WS), CreatePostModal

### 5.4 Referral Program
- **Store**: `referralTree` (persisted), `referralCode`, `referredUsers`, `referralRewards`
- **Tiers**: Direct (30%), 2nd level (3%), 3rd level (2%)
- **Rewards**: USDC claimable, auto-compound option
- **API**: GET `/api/referral/stats`, POST `/api/referral/claim`, GET `/api/referral/tree`
- **UI**: ReferralModal (code, tree visualization, earnings, claim button)

### 5.5 Trader Profiles
- **Public profile**: `/trader/:address` with stats, history, risk metrics, copy button
- **Privacy**: Opt-in, hide balances option
- **Verification badge**: KYC + on-chain proof
- **UI**: TraderProfileView (tabs: Overview/Trades/Metrics/Followers)

### 5.6 Copy-Trade Analytics
- **Subscriber view**: PnL by trader, correlation matrix, slippage analysis
- **Trader view**: AUM, subscriber count, fee revenue, retention
- **Charts**: Equity curve, drawdown, rolling Sharpe
- **Export**: CSV/PDF reports

---

## Sprint 6: Analytics & Reporting (Week 5-6)

### 6.1 Tax Reports
- **FIFO/LIFO/HIFO**: Configurable cost basis method
- **Forms**: CSV (generic), Form 8949 (US), Schedule D summary
- **Wash sales**: Detection and adjustment
- **DeFi income**: Staking rewards, LP fees, lending interest
- **API**: GET `/api/tax/report?year=2024&method=fifo&format=csv|8949`
- **UI**: TaxReportModal (year picker, method, preview, download)

### 6.2 Portfolio Analytics
- **Metrics**: Sharpe, Sortino, Calmar, Alpha/Beta vs SOL, Max Drawdown, VaR 95%
- **Attribution**: By token, by strategy (manual/snipe/DCA/copy/grid), by DEX
- **Rolling windows**: 7d, 30d, 90d, 1y, all-time
- **Benchmark**: Compare to SOL, BTC, SPY
- **UI**: AnalyticsDashboard (metric cards, attribution charts, benchmark comparison)

### 6.3 Performance Dashboard
- **Equity curve**: Daily snapshots from portfolio value
- **Trade analysis**: Win rate by token/side/time, avg win/loss, profit factor
- **Monthly heatmap**: Calendar view of daily PnL
- **Distribution**: PnL histogram, MAE/MFE scatter
- **UI**: PerformanceTab in Portfolio (interactive charts via recharts/lightweight-charts)

### 6.4 Risk Dashboard
- **Concentration**: HHI index, top 5 exposure, sector/DEX correlation
- **Liquidity risk**: Days to liquidate at 1%/5%/10% volume
- **Smart contract risk**: Protocol TVL, audit status, upgradeability
- **Counterparty risk**: CEX exposure, bridge exposure
- **Stress tests**: -20% SOL, -50% altcoins, liquidity crunch
- **UI**: RiskTab in Portfolio (risk score, breakdown, stress test results)

### 6.5 Custom Reports
- **Builder**: Drag-drop metrics, filters, group-by, time range
- **Scheduling**: Daily/weekly/monthly, email/webhook delivery
- **Templates**: Pre-built (tax, performance, risk, compliance)
- **API**: POST `/api/reports/custom`, GET `/api/reports/templates`
- **UI**: ReportBuilderModal (visual query builder), ScheduledReportsTab

---

## Sprint 7: Mobile & PWA Excellence (Week 7-8)

### 7.1 Offline Support
- **Service Worker**: Workbox, cache-first for static, stale-while-revalidate for API
- **Background Sync**: Queue trades/orders when offline, replay on reconnect
- **IndexedDB**: Cache portfolio, prices, orders for offline viewing
- **Manifest**: Updated with shortcuts, screenshots, categories
- **Testing**: Lighthouse PWA score >90

### 7.2 Push Notifications
- **VAPID keys**: Generate and configure
- **Subscription**: Prompt on first alert creation, manage in Settings
- **Payloads**: Price alerts, whale moves, order fills, copy-trade signals
- **Actions**: "View", "Buy", "Dismiss" buttons on notification
- **Server**: Firebase Cloud Functions or custom VAPID server

### 7.3 Home Screen Widgets
- **iOS**: WidgetKit (Swift), shows portfolio value, top 3 tokens, 24h change
- **Android**: Jetpack Glance, same data
- **Data**: Shared via App Groups / Content Provider, updated via background fetch
- **Config**: User selects tokens/metrics in app

### 7.4 Biometric Auth
- **WebAuthn**: Passkeys for trade confirmation (no password)
- **Flow**: Register credential → store public key → challenge on trade → verify
- **Fallback**: PIN/pattern for devices without biometrics
- **Settings**: Enable/disable, manage credentials

### 7.5 Haptic Feedback
- **Patterns**: success (double tap), error (long buzz), warning (triple), selection (light)
- **Integration**: useHaptics hook already exists, wire to all buttons/forms
- **iOS**: Taptic Engine via `navigator.vibrate` patterns
- **Android**: VibrationEffect via same API

---

## Sprint 8: Pro/Institutional Features (Week 9-10)

### 8.1 Team Workspaces
- **Org model**: Owner → Admins → Members → Viewers
- **Roles**: Trade, Manage Strategies, View Analytics, Manage Team
- **Shared**: Strategies, watchlists, alerts, API keys
- **Audit**: All actions logged with user attribution
- **UI**: WorkspaceSwitcher, TeamSettings, InviteModal, RoleManager

### 8.2 API Access
- **Keys**: Create/revoke, scopes (read/trade/admin), rate limits, IP whitelist
- **REST**: All endpoints with API key auth (Bearer token)
- **WebSocket**: Authenticated WS for real-time prices/orders
- **Webhooks**: Order fill, price alert, whale alert, copy-trade signal
- **Docs**: OpenAPI/Swagger, Postman collection
- **UI**: ApiKeysModal (create, scopes, limits, webhook URL, test button)

### 8.3 Audit Logging
- **Immutable**: Append-only log (Cloudflare D1 / Supabase / PostgreSQL)
- **Events**: Login, trade, order, config change, withdrawal, API call
- **Retention**: 7 years default, configurable
- **Export**: CSV/JSON for compliance
- **Tamper-proof**: Hash chain, periodic Merkle root to Solana

### 8.4 White-label
- **Theming**: Colors, logo, favicon, meta tags, email templates
- **Domain**: Custom subdomain (trade.fund.com) or full domain
- **Feature flags**: Enable/disable modules per client
- **Billing**: Stripe Connect for platform fees
- **Admin**: Multi-tenant dashboard, usage analytics, billing

---

## Sprint 9: AI/ML Intelligence (Week 11-12)

### 9.1 Predictive Models
- **Price direction**: LSTM/Transformer on 1m/5m/15m candles → 1h/4h/24h forecast
- **Volatility**: GARCH + realized vol → expected range
- **Rug probability**: Static analysis (mint authority, LP lock, holder dist) + dynamic (volume, buys/sells)
- **Training**: Daily retrain on new data, walk-forward validation
- **API**: GET `/api/ml/predict?token=SOL&horizon=1h|4h|24h`
- **UI**: PredictionsTab (confidence intervals, feature importance, backtest chart)

### 9.2 Anomaly Detection
- **Volume spikes**: Z-score > 3 on 5m volume vs 1h baseline
- **New wallet clusters**: Graph analysis of first-time buyers
- **MEV detection**: Sandwich attacks, JIT liquidity, frontrunning patterns
- **Alerting**: Real-time toast + webhook for anomalies
- **UI**: AnomaliesTab (live feed, severity, token link, explanation)

### 9.3 Strategy Optimizer
- **Backtest engine**: Event-driven, tick-level, realistic fees/slippage
- **Parameters**: Grid count, DCA frequency, snipe thresholds, trailing %
- **Optimization**: Genetic algorithm (population=50, generations=100)
- **Objectives**: Max Sharpe, min drawdown, max return, custom weight
- **Walk-forward**: Train on 70%, validate on 30%, rolling windows
- **UI**: OptimizerModal (param ranges, objective, progress, results table)

### 9.4 Natural Language Queries
- **LLM**: Fine-tuned on Solana DeFi schema + SQL
- **Examples**: "Top 10 tokens by smart money buys last hour", "My worst trade this week"
- **Execution**: Generates SQL → executes → formats response
- **Security**: Read-only, row-level permissions, query timeout
- **UI**: Chat interface in Analytics (separate from AI Copilot)

### 9.5 Sentiment Analysis
- **Sources**: Twitter (X API), Telegram (MTProto), Discord (bot), Reddit
- **Models**: FinBERT for financial sentiment, custom for crypto slang
- **Signals**: Token mentions, sentiment score, influencer weighting
- **Correlation**: Sentiment vs price change (lead/lag analysis)
- **UI**: SentimentTab (token search, time series, top bullish/bearish)

---

## Technical Architecture Notes

### Shared Infrastructure
- **Background jobs**: All pollers use `document.visibilityState` + AbortController
- **State persistence**: Zustand `partialize` with version migration
- **Error boundaries**: React Error Boundaries per feature module
- **Testing**: Vitest unit tests + Playwright E2E for critical flows
- **Monitoring**: Sentry for errors, custom metrics for business KPIs

### Data Flow
```
User Action → Store Action → API Call → On-chain/DEX → Store Update → UI Re-render
                    ↓
            Background Poller → Check Conditions → Execute/Alert → Store Update
```

### API Conventions
- **REST**: `/api/v1/{resource}` with standard CRUD
- **WebSocket**: `/api/ws` with channels (prices, orders, alerts, social)
- **Auth**: JWT (access + refresh), API keys for programmatic
- **Rate limits**: Per-user (100/min), per-IP (500/min), per-API key (1000/min)

---

## Migration Strategy

### Phase 1 (Sprint 4-5): Core trading + social
- No breaking changes to existing APIs
- New store slices additive
- Feature flags for gradual rollout

### Phase 2 (Sprint 6-7): Analytics + mobile
- New analytics endpoints
- PWA manifest updates
- Service worker registration

### Phase 3 (Sprint 8-9): Pro + AI
- New auth system (API keys, WebAuthn)
- ML model serving (separate service or edge functions)
- Multi-tenant database schema

---

## Success Metrics

| Sprint | Metric | Target |
|--------|--------|--------|
| 4 | Limit orders placed/day | >100 |
| 4 | DCA strategies active | >50 |
| 5 | Copy-trade subscribers | >200 |
| 5 | Referral signups | >500 |
| 6 | Tax reports generated | >50/month |
| 7 | PWA install rate | >5% |
| 7 | Push opt-in rate | >30% |
| 8 | API keys issued | >20 |
| 9 | Prediction accuracy | >60% directional |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Jupiter API changes | Abstract DEX adapter, support multiple DEXs |
| gmgn-cli rate limits | Cache aggressively, fallback to DexScreener |
| Solana RPC reliability | Multiple RPC endpoints, health checks |
| ML model drift | Daily retrain, A/B test predictions vs random |
| Regulatory (copy-trade) | Legal review, disclaimers, accredited investor gate |
| Performance (large portfolios) | Virtualized lists, pagination, Web Workers for compute |