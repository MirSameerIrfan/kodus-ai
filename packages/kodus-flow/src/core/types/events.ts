// Novos tipos de eventos para observabilidade de alto nível de planejamento e execução

export type AgentPlanEvent =
    | {
          type: 'agent.plan.created';
          agentId: string;
          runId: string;
          plan: {
              totalSteps: number;
              goal: string;
              steps: Array<{
                  id: string;
                  description: string;
                  type: string;
                  status: 'pending';
              }>;
          };
          timestamp: number;
      }
    | {
          type: 'agent.step.started';
          agentId: string;
          runId: string;
          stepId: string;
          stepIndex: number;
          timestamp: number;
      }
    | {
          type: 'agent.step.completed';
          agentId: string;
          runId: string;
          stepId: string;
          result: unknown;
          timestamp: number;
      }
    | {
          type: 'agent.step.failed';
          agentId: string;
          runId: string;
          stepId: string;
          error: string;
          timestamp: number;
      }
    | {
          type: 'agent.plan.updated'; // Para re-planning (ReWoo/ReAct)
          agentId: string;
          newPlan: unknown;
          timestamp: number;
      };
