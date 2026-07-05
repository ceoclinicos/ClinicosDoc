export interface GeoCoords {
  lat: number;
  lng: number;
  accuracy?: number;
}

export function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function openStreetMapUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
}

export function googleMapsUrl(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

export function openStreetMapEmbedUrl(lat: number, lng: number): string {
  const pad = 0.008;
  const bbox = `${lng - pad},${lat - pad},${lng + pad},${lat + pad}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export function getCurrentPosition(): Promise<GeoCoords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Su navegador no soporta geolocalización"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "Permiso de ubicación denegado"
            : err.code === err.TIMEOUT
              ? "Tiempo agotado al obtener ubicación"
              : "No se pudo obtener la ubicación";
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  });
}
