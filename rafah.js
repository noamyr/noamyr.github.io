document.addEventListener('DOMContentLoaded', function() {
    var map;
    var svgOverlay; // Reference to the SVG overlay

    function initMap(lat, lng) {
        map = L.map('map').setView([lat, lng], 11);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Call to update the overlay initially and on map events
        updateSvgOverlay();

        map.on('move', updateSvgOverlay);
        map.on('zoomend', updateSvgOverlay);
    }

    function updateSvgOverlay() {
        if (svgOverlay) {
            map.removeLayer(svgOverlay);
        }

        var center = map.getCenter(); // Get the current center of the map
        var latDelta = 0.064; // Latitude span
        var lngDelta = 0.076; // Longitude span
        var overlayBounds = [
            [center.lat - latDelta / 2, center.lng - lngDelta / 2],
            [center.lat + latDelta / 2, center.lng + lngDelta / 2]
        ];

        svgOverlay = L.imageOverlay('rafah.svg', overlayBounds, {
            opacity: 0.5,
            interactive: false
        }).addTo(map);
    }

    function getLocationAndInitMap() {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(function(position) {
                // Successfully retrieved the location
                initMap(position.coords.latitude, position.coords.longitude);
            }, function(error) {
                // Error or permission denied
                console.error('Geolocation error:', error.message);
                initMap(31.343, 34.263); // Example: Default to a central position
            }, {
                enableHighAccuracy: true,
                timeout: 10000, // 10 seconds
                maximumAge: 0
            });
        } else {
            console.log('Geolocation is not supported by this browser.');
            initMap(31.343, 34.263); // Example: Default to a central position
        }
    }

    getLocationAndInitMap();
});
