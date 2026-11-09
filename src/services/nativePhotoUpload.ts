export function appendNativePhoto(
  body: FormData,
  uri: string,
  FileClass: new (uri: string) => Blob,
) {
  body.append("file", new FileClass(uri));
}
