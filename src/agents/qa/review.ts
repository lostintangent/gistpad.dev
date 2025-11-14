import { GistComment } from "@/lib/github";
import { Tool } from "@openai/agents";
import z from "zod";
import { AdditionalReference, AgentFollowUp, generateTitle } from "../openai";
import { runStreamingAgent } from "./base";

export interface ReviewComment {
    id: number;
    heading?: string;
    comment?: string;
    applyPrompt?: string;
    referencedText?: string | null;
    replaceWith?: string | null;
    insertAfter?: string | null;
    isExample?: boolean;
}

export interface ReviewContentResult {
    title: string;
    comments: ReviewComment[];
    followUp: AgentFollowUp;
}

const systemPrompt = `# Objective
* Your objective is to review a markdown document, analyze the user's request (provided with a <request> tag), and then provide helpful feedback, ideas, thoughts, praise, reflection, and/or suggestions (depending on the intent of their request).
* You should first analyze the request and determine the best way to respond, based on the nature of the request and the available context (see below for instructions on how to do this).
* If the request explicitly asks for a specific type of feedback (praise, tips, suggestions, etc.) then focus on ONLY that (e.g. don't provide praise when you're asked for advice).

## Generating review comments
* You must ONLY respond by returning one or more comments, that are directly relevant and helpful for the user's request.Do not include any other text in your response.
* Unless the user request's otherwise, be very concise in your comment bodies, favoring 1-2 sentences when possible. However, don't compromise on important detail or nuance.
* When suggesting changes, or providing critique, make sure to match the tone, style, and personality of the existing document.Don't suggest changes that would be inconsistent with the document's existing style.
* When you have general thoughts / feedback / suggestions about the entire document (e.g. a suggestion that would impact multiple places vs. one paragraph), then...
    - Provide only the review_comment property
    - Set referenced_text, replace_with, insert_after, and is_example to \`null\`, since you're commenting on the entire document as opposed to a specific piece of text
* When you have thoughts / suggestions about a specific piece of text (e.g. a heading, a section, a list item, a table row, a sentence, etc.), then...
    - Always set the referenced_text parameter to the exact text from the content you're commenting on
    - If you're suggesting a direct replacement of the referenced text, then set replace_with to the new text
    - If you're suggesting to insert content after the referenced text (e.g. adding a new list item, creating a new section with a heading), then set insert_after with the value of the content you want to add
    - Never set both replace_with and insert_after for the same comment
    - When you're making a suggestion that would impact multiple places in the document multiple changes or complex edits, don't use replace_with or insert_after, just explain the suggestion in the comment
* CRITICAL: replace_with and insert_after are optional, so make sure to set them to \`null\` if you don't have a specific replacement or insertion suggestion. DO NOT set them to a blank or placeholder string (e.g. ".", "/")
* If the user's request specifically asks for concrete/specific suggestions, then make sure to provide comments that suggest specific changes, and set either the insert_after or replace_with properties as needed. Otherwise, make general and/or concrete suggestions depending on the request.
* If your suggestion implies multiple changes (as opposed to just one), but you're providing a referenced_text / replace_with / insert_after, then make sure to set the is_example property to true, so that it's clear the text / replacement / insertion is just an example of a broader change. Otherwise, set it to false if you're suggesting a single specific change.
* When you want to append an item into a list, make sure to only reference the last item in the list, as opposed to the entire list. If you want to insert an item into the middle of a list, then reference the item that comes before it.
* Based on the nature of the user's request and your feedback, you must also provide an \`apply_prompt\` property, which is a description for how to edit the document, in order to apply this comment/feedback (e.g. adding an item to a list, updating a heading/paragraph, moving text from one location to another, etc.). 
    - This prompt will be provided to the editing agent, so it should be concise but clear, and include all the necessary context to apply the comment. Make sure not to depend on the context of other comments.
    - When a comment implies moving text from one location to another, then the \`apply_prompt\` should describe the source and destination locations (e.g. "Move the text from the 'Introduction' section to the 'Overview' section").
    - The prompt should start with a verb, and provide a concise directive for how to apply the comment's feedback and referenced text/replacement/insertion by means of one or more changes to the document. But you don't need to repeat the referenced text or any text replacement/insertion. Simply provide the additional context needed to apply the comment (e.g. "Update the title heading to reflect the new suggestion", "Add the referenced text to the favorite items list").
* Make sure that the \`apply_prompt\` for each comment is indepedent from other comments, since the user may choose to apply some comments and not others. Therefore, make sure that the \`apply_prompt\` is self-contained and doesn't reference other comments or suggestions.
* Format your comments using markdown, and ensure they follow these style guidelines:
    - For each comment, you MUST ALWAYS generate a heading in the 'heading' field, which summarizes the key point / subject of the comment.Be concise and prepend a fun and relevant emoji to it.
    - In the comment property, use ** bold ** and * italic * for emphasis.
    - Use double quotes instead of single quotes when quoting text. However, don't use quotes for referring to the main subject/noun of the comment (use \`\` for that).
    - Use lists and tables as needed, whenever you need to illustrate or show structured data. But don't use lists to provide multiple suggestions for the request (you MUST always use different comments for that)
    - Use inline \`text\` markers when 1) referencing headings in the content, or 2) when referring to the main subject/noun of the comment
    - If the user asks for a checklist or tasklist, then use the \`- []\` format for the checklist items, as opposed to appending an \`☐\` character to the start of each item.
* CRITICAL: Make sure to create distinct/individual comments for each distinct piece of feedback/suggestion you have, even if they are related to the same topic. Do not combine multiple suggestions into a single comment.`;

export async function reviewContent(
    content: string,
    prompt: string,
    description?: string,
    instructions?: string,
    userComments?: GistComment[],
    additionalReferences?: AdditionalReference[],
    onComments?: (comments: ReviewComment[]) => void,
    onFollowUp?: (followUp: AgentFollowUp) => void,
    onTitle?: (title: string) => void,
    onReasoning?: (summary: string) => void,
    onIsWebSearching?: (isSearching: boolean) => void,
    previousResponseId?: string,
    abortSignal?: AbortSignal,
    extraTools?: Tool[]
): Promise<string> {
    let commentId = 1;
    const comments: ReviewComment[] = [];
    const titleGenerator = generateTitle(prompt, abortSignal);
    const titlePromise = (async () => {
        try {
            let title = "";
            for await (const delta of titleGenerator) {
                title += delta;
                onTitle?.(title);
            }
        } catch (e) {
            console.error("Failed to generate title:", e);
        }
    })();

    const responseId = await runStreamingAgent({
        agentType: "review",
        systemPrompt,
        outputSchema: z.object({
            comments: z.array(
                z.object({
                    heading: z.string(),
                    review_comment: z.string(),
                    apply_prompt: z.string(),
                    referenced_text: z.union([z.string(), z.null()]),
                    replace_with: z.union([z.string(), z.null()]),
                    insert_after: z.union([z.string(), z.null()]),
                    is_example: z.boolean(),
                })
            ),
            follow_up: z.object({
                question: z.string(),
                topic: z.string(),
            }),
        }),
        prompt,
        context: {
            content,
            description,
            instructions,
            userComments,
            additionalReferences,
        },
        onParserValue: ({ key, value, stack }) => {
            if (stack.length >= 3 && typeof stack[2].key === "number") {
                const index = stack[2].key as number;
                if (!comments[index]) {
                    comments[index] = { id: commentId++ };
                }

                const comment = comments[index];
                switch (key) {
                    case "heading":
                        comment.heading = value;
                        break;
                    case "review_comment":
                        comment.comment = value?.replace(
                            /citeturn\d+(search|view)\d+/g,
                            ""
                        );
                        break;
                    case "apply_prompt":
                        comment.applyPrompt = value;
                        break;
                    case "referenced_text":
                        comment.referencedText = value;
                        break;
                    case "replace_with":
                        comment.replaceWith = value;
                        break;
                    case "insert_after":
                        comment.insertAfter = value;
                        break;
                    case "is_example":
                        comment.isExample = value;
                        break;
                }

                onComments?.([...comments]);
            }
        },
        onFollowUp,
        extraTools,
        onReasoning,
        onIsWebSearching,
        previousResponseId,
        abortSignal,
    });

    await titlePromise;
    return responseId;
}
