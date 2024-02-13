document.addEventListener('DOMContentLoaded', function () {
    var map;
    var svgOverlay; // Reference to the SVG overlay

    function initMap(lat, lng) {
        map = L.map('map').setView([lat, lng], 12);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Initial call to update the overlay
        updateSvgOverlay();

        map.on('move', updateSvgOverlay);
        map.on('zoomend', updateSvgOverlay);
    }

    function updateSvgOverlay() {
        if (svgOverlay) {
            map.removeLayer(svgOverlay);
        }

        var center = map.getCenter(); // Current center of the map
        var latDelta = 0.064; // Latitude span
        var lngDelta = 0.076; // Longitude span

        // Calculate the bounds for the overlay
        var overlayBounds = [
            [center.lat - latDelta / 2, center.lng - lngDelta / 2],
            [center.lat + latDelta / 2, center.lng + lngDelta / 2]
        ];

        svgOverlay = L.imageOverlay('rafah.svg', overlayBounds, {
            opacity: 0.5,
            interactive: false
        }).addTo(map);
    }

    function onLocationFound(e) {
        initMap(e.latlng.lat, e.latlng.lng);
    }

    function onLocationError(e) {
        console.log('Location error:', e.message);
        // Fallback to Rafah's accurate coordinates, with a more zoomed-out view
        initMap(31.343, 34.263); // Rafah's coordinates
    }

    // Feature detection for Geolocation API
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(onLocationFound, onLocationError, {
            enableHighAccuracy: true, // Request the best possible results
            timeout: 5000, // Set a timeout limit
            maximumAge: 0 // Accept only fresh location information
        });
    } else {
        console.log('Geolocation is not supported by this browser.');
        onLocationError({message: 'Geolocation not supported.'});
    }
});

// Ensure to replace 'path/to/your/rafah.svg' with the actual path to your SVG file.
