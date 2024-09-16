// Fetch the summary data from v3 API
fetch('https://data.techforpalestine.org/api/v3/summary.json')
    .then(response => response.json())
    .then(data => {
        const summarySection = document.getElementById('summary-section');
        const gazaData = data.gaza;
        const westBankData = data.west_bank;
        summarySection.innerHTML = `
        <h4>Gaza:</h4>
        <p><strong>Total Killed:</strong> ${gazaData.killed.total || 'N/A'}</p>
        <p><strong>Children Killed:</strong> ${gazaData.killed.children || 'N/A'}</p>
        <p><strong>Women Killed:</strong> ${gazaData.killed.women || 'N/A'}</p>
        <p><strong>Injured:</strong> ${gazaData.injured.total || 'N/A'}</p>
        <h4>West Bank:</h4>
        <p><strong>Total Killed:</strong> ${westBankData.killed.total || 'N/A'}</p>
        <p><strong>Children Killed:</strong> ${westBankData.killed.children || 'N/A'}</p>
        <p><strong>Injured:</strong> ${westBankData.injured.total || 'N/A'}</p>
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
        <p><bold>Civic Buildings Destroyed:</bold> ${mostRecentReport.civic_buildings.ext_destroyed || 'N/A'}</p>
        <p><bold>Educational Buildings Destroyed:</bold> ${mostRecentReport.educational_buildings.ext_destroyed || 'N/A'}</p>
        <p><bold>Educational Buildings Damaged:</bold> ${mostRecentReport.educational_buildings.ext_damaged || 'N/A'}</p>
        <p><bold>Mosques Destroyed:</bold> ${mostRecentReport.places_of_worship.ext_mosques_destroyed || 'N/A'}</p>
        <p><bold>Mosques Damaged:</bold> ${mostRecentReport.places_of_worship.ext_mosques_damaged || 'N/A'}</p>
        <p><bold>Residential Buildings Destroyed:</bold> ${mostRecentReport.residential.ext_destroyed || 'N/A'}</p>
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
                <p><a href="${item.url}" target="_blank">${item.name}</a> (website - ${item.categories})</p>
                <p>${item.description}</p>
            `;
            } else if (item.type === 'social') {
                dataItem.innerHTML = `
                <p><a href="${item.url}" target="_blank">${item.name}</a> (${item.network})</p>
                <p>${item.description}</p>
            `;
            }
            combinedSection.appendChild(dataItem);
        });
    })
    .catch(error => console.error('Error fetching data:', error));
