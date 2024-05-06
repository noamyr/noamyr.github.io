function submitSignature() {
    var name = document.getElementById('name').value;
    fetch('https://script.google.com/macros/s/AKfycbwgqA4X-Y2VOMXm3SmRybG9VS1CFXPq6uLLmM_WHNp6GMoPw4cFiLz-e3_FidJrCFoRhA/exec', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({name: name})
    })
    .then(response => response.json())
    .then(data => {
        console.log(data);
        fetchSignatures();
    })
    .catch(error => console.error('Error:', error));
}

function fetchSignatures() {
    fetch('https://script.google.com/macros/s/AKfycbwgqA4X-Y2VOMXm3SmRybG9VS1CFXPq6uLLmM_WHNp6GMoPw4cFiLz-e3_FidJrCFoRhA/exec')
    .then(response => response.json())
    .then(data => {
        var signaturesDiv = document.getElementById('signatures');
        signaturesDiv.innerHTML = '';
        data.forEach(function(sig) {
            signaturesDiv.innerHTML += `<p>${sig.name}</p>`;
        });
    });
}

document.addEventListener('DOMContentLoaded', function() {
    fetchSignatures();
});
