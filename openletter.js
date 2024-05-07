function submitSignature() {
    var name = document.getElementById('name').value;
    var status = document.getElementById('status').value;
    var script = document.createElement('script');
    script.src = `https://script.google.com/macros/s/AKfycbxdjjHZ-UdigeX8QTzCW2fdCzBeYSFIR_4PLT0kxj2nmwLoo4hI76tkf3-zv4EfzlObRg/exec?callback=handleResponse&name=${encodeURIComponent(name)}&status=${encodeURIComponent(status)}`;
    document.head.appendChild(script);
    document.head.removeChild(script); // Clean up script tag after execution
}

function handleResponse(response) {
    console.log('Server responded with:', response);
    if (response.status === 'success') {
        alert('Signature submitted successfully!');
        fetchSignatures(); // Refresh the list of signatures
    } else {
        alert('Failed to submit signature.');
    }
}

function fetchSignatures() {
    var script = document.createElement('script');
    script.src = `https://script.google.com/macros/s/AKfycbxdjjHZ-UdigeX8QTzCW2fdCzBeYSFIR_4PLT0kxj2nmwLoo4hI76tkf3-zv4EfzlObRg/exec?callback=displaySignatures&operation=fetchSignatures`;
    document.head.appendChild(script);
    document.head.removeChild(script); // Clean up script tag after execution
}

function displaySignatures(data) {
    var signaturesDiv = document.getElementById('signatures');
    var countElement = document.getElementById('count');
    signaturesDiv.innerHTML = '';
    data.forEach(function(entry) {
        signaturesDiv.innerHTML += `<p>${entry.name} - ${entry.status}</p>`;
    });
    countElement.innerHTML = `Total Signatures: ${data.length}`;
}

function printPage() {
    window.print();
}

window.onload = fetchSignatures; // Fetch signatures when the page loads
