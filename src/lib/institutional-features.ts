/**
 * Institutional Features
 * Sub-accounts, role-based access, audit logs, SSO (SAML/OIDC)
 */

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  domain?: string; // For SSO
  plan: 'team' | 'business' | 'enterprise';
  settings: OrganizationSettings;
  billing: BillingInfo;
  createdAt: number;
  updatedAt: number;
}

export interface OrganizationSettings {
  // Security
  require2FA: boolean;
  sessionTimeoutMinutes: number;
  ipWhitelist: string[];
  allowedChains: number[];
  
  // Trading limits
  maxPositionUsd: number;
  maxDailyVolumeUsd: number;
  maxLeverage: number;
  allowedStrategies: string[];
  blockedTokens: string[];
  
  // Compliance
  kycRequired: boolean;
  amlMonitoring: boolean;
  tradeReporting: boolean;
  dataRetentionDays: number;
  
  // Notifications
  emailNotifications: boolean;
  slackWebhook?: string;
  teamsWebhook?: string;
  
  // API
  apiRateLimitMultiplier: number;
  webhookRetryPolicy: {
    maxRetries: number;
    initialDelayMs: number;
  };
}

export interface BillingInfo {
  stripeCustomerId?: string;
  subscriptionId?: string;
  plan: 'team' | 'business' | 'enterprise';
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  seats: number;
  usedSeats: number;
  billingCycle: 'monthly' | 'yearly';
  nextBillingDate: number;
  paymentMethod?: {
    type: 'card' | 'bank' | 'crypto';
    last4?: string;
    brand?: string;
  };
}

export interface Member {
  id: string;
  organizationId: string;
  userId: string;
  email: string;
  name: string;
  avatar?: string;
  role: MemberRole;
  permissions: Permission[];
  status: 'active' | 'invited' | 'suspended' | 'removed';
  invitedBy: string;
  invitedAt: number;
  joinedAt?: number;
  lastActive?: number;
  mfaEnabled: boolean;
}

export type MemberRole = 'owner' | 'admin' | 'trader' | 'analyst' | 'viewer' | 'compliance' | 'developer';

export interface Permission {
  resource: string;
  actions: ('read' | 'write' | 'delete' | 'execute' | 'approve')[];
  conditions?: Record<string, any>;
  grantedBy: string;
  grantedAt: number;
}

export interface SubAccount {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  type: 'trading' | 'treasury' | 'strategy' | 'client' | 'testing';
  walletAddress: string;
  chainId: number;
  balance: SubAccountBalance;
  limits: SubAccountLimits;
  managers: string[]; // Member IDs
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SubAccountBalance {
  totalUsd: number;
  byToken: { mint: string; symbol: string; amount: number; valueUsd: number }[];
  lastUpdated: number;
}

export interface SubAccountLimits {
  maxPositionUsd: number;
  maxDailyLossUsd: number;
  maxDailyVolumeUsd: number;
  allowedTokens: string[];
  blockedTokens: string[];
  allowedStrategies: string[];
  requireApprovalAbove: number;
  approvers: string[];
}

export interface AuditLogEntry {
  id: string;
  organizationId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: number;
}

export interface SSOConfig {
  id: string;
  organizationId: string;
  provider: 'saml' | 'oidc' | 'azure_ad' | 'google_workspace' | 'okta' | 'auth0';
  name: string;
  enabled: boolean;
  config: {
    // SAML
    entryPoint?: string;
    issuer?: string;
    cert?: string;
    privateKey?: string;
    // OIDC
    clientId?: string;
    clientSecret?: string;
    issuerUrl?: string;
    scope?: string;
    // Common
    attributeMapping: {
      email: string;
      name: string;
      groups: string;
    };
    autoProvision: boolean;
    defaultRole: MemberRole;
    allowedDomains: string[];
  };
  createdAt: number;
  updatedAt: number;
}

export interface ComplianceReport {
  id: string;
  organizationId: string;
  type: 'trade_report' | 'aml_check' | 'kyc_status' | 'position_limit' | 'audit_trail';
  period: { start: number; end: number };
  status: 'pending' | 'generating' | 'completed' | 'failed';
  data: any;
  downloadUrl?: string;
  generatedBy: string;
  generatedAt: number;
  expiresAt?: number;
}

export interface ApprovalRequest {
  id: string;
  organizationId: string;
  subAccountId?: string;
  requestedBy: string;
  type: 'trade' | 'withdrawal' | 'strategy_change' | 'limit_increase' | 'new_token' | 'api_key';
  title: string;
  description: string;
  payload: any;
  requiredApprovers: number;
  approvals: Approval[];
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  expiresAt: number;
  createdAt: number;
  resolvedAt?: number;
}

export interface Approval {
  approverId: string;
  approverName: string;
  decision: 'approve' | 'reject';
  comment?: string;
  timestamp: number;
}

class InstitutionalManager {
  private organizations: Map<string, Organization> = new Map();
  private members: Map<string, Member[]> = new Map(); // orgId -> members
  private subAccounts: Map<string, SubAccount[]> = new Map(); // orgId -> subAccounts
  private auditLogs: Map<string, AuditLogEntry[]> = new Map(); // orgId -> logs
  private ssoConfigs: Map<string, SSOConfig[]> = new Map(); // orgId -> configs
  private complianceReports: Map<string, ComplianceReport[]> = new Map(); // orgId -> reports
  private approvalRequests: Map<string, ApprovalRequest[]> = new Map(); // orgId -> requests
  private subscribers: Set<(orgId: string) => void> = new Set();
  private currentUserId: string | null = null;
  private currentOrgId: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  private initialize(): void {
    this.loadCurrentContext();
  }

  private loadCurrentContext(): void {
    // In production, get from auth
    this.currentUserId = 'current_user';
    this.currentOrgId = 'demo_org';
    this.ensureOrganization(this.currentOrgId);
  }

  private ensureOrganization(orgId: string): Organization {
    if (!this.organizations.has(orgId)) {
      const org: Organization = {
        id: orgId,
        name: 'Whales Tracker Demo',
        slug: 'whales-tracker-demo',
        plan: 'enterprise',
        settings: {
          require2FA: true,
          sessionTimeoutMinutes: 60,
          ipWhitelist: [],
          allowedChains: [101, 1, 8453, 42161, 56],
          maxPositionUsd: 100000,
          maxDailyVolumeUsd: 1000000,
          maxLeverage: 1,
          allowedStrategies: ['snipe', 'dca', 'trailing_stop', 'copy_trade', 'rebalance', 'arbitrage'],
          blockedTokens: [],
          kycRequired: true,
          amlMonitoring: true,
          tradeReporting: true,
          dataRetentionDays: 2555, // 7 years
          emailNotifications: true,
          apiRateLimitMultiplier: 10,
          webhookRetryPolicy: { maxRetries: 5, initialDelayMs: 1000 },
        },
        billing: {
          plan: 'enterprise',
          status: 'active',
          seats: 50,
          usedSeats: 12,
          billingCycle: 'yearly',
          nextBillingDate: Date.now() + 365 * 86400000,
        },
        createdAt: Date.now() - 365 * 86400000,
        updatedAt: Date.now(),
      };
      this.organizations.set(orgId, org);
    }
    return this.organizations.get(orgId)!;
  }

  // Organization management
  getOrganization(orgId: string): Organization | undefined {
    return this.organizations.get(orgId);
  }

  getCurrentOrganization(): Organization | null {
    return this.currentOrgId ? this.organizations.get(this.currentOrgId) || null : null;
  }

  updateOrganization(orgId: string, updates: Partial<Organization>): Organization | null {
    const org = this.organizations.get(orgId);
    if (!org) return null;
    
    const updated = { ...org, ...updates, updatedAt: Date.now() };
    this.organizations.set(orgId, updated);
    this.logAudit(orgId, this.currentUserId!, 'organization_update', 'organization', orgId, updates);
    return updated;
  }

  // Member management
  getMembers(orgId: string): Member[] {
    return this.members.get(orgId) || [];
  }

  inviteMember(orgId: string, invite: {
    email: string;
    name: string;
    role: MemberRole;
    permissions?: Permission[];
  }): Member {
    const member: Member = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      organizationId: orgId,
      userId: `user_${Date.now()}`,
      email: invite.email,
      name: invite.name,
      role: invite.role,
      permissions: invite.permissions || this.getDefaultPermissions(invite.role),
      status: 'invited',
      invitedBy: this.currentUserId!,
      invitedAt: Date.now(),
      mfaEnabled: false,
    };

    if (!this.members.has(orgId)) this.members.set(orgId, []);
    this.members.get(orgId)!.push(member);
    
    this.logAudit(orgId, this.currentUserId!, 'member_invite', 'member', member.id, { email: invite.email, role: invite.role });
    
    // In production, send invitation email
    return member;
  }

  acceptInvitation(orgId: string, memberId: string): Member | null {
    const members = this.members.get(orgId) || [];
    const member = members.find(m => m.id === memberId);
    if (!member || member.status !== 'invited') return null;
    
    member.status = 'active';
    member.joinedAt = Date.now();
    member.userId = this.currentUserId!;
    this.logAudit(orgId, this.currentUserId!, 'member_join', 'member', memberId, {});
    return member;
  }

  updateMemberRole(orgId: string, memberId: string, role: MemberRole, permissions?: Permission[]): Member | null {
    const members = this.members.get(orgId) || [];
    const member = members.find(m => m.id === memberId);
    if (!member) return null;
    
    const oldRole = member.role;
    member.role = role;
    if (permissions) member.permissions = permissions;
    
    this.logAudit(orgId, this.currentUserId!, 'member_role_change', 'member', memberId, { oldRole, newRole: role });
    return member;
  }

  removeMember(orgId: string, memberId: string): boolean {
    const members = this.members.get(orgId) || [];
    const index = members.findIndex(m => m.id === memberId);
    if (index === -1) return false;
    
    members[index].status = 'removed';
    this.logAudit(orgId, this.currentUserId!, 'member_remove', 'member', memberId, {});
    return true;
  }

  private getDefaultPermissions(role: MemberRole): Permission[] {
    const base: Permission[] = [
      { resource: 'portfolio', actions: ['read'], grantedBy: 'system', grantedAt: Date.now() },
      { resource: 'market', actions: ['read'], grantedBy: 'system', grantedAt: Date.now() },
    ];

    switch (role) {
      case 'owner':
        return [
          ...base,
          { resource: '*', actions: ['read', 'write', 'delete', 'execute', 'approve'], grantedBy: 'system', grantedAt: Date.now() },
        ];
      case 'admin':
        return [
          ...base,
          { resource: 'trading', actions: ['read', 'write', 'execute'], grantedBy: 'system', grantedAt: Date.now() },
          { resource: 'members', actions: ['read', 'write', 'delete'], grantedBy: 'system', grantedAt: Date.now() },
          { resource: 'sub_accounts', actions: ['read', 'write', 'delete'], grantedBy: 'system', grantedAt: Date.now() },
          { resource: 'settings', actions: ['read', 'write'], grantedBy: 'system', grantedAt: Date.now() },
          { resource: 'audit_logs', actions: ['read'], grantedBy: 'system', grantedAt: Date.now() },
          { resource: 'approvals', actions: ['read', 'approve'], grantedBy: 'system', grantedAt: Date.now() },
        ];
      case 'trader':
        return [
          ...base,
          { resource: 'trading', actions: ['read', 'write', 'execute'], grantedBy: 'system', grantedAt: Date.now() },
          { resource: 'sub_accounts', actions: ['read', 'write'], grantedBy: 'system', grantedAt: Date.now() },
          { resource: 'strategies', actions: ['read', 'write', 'execute'], grantedBy: 'system', grantedAt: Date.now() },
        ];
      case 'analyst':
        return [
          ...base,
          { resource: 'trading', actions: ['read'], grantedBy: 'system', grantedAt: Date.now() },
          { resource: 'analytics', actions: ['read', 'write'], grantedBy: 'system', grantedAt: Date.now() },
          { resource: 'reports', actions: ['read', 'write'], grantedBy: 'system', grantedAt: Date.now() },
        ];
      case 'viewer':
        return base;
      case 'compliance':
        return [
          ...base,
          { resource: 'audit_logs', actions: ['read'], grantedBy: 'system', grantedAt: Date.now() },
          { resource: 'reports', actions: ['read', 'write'], grantedBy: 'system', grantedAt: Date.now() },
          { resource: 'approvals', actions: ['read', 'approve'], grantedBy: 'system', grantedAt: Date.now() },
          { resource: 'compliance', actions: ['read', 'write'], grantedBy: 'system', grantedAt: Date.now() },
        ];
      case 'developer':
        return [
          ...base,
          { resource: 'api_keys', actions: ['read', 'write', 'delete'], grantedBy: 'system', grantedAt: Date.now() },
          { resource: 'webhooks', actions: ['read', 'write', 'delete'], grantedBy: 'system', grantedAt: Date.now() },
          { resource: 'workflows', actions: ['read', 'write', 'execute'], grantedBy: 'system', grantedAt: Date.now() },
          { resource: 'plugins', actions: ['read', 'write', 'delete'], grantedBy: 'system', grantedAt: Date.now() },
        ];
      default:
        return base;
    }
  }

  checkPermission(userId: string, orgId: string, resource: string, action: string): boolean {
    const members = this.members.get(orgId) || [];
    const member = members.find(m => m.userId === userId && m.status === 'active');
    if (!member) return false;

    // Owner has all permissions
    if (member.role === 'owner') return true;

    for (const perm of member.permissions) {
      if ((perm.resource === resource || perm.resource === '*') && 
          (perm.actions.includes(action as any) || perm.actions.includes('*'))) {
        // Check conditions
        if (perm.conditions) {
          // Evaluate conditions (simplified)
        }
        return true;
      }
    }
    return false;
  }

  // Sub-accounts
  createSubAccount(orgId: string, account: Omit<SubAccount, 'id' | 'organizationId' | 'balance' | 'createdAt' | 'updatedAt'>): SubAccount {
    const subAccount: SubAccount = {
      ...account,
      id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      organizationId: orgId,
      balance: {
        totalUsd: 0,
        byToken: [],
        lastUpdated: Date.now(),
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (!this.subAccounts.has(orgId)) this.subAccounts.set(orgId, []);
    this.subAccounts.get(orgId)!.push(subAccount);
    
    this.logAudit(orgId, this.currentUserId!, 'sub_account_create', 'sub_account', subAccount.id, { name: account.name, type: account.type });
    return subAccount;
  }

  getSubAccounts(orgId: string): SubAccount[] {
    return this.subAccounts.get(orgId) || [];
  }

  updateSubAccount(orgId: string, accountId: string, updates: Partial<SubAccount>): SubAccount | null {
    const accounts = this.subAccounts.get(orgId) || [];
    const account = accounts.find(a => a.id === accountId);
    if (!account) return null;
    
    Object.assign(account, updates, { updatedAt: Date.now() });
    this.logAudit(orgId, this.currentUserId!, 'sub_account_update', 'sub_account', accountId, updates);
    return account;
  }

  // Audit logs
  logAudit(
    orgId: string,
    actorId: string,
    action: string,
    resource: string,
    resourceId?: string,
    details?: Record<string, any>
  ): AuditLogEntry {
    const actor = this.getMember(orgId, actorId);
    
    const entry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      organizationId: orgId,
      actorId,
      actorName: actor?.name || 'Unknown',
      actorRole: actor?.role || 'Unknown',
      action,
      resource,
      resourceId,
      details: details || {},
      ipAddress: '0.0.0.0', // Would get from request
      userAgent: navigator.userAgent,
      severity: this.getSeverity(action),
      timestamp: Date.now(),
    };

    if (!this.auditLogs.has(orgId)) this.auditLogs.set(orgId, []);
    this.auditLogs.get(orgId)!.unshift(entry);
    
    // Keep last 10000
    const logs = this.auditLogs.get(orgId)!;
    if (logs.length > 10000) logs.splice(10000);
    
    return entry;
  }

  private getSeverity(action: string): 'info' | 'warning' | 'critical' {
    if (action.includes('delete') || action.includes('remove') || action.includes('withdraw')) return 'critical';
    if (action.includes('update') || action.includes('change') || action.includes('create')) return 'warning';
    return 'info';
  }

  getAuditLogs(orgId: string, filters?: {
    actorId?: string;
    action?: string;
    resource?: string;
    startTime?: number;
    endTime?: number;
    severity?: AuditLogEntry['severity'];
    limit?: number;
  }): AuditLogEntry[] {
    let logs = this.auditLogs.get(orgId) || [];
    
    if (filters) {
      if (filters.actorId) logs = logs.filter(l => l.actorId === filters.actorId);
      if (filters.action) logs = logs.filter(l => l.action.includes(filters.action!));
      if (filters.resource) logs = logs.filter(l => l.resource === filters.resource);
      if (filters.startTime) logs = logs.filter(l => l.timestamp >= filters.startTime!);
      if (filters.endTime) logs = logs.filter(l => l.timestamp <= filters.endTime!);
      if (filters.severity) logs = logs.filter(l => l.severity === filters.severity);
    }
    
    return logs.slice(0, filters?.limit || 100);
  }

  private getMember(orgId: string, userId: string): Member | undefined {
    return this.members.get(orgId)?.find(m => m.userId === userId);
  }

  // SSO Configuration
  configureSSO(orgId: string, config: Omit<SSOConfig, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>): SSOConfig {
    const ssoConfig: SSOConfig = {
      ...config,
      id: `sso_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      organizationId: orgId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (!this.ssoConfigs.has(orgId)) this.ssoConfigs.set(orgId, []);
    this.ssoConfigs.get(orgId)!.push(ssoConfig);
    
    this.logAudit(orgId, this.currentUserId!, 'sso_configure', 'sso_config', ssoConfig.id, { provider: config.provider });
    return ssoConfig;
  }

  getSSOConfigs(orgId: string): SSOConfig[] {
    return this.ssoConfigs.get(orgId) || [];
  }

  // Initiate SSO login
  initiateSSOLogin(orgId: string, providerId: string): { url: string; state: string } | null {
    const configs = this.ssoConfigs.get(orgId) || [];
    const config = configs.find(c => c.id === providerId && c.enabled);
    if (!config) return null;

    const state = `sso_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    // In production, generate actual SAML/OIDC auth URL
    let url = '';
    if (config.config.clientId && config.config.issuerUrl) {
      // OIDC
      const params = new URLSearchParams({
        client_id: config.config.clientId,
        redirect_uri: `${window.location.origin}/auth/sso/callback`,
        response_type: 'code',
        scope: config.config.scope || 'openid email profile',
        state,
      });
      url = `${config.config.issuerUrl}/authorize?${params.toString()}`;
    } else if (config.config.entryPoint) {
      // SAML
      url = `${config.config.entryPoint}?SAMLRequest=${btoa(`<AuthnRequest ID="${state}"/>`)}&RelayState=${state}`;
    }
    
    return { url, state };
  }

  // Handle SSO callback
  async handleSSOCallback(orgId: string, providerId: string, code: string, state: string): Promise<{ member: Member; isNew: boolean } | null> {
    // In production, exchange code for tokens, get user info, create/login member
    return null;
  }

  // Compliance reports
  generateComplianceReport(orgId: string, report: Omit<ComplianceReport, 'id' | 'status' | 'downloadUrl' | 'generatedBy' | 'generatedAt' | 'expiresAt'>): ComplianceReport {
    const newReport: ComplianceReport = {
      ...report,
      id: `report_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      status: 'generating',
      generatedBy: this.currentUserId!,
      generatedAt: Date.now(),
      expiresAt: Date.now() + 30 * 86400000, // 30 days
    };

    if (!this.complianceReports.has(orgId)) this.complianceReports.set(orgId, []);
    this.complianceReports.get(orgId)!.push(newReport);
    
    this.logAudit(orgId, this.currentUserId!, 'report_generate', 'compliance_report', newReport.id, { type: report.type });
    
    // In production, generate report asynchronously
    setTimeout(() => {
      newReport.status = 'completed';
      newReport.downloadUrl = `/api/org/${orgId}/reports/${newReport.id}/download`;
      this.logAudit(orgId, this.currentUserId!, 'report_complete', 'compliance_report', newReport.id, {});
    }, 5000);
    
    return newReport;
  }

  getComplianceReports(orgId: string): ComplianceReport[] {
    return this.complianceReports.get(orgId) || [];
  }

  // Approval workflows
  createApprovalRequest(orgId: string, request: Omit<ApprovalRequest, 'id' | 'approvals' | 'status' | 'createdAt' | 'resolvedAt'>): ApprovalRequest {
    const approvalRequest: ApprovalRequest = {
      ...request,
      id: `appr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      approvals: [],
      status: 'pending',
      createdAt: Date.now(),
    };

    if (!this.approvalRequests.has(orgId)) this.approvalRequests.set(orgId, []);
    this.approvalRequests.get(orgId)!.push(approvalRequest);
    
    this.logAudit(orgId, this.currentUserId!, 'approval_request', 'approval', approvalRequest.id, { type: request.type });
    
    // Notify approvers
    // In production, send notifications
    
    return approvalRequest;
  }

  approveRequest(orgId: string, requestId: string, approverId: string, comment?: string): ApprovalRequest | null {
    const requests = this.approvalRequests.get(orgId) || [];
    const request = requests.find(r => r.id === requestId);
    if (!request || request.status !== 'pending') return null;

    const approver = this.getMember(orgId, approverId);
    if (!approver) return null;

    request.approvals.push({
      approverId,
      approverName: approver.name,
      decision: 'approve',
      comment,
      timestamp: Date.now(),
    });

    if (request.approvals.filter(a => a.decision === 'approve').length >= request.requiredApprovers) {
      request.status = 'approved';
      request.resolvedAt = Date.now();
    }

    this.logAudit(orgId, approverId, 'approval_decision', 'approval', requestId, { decision: 'approve' });
    return request;
  }

  rejectRequest(orgId: string, requestId: string, approverId: string, comment?: string): ApprovalRequest | null {
    const requests = this.approvalRequests.get(orgId) || [];
    const request = requests.find(r => r.id === requestId);
    if (!request || request.status !== 'pending') return null;

    const approver = this.getMember(orgId, approverId);
    if (!approver) return null;

    request.approvals.push({
      approverId,
      approverName: approver.name,
      decision: 'reject',
      comment,
      timestamp: Date.now(),
    });

    request.status = 'rejected';
    request.resolvedAt = Date.now();
    
    this.logAudit(orgId, approverId, 'approval_decision', 'approval', requestId, { decision: 'reject' });
    return request;
  }

  getApprovalRequests(orgId: string, filters?: { status?: ApprovalRequest['status']; type?: ApprovalRequest['type'] }): ApprovalRequest[] {
    let requests = this.approvalRequests.get(orgId) || [];
    
    if (filters) {
      if (filters.status) requests = requests.filter(r => r.status === filters.status);
      if (filters.type) requests = requests.filter(r => r.type === filters.type);
    }
    
    return requests.sort((a, b) => b.createdAt - a.createdAt);
  }

  // Subscriptions
  onOrgChange(callback: (orgId: string) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(orgId: string): void {
    for (const sub of this.subscribers) {
      try { sub(orgId); } catch (e) { console.error('[Institutional] Subscriber error:', e); }
    }
  }
}

// Singleton
let institutionalManagerInstance: InstitutionalManager | null = null;

export function getInstitutionalManager(): InstitutionalManager {
  if (!institutionalManagerInstance) {
    institutionalManagerInstance = new InstitutionalManager();
  }
  return institutionalManagerInstance;
}

// React hook
export function useInstitutionalManager() {
  const manager = getInstitutionalManager();
  
  return {
    getOrganization: (id: string) => manager.getOrganization(id),
    getCurrentOrganization: () => manager.getCurrentOrganization(),
    updateOrganization: (id: string, updates: any) => manager.updateOrganization(id, updates),
    getMembers: (orgId: string) => manager.getMembers(orgId),
    inviteMember: (orgId: string, invite: any) => manager.inviteMember(orgId, invite),
    acceptInvitation: (orgId: string, memberId: string) => manager.acceptInvitation(orgId, memberId),
    updateMemberRole: (orgId: string, memberId: string, role: any, permissions?: any) => manager.updateMemberRole(orgId, memberId, role, permissions),
    removeMember: (orgId: string, memberId: string) => manager.removeMember(orgId, memberId),
    checkPermission: (userId: string, orgId: string, resource: string, action: string) => manager.checkPermission(userId, orgId, resource, action),
    createSubAccount: (orgId: string, account: any) => manager.createSubAccount(orgId, account),
    getSubAccounts: (orgId: string) => manager.getSubAccounts(orgId),
    updateSubAccount: (orgId: string, accountId: string, updates: any) => manager.updateSubAccount(orgId, accountId, updates),
    getAuditLogs: (orgId: string, filters?: any) => manager.getAuditLogs(orgId, filters),
    configureSSO: (orgId: string, config: any) => manager.configureSSO(orgId, config),
    getSSOConfigs: (orgId: string) => manager.getSSOConfigs(orgId),
    initiateSSOLogin: (orgId: string, providerId: string) => manager.initiateSSOLogin(orgId, providerId),
    handleSSOCallback: (orgId: string, providerId: string, code: string, state: string) => manager.handleSSOCallback(orgId, providerId, code, state),
    generateComplianceReport: (orgId: string, report: any) => manager.generateComplianceReport(orgId, report),
    getComplianceReports: (orgId: string) => manager.getComplianceReports(orgId),
    createApprovalRequest: (orgId: string, request: any) => manager.createApprovalRequest(orgId, request),
    approveRequest: (orgId: string, requestId: string, approverId: string, comment?: string) => manager.approveRequest(orgId, requestId, approverId, comment),
    rejectRequest: (orgId: string, requestId: string, approverId: string, comment?: string) => manager.rejectRequest(orgId, requestId, approverId, comment),
    getApprovalRequests: (orgId: string, filters?: any) => manager.getApprovalRequests(orgId, filters),
    onOrgChange: (callback: (orgId: string) => void) => manager.onOrgChange(callback),
  };
}

export type { Organization, OrganizationSettings, BillingInfo, Member, MemberRole, Permission, SubAccount, SubAccountBalance, SubAccountLimits, AuditLogEntry, SSOConfig, ComplianceReport, ApprovalRequest, Approval };