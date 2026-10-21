import chimeUrl from "./chime.mp3";

/** Plays a chime, to let the user know that the agent has finished (e.g. while they look elsewhere). */
export function playChime() {
  return new Audio(chimeUrl).play();
}
