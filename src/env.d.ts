// Non-code imports, which Bun's bundler turns into (content-hashed) URLs, or into
// strings when imported `with { type: "text" }`.

declare module "*.css";

declare module "*.png" {
  const url: string;
  export default url;
}

declare module "*.svg" {
  const url: string;
  export default url;
}

declare module "*.mp3" {
  const url: string;
  export default url;
}

declare module "*.aff" {
  const text: string;
  export default text;
}

declare module "*.dic" {
  const text: string;
  export default text;
}
