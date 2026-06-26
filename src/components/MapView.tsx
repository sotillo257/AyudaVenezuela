"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair } from "lucide-react";
import type { Centro } from "@/lib/types";
import { STATUS } from "@/lib/util";

function pinIcon(color: string, big = false) {
  const s = big ? 36 : 28;
  return L.divIcon({
    className: "",
    iconSize: [s, s * 1.27],
    iconAnchor: [s / 2, s * 1.27],
    html: `<svg width="${s}" height="${s * 1.27}" viewBox="0 0 24 30">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 8 12 18 12 18s12-10 12-18C24 5.4 18.6 0 12 0z"
        fill="${color}" stroke="#fff" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="4.5" fill="#fff"/></svg>`,
  });
}

const meIcon = L.divIcon({
  className: "",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#0284C7;border:3px solid #fff;box-shadow:0 0 0 4px rgba(2,132,199,.25)"></div>`,
});

function MapRef({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  mapRef.current = useMap();
  return null;
}

function RecenterOnUser({ userPos }: { userPos: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView(userPos, 14, { animate: true });
  }, [map, userPos]);

  return null;
}

export default function MapView({
  centros, userPos, selectedId, onSelect,
}: {
  centros: Centro[];
  userPos: [number, number];
  selectedId: string | null;
  onSelect: (c: Centro) => void;
}) {
  const mapRef = useRef<L.Map | null>(null);

  return (
    <div className="relative h-full w-full">
      <MapContainer center={userPos} zoom={13} zoomControl={false} className="h-full w-full">
        <MapRef mapRef={mapRef} />
        <RecenterOnUser userPos={userPos} />
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={userPos} icon={meIcon} />
        {centros.map((c) => (
          <Marker
            key={c.id}
            position={[c.lat, c.lon]}
            icon={pinIcon(STATUS[c.estado].color, c.id === selectedId)}
            eventHandlers={{ click: () => onSelect(c) }}
          />
        ))}
      </MapContainer>

      <button
        onClick={() => mapRef.current?.setView(userPos, 14, { animate: true })}
        className="absolute right-3.5 bottom-4 z-[500] w-11 h-11 rounded-full bg-white shadow-md flex items-center justify-center"
        title="Centrar en mí"
      >
        <Crosshair size={20} className="text-stone-800" />
      </button>
    </div>
  );
}
