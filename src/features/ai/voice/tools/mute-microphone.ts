import type { Tool } from "../types";

export default {
  definition: {
    name: "mute_microphone",
    description: "Mute the user's microphone when they explicitly ask to mute.",
  },
  handler: (_, { muteMicrophone }) => muteMicrophone(),
} as Tool<void>;
