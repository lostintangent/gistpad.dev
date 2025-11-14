import { generateDalleImage } from "@/agents/openai";
import { uploadImage } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Tool } from "../types";

export default {
  definition: {
    name: "generate_image",
    description:
      "Generate an image URL based on a prompt. And then after you receive the resulting URL, insert it into the document by calling edit_gist with the necessary markdown image link (including the entire document comments + your edits). Only ever generate one image at a time, and so if the user asks for multiple images, then generate one, and then wait to recieve confirmation that it succeeded before generating the next one.",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "The full prompt to use for generating the image.",
        },
        summary: {
          type: "string",
          description:
            "A short description (3-5 words) that summarizes the image being generated.",
        },
      },
      required: ["prompt", "summary"],
    },
  },
  handler: async (args, context) => {
    const toastId = toast.loading(`Generating image ("${args.summary}")...`, { dismissible: false, duration: Infinity });

    const buffer = await generateDalleImage(args.prompt);
    const imageUrl = await uploadImage(context.gistId!, buffer);

    toast.dismiss(toastId);

    return {
      successMessage: `Image generated: ${imageUrl}.`,
      requestResponse: true,
    };
  },
  isEditTool: true,
} as Tool<{
  prompt: string;
  summary: string;
}>;
