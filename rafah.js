document.addEventListener('DOMContentLoaded', function () {
    var map;
    var svgOverlay; // Reference to the SVG overlay

    function initMap(lat, lng) {
        map = L.map('map').setView([lat, lng], 12);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Update the overlay for the first time
        updateSvgOverlay();

        map.on('move', updateSvgOverlay);
        map.on('zoomend', updateSvgOverlay);
    }

    function updateSvgOverlay() {
        var center = map.getCenter(); // Current center of the map

        // Rafah's approximate geographical size (latitude and longitude deltas)
        // Adjust these values based on the actual size of Rafah
        var latDelta = 0.064; // Latitude span
        var lngDelta = 0.076; // Longitude span

        // Calculate the bounds for the overlay based on Rafah's size
        var overlayBounds = [
            [center.lat - latDelta / 2, center.lng - lngDelta / 2],
            [center.lat + latDelta / 2, center.lng + lngDelta / 2]
        ];

        if (svgOverlay) {
            map.removeLayer(svgOverlay);
        }

        svgOverlay = L.imageOverlay('rafah.svg', overlayBounds, {
            opacity: 0.5,
            interactive: false
        }).addTo(map);
    }

    function onLocationFound(e) {
        initMap(e.latlng.lat, e.latlng.lng);
    }

    function onLocationError(e) {
        console.log(e.message);
        // Fallback to a default location
        initMap(31.343, 34.263); // Example: Default to a central position
    }

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            onLocationFound({latlng: {lat: position.coords.latitude, lng: position.coords.longitude}});
        }, onLocationError);
    } else {
        console.log('Geolocation is not supported by this browser.');
        onLocationError({message: 'Geolocation not supported.'});
    }
});

