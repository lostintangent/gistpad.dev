import { getGitHubToken } from "@/hooks/useUserSession";
import { GistComment } from "@/lib/github";
import { createOpenAIClient, getModelProperties, userCommentsAsContext } from "./openai";

export async function researchTopic(
    topic: string,
    description?: string,
    context?: string,
    userComments?: GistComment[]
): Promise<string> {
    const openai = createOpenAIClient();

    const userCommentsContext = userCommentsAsContext(userComments);

    const modelProperties = getModelProperties("research");
    const response = await openai.responses.create({
        ...modelProperties,
        instructions: `# Objective
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

In addition to the research content, also generate a title for the research analysis, and a file name that will be used if the user chooses to save this analysis. Favor concise names that use sentence casing and spaces (e.g. "Historical Examples.md" vs. "historical-examples.md")`,
        input: `The topic I'd like you to research is:\n\n<research_topic>${topic}</research_topic>${context ? `\n\nAdditionally, here is some content for a document that I'm currently working on/viewing, and is likely relevant to my request, so please take it into account:\n\n<referenced_context>${context}</referenced_context>` : ""}${userCommentsContext}`,
        text: {
            format: {
                type: "json_schema",
                name: "research_results",
                description:
                    "A markdown file that contains the results of performing research on the requested topic.",
                strict: true,
                schema: {
                    type: "object",
                    properties: {
                        title: {
                            type: "string",
                            description:
                                "The title of the analysis, which is a concise description of the research analysis, prefixed with an emoji.",
                        },
                        filename: {
                            type: "string",
                            description:
                                "The filename for the markdown file (must end in .md and be a valid filename without slashes, emoji, etc.)",
                        },
                        content: {
                            type: "string",
                            description:
                                "The research analysis/content (in markdown format) for the requested topic.",
                        },
                    },
                    required: ["title", "filename", "content"],
                    additionalProperties: false,
                },
            },
        },
        tools: [
            {
                type: "web_search_preview",
                search_context_size: "high",
            },
            // ATM the GitHub MCP server doesn't include a tool for getting gists, so this isn't
            // particularly useful. But in the future when it does, this will allow the agent to reference
            // the user's gists as part of its research.
            {
                type: "mcp",
                server_url: "https://api.githubcopilot.com/mcp/x/gists/readonly",
                server_label: "github-gists",
                headers: {
                    Authorization: `Bearer ${getGitHubToken()}`,
                },
                require_approval: "never",
            }
        ],
        background: true,
    });

    return response.id;
}

export async function pollResearchTask(
    requestId: string
): Promise<undefined | { title: string; filename: string; content: string }> {
    const openai = createOpenAIClient();
    const response = await openai.responses.retrieve(requestId);
    if (response.status === "completed") {
        // TODO: Look into how to get output_text directly
        const result = JSON.parse(
            response.output
                .find((output) => output.type === "message")!
                .content.find((message) => message.type === "output_text")!.text
        );
        const finalFilename = result.filename.endsWith(".md")
            ? result.filename
            : `${result.filename}.md`;

        return {
            title: result.title,
            filename: finalFilename,
            content: result.content.trim(),
        };
    }
}