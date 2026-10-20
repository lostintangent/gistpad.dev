import { z } from "zod";

// The agent's tools are defined independently of any SDK (and are adapted to one by its runtime), so
// that the same tools can also be given to the voice assistant.

export interface AgentTool<Parameters extends z.ZodObject = z.ZodObject> {
  name: string;
  description: string;
  parameters: Parameters;
  /** Returns the result (for the model), and throws if it fails. */
  execute(args: z.infer<Parameters>): string | Promise<string>;
  /**
   * Whether a failure fails the entire request, rather than being reported to the model (which lets
   * it correct its arguments and try again).
   */
  failsRequest?: boolean;
}

/** Defines a tool (whose `execute` arguments are inferred from its parameters). */
export const defineTool = <Parameters extends z.ZodObject>(tool: AgentTool<Parameters>) => tool;
