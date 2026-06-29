"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ME } from "@/lib/util";

const pin = L.divIcon({
  className: "",
  iconSize: [28, 36],
  iconAnchor: [14, 36],
  html: `<svg width="28" height="36" viewBox="0 0 24 30"><path d="M12 0C5.4 0 0 5.4 0 12c0 8 12 18 12 18s12-10 12-18C24 5.4 18.6 0 12 0z" fill="#059669" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="12" r="4.5" fill="#fff"/></svg>`,
});

function Clicker({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

function MapReady({ mapRef }: { mapRef: MutableRefObject<L.Map | null> }) {
  const map = useMap();

  useEffect(() => {
    mapRef.current = map;
    const id = window.setTimeout(() => map.invalidateSize(), 80);
    return () => window.clearTimeout(id);
  }, [map, mapRef]);

  return null;
}

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center);
  }, [center, map]);

  return null;
}

export default function MapPicker({
  value, onPick,
}: {
  value: [number, number] | null;
  onPick: (lat: number, lon: number) => void;
}) {
  const mapRef = useRef<L.Map | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>(value ?? ME);

  useEffect(() => {
    if (value) {
      setMapCenter(value);
    }
  }, [value]);

  const locatePerson = useCallback(() => {
    if (typeof window === "undefined" || value) return;
    if (!navigator.geolocation) return;
    if (!window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setMapCenter([coords.latitude, coords.longitude]);
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [value]);

  useEffect(() => {
    locatePerson();
  }, [locatePerson]);

  const pickVisibleCenter = () => {
    const center = mapRef.current?.getCenter();
    onPick(center?.lat ?? mapCenter[0], center?.lng ?? mapCenter[1]);
  };

  return (
    <div
      role="region"
      aria-label="Seleccionar ubicación del centro"
      className="relative h-[26rem] w-full overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50 shadow-inner"
    >
      <MapContainer center={mapCenter} zoom={14} scrollWheelZoom={false} className="h-full w-full">
        <MapReady mapRef={mapRef} />
        <RecenterMap center={mapCenter} />
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Clicker onPick={onPick} />
        {value && <Marker position={value} icon={pin} />}
      </MapContainer>

      <div className="pointer-events-none absolute left-3 right-3 top-3 z-[500] rounded-xl bg-white/95 px-3 py-2 text-[11.5px] font-semibold text-stone-700 shadow-sm">
        Arrastra el mapa y toca el punto exacto del centro de acopio. Si aceptas el permiso, primero intentaré centrarme en tu ubicación.
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[500] rounded-xl bg-stone-900/90 px-3 py-2 text-[11px] text-white shadow-sm">
        {value
          ? `Ubicación seleccionada: ${value[0].toFixed(5)}, ${value[1].toFixed(5)}`
          : "Sin ubicación seleccionada todavía. Toca el mapa o usa el botón para colocar el marcador."}
      </div>

      <button
        type="button"
        onClick={pickVisibleCenter}
        className="absolute bottom-[78px] left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-emerald-600 px-4 py-2 text-[12px] font-bold text-white shadow-lg pointer-events-auto active:scale-[0.98]"
      >
        Seleccionar centro del mapa
      </button>
    </div>
  );
}
