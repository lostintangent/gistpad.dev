export const optionalString = (value: unknown) => (typeof value === "string" ? value : undefined);

// README is the default file, so keep it omitted from editor and share URLs.
export const omitReadmeFilePath = <T extends { filePath?: string }>({
  filePath,
  ...params
}: T) => ({
  ...params,
  filePath: filePath === "README.md" ? undefined : filePath,
});
