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
        const sectionsWrapper = document.querySelector('.sections-wrapper'); // Get the grid container
        const arrow = h1Element.querySelector('.arrow'); // Get the arrow element
    
        // Get the height of the h1 element
        const h1Height = h1Element.offsetHeight + 16; // Add padding for visual spacing
        
        // Get the other section (opposite of the current one)
        const otherSection = section.classList.contains('left') 
            ? document.querySelector('.right') 
            : document.querySelector('.left');
        const otherScrollBox = otherSection.querySelector('.scroll-box');
        const otherArrow = otherSection.querySelector('.arrow');
    
        // Check if it's mobile or desktop
        if (window.innerWidth <= 768) {
            // MOBILE: Use grid-template-rows for mobile layout
            if (isHidden) {
                // Expand the clicked section
                scrollBox.classList.remove('hidden-content');
                sectionsWrapper.style.gridTemplateRows = 'auto auto'; // Reset both rows
                arrow.textContent = '▲'; // Change the arrow to indicate expansion
    
                // Enable the collapsing function of the other section and make its arrow visible
                otherArrow.style.display = 'inline'; // Ensure the other section's arrow is visible
            } else {
                // Collapse the clicked section, but only if the other section is currently expanded
                if (!otherScrollBox.classList.contains('hidden-content')) {
                    scrollBox.classList.add('hidden-content'); // Collapse the current section
                    if (section.classList.contains('left')) {
                        sectionsWrapper.style.gridTemplateRows = `${h1Height}px auto`; // Collapse left section, right expands
                    } else {
                        sectionsWrapper.style.gridTemplateRows = `auto ${h1Height}px`; // Collapse right section, left expands
                    }
                    arrow.textContent = '▼'; // Change the arrow to indicate collapse
    
                    // Disable the collapsing function of the other section and hide its arrow
                    otherArrow.style.display = 'none'; // Hide the other section's arrow
                } else {
                    // Prevent collapsing both sections on mobile by keeping one section open
                    arrow.style.display = 'none'; // Hide the arrow of the current section if it is the only expanded section
                }
            }
        } 
        else {
            // DESKTOP: Directly manipulate the height of individual sections
            if (isHidden) {
                scrollBox.classList.remove('hidden-content'); // Expand if it was collapsed
                section.style.height = 'auto'; // Let the section grow naturally
                arrow.textContent = '▲'; // Change the arrow to indicate expansion
            } else {
                scrollBox.classList.add('hidden-content'); // Collapse the section content
                section.style.height = `${h1Height}px`; // Set the height of the section to the height of the h1 element
                arrow.textContent = '▼'; // Change the arrow to indicate collapse
            }
        }
    }
    