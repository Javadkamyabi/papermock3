/**
 * PipelineModule: Orchestrator/Engine for PaperMock3/PaperDig system
 * Manages pipeline execution, state, dependencies, and progress tracking
 * Does NOT analyze paper content - only coordinates module execution
 */

import { BaseAssessmentModule } from './base.js';
import type { ModuleConfig } from '../types/index.js';

interface PaperMetadata {
  submission_id?: string;
  paper_title?: string;
  authors?: string[];
  venue?: string | null;
  submission_date?: string | null;
}

interface PaperSource {
  type: 'pdf' | 'text' | 'other';
  location: string;
}

interface ModuleState {
  name: string;
  required: boolean;
  status: 'pending' | 'running' | 'success' | 'failed';
  retries: number;
  last_error: string | null;
}

interface PipelineState {
  document_id: string;
  paper_metadata: PaperMetadata;
  paper_source: PaperSource;
  modules_state: Record<string, ModuleState>;
  max_retries_per_module: number;
}

interface NextAction {
  action: 'run_module' | 'retry_module' | 'no_action';
  target_module: string;
  reason: string;
}

interface BlockingProblem {
  module: string;
  reason: string;
  retries_exhausted: boolean;
}

interface PipelineOutput {
  module: string;
  version: string;
  success: boolean;
  document_id: string;
  pipeline_status: 'running' | 'completed_success' | 'blocked' | 'completed_with_errors';
  next_actions: NextAction[];
  progress: {
    completed_required_modules: number;
    total_required_modules: number;
    fraction: number;
    description: string;
  };
  blocking_problems: BlockingProblem[];
  error?: string;
}

export class PipelineModule extends BaseAssessmentModule {
  constructor() {
    const config: ModuleConfig = {
      name: 'PipelineModule',
      description: 'Orchestrates pipeline execution and state management for all modules',
      version: '1.0.0',
    };
    super(config);
  }

  /**
   * Main assessment method - not used by this module
   */
  async assess(paperText: string, paperId: string): Promise<Record<string, any>> {
    throw new Error('PipelineModule must be called with process() method, not assess()');
  }

  /**
   * Get module dependencies
   */
  private getModuleDependencies(moduleId: string): string[] {
    const dependencies: Record<string, string[]> = {
      '1': [], // Module 1 can run immediately
      '2': ['1'], // Module 2 needs Module 1
      '3': ['1', '2'], // Module 3 needs Modules 1 and 2
      '4': ['1', '2'], // Module 4 group needs Modules 1 and 2
      '6': ['1', '2'], // Module 6 needs Modules 1 and 2
      '7': ['1', '2'], // Module 7 needs Modules 1 and 2
      '8': ['1', '2'], // Module 8 needs Modules 1 and 2
      '9': ['1', '2'], // Module 9 needs Modules 1 and 2
      '10': ['1', '2'], // Module 10 needs Modules 1 and 2
      '11': ['1', '2'], // Module 11 needs Modules 1 and 2
      '12': ['1', '2'], // Module 12 needs Modules 1 and 2
      '13': ['1', '2'], // Module 13 needs Modules 1 and 2
      '14': ['1', '2'], // Module 14 needs Modules 1 and 2
      '15': ['1', '2', '3', '4', '6', '7', '8', '9', '10', '11', '12', '13', '14'], // Module 15 needs all analysis modules
      '16': ['15'], // Module 16 needs Module 15
      'BackEndModule': ['1', '2', '3', '4', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'], // BackEndModule needs all required modules
    };
    return dependencies[moduleId] || [];
  }

  /**
   * Check if all dependencies are satisfied
   */
  private areDependenciesSatisfied(moduleId: string, modulesState: Record<string, ModuleState>): boolean {
    const dependencies = this.getModuleDependencies(moduleId);
    return dependencies.every(depId => {
      const depState = modulesState[depId];
      return depState && depState.status === 'success';
    });
  }

  /**
   * Determine pipeline status
   */
  private determinePipelineStatus(modulesState: Record<string, ModuleState>): 'running' | 'completed_success' | 'blocked' | 'completed_with_errors' {
    const requiredModules = Object.entries(modulesState)
      .filter(([_, state]) => state.required)
      .map(([id, _]) => id);

    // Check if all required modules are successful
    const allRequiredSuccessful = requiredModules.every(id => {
      const state = modulesState[id];
      return state && state.status === 'success';
    });

    if (allRequiredSuccessful) {
      return 'completed_success';
    }

    // Check for blocking failures (required modules that failed with retries exhausted)
    const blockingFailures = requiredModules.filter(id => {
      const state = modulesState[id];
      return (
        state &&
        state.status === 'failed' &&
        state.retries >= (modulesState[id]?.retries || 0) // This will be checked against max_retries
      );
    });

    if (blockingFailures.length > 0) {
      // Check if any blocking failure prevents later modules
      const hasBlockingDependency = blockingFailures.some(failedId => {
        // Check if any module depends on this failed module
        return Object.keys(modulesState).some(otherId => {
          const deps = this.getModuleDependencies(otherId);
          return deps.includes(failedId);
        });
      });

      if (hasBlockingDependency) {
        return 'blocked';
      }
      return 'completed_with_errors';
    }

    return 'running';
  }

  /**
   * Plan next actions
   */
  private planNextActions(
    modulesState: Record<string, ModuleState>,
    maxRetries: number
  ): NextAction[] {
    const actions: NextAction[] = [];

    for (const [moduleId, state] of Object.entries(modulesState)) {
      // Check if module is pending and dependencies are satisfied
      if (state.status === 'pending' && this.areDependenciesSatisfied(moduleId, modulesState)) {
        actions.push({
          action: 'run_module',
          target_module: moduleId,
          reason: `Dependencies satisfied and module is pending`,
        });
      }

      // Check if module failed and can be retried
      if (
        state.status === 'failed' &&
        state.retries < maxRetries &&
        this.areDependenciesSatisfied(moduleId, modulesState)
      ) {
        actions.push({
          action: 'retry_module',
          target_module: moduleId,
          reason: `Previous failure, ${maxRetries - state.retries} retries remaining`,
        });
      }
    }

    // If no actions, return a no_action
    if (actions.length === 0) {
      actions.push({
        action: 'no_action',
        target_module: '',
        reason: 'Waiting for external completion updates or all modules are running/completed.',
      });
    }

    return actions;
  }

  /**
   * Calculate progress
   */
  private calculateProgress(modulesState: Record<string, ModuleState>): {
    completed_required_modules: number;
    total_required_modules: number;
    fraction: number;
    description: string;
  } {
    const requiredModules = Object.entries(modulesState).filter(([_, state]) => state.required);
    const totalRequired = requiredModules.length;
    const completedRequired = requiredModules.filter(
      ([_, state]) => state.status === 'success'
    ).length;

    const fraction = totalRequired > 0 ? completedRequired / totalRequired : 0.0;

    // Build description
    const pendingModules = requiredModules
      .filter(([_, state]) => state.status === 'pending')
      .map(([id, state]) => state.name);
    const failedModules = requiredModules
      .filter(([_, state]) => state.status === 'failed')
      .map(([id, state]) => state.name);
    const runningModules = requiredModules
      .filter(([_, state]) => state.status === 'running')
      .map(([id, state]) => state.name);

    const remaining = [...pendingModules, ...failedModules, ...runningModules];
    const description =
      remaining.length > 0
        ? `Completed ${completedRequired}/${totalRequired} required modules. Remaining: ${remaining.join(', ')}.`
        : `Completed ${completedRequired}/${totalRequired} required modules.`;

    return {
      completed_required_modules: completedRequired,
      total_required_modules: totalRequired,
      fraction,
      description,
    };
  }

  /**
   * Identify blocking problems
   */
  private identifyBlockingProblems(
    modulesState: Record<string, ModuleState>,
    maxRetries: number
  ): BlockingProblem[] {
    const problems: BlockingProblem[] = [];

    for (const [moduleId, state] of Object.entries(modulesState)) {
      if (
        state.required &&
        state.status === 'failed' &&
        state.retries >= maxRetries
      ) {
        // Check if this module blocks other modules
        const blocksOthers = Object.keys(modulesState).some(otherId => {
          if (otherId === moduleId) return false;
          const deps = this.getModuleDependencies(otherId);
          return deps.includes(moduleId);
        });

        if (blocksOthers || state.required) {
          problems.push({
            module: moduleId,
            reason: `Required module ${state.name} failed after ${state.retries} retries. ${blocksOthers ? 'This blocks dependent modules.' : 'This prevents pipeline completion.'}`,
            retries_exhausted: true,
          });
        }
      }
    }

    return problems;
  }

  /**
   * Process pipeline state and generate orchestration output
   */
  async process(pipelineState: PipelineState): Promise<PipelineOutput> {
    try {
      // Validate input
      if (!pipelineState.document_id) {
        return {
          module: this.config.name,
          version: this.config.version,
          success: false,
          document_id: '',
          pipeline_status: 'blocked',
          next_actions: [],
          progress: {
            completed_required_modules: 0,
            total_required_modules: 0,
            fraction: 0,
            description: 'Invalid input',
          },
          blocking_problems: [],
          error: 'Invalid pipeline state: document_id missing.',
        };
      }

      if (!pipelineState.modules_state) {
        return {
          module: this.config.name,
          version: this.config.version,
          success: false,
          document_id: pipelineState.document_id,
          pipeline_status: 'blocked',
          next_actions: [],
          progress: {
            completed_required_modules: 0,
            total_required_modules: 0,
            fraction: 0,
            description: 'Invalid input',
          },
          blocking_problems: [],
          error: 'Invalid pipeline state: modules_state missing.',
        };
      }

      if (!pipelineState.paper_source) {
        return {
          module: this.config.name,
          version: this.config.version,
          success: false,
          document_id: pipelineState.document_id,
          pipeline_status: 'blocked',
          next_actions: [],
          progress: {
            completed_required_modules: 0,
            total_required_modules: 0,
            fraction: 0,
            description: 'Invalid input',
          },
          blocking_problems: [],
          error: 'Invalid pipeline state: paper_source missing.',
        };
      }

      const maxRetries = pipelineState.max_retries_per_module || 2;

      // Determine pipeline status
      const pipelineStatus = this.determinePipelineStatus(pipelineState.modules_state);

      // Plan next actions
      const nextActions = this.planNextActions(pipelineState.modules_state, maxRetries);

      // Calculate progress
      const progress = this.calculateProgress(pipelineState.modules_state);

      // Identify blocking problems
      const blockingProblems = this.identifyBlockingProblems(
        pipelineState.modules_state,
        maxRetries
      );

      return {
        module: this.config.name,
        version: this.config.version,
        success: true,
        document_id: pipelineState.document_id,
        pipeline_status: pipelineStatus,
        next_actions: nextActions,
        progress,
        blocking_problems: blockingProblems,
      };
    } catch (error) {
      return {
        module: this.config.name,
        version: this.config.version,
        success: false,
        document_id: pipelineState?.document_id || '',
        pipeline_status: 'blocked',
        next_actions: [],
        progress: {
          completed_required_modules: 0,
          total_required_modules: 0,
          fraction: 0,
          description: 'Error processing pipeline state',
        },
        blocking_problems: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

