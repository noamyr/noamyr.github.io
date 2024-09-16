// Fetch the summary data from v3 API
fetch('https://data.techforpalestine.org/api/v3/summary.json')
    .then(response => response.json())
    .then(data => {
        const summarySection = document.getElementById('summary-section');
        const gazaData = data.gaza;
        const westBankData = data.west_bank;
        summarySection.innerHTML = `
        <h2>Gaza Casualties:</h2>
        <p>Total Killed: ${gazaData.killed.total || 'N/A'}<br>
        Children Killed: ${gazaData.killed.children || 'N/A'}<br>
        Women Killed: ${gazaData.killed.women || 'N/A'}<br>
        Injured:${gazaData.injured.total || 'N/A'}</p>
        <h2>West Bank Casualties:</h2>
        <p>Total Killed: ${westBankData.killed.total || 'N/A'}<br>
        Children Killed: ${westBankData.killed.children || 'N/A'}<br>
        Injured: ${westBankData.injured.total || 'N/A'}</p>
    `;
    })
    .catch(error => console.error('Error fetching summary data:', error));

// Fetch the infrastructure damage data from v3 API
fetch('https://data.techforpalestine.org/api/v3/infrastructure-damaged.json')
    .then(response => response.json())
    .then(data => {
        const infrastructureSection = document.getElementById('infrastructure-section');
        infrastructureSection.innerHTML = '';  // Clear loading message

        // Use the most recent report (last one in the array)
        const mostRecentReport = data[data.length - 1];

        // Create a data item for the most recent infrastructure report
        const dataItem = document.createElement('div');
        dataItem.classList.add('data-item');
        dataItem.innerHTML = `
        <h2>Infrastructure Damage:</h2>
        <p>Civic Buildings Destroyed: ${mostRecentReport.civic_buildings.ext_destroyed || 'N/A'}<br>
        Educational Buildings Destroyed: ${mostRecentReport.educational_buildings.ext_destroyed || 'N/A'}<br>
        Educational Buildings Damaged: ${mostRecentReport.educational_buildings.ext_damaged || 'N/A'}<br>
        Mosques Destroyed: ${mostRecentReport.places_of_worship.ext_mosques_destroyed || 'N/A'}<br>
        Mosques Damaged: ${mostRecentReport.places_of_worship.ext_mosques_damaged || 'N/A'}<br>
        Residential Buildings Destroyed: ${mostRecentReport.residential.ext_destroyed || 'N/A'}</p>
    `;
        infrastructureSection.appendChild(dataItem);
    })
    .catch(error => console.error('Error fetching infrastructure data:', error));

// Utility function to randomize an array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Fetch websites and social media accounts, then display them together
Promise.all([
    fetch('https://data.palestinelove.org/api/v1/websites').then(response => response.json()),
    fetch('https://data.palestinelove.org/api/v1/social-media').then(response => response.json())
])
    .then(([websites, socialMedia]) => {
        const combinedList = [];

        // Add websites to the combined list
        websites.forEach(website => {
            combinedList.push({
                type: 'website',
                name: website.name,
                description: website.description,
                categories: website.categories.join(', '),
                url: website.url
            });
        });

        // Add social media accounts to the combined list
        socialMedia.forEach(account => {
            combinedList.push({
                type: 'social',
                name: account.name,
                description: account.description,
                network: account.network,
                url: account.url
            });
        });

        // Randomize the order of the combined list
        const randomizedList = shuffleArray(combinedList);

        // Display the randomized list
        const combinedSection = document.getElementById('website-section');
        combinedSection.innerHTML = ''; // Clear the loading message

        randomizedList.forEach(item => {
            const dataItem = document.createElement('div');
            dataItem.classList.add('data-item');
            if (item.type === 'website') {
                dataItem.innerHTML = `
                <p><a href="${item.url}" target="_blank">${item.name}</a> (website - ${item.categories})<br>
                ${item.description}</p>
            `;
            } else if (item.type === 'social') {
                dataItem.innerHTML = `
                <p><a href="${item.url}" target="_blank">${item.name}</a> (${item.network})<br>
                ${item.description}</p>
            `;
            }
            combinedSection.appendChild(dataItem);
        });
    })
    .catch(error => console.error('Error fetching data:', error));

    function toggleSection(h1Element) {
        const section = h1Element.parentElement; // Get the clicked section (either .left or .right)
        const scrollBox = section.querySelector('.scroll-box');
        const isHidden = scrollBox.classList.contains('hidden-content'); // Check if the clicked section is collapsed
        const allSectionsOnSameSide = document.querySelectorAll(`.${section.classList.contains('left') ? 'left' : 'right'}`); // Get sections on the same side
    
        // First, collapse all sections on the same side except the clicked one
        allSectionsOnSameSide.forEach(sec => {
            const secScrollBox = sec.querySelector('.scroll-box');
            if (sec !== section) {
                secScrollBox.classList.add('hidden-content'); // Collapse other sections on the same side
            }
        });
    
        // Toggle the clicked section
        if (isHidden) {
            scrollBox.classList.remove('hidden-content'); // Expand if it was collapsed
        } else {
            scrollBox.classList.add('hidden-content'); // Collapse if it was expanded
        }
    
        // On mobile, adjust the layout based on the expanded/collapsed state
        if (window.innerWidth <= 768) {
            const anyExpanded = Array.from(allSectionsOnSameSide).some(sec => !sec.querySelector('.scroll-box').classList.contains('hidden-content'));
    
            // Remove the expanded class from all sections on the same side first
            allSectionsOnSameSide.forEach(sec => sec.classList.remove('expanded'));
    
            // Add expanded class only to the clicked section if it's expanded
            if (!isHidden) {
                section.classList.add('expanded');
            }
        }
    }
    
