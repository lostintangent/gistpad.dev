import { Gist } from "@/lib/github";
import { createOpenAIClient, getModelProperties } from "./openai";

export async function analyzeStyle(gists: Gist[]): Promise<string> {
    const openai = createOpenAIClient();

    // Build array of gist contents
    const gistContents = gists.map((gist) => ({
        description: gist.description,
        files: Object.entries(gist.files).map(([filename, file]) => ({
            filename,
            content: file.content,
        })),
    }));

    const response = await openai.responses.create({
        ...getModelProperties("research"),
        instructions: `You are an expert writing style analyst. Your task is to analyze the contents of several markdown documents and identify common patterns, styles, and conventions that appear consistently across them. 

Your analysis should focus on elements like:

1. Document structure and organization
1. Language tone, voice, style and personality (e.g. use of emojis, humor, sarcasm, etc.)
1. Common formatting/style conventions such as lists, tables, etc.
1. Any other relevant patterns or conventions that you notice

Based on your analysis, generate clear, actionable markdown-formatted instructions that would help someone replicate this writing style in new documents. When responding, don't include any additional text, disclaimers, call-to-actions, or  a wrap-up/footer. Simply provide the instructions in markdown format, since the user will take your response and save it as a markdown file.

Addtionally, when generating the instructions, make sure to follow these guidelines:

* Don't generate a title or heading for the instructions. Simply provide the instructions in markdown format.
* Generate a list of sections, each with a heading that summarizes the key point and is prepended with an emoji.
* Think deeply about the documents and observed patterns, and try to elevate nuanced and meaningful insights that would help someone replicate the writing style. Not just the obvious or surface-level observations.
* Don't include sections that aren't directly relevant to the writing style of the provided documents. If you don't have anything to say about a specific topic, then don't include it in the instructions.
* When multiple gists are provided, make sure to analyze the commonalities and differences between them, and provide instructions that are relevant to all of them. Don't just analyze each gist in isolation.
`,
        input: JSON.stringify(gistContents),
    });

    return response.output_text;
}
