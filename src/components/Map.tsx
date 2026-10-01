import { useEffect, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  localStreets,
  type StreetPack,
  type StreetProperties,
} from "../geo/streets";
import type { Workplace } from "../core/geofence";
import type { LocationSample } from "../location/types";

function textLabel(text: string) {
  const node = document.createElement("span");
  node.textContent = text;
  return node;
}
function style(properties: StreetProperties): L.PathOptions {
  if (properties.kind === "building")
    return {
      color: "#5e777e",
      weight: 1,
      fillColor: "#334c55",
      fillOpacity: 0.85,
    };
  if (properties.kind === "water")
    return {
      color: "#3b7995",
      weight: 3,
      fillColor: "#194457",
      fillOpacity: 0.8,
    };
  const main = [
    "motorway",
    "trunk",
    "primary",
    "secondary",
    "tertiary",
  ].includes(properties.highway ?? "");
  const path = ["footway", "path", "steps", "cycleway"].includes(
    properties.highway ?? "",
  );
  return {
    color: main ? "#e4bb75" : path ? "#99bfa0" : "#8aa1a7",
    weight: main ? 5 : path ? 1.5 : 3,
    opacity: 0.9,
    dashArray: path ? "3 4" : undefined,
  };
}
export function MapView({
  work,
  sample,
  online = true,
  onSetLocation,
}: {
  work?: Workplace;
  sample: LocationSample | null;
  online?: boolean;
  onSetLocation?: (point: { lat: number; lng: number }) => void;
}) {
  const container = useRef<HTMLDivElement>(null),
    mapRef = useRef<L.Map | null>(null);
  const streets = useRef<L.LayerGroup | null>(null),
    workMarkers = useRef<L.LayerGroup | null>(null);
  const pointMarker = useRef<L.Marker | null>(null),
    accuracyCircle = useRef<L.Circle | null>(null);
  const current = useRef({ work, sample, onSetLocation });
  current.current = { work, sample, onSetLocation };
  const dragging = useRef(false),
    positionSeen = useRef(false);
  const sourceSeen = useRef(sample?.source);
  const [pack, setPack] = useState<StreetPack | null>(null),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current, {
      minZoom: 2,
      maxZoom: 20,
      zoomControl: true,
      preferCanvas: false,
    });
    if (work) map.setView([work.lat, work.lng], 17);
    else if (sample) map.setView([sample.latitude, sample.longitude], 17);
    else map.fitWorld();
    mapRef.current = map;
    streets.current = L.layerGroup().addTo(map);
    workMarkers.current = L.layerGroup().addTo(map);
    L.control.scale({ imperial: false }).addTo(map);
    map.attributionControl.addAttribution(
      '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a> · ODbL',
    );
    map.on("click", (event: L.LeafletMouseEvent) => {
      const point = event.latlng.wrap();
      current.current.onSetLocation?.({ lat: point.lat, lng: point.lng });
    });
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);
  useEffect(() => {
    const map = mapRef.current,
      group = workMarkers.current;
    if (!map || !group) return;
    group.clearLayers();
    if (!work) return;
    map.setView([work.lat, work.lng], 17);
    L.circle([work.lat, work.lng], {
      radius: work.exit,
      color: "#e5bd84",
      weight: 1.5,
      fillOpacity: 0.03,
      dashArray: "4 5",
    }).addTo(group);
    L.circle([work.lat, work.lng], {
      radius: work.enter,
      color: "#99dfb6",
      weight: 1.5,
      fillOpacity: 0.08,
    }).addTo(group);
    L.circleMarker([work.lat, work.lng], {
      radius: 7,
      color: "#142c35",
      weight: 2,
      fillColor: "#edc78d",
      fillOpacity: 1,
    })
      .bindTooltip(textLabel(work.name.split(", ")[0]), {
        permanent: true,
        direction: "top",
        className: "workplace-label",
      })
      .addTo(group);
  }, [work]);
  const lat = sample?.latitude,
    lng = sample?.longitude;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!sample) {
      pointMarker.current?.remove();
      pointMarker.current = null;
      accuracyCircle.current?.remove();
      accuracyCircle.current = null;
      return;
    }
    const point: L.LatLngTuple = [sample.latitude, sample.longitude];
    if (sourceSeen.current !== sample.source) {
      positionSeen.current = false;
      sourceSeen.current = sample.source;
    }
    if (!pointMarker.current) {
      const marker = L.marker(point, {
        draggable: Boolean(onSetLocation),
        icon: L.divIcon({
          className: "location-dot",
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      });
      marker
        .bindTooltip(
          textLabel(sample.source === "simulation" ? "Test" : "You"),
          { permanent: true, direction: "bottom", className: "location-label" },
        )
        .addTo(map);
      marker.on("dragstart", () => {
        dragging.current = true;
      });
      marker.on("dragend", () => {
        dragging.current = false;
        const p = marker.getLatLng().wrap();
        current.current.onSetLocation?.({ lat: p.lat, lng: p.lng });
      });
      pointMarker.current = marker;
      accuracyCircle.current = L.circle(point, {
        radius: sample.accuracy,
        color: "#8fdccc",
        weight: 1,
        fillOpacity: 0.08,
      }).addTo(map);
    } else if (!dragging.current) {
      pointMarker.current.setLatLng(point);
      accuracyCircle.current?.setLatLng(point).setRadius(sample.accuracy);
      pointMarker.current.setTooltipContent(
        textLabel(sample.source === "simulation" ? "Test" : "You"),
      );
      if (onSetLocation) pointMarker.current.dragging?.enable();
      else pointMarker.current.dragging?.disable();
    }
    if (!positionSeen.current) {
      positionSeen.current = true;
      // Keep workplace and initial position together; later moves retain pans.
      if (work)
        map.fitBounds([[work.lat, work.lng], point], {
          padding: [45, 45],
          maxZoom: 17,
        });
      else map.setView(point, 17);
    }
  }, [lat, lng, sample?.accuracy, sample?.source, onSetLocation === undefined]);
  useEffect(() => {
    let active = true;
    const point = sample
      ? { lat: sample.latitude, lng: sample.longitude }
      : work;
    if (!point) {
      setPack(null);
      return;
    }
    void localStreets(point.lat, point.lng).then((value) => {
      if (active) setPack(value);
    });
    return () => {
      active = false;
    };
  }, [lat?.toFixed(3), lng?.toFixed(3), work?.code]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !online) return;
    setFailed(false);
    const tiles = L.tileLayer("https://tile.openstreetmap.de/{z}/{x}/{y}.png", {
      maxZoom: 19,
      crossOrigin: true,
      attribution:
        '<a href="https://www.openstreetmap.de/">OpenStreetMap.de</a>',
    }).addTo(map);
    const onError = () => setFailed(true);
    tiles.on("tileerror", onError);
    return () => {
      tiles.off("tileerror", onError);
      tiles.remove();
    };
  }, [online]);
  useEffect(() => {
    const map = mapRef.current,
      group = streets.current;
    if (!map || !group) return;
    group.clearLayers();
    if (!pack || (online && !failed)) return;
    const labels = L.layerGroup().addTo(group),
      candidates: { name: string; kind: string; point: L.LatLng }[] = [];
    for (const kind of ["water", "building", "road", "place"]) {
      L.geoJSON(pack, {
        filter: (feature) => feature.properties.kind === kind,
        style: (feature) => style(feature!.properties),
        pointToLayer: (_, point) =>
          L.circleMarker(point, { radius: 2, color: "#d9dec3", weight: 1 }),
        onEachFeature: (feature, layer) => {
          const name = feature.properties.name;
          if (!name) return;
          layer.bindTooltip(textLabel(name), {
            direction: "center",
            className: `street-label ${kind}`,
          });
          const point =
            layer instanceof L.Polyline
              ? layer.getBounds().getCenter()
              : (layer as L.CircleMarker).getLatLng();
          candidates.push({ name, kind, point });
        },
      }).addTo(group);
    }
    const draw = () => {
      labels.clearLayers();
      const size = map.getSize(),
        used = new Set<string>(),
        boxes: { x: number; y: number; w: number; h: number }[] = [];
      for (const candidate of [...candidates].sort(
        (a, b) =>
          a.point.distanceTo(map.getCenter()) -
          b.point.distanceTo(map.getCenter()),
      )) {
        if (used.has(candidate.name)) continue;
        const p = map.latLngToContainerPoint(candidate.point);
        const w =
          Math.min(
            180,
            [...candidate.name].reduce(
              (value, c) => value + (c.charCodeAt(0) > 255 ? 11 : 6),
              0,
            ),
          ) + 10;
        const box = { x: p.x - w / 2, y: p.y - 9, w, h: 18 };
        if (
          box.x < 4 ||
          box.y < 4 ||
          box.x + w > size.x - 4 ||
          box.y + 18 > size.y - 4 ||
          boxes.some(
            (b) =>
              box.x < b.x + b.w + 6 &&
              box.x + w + 6 > b.x &&
              box.y < b.y + b.h + 6 &&
              box.y + 24 > b.y,
          )
        )
          continue;
        used.add(candidate.name);
        boxes.push(box);
        L.tooltip({
          permanent: true,
          direction: "center",
          className: `street-label ${candidate.kind}`,
          opacity: 1,
        })
          .setLatLng(candidate.point)
          .setContent(textLabel(candidate.name))
          .addTo(labels);
      }
    };
    draw();
    map.on("moveend zoomend resize", draw);
    return () => {
      map.off("moveend zoomend resize", draw);
    };
  }, [pack, online, failed]);
  return (
    <section className="map-card minimal-map">
      <div className="map-stage">
        <div
          className="detail-map"
          ref={container}
          aria-label={
            onSetLocation ? "Test map: click to set location" : "Street map"
          }
        />
      </div>
      {failed && !pack && (
        <span className="map-alert" role="status">
          Map unavailable
        </span>
      )}
    </section>
  );
}
