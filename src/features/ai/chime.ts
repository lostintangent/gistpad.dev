import chimeUrl from "@/assets/chime.mp3";

/** Plays a chime, to let the user know that the AI has finished (e.g. while they look elsewhere). */
export function playAiChime() {
  return new Audio(chimeUrl).play();
}
