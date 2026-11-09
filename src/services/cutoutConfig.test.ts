import { expect, it } from "vitest";
import { cutoutServerUrl } from "./cutoutConfig";
it("uses the same LAN computer as Metro, not the iPhone localhost", () => {
  expect(cutoutServerUrl(undefined, "192.168.1.40:8081")).toBe(
    "http://192.168.1.40:8787",
  );
});
it("uses an explicit HTTPS processor when provided", () => {
  expect(
    cutoutServerUrl("https://photos.example.test/", "192.168.1.40:8081"),
  ).toBe("https://photos.example.test");
});
it("requires explicit setup for tunnel hosts", () => {
  expect(() => cutoutServerUrl(undefined, "hello.exp.direct")).toThrow(
    "EXPO_PUBLIC_CUTOUT_URL",
  );
});
it.each(["hello.ngrok-free.app", "preview.example.test"])(
  "requires explicit setup for public hosts: %s",
  (host) => {
    expect(() => cutoutServerUrl(undefined, host)).toThrow(
      "EXPO_PUBLIC_CUTOUT_URL",
    );
  },
);
