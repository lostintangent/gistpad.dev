import type { GistComment } from "@/shared/github";
import { z } from "zod";
import { userCommentsAsContext } from "../model/context";
import { defineTool } from "../model/tools";

// Research is a long-running task (which searches the web in depth), that runs in the background and
// produces a new document. The agent starts it with its research tool, and the user can also start it
// directly (with the "research" mode).

export interface ResearchRequest {
  topic: string;
  /** The description of the gist that the research is for. */
  description?: string;
  /** The document (or selection) that the user is viewing, which is likely relevant to the topic. */
  context?: string;
  userComments?: GistComment[];
}

export const researchInstructions = (description?: string) => `# Objective
* Your objective is to support a user research a provided topic.
* Think deeply about the requirements of the research topic, search the web for relevant sources, synthesize your findings, and then generate a markdown file with the appropriate content/analysis. ${description ? `Also note that this research topic is contained within a project with the following description, so take that context into account: "${description}"` : ""}.

## Research guidelines
When performing the research, make sure to consider the following:

* Think critically about the topic and any sub-topics that might be relevant.
* Search for at least 5 relevant and distinct web sources/citations.
* Don't just summarize the content of the sources, but rather, provide in-depth analysis and insights, with rich yet concise details.

## Content guidelines
When generating the markdown results, make sure to follow these guidelines:

* Include a brief introduction that frames the analysis, but don't include a markdown heading/title for the document.
* Structure the content well and make sure it's easy to read, with clear sections and subheadings (using ## for main sections).
* Include citation links for all sources used. And when including a citiation, make sure to use markdown footnote syntax, so that the citations are rendered as footnotes at the bottom of the document (e.g. [^1], [^2], etc. and then [^1:] at the bottom).
* If you add markdown footnotes/citations at the end of the document, don't include a seperator between it and the previous content. The document will be rendered as HTML and a seperator will be added automatically.
* Don't add any unnecessary content or fluff.
* Add emojis to the beginning of each section's subheading, in order to make it visually distinct, easy to navigate, and fun!
* Don't include a conclusion section at the bottom. Simply provide the intro framing and then structured research results and analysis.
* Don't add a note/disclaimer to the bottom indicating that the content is only a summary of the research. The developer is aware of this and doesn't need a note.
* As needed, make use of markdown formatting, such as bold, italics, underline (<ins></ins>), lists, and tables, to enhance readability and structure.

In addition to the research content, also generate a title for the research analysis, and a file name that will be used if the user chooses to save this analysis. Favor concise names that use sentence casing and spaces (e.g. "Historical Examples.md" vs. "historical-examples.md")`;

export const researchInput = ({ topic, context, userComments }: ResearchRequest) =>
  [
    `The topic I'd like you to research is:\n\n<research_topic>${topic}</research_topic>`,
    context &&
      `Additionally, here is some content for a document that I'm currently working on/viewing, and is likely relevant to my request, so please take it into account:\n\n<referenced_context>${context}</referenced_context>`,
    userCommentsAsContext(userComments),
  ]
    .filter(Boolean)
    .join("\n\n");

/** The research results, which are a markdown file (with a title). */
export type ResearchResult = z.infer<typeof researchResult.schema>;

export const researchResult = {
  name: "research_results",
  description:
    "A markdown file that contains the results of performing research on the requested topic.",
  schema: z.object({
    title: z
      .string()
      .describe(
        "The title of the analysis, which is a concise description of the research analysis, prefixed with an emoji.",
      ),
    filename: z
      .string()
      .describe(
        "The filename for the markdown file (must end in .md and be a valid filename without slashes, emoji, etc.)",
      ),
    content: z
      .string()
      .describe("The research analysis/content (in markdown format) for the requested topic."),
  }),
};

export const RESEARCH_TOOL = "start_research";

/** When the agent can choose to start a research task (which it decides between its other modes). */
export const researchAction = `* Start an in-depth research task about a topic, by calling the \`${RESEARCH_TOOL}\` tool. Only do this when the user explicitly asks you to research (or investigate, explore, etc.) a topic in depth, since it's a long-running task that produces a new document.`;

/** The tool that the agent starts research tasks with (when the user asks it to research a topic). */
export const researchTool = (onResearch: (topic: string) => Promise<void>) =>
  defineTool({
    name: RESEARCH_TOOL,
    description:
      "Starts a long-running research task about a topic (which searches the web in depth, and creates a new document with the results).",
    parameters: z.object({
      topic: z
        .string()
        .describe("What to research, which preserves the details (and wording) of the request"),
    }),
    execute: async ({ topic }) => {
      await onResearch(topic);
      return "Started the research task.";
    },
    // Failing to start a research task fails the request (rather than the agent retrying it)
    failsRequest: true,
  });
