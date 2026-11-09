import { expect, it } from "vitest";
import { convertFormDataAsync } from "../../node_modules/expo/src/winter/fetch/convertFormData";
import { appendNativePhoto } from "./nativePhotoUpload";

it("serializes native JPEG file bytes through the actual Expo multipart encoder", async () => {
  const photo = new Uint8Array([255,216,255,224,0,16,74,70,73,70,0,255,217]);
  // This stand-in supplies native File's bytes() interface; Expo's own encoder
  // performs the multipart conversion, rather than mocking its result.
  class NativeFile {
    name = "bottle.jpg";
    type = "image/jpeg";
    constructor(readonly uri: string) {}
    async bytes() {
      return photo;
    }
  }
  const parts: [string, unknown][] = [];
  const form = {
    append: (key: string, value: unknown) => parts.push([key, value]),
    entries: () => parts.values(),
  } as unknown as FormData;
  appendNativePhoto(
    form,
    "file:///camera/bottle.jpg",
    NativeFile as unknown as new (uri: string) => Blob,
  );
  const { body } = await convertFormDataAsync(form, "fraggy-native-test");
  const text = new TextDecoder().decode(body);
  expect(text).toContain('name="file"; filename="bottle.jpg"');
  expect(text).toContain("content-type: image/jpeg");
  const headerEnd = new TextEncoder().encode(
    text.slice(0, text.indexOf("\r\n\r\n") + 4),
  ).length;
  expect(body.slice(headerEnd, headerEnd + photo.length)).toEqual(photo);
});
