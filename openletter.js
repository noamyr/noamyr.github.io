function submitSignature() {
    var submitButton = document.querySelector('button[type="submit"]');
    submitButton.disabled = true;  // Disable the submit button

    var name = document.getElementById('name').value;
    var status = document.getElementById('status').value;
    var script = document.createElement('script');
    script.src = `https://script.google.com/macros/s/AKfycbxdjjHZ-UdigeX8QTzCW2fdCzBeYSFIR_4PLT0kxj2nmwLoo4hI76tkf3-zv4EfzlObRg/exec?callback=handleResponse&name=${encodeURIComponent(name)}&status=${encodeURIComponent(status)}`;
    document.head.appendChild(script);
    document.head.removeChild(script); // Clean up script tag after execution
}

function handleResponse(response) {
    console.log('Server responded with:', response);
    var submitButton = document.querySelector('button[type="submit"]');
    submitButton.disabled = false;  // Re-enable the submit button

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
    shuffleArray(data); // Shuffle the data before displaying
    signaturesDiv.innerHTML = '';
    data.forEach(function(entry) {
        signaturesDiv.innerHTML += `<p>${entry.name} - ${entry.status}</p>`;
    });
    countElement.innerHTML = `Total Signatures: ${data.length}`;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1)); // Random index from 0 to i
        [array[i], array[j]] = [array[j], array[i]]; // Swap elements
    }
}

function printPage() {
    window.print();
}

function sendEmail() {
    var subject = "Open Letter to the Executive Board of Design Academy Eindhoven";
    var body = `Dear Executive Board of Design Academy Eindhoven,

We hope this open letter finds you well.

“Design as a global phenomenon with an increasing urgency to reform social structures and systems,” as discussed on the school’s website, is inseparable from the ongoing apartheid and genocide in Palestine, supported by designed infrastructures of oppression, segregation, and violence. We critically question the role of “one of the world’s leading design schools,” especially at this crucial moment when movements for Palestine are being organized in various educational institutions globally.

As students, alumni, and employees of Design Academy Eindhoven, we request the following from the institution:

1. Assess the complicity of itself and its collaborators and organize boycotts. Sever ties with institutions complicit in genocide, from the products in the vending machines to partner universities, including Bezalel Academy of Art and Design and Shenkar College.
2. Support Palestinian students, designers and collaborators in and around the institution. Initiate ties with a Palestinian art school, Dar al-Kalima University.
3. Support student-organized resistance against the ongoing genocide. While big institutions in the design industry have remained utterly silent, design students and young designers have been organizing various programs that are highly urgent and relevant. Elevator Radio was one of the only consistent voices about Palestine during the recent Milan Design Week. Complicating Everything, organized by Leigh Tukker and Pete Fung, will hold discussions about the occupation and settler colonialism in a carefully facilitated way within the school. Many DAE students are attending the student encampment taking place at TU/e to show solidarity. Support these initiatives and prove that design education is more than just a neoliberal apparatus for producing star designers, but an open environment where the contingencies of radical imagination still exist.
4. Beyond cherishing these student-based initiatives, mobilize the school’s cultural capital more fundamentally against the genocide. Utilize the school’s unique status in the scene—its well-known graduation shows and curated programs during design weeks—to help the design industry deviate from its apolitical path. Do not consume activism as a gimmick or a token, but as an integral part of the school’s approach to design and its position in the global design scene, especially when it is urgently needed.

What the history of design remembers us as will depend on what we do in this pressing moment of global history.

Best regards,

Signed by:
`;

    // Fetch and shuffle signatures
    var signaturesDiv = document.getElementById('signatures');
    var signaturesArray = signaturesDiv.innerText.trim().split('\n').filter(entry => entry.trim() !== "");
    shuffleArray(signaturesArray);

    // Add signatures and count to body
    body += signaturesArray.join('\n');
    body += `\n\nTotal Signatures: ${signaturesArray.length}`;

    var mailtoLink = `mailto:info@designacademy.nl,ExecutiveBoard@designacademy.nl?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
}

window.onload = fetchSignatures; // Fetch signatures when the page loads
