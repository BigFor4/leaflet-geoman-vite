import L from './LeafletView/leaflet-geoman.js';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import './LeafletView/leaflet-geoman.css';
import './App.css';

export default function App() {
  const mapRef = useRef(null); // Use ref to store the map instance

  useEffect(() => {
    // Check if the map has already been initialized
    if (mapRef.current === null) {
      // Initialize the map and set its view
      const map = L.map('map').setView([51.505, -0.09], 13);
      mapRef.current = map; // Store the map instance in the ref

      // Add tile layer
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Add leaflet-geoman controls
      map.pm.addControls({
        drawMarker: true,
        drawPolygon: true,
        editMode: true,
        drawPolyline: true,
        removalMode: true,
      });

      const polygon2 = L.polygon([
        [54, -5],
        [54, 1],
        [52, 1],
        [52, -5],
      ], {
        color: '#ff7800',
        fillColor: '#ff7800'
      }).on('click', (e) => {
        const data = e.target;
        data.pm.enable({
          snappable: true,
          draggable: true,
          snappingOrder: ['Wireframe']
        });
      });
      polygon2.addTo(map);
      polygon2.typeDraw = 'Wireframe';
      const polygon3 = L.polygon([
        [55, -8],
        [55, -3],
        [53, -3],
        [53, -8],
      ],{
        color: '#000000',
        fillColor: '#000000'
      }).on('click', (e) => {
        const data = e.target;
        data.pm.enable({
          snappable: true,
          draggable: true,
          snappingOrder: ['Wireframe']
        });
      });
      polygon3.typeDraw = 'Wireframe';
      polygon3.addTo(map);

      const polygon4 = L.polygon([
        [58, -10],
        [58, -5],
        [56, -5],
        [56, -10],
      ]).on('click', (e) => {
        const data = e.target;
        data.pm.enable({
          snappable: true,
          draggable: true,
        });
      });
      polygon4.addTo(map);

      // Fit map bounds to the combined bounds of all polygons
      const group = L.featureGroup([polygon2, polygon3, polygon4]);
      map.fitBounds(group.getBounds());
    }

    return () => {
      if (mapRef.current !== null) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return <div id="map" className="map"></div>;
}
