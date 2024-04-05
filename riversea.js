document.addEventListener('DOMContentLoaded', function() {
    const apiKey = 'tg4GJM12';
    let intervalId;
    let lastRiverImageId = '';
    let lastSeaImageId = '';

    // Function to fetch and display artworks from the Rijksmuseum API
    function fetchAndDisplayArtwork(keyword, elementId, lastImageId) {
        const url = `https://www.rijksmuseum.nl/api/en/collection?key=${apiKey}&q=${keyword}&type=painting&imgonly=True&s=relevance`;

        fetch(url)
            .then(response => response.json())
            .then(data => {
                const artworks = data.artObjects.filter(artwork => artwork.objectNumber !== lastImageId);
                if (artworks.length > 0) {
                    const randomIndex = Math.floor(Math.random() * artworks.length);
                    const artwork = artworks[randomIndex];

                    if (elementId === 'riverArt') {
                        lastRiverImageId = artwork.objectNumber;
                        const imageElement = document.getElementById(elementId);
                        imageElement.alt = `Painting depicting a river, sourced from the Rijksmuseum database. ${artwork.longTitle}`;
                        imageElement.src = artwork.webImage.url;
                    } else if (elementId === 'seaArt') {
                        lastSeaImageId = artwork.objectNumber;
                        const imageElement = document.getElementById(elementId);
                        imageElement.alt = `Painting depicting a sea, sourced from the Rijksmuseum database. ${artwork.longTitle}`;
                        imageElement.src = artwork.webImage.url;
                    }
                } else {
                    document.getElementById(elementId).alt = 'No artwork found';
                }
            })
            .catch(error => console.error('Error fetching data:', error));
    }

    // Function to refresh artworks
    function refreshArtworks() {
        fetchAndDisplayArtwork('river', 'riverArt', lastRiverImageId);
        fetchAndDisplayArtwork('sea', 'seaArt', lastSeaImageId);
    }

    // Toggle button functionality
    const refreshButton = document.getElementById('toggleRefresh');
    refreshButton.addEventListener('click', function() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
            this.textContent = 'Resume Refreshing Images';
            this.style.backgroundColor = '#008145';
        } else {
            intervalId = setInterval(refreshArtworks, 5000);
            this.textContent = 'Stop Refreshing Images';
            this.style.backgroundColor = '#c24e44';
        }
    });

    // Load initial artworks immediately, then set up automatic refresh
    refreshArtworks(); // Load images immediately on page load
    intervalId = setInterval(refreshArtworks, 5000);
    refreshButton.textContent = 'Stop Refreshing Images';
    refreshButton.style.backgroundColor = '#c24e44';
});
