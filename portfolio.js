// Your Google Sheets API key and Spreadsheet ID
const apiKey = 'AIzaSyBhk_CsqKO2vUEpyreEoNGO2eEnkqFJ8gA'; // Replace with your actual API key
const spreadsheetId = '1Y5JZ2PSF4RTpjv1o0BJArLmAvLrA0k1zpHXbvwZOaJ0'; // Your Spreadsheet ID

// Define ranges for each section
const ranges = {
  portfolio: 'Portfolio!A1:F100'
  // Add more ranges if needed
};

// Fetch data for all sections on page load
document.addEventListener('DOMContentLoaded', () => {
  fetchData('portfolio');
});

// Function to fetch data for a specific section
function fetchData(section) {
  const range = ranges[section];
  fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`)
    .then(response => response.json())
    .then(data => {
      displayData(section, data);
    })
    .catch(error => console.error('Error fetching data:', error));
}

// Function to display data in the correct table, making second column clickable based on URL in first column
function displayData(section, data) {
  const tableBody = document.getElementById(`${section}-body`);
  tableBody.innerHTML = ''; // Clear existing rows

  // Reverse the order of the rows
  const reversedData = data.values.reverse();

  reversedData.forEach(row => {
    const tr = document.createElement('tr');
    
    // Create a cell for the second column (display text) and make it clickable if a URL exists
    const displayTextCell = document.createElement('td');
    const url = row[0]; // URL (first column in spreadsheet)
    const displayText = row[1]; // Display text (second column in spreadsheet)

    if (url) {
      // If URL exists, make the display text clickable
      const a = document.createElement('a');
      a.href = url;           // Use the URL from the first column
      a.textContent = displayText; // The clickable display text
      a.target = '_blank';    // Open in new tab
      displayTextCell.appendChild(a);
    } else {
      // If no URL, just show the display text as regular text
      displayTextCell.textContent = displayText;
    }
    
    tr.appendChild(displayTextCell);

    // Append the other columns (Institution, Year, Notes)
    tr.innerHTML += `
      <td>${row[2]}</td> 
      <td>${row[3]}</td>
      <td>${row[4]}</td>
      <td>${row[5]}</td> 
    `;

    tableBody.appendChild(tr);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const tables = document.querySelectorAll('table');

  tables.forEach((table) => {
    const headers = table.querySelectorAll('th');
    
    headers.forEach((header, index) => {
      header.addEventListener('click', () => {
        const isAscending = header.classList.contains('asc');
        sortTableByColumn(table, index, !isAscending);
        updateSortClasses(header, headers, !isAscending);
      });
    });
  });
});

/**
 * Sorts a table by the specified column.
 */
function sortTableByColumn(table, columnIndex, asc = true) {
  const tbody = table.querySelector('tbody');
  const rowsArray = Array.from(tbody.querySelectorAll('tr'));
  
  const sortedRows = rowsArray.sort((a, b) => {
    const aText = a.cells[columnIndex].textContent.trim();
    const bText = b.cells[columnIndex].textContent.trim();
    
    const aVal = isNaN(aText) ? aText.toLowerCase() : parseFloat(aText);
    const bVal = isNaN(bText) ? bText.toLowerCase() : parseFloat(bText);
    
    if (aVal > bVal) {
      return asc ? 1 : -1;
    } else if (aVal < bVal) {
      return asc ? -1 : 1;
    } else {
      return 0;
    }
  });

  // Clear existing rows and append the sorted ones
  tbody.innerHTML = '';
  sortedRows.forEach(row => tbody.appendChild(row));
}

/**
 * Updates the sort classes for the column headers.
 */
function updateSortClasses(activeHeader, headers, asc) {
  headers.forEach(header => {
    header.classList.remove('asc', 'desc');
  });
  activeHeader.classList.add(asc ? 'asc' : 'desc');
}
