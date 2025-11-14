import type { Tool } from "../types";

export default {
    definition: {
        name: "end_conversation",
        description:
            "End the current voice conversation when explicitly requested by the user.",
    },
    handler: (_, { endVoiceConversation }) => endVoiceConversation(),
} as Tool<void>;
