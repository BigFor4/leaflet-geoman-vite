import * as L from 'leaflet';
import { useEffect } from "react";
import 'leaflet/dist/leaflet.css';
import './LeafletView/leaflet-geoman.css';
import './App.css';

import * as PM from './LeafletView/leaflet-geoman.js';

export default function App() {
  useEffect(() => {
    // eslint-disable-next-line no-import-assign
    L.PM = PM;

    // Create a map container reference
    const mapContainerIds = ['example2'];
    const maps = [];

    mapContainerIds.forEach((id) => {
      // Check if the map is already initialized
      if (!document.getElementById(id).map) {
        const map = L.map(id).setView([51.505, -0.09], 13);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        // Store the map instance
        maps.push(map);
      }
    });

    // Example of adding elements to map2
    const map2 = maps[0]; // First map (example2)

    // Map2 controls and events
    map2.pm.addControls({
      drawMarker: true,
      drawPolygon: true,
      editMode: true,
      drawPolyline: true,
      removalMode: true,
    });
    return () => {
      // Clean up maps if necessary (optional)
      maps.forEach((map) => {
        map.remove();
      });
    };
  }, []);

  return (
    <div className="map" id="example2"></div>


  );
}
