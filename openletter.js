function submitSignature() {
    var name = document.getElementById('name').value;
    var script = document.createElement('script');
    script.src = `https://script.google.com/macros/s/AKfycbzjIaP3IdZrbtgxnyZiGQwmoKGWVAcLGBTo81ejHcoEoj7uVXZPTL4yR8JLvy05wZuvbw/exec?callback=processSubmitResponse&name=${encodeURIComponent(name)}`;
    document.head.appendChild(script);
    document.head.removeChild(script); // Clean up script tag after insertion
}


function processSubmitResponse(response) {
    if (response && response.status === "success") {
        fetchSignatures();
    } else {
        console.error('Failed to submit signature, server responded with:', response);
        alert("Failed to submit signature.");
    }
}


function fetchSignatures() {
    var script = document.createElement('script');
    script.src = `https://script.google.com/macros/s/AKfycbzjIaP3IdZrbtgxnyZiGQwmoKGWVAcLGBTo81ejHcoEoj7uVXZPTL4yR8JLvy05wZuvbw/exec?callback=displaySignatures`;
    document.head.appendChild(script);
    document.head.removeChild(script);  // Clean up script tag after insertion
}

function displaySignatures(data) {
    var signaturesDiv = document.getElementById('signatures');
    signaturesDiv.innerHTML = '';  // Clear previous entries
    data.forEach(function(sig) {
        signaturesDiv.innerHTML += `<p>${sig.name}</p>`;
    });
}

// Load signatures when the page loads
window.onload = fetchSignatures;
