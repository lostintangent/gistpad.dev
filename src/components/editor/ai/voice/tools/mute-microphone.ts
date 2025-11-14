import { Tool } from "../types";

export default {
    definition: {
        name: "mute_microphone",
        description: "Mute the user's microphone when they explicitly ask to mute.",
    },
    handler: (_, { audioStream, muteMic }) => {
        audioStream.getAudioTracks()[0].enabled = false;
        muteMic();
    },
} as Tool<void>;
