/**
 * Agentic Workflow Builder
 * Visual DAG: "On GMGN signal → check risk score → buy → set trailing"
 */

export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'condition' | 'action' | 'transform' | 'delay' | 'branch' | 'merge';
  name: string;
  description: string;
  position: { x: number; y: number };
  config: Record<string, any>;
  inputs: string[]; // Node IDs that connect to this node's inputs
  outputs: string[]; // Node IDs that this node connects to
  status: 'idle' | 'running' | 'success' | 'error' | 'waiting';
  lastRun?: {
    timestamp: number;
    duration: number;
    output?: any;
    error?: string;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string; // Node ID
  target: string; // Node ID
  sourceHandle?: string; // Output handle
  targetHandle?: string; // Input handle
  label?: string;
  condition?: string; // For conditional edges
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  version: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  enabled: boolean;
  schedule?: {
    type: 'interval' | 'cron' | 'event';
    value: string; // cron expression or interval ms
  };
  triggers: WorkflowTrigger[];
  createdAt: number;
  updatedAt: number;
  lastRun?: number;
  runCount: number;
  successCount: number;
  errorCount: number;
}

export interface WorkflowTrigger {
  type: 'schedule' | 'webhook' | 'price' | 'smart_money' | 'new_launch' | 'portfolio' | 'manual';
  config: Record<string, any>;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: number;
  completedAt?: number;
  triggerData?: any;
  nodeResults: Map<string, NodeExecutionResult>;
  currentNode?: string;
  error?: string;
}

export interface NodeExecutionResult {
  nodeId: string;
  status: 'success' | 'error' | 'skipped';
  input: any;
  output: any;
  duration: number;
  error?: string;
  timestamp: number;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'trading' | 'monitoring' | 'portfolio' | 'risk' | 'research' | 'notification';
  workflow: Omit<Workflow, 'id' | 'version' | 'createdAt' | 'updatedAt' | 'runCount' | 'successCount' | 'errorCount'>;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedSetupTime: string;
}

// Built-in node types
export const NODE_TYPES = {
  triggers: [
    { type: 'trigger', subtype: 'schedule', name: 'Schedule', icon: 'Clock', description: 'Run on a schedule (cron/interval)' },
    { type: 'trigger', subtype: 'price', name: 'Price Alert', icon: 'TrendingUp', description: 'Trigger when price crosses threshold' },
    { type: 'trigger', subtype: 'smart_money', name: 'Smart Money Signal', icon: 'Brain', description: 'GMGN smart money activity detected' },
    { type: 'trigger', subtype: 'new_launch', name: 'New Launch', icon: 'Rocket', description: 'New token launch detected' },
    { type: 'trigger', subtype: 'portfolio', name: 'Portfolio Change', icon: 'PieChart', description: 'Portfolio value/allocation changed' },
    { type: 'trigger', subtype: 'webhook', name: 'Webhook', icon: 'Webhook', description: 'External HTTP trigger' },
    { type: 'trigger', subtype: 'manual', name: 'Manual', icon: 'MousePointer', description: 'Manual button trigger' },
  ],
  conditions: [
    { type: 'condition', subtype: 'price_check', name: 'Price Check', icon: 'DollarSign', description: 'Check if price meets condition' },
    { type: 'condition', subtype: 'risk_score', name: 'Risk Score', icon: 'Shield', description: 'Check token security/risk score' },
    { type: 'condition', subtype: 'liquidity', name: 'Liquidity Check', icon: 'Droplets', description: 'Verify sufficient liquidity' },
    { type: 'condition', subtype: 'volume', name: 'Volume Check', icon: 'Activity', description: 'Check volume thresholds' },
    { type: 'condition', subtype: 'technical', name: 'Technical Indicator', icon: 'BarChart', description: 'RSI, MACD, MA conditions' },
    { type: 'condition', subtype: 'portfolio', name: 'Portfolio Condition', icon: 'Briefcase', description: 'Check portfolio metrics' },
    { type: 'condition', subtype: 'time', name: 'Time Window', icon: 'Clock', description: 'Only run during specific hours' },
    { type: 'condition', subtype: 'custom', name: 'Custom Expression', icon: 'Code', description: 'JavaScript expression' },
  ],
  actions: [
    { type: 'action', subtype: 'buy', name: 'Buy Token', icon: 'ShoppingCart', description: 'Execute buy order via Jupiter' },
    { type: 'action', subtype: 'sell', name: 'Sell Token', icon: 'ShoppingBag', description: 'Execute sell order via Jupiter' },
    { type: 'action', subtype: 'snipe', name: 'Snipe Launch', icon: 'Target', description: 'Snipe new token launch' },
    { type: 'action', subtype: 'trailing_stop', name: 'Set Trailing Stop', icon: 'Flag', description: 'Set/update trailing stop loss' },
    { type: 'action', subtype: 'dca', name: 'Start DCA', icon: 'Repeat', description: 'Start dollar-cost averaging' },
    { type: 'action', subtype: 'copy_trade', name: 'Copy Trade', icon: 'Copy', description: 'Mirror wallet trades' },
    { type: 'action', subtype: 'rebalance', name: 'Rebalance', icon: 'RotateCcw', description: 'Trigger portfolio rebalance' },
    { type: 'action', subtype: 'alert', name: 'Send Alert', icon: 'Bell', description: 'Send notification (Telegram/Email/Push)' },
    { type: 'action', subtype: 'log', name: 'Log Event', icon: 'FileText', description: 'Log to database/analytics' },
  ],
  transforms: [
    { type: 'transform', subtype: 'calculate_size', name: 'Calculate Position Size', icon: 'Calculator', description: 'Kelly, risk parity, fixed %' },
    { type: 'transform', subtype: 'format_message', name: 'Format Message', icon: 'MessageSquare', description: 'Template string with variables' },
    { type: 'transform', subtype: 'fetch_data', name: 'Fetch Data', icon: 'Download', description: 'Get price, GMGN, on-chain data' },
    { type: 'transform', subtype: 'filter', name: 'Filter Array', icon: 'Filter', description: 'Filter array by condition' },
    { type: 'transform', subtype: 'map', name: 'Map Transform', icon: 'ArrowRightLeft', description: 'Transform each item in array' },
  ],
  control: [
    { type: 'delay', subtype: 'wait', name: 'Wait', icon: 'Hourglass', description: 'Pause execution for duration' },
    { type: 'delay', subtype: 'wait_for', name: 'Wait For Condition', icon: 'PauseCircle', description: 'Wait until condition met' },
    { type: 'branch', subtype: 'if_else', name: 'If/Else', icon: 'GitBranch', description: 'Branch based on condition' },
    { type: 'branch', subtype: 'switch', name: 'Switch', icon: 'Square', description: 'Multiple branches' },
    { type: 'merge', subtype: 'join', name: 'Join', icon: 'Merge', description: 'Merge parallel branches' },
    { type: 'merge', subtype: 'race', name: 'Race', icon: 'Zap', description: 'First branch to complete wins' },
  ],
};

class WorkflowBuilder {
  private workflows: Map<string, Workflow> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private templates: WorkflowTemplate[] = [];
  private subscribers: Set<(workflows: Workflow[]) => void> = new Set();
  private executionSubscribers: Set<(execution: WorkflowExecution) => void> = new Set();
  private runningExecutions: Map<string, AbortController> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    this.templates = [
      {
        id: 'snipe_smart_money',
        name: 'Smart Money Snipe',
        description: 'When smart money buys a new token, check risk score, then snipe with trailing stop',
        category: 'trading',
        workflow: {
          name: 'Smart Money Snipe',
          description: 'Auto-snipe when smart money accumulates new tokens',
          nodes: [
            { id: 'trigger_1', type: 'trigger', name: 'Smart Money Signal', description: 'GMGN smart money buy detected', position: { x: 100, y: 100 }, config: { subtype: 'smart_money', minFlowUsd: 10000, tokenFilter: 'new' }, inputs: [], outputs: ['condition_1'], status: 'idle' },
            { id: 'condition_1', type: 'condition', name: 'Risk Score > 70', description: 'Verify token security', position: { x: 350, y: 100 }, config: { subtype: 'risk_score', operator: '>', value: 70 }, inputs: ['trigger_1'], outputs: ['action_1'], status: 'idle' },
            { id: 'action_1', type: 'action', name: 'Snipe Buy', description: 'Buy $200 at market', position: { x: 600, y: 100 }, config: { subtype: 'snipe', amountUsd: 200, slippageBps: 500 }, inputs: ['condition_1'], outputs: ['action_2'], status: 'idle' },
            { id: 'action_2', type: 'action', name: 'Set Trailing Stop 15%', description: 'Protect downside', position: { x: 850, y: 100 }, config: { subtype: 'trailing_stop', trailPercent: 15 }, inputs: ['action_1'], outputs: [], status: 'idle' },
          ],
          edges: [
            { id: 'e1', source: 'trigger_1', target: 'condition_1' },
            { id: 'e2', source: 'condition_1', target: 'action_1' },
            { id: 'e3', source: 'action_1', target: 'action_2' },
          ],
          enabled: false,
          triggers: [{ type: 'smart_money', config: { minFlowUsd: 10000 } }],
        },
        tags: ['snipe', 'smart-money', 'auto-trade', 'risk-management'],
        difficulty: 'intermediate',
        estimatedSetupTime: '5 min',
      },
      {
        id: 'dca_accumulation',
        name: 'DCA Accumulation',
        description: 'Daily DCA into SOL/JUP with RSI oversold boost',
        category: 'trading',
        workflow: {
          name: 'DCA Accumulation',
          description: 'Automated daily DCA with smart entry timing',
          nodes: [
            { id: 'trigger_1', type: 'trigger', name: 'Daily 9 AM UTC', description: 'Run every day at 9 AM', position: { x: 100, y: 100 }, config: { subtype: 'schedule', cron: '0 9 * * *' }, inputs: [], outputs: ['condition_1'], status: 'idle' },
            { id: 'condition_1', type: 'condition', name: 'RSI < 40?', description: 'Check if oversold for boost', position: { x: 350, y: 100 }, config: { subtype: 'technical', indicator: 'rsi', operator: '<', value: 40 }, inputs: ['trigger_1'], outputs: ['action_1', 'action_2'], status: 'idle' },
            { id: 'action_1', type: 'action', name: 'DCA $100 (Boost)', description: 'Double size when oversold', position: { x: 600, y: 50 }, config: { subtype: 'dca', token: 'SOL', amountUsd: 200, interval: 'daily' }, inputs: ['condition_1'], outputs: [], status: 'idle' },
            { id: 'action_2', type: 'action', name: 'DCA $50 (Normal)', description: 'Regular DCA amount', position: { x: 600, y: 150 }, config: { subtype: 'dca', token: 'SOL', amountUsd: 50, interval: 'daily' }, inputs: ['condition_1'], outputs: [], status: 'idle' },
          ],
          edges: [
            { id: 'e1', source: 'trigger_1', target: 'condition_1' },
            { id: 'e2', source: 'condition_1', target: 'action_1', label: 'true' },
            { id: 'e3', source: 'condition_1', target: 'action_2', label: 'false' },
          ],
          enabled: false,
          triggers: [{ type: 'schedule', config: { cron: '0 9 * * *' } }],
        },
        tags: ['dca', 'accumulation', 'sol', 'long-term'],
        difficulty: 'beginner',
        estimatedSetupTime: '3 min',
      },
      {
        id: 'portfolio_rebalance',
        name: 'Weekly Rebalance',
        description: 'Check portfolio drift every Monday, rebalance if >10% deviation',
        category: 'portfolio',
        workflow: {
          name: 'Weekly Rebalance',
          description: 'Automated weekly portfolio rebalancing',
          nodes: [
            { id: 'trigger_1', type: 'trigger', name: 'Monday 9 AM UTC', description: 'Weekly check', position: { x: 100, y: 100 }, config: { subtype: 'schedule', cron: '0 9 * * 1' }, inputs: [], outputs: ['condition_1'], status: 'idle' },
            { id: 'condition_1', type: 'condition', name: 'Max Drift > 10%?', description: 'Check allocation deviation', position: { x: 350, y: 100 }, config: { subtype: 'portfolio', metric: 'max_drift_pct', operator: '>', value: 10 }, inputs: ['trigger_1'], outputs: ['action_1'], status: 'idle' },
            { id: 'action_1', type: 'action', name: 'Execute Rebalance', description: 'Rebalance to targets', position: { x: 600, y: 100 }, config: { subtype: 'rebalance', useLimitOrders: true, maxSlippageBps: 50 }, inputs: ['condition_1'], outputs: ['action_2'], status: 'idle' },
            { id: 'action_2', type: 'action', name: 'Notify Complete', description: 'Send Telegram notification', position: { x: 850, y: 100 }, config: { subtype: 'alert', channel: 'telegram', template: 'Rebalance complete: {{changes}}' }, inputs: ['action_1'], outputs: [], status: 'idle' },
          ],
          edges: [
            { id: 'e1', source: 'trigger_1', target: 'condition_1' },
            { id: 'e2', source: 'condition_1', target: 'action_1' },
            { id: 'e3', source: 'action_1', target: 'action_2' },
          ],
          enabled: false,
          triggers: [{ type: 'schedule', config: { cron: '0 9 * * 1' } }],
        },
        tags: ['rebalance', 'portfolio', 'weekly', 'risk-management'],
        difficulty: 'beginner',
        estimatedSetupTime: '3 min',
      },
      {
        id: 'copy_trade_whale',
        name: 'Copy Whale Trades',
        description: 'Mirror top GMGN whale trades with position sizing',
        category: 'trading',
        workflow: {
          name: 'Copy Whale Trades',
          description: 'Follow verified whale wallets automatically',
          nodes: [
            { id: 'trigger_1', type: 'trigger', name: 'Whale Trade', description: 'GMGN whale trade detected', position: { x: 100, y: 100 }, config: { subtype: 'smart_money', walletTier: 'whale', minWinRate: 60 }, inputs: [], outputs: ['condition_1'], status: 'idle' },
            { id: 'condition_1', type: 'condition', name: 'Risk Score > 60?', description: 'Check token safety', position: { x: 350, y: 100 }, config: { subtype: 'risk_score', operator: '>', value: 60 }, inputs: ['trigger_1'], outputs: ['transform_1'], status: 'idle' },
            { id: 'transform_1', type: 'transform', name: 'Calc Position Size', description: '1% portfolio per trade', position: { x: 600, y: 100 }, config: { subtype: 'calculate_size', method: 'fixed_pct', portfolioPct: 1 }, inputs: ['condition_1'], outputs: ['action_1'], status: 'idle' },
            { id: 'action_1', type: 'action', name: 'Copy Buy', description: 'Mirror the trade', position: { x: 850, y: 100 }, config: { subtype: 'copy_trade', copySells: true, delayMs: 5000 }, inputs: ['transform_1'], outputs: ['action_2'], status: 'idle' },
            { id: 'action_2', type: 'action', name: 'Set Trailing 20%', description: 'Trailing stop for copied trade', position: { x: 1100, y: 100 }, config: { subtype: 'trailing_stop', trailPercent: 20 }, inputs: ['action_1'], outputs: [], status: 'idle' },
          ],
          edges: [
            { id: 'e1', source: 'trigger_1', target: 'condition_1' },
            { id: 'e2', source: 'condition_1', target: 'transform_1' },
            { id: 'e3', source: 'transform_1', target: 'action_1' },
            { id: 'e4', source: 'action_1', target: 'action_2' },
          ],
          enabled: false,
          triggers: [{ type: 'smart_money', config: { walletTier: 'whale', minWinRate: 60 } }],
        },
        tags: ['copy-trade', 'whale', 'smart-money', 'auto-trade'],
        difficulty: 'advanced',
        estimatedSetupTime: '10 min',
      },
      {
        id: 'launch_sniper',
        name: 'Launch Sniper with Filters',
        description: 'Snipe pump.fun launches passing security + smart money filters',
        category: 'trading',
        workflow: {
          name: 'Launch Sniper',
          description: 'Automated launch sniping with quality filters',
          nodes: [
            { id: 'trigger_1', type: 'trigger', name: 'New Launch', description: 'pump.fun/Raydium new pair', position: { x: 100, y: 100 }, config: { subtype: 'new_launch', sources: ['pumpfun', 'raydium'] }, inputs: [], outputs: ['condition_1'], status: 'idle' },
            { id: 'condition_1', type: 'condition', name: 'Security > 75?', description: 'Basic safety check', position: { x: 350, y: 50 }, config: { subtype: 'risk_score', operator: '>', value: 75 }, inputs: ['trigger_1'], outputs: ['condition_2'], status: 'idle' },
            { id: 'condition_2', type: 'condition', name: 'Liquidity > $10k?', description: 'Sufficient liquidity', position: { x: 350, y: 150 }, config: { subtype: 'liquidity', operator: '>', value: 10000 }, inputs: ['condition_1'], outputs: ['transform_1'], status: 'idle' },
            { id: 'transform_1', type: 'transform', name: 'Calc Size', description: 'Risk-based sizing', position: { x: 600, y: 100 }, config: { subtype: 'calculate_size', method: 'risk_parity', maxRiskUsd: 100 }, inputs: ['condition_2'], outputs: ['action_1'], status: 'idle' },
            { id: 'action_1', type: 'action', name: 'Snipe Buy', description: 'Fast market buy', position: { x: 850, y: 50 }, config: { subtype: 'snipe', slippageBps: 1000, priorityFee: 100000 }, inputs: ['transform_1'], outputs: ['action_2', 'action_3'], status: 'idle' },
            { id: 'action_2', type: 'action', name: 'Trailing Stop 25%', description: 'Wide stop for volatility', position: { x: 1100, y: 50 }, config: { subtype: 'trailing_stop', trailPercent: 25 }, inputs: ['action_1'], outputs: [], status: 'idle' },
            { id: 'action_3', type: 'action', name: 'Alert', description: 'Notify of snipe', position: { x: 1100, y: 150 }, config: { subtype: 'alert', channel: 'telegram', template: 'Sniped {{token}} for {{amount}}' }, inputs: ['action_1'], outputs: [], status: 'idle' },
          ],
          edges: [
            { id: 'e1', source: 'trigger_1', target: 'condition_1' },
            { id: 'e2', source: 'condition_1', target: 'condition_2' },
            { id: 'e3', source: 'condition_2', target: 'transform_1' },
            { id: 'e4', source: 'transform_1', target: 'action_1' },
            { id: 'e5', source: 'action_1', target: 'action_2' },
            { id: 'e6', source: 'action_1', target: 'action_3' },
          ],
          enabled: false,
          triggers: [{ type: 'new_launch', config: { sources: ['pumpfun', 'raydium'] } }],
        },
        tags: ['snipe', 'launch', 'pumpfun', 'high-risk'],
        difficulty: 'advanced',
        estimatedSetupTime: '10 min',
      },
    ];
  }

  // Workflow CRUD
  createWorkflow(workflow: Omit<Workflow, 'id' | 'version' | 'createdAt' | 'updatedAt' | 'runCount' | 'successCount' | 'errorCount'>): Workflow {
    const newWorkflow: Workflow = {
      ...workflow,
      id: `wf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      runCount: 0,
      successCount: 0,
      errorCount: 0,
    };
    this.workflows.set(newWorkflow.id, newWorkflow);
    this.notifySubscribers();
    return newWorkflow;
  }

  createFromTemplate(templateId: string, overrides?: Partial<Workflow>): Workflow | null {
    const template = this.templates.find(t => t.id === templateId);
    if (!template) return null;

    return this.createWorkflow({
      ...template.workflow,
      name: overrides?.name || template.workflow.name,
      description: overrides?.description || template.workflow.description,
      enabled: false, // Always start disabled for safety
      ...overrides,
    });
  }

  getWorkflow(id: string): Workflow | undefined {
    return this.workflows.get(id);
  }

  getAllWorkflows(): Workflow[] {
    return Array.from(this.workflows.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  updateWorkflow(id: string, updates: Partial<Workflow>): Workflow | null {
    const workflow = this.workflows.get(id);
    if (!workflow) return null;

    const updated = {
      ...workflow,
      ...updates,
      version: workflow.version + 1,
      updatedAt: Date.now(),
    };
    this.workflows.set(id, updated);
    this.notifySubscribers();
    return updated;
  }

  deleteWorkflow(id: string): boolean {
    const deleted = this.workflows.delete(id);
    if (deleted) this.notifySubscribers();
    return deleted;
  }

  // Node/Edge manipulation
  addNode(workflowId: string, node: Omit<WorkflowNode, 'id'>): WorkflowNode | null {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return null;

    const newNode: WorkflowNode = {
      ...node,
      id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    };
    workflow.nodes.push(newNode);
    this.updateWorkflow(workflowId, { nodes: workflow.nodes });
    return newNode;
  }

  updateNode(workflowId: string, nodeId: string, updates: Partial<WorkflowNode>): WorkflowNode | null {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return null;

    const nodeIndex = workflow.nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex === -1) return null;

    workflow.nodes[nodeIndex] = { ...workflow.nodes[nodeIndex], ...updates };
    this.updateWorkflow(workflowId, { nodes: workflow.nodes });
    return workflow.nodes[nodeIndex];
  }

  deleteNode(workflowId: string, nodeId: string): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return false;

    workflow.nodes = workflow.nodes.filter(n => n.id !== nodeId);
    workflow.edges = workflow.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    this.updateWorkflow(workflowId, { nodes: workflow.nodes, edges: workflow.edges });
    return true;
  }

  addEdge(workflowId: string, edge: Omit<WorkflowEdge, 'id'>): WorkflowEdge | null {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return null;

    const newEdge: WorkflowEdge = {
      ...edge,
      id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    };
    workflow.edges.push(newEdge);
    this.updateWorkflow(workflowId, { edges: workflow.edges });
    return newEdge;
  }

  deleteEdge(workflowId: string, edgeId: string): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return false;

    workflow.edges = workflow.edges.filter(e => e.id !== edgeId);
    this.updateWorkflow(workflowId, { edges: workflow.edges });
    return true;
  }

  // Execution
  async executeWorkflow(workflowId: string, triggerData?: any): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error('Workflow not found');
    if (!workflow.enabled) throw new Error('Workflow is disabled');

    const execution: WorkflowExecution = {
      id: `exec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      workflowId,
      status: 'running',
      startedAt: Date.now(),
      triggerData,
      nodeResults: new Map(),
    };

    this.executions.set(execution.id, execution);
    this.notifyExecutionSubscribers(execution);

    const abortController = new AbortController();
    this.runningExecutions.set(execution.id, abortController);

    try {
      await this.executeWorkflowGraph(workflow, execution, abortController.signal);
      
      execution.status = 'completed';
      execution.completedAt = Date.now();
      this.updateWorkflow(workflowId, { 
        lastRun: execution.completedAt,
        runCount: workflow.runCount + 1,
        successCount: workflow.successCount + 1,
      });
    } catch (error) {
      execution.status = 'failed';
      execution.completedAt = Date.now();
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      this.updateWorkflow(workflowId, { 
        runCount: workflow.runCount + 1,
        errorCount: workflow.errorCount + 1,
      });
    }

    this.runningExecutions.delete(execution.id);
    this.notifyExecutionSubscribers(execution);
    return execution;
  }

  private async executeWorkflowGraph(
    workflow: Workflow,
    execution: WorkflowExecution,
    signal: AbortSignal
  ): Promise<void> {
    // Build adjacency list
    const adjacency = new Map<string, string[]>();
    const reverseAdjacency = new Map<string, string[]>();
    
    for (const edge of workflow.edges) {
      if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
      adjacency.get(edge.source)!.push(edge.target);
      
      if (!reverseAdjacency.has(edge.target)) reverseAdjacency.set(edge.target, []);
      reverseAdjacency.get(edge.target)!.push(edge.source);
    }

    // Find start nodes (triggers with no inputs)
    const startNodes = workflow.nodes
      .filter(n => n.type === 'trigger' && n.inputs.length === 0)
      .map(n => n.id);

    // Execute using topological order
    const executed = new Set<string>();
    const queue = [...startNodes];

    while (queue.length > 0) {
      if (signal.aborted) throw new Error('Execution cancelled');

      const nodeId = queue.shift()!;
      if (executed.has(nodeId)) continue;

      const node = workflow.nodes.find(n => n.id === nodeId);
      if (!node) continue;

      // Check if all inputs are satisfied
      const inputs = reverseAdjacency.get(nodeId) || [];
      const allInputsDone = inputs.every(inputId => executed.has(inputId));
      if (!allInputsDone) {
        queue.push(nodeId); // Re-queue
        continue;
      }

      // Execute node
      execution.currentNode = nodeId;
      this.notifyExecutionSubscribers(execution);

      const startTime = Date.now();
      try {
        const inputData = this.gatherInputData(node, execution, workflow);
        const output = await this.executeNode(node, inputData, execution);
        
        execution.nodeResults.set(nodeId, {
          nodeId,
          status: 'success',
          input: inputData,
          output,
          duration: Date.now() - startTime,
          timestamp: Date.now(),
        });

        node.status = 'success';
        node.lastRun = { timestamp: Date.now(), duration: Date.now() - startTime, output };
      } catch (error) {
        execution.nodeResults.set(nodeId, {
          nodeId,
          status: 'error',
          input: {},
          output: null,
          duration: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now(),
        });

        node.status = 'error';
        node.lastRun = { timestamp: Date.now(), duration: Date.now() - startTime, error: error instanceof Error ? error.message : 'Unknown error' };
        
        // For now, stop on error (could add error handling branches)
        throw error;
      }

      executed.add(nodeId);

      // Add outputs to queue
      const outputs = adjacency.get(nodeId) || [];
      for (const outputId of outputs) {
        queue.push(outputId);
      }
    }
  }

  private gatherInputData(node: WorkflowNode, execution: WorkflowExecution, workflow: Workflow): any {
    const inputs: Record<string, any> = {};
    
    for (const inputNodeId of node.inputs) {
      const result = execution.nodeResults.get(inputNodeId);
      if (result?.status === 'success') {
        const inputNode = workflow.nodes.find(n => n.id === inputNodeId);
        inputs[inputNodeId] = result.output;
      }
    }

    // Include trigger data for first nodes
    if (node.type === 'trigger') {
      inputs.trigger = execution.triggerData;
    }

    return inputs;
  }

  private async executeNode(node: WorkflowNode, input: any, execution: WorkflowExecution): Promise<any> {
    // In production, this would call actual services
    // For now, simulate execution
    await new Promise(resolve => setTimeout(resolve, 100));

    switch (node.type) {
      case 'trigger':
        return { triggered: true, data: input.trigger, timestamp: Date.now() };

      case 'condition':
        return this.evaluateCondition(node, input);

      case 'action':
        return this.executeAction(node, input, execution);

      case 'transform':
        return this.executeTransform(node, input);

      case 'delay':
        return this.executeDelay(node, input);

      case 'branch':
        return this.executeBranch(node, input);

      case 'merge':
        return this.executeMerge(node, input);

      default:
        return { executed: true, nodeId: node.id };
    }
  }

  private evaluateCondition(node: WorkflowNode, input: any): any {
    const config = node.config;
    // Simplified condition evaluation
    return { 
      passed: true, // Would evaluate actual condition
      condition: config.subtype,
      details: config 
    };
  }

  private executeAction(node: WorkflowNode, input: any, execution: WorkflowExecution): any {
    const config = node.config;
    // In production: call Jupiter, GMGN, etc.
    return { 
      executed: true, 
      action: config.subtype,
      params: config,
      txHash: `sim_${Date.now()}`,
      timestamp: Date.now() 
    };
  }

  private executeTransform(node: WorkflowNode, input: any): any {
    const config = node.config;
    // Simplified transforms
    return { 
      transformed: true, 
      transform: config.subtype,
      result: input, // Would transform
      timestamp: Date.now() 
    };
  }

  private executeDelay(node: WorkflowNode, input: any): any {
    const ms = node.config.ms || 1000;
    return { delayed: true, ms, timestamp: Date.now() };
  }

  private executeBranch(node: WorkflowNode, input: any): any {
    return { branched: true, path: 'true', timestamp: Date.now() };
  }

  private executeMerge(node: WorkflowNode, input: any): any {
    return { merged: true, inputs: Object.keys(input).length, timestamp: Date.now() };
  }

  cancelExecution(executionId: string): boolean {
    const controller = this.runningExecutions.get(executionId);
    if (controller) {
      controller.abort();
      this.runningExecutions.delete(executionId);
      return true;
    }
    return false;
  }

  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  getExecutionHistory(workflowId?: string, limit: number = 50): WorkflowExecution[] {
    let executions = Array.from(this.executions.values());
    if (workflowId) {
      executions = executions.filter(e => e.workflowId === workflowId);
    }
    return executions
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit);
  }

  // Templates
  getTemplates(category?: WorkflowTemplate['category']): WorkflowTemplate[] {
    let templates = this.templates;
    if (category) {
      templates = templates.filter(t => t.category === category);
    }
    return templates;
  }

  // Subscriptions
  subscribe(callback: (workflows: Workflow[]) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  subscribeToExecutions(callback: (execution: WorkflowExecution) => void): () => void {
    this.executionSubscribers.add(callback);
    return () => this.executionSubscribers.delete(callback);
  }

  private notifySubscribers(): void {
    const workflows = this.getAllWorkflows();
    for (const sub of this.subscribers) {
      try { sub(workflows); } catch (e) { console.error('Workflow subscriber error:', e); }
    }
  }

  private notifyExecutionSubscribers(execution: WorkflowExecution): void {
    for (const sub of this.executionSubscribers) {
      try { sub(execution); } catch (e) { console.error('Execution subscriber error:', e); }
    }
  }

  // Validation
  validateWorkflow(workflow: Workflow): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for cycles
    if (this.hasCycles(workflow)) {
      errors.push('Workflow contains cycles');
    }

    // Check for disconnected nodes
    const connected = new Set<string>();
    for (const edge of workflow.edges) {
      connected.add(edge.source);
      connected.add(edge.target);
    }
    for (const node of workflow.nodes) {
      if (!connected.has(node.id) && workflow.nodes.length > 1) {
        errors.push(`Node "${node.name}" is not connected`);
      }
    }

    // Check trigger nodes exist
    const hasTrigger = workflow.nodes.some(n => n.type === 'trigger');
    if (!hasTrigger) {
      errors.push('Workflow must have at least one trigger node');
    }

    return { valid: errors.length === 0, errors };
  }

  private hasCycles(workflow: Workflow): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const adj = new Map<string, string[]>();

    for (const edge of workflow.edges) {
      if (!adj.has(edge.source)) adj.set(edge.source, []);
      adj.get(edge.source)!.push(edge.target);
    }

    const dfs = (nodeId: string): boolean => {
      if (recStack.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      recStack.add(nodeId);

      const neighbors = adj.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (dfs(neighbor)) return true;
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const node of workflow.nodes) {
      if (dfs(node.id)) return true;
    }

    return false;
  }
}

// Singleton
let workflowBuilderInstance: WorkflowBuilder | null = null;

export function getWorkflowBuilder(): WorkflowBuilder {
  if (!workflowBuilderInstance) {
    workflowBuilderInstance = new WorkflowBuilder();
  }
  return workflowBuilderInstance;
}

// React hook
export function useWorkflowBuilder() {
  const builder = getWorkflowBuilder();
  
  return {
    createWorkflow: (wf: any) => builder.createWorkflow(wf),
    createFromTemplate: (id: string, overrides?: any) => builder.createFromTemplate(id, overrides),
    getWorkflow: (id: string) => builder.getWorkflow(id),
    getAllWorkflows: () => builder.getAllWorkflows(),
    updateWorkflow: (id: string, updates: any) => builder.updateWorkflow(id, updates),
    deleteWorkflow: (id: string) => builder.deleteWorkflow(id),
    addNode: (wfId: string, node: any) => builder.addNode(wfId, node),
    updateNode: (wfId: string, nodeId: string, updates: any) => builder.updateNode(wfId, nodeId, updates),
    deleteNode: (wfId: string, nodeId: string) => builder.deleteNode(wfId, nodeId),
    addEdge: (wfId: string, edge: any) => builder.addEdge(wfId, edge),
    deleteEdge: (wfId: string, edgeId: string) => builder.deleteEdge(wfId, edgeId),
    executeWorkflow: (id: string, triggerData?: any) => builder.executeWorkflow(id, triggerData),
    cancelExecution: (id: string) => builder.cancelExecution(id),
    getExecution: (id: string) => builder.getExecution(id),
    getExecutionHistory: (wfId?: string, limit?: number) => builder.getExecutionHistory(wfId, limit),
    getTemplates: (category?: string) => builder.getTemplates(category),
    validateWorkflow: (wf: Workflow) => builder.validateWorkflow(wf),
    subscribe: (callback: any) => builder.subscribe(callback),
    subscribeToExecutions: (callback: any) => builder.subscribeToExecutions(callback),
  };
}

export type { Workflow, WorkflowNode, WorkflowEdge, WorkflowExecution, NodeExecutionResult, WorkflowTrigger, WorkflowTemplate };
export { NODE_TYPES };