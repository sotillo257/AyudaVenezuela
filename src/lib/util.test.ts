import { describe, expect, it, vi } from "vitest";
import { buildCenterUrl, distanceMeters, freshness, km, whatsappMessage, whatsappText } from "./util";

describe("util", () => {
  it("formats meter and kilometer distances", () => {
    expect(km(undefined)).toBeNull();
    expect(km(450)).toBe("450 m");
    expect(km(1530)).toBe("1.5 km");
  });

  it("calculates real-world distance in meters", () => {
    const madrid: [number, number] = [40.4168, -3.7038];
    const barcelona: [number, number] = [41.3874, 2.1686];

    expect(distanceMeters(madrid, madrid)).toBeCloseTo(0, 5);
    expect(distanceMeters(madrid, barcelona)).toBeGreaterThan(500_000);
    expect(distanceMeters(madrid, barcelona)).toBeLessThan(520_000);
  });

  it("reports verification freshness without automatic expiration", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-26T12:00:00Z"));

    expect(freshness(null).text).toBe("Sin verificar aún");
    expect(freshness("2026-06-26T11:30:00Z").text).toBe("Comprobado hace menos de 1 h");
    expect(freshness("2026-06-25T12:00:00Z").text).toBe("Comprobado hace 1 d");
    expect(freshness("2026-06-23T12:00:00Z").expired).toBe(false);

    vi.useRealTimers();
  });

  it("builds center URLs from the current origin without duplicate slashes", () => {
    expect(buildCenterUrl("123", "https://example.com")).toBe("https://example.com/centro/123");
    expect(buildCenterUrl("123", "https://example.com/")).toBe("https://example.com/centro/123");
    expect(buildCenterUrl("123")).toBe("/centro/123");
  });

  it("builds WhatsApp sharing links with center details and a clean standalone center URL", () => {
    const message = whatsappMessage(
      { nombre: "Centro Demo", area: "Madrid", acepta: ["Agua", "Alimentos"], horario: "10:00-14:00" },
      "https://example.com/centro/1"
    );
    const url = whatsappText(
      { nombre: "Centro Demo", area: "Madrid", acepta: ["Agua", "Alimentos"], horario: "10:00-14:00" },
      "https://example.com/centro/1"
    );

    expect(message).toContain("Centro Demo");
    expect(message).toContain("Agua, Alimentos");
    expect(message).toContain("\nInfo y ruta: https://example.com/centro/1");
    expect(url).toContain("https://wa.me/?text=");
    expect(decodeURIComponent(url)).toContain(message);
  });
});
