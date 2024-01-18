document.getElementById('processButton').addEventListener('click', function() {
    var input = document.getElementById('imageInput');
    if (input.files && input.files[0]) {
        var reader = new FileReader();
        reader.onload = function(e) {
            var img = new Image();
            img.onload = function() {
                processImage(img);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    } else {
        alert('Please select an image file first.');
    }
});

function processImage(img) {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var data = imageData.data;
    
    // Process each pixel
    for (var i = 0; i < data.length; i += 4) {
        var closest = closestColor(data[i], data[i + 1], data[i + 2]);
        data[i] = closest[0];
        data[i + 1] = closest[1];
        data[i + 2] = closest[2];
    }

    function processImage(img) {
        // ... [previous code to load and process initial image]
    
        // Calculate initial color distribution
        var colorCounts = { 'Red': 0, 'Black': 0, 'White': 0, 'Green': 0 };
        for (var i = 0; i < data.length; i += 4) {
            var color = colorName([data[i], data[i + 1], data[i + 2]]);
            colorCounts[color]++;
        }
    
        // Adjust colors to approximate desired ratios
        adjustColorRatios(data, colorCounts, canvas.width * canvas.height);
    
        // ... [rest of the code to update and display the image]
    }
    
    function colorName(rgb) {
        var colorMap = {
            '238,42,53': 'Red',
            '0,0,0': 'Black',
            '255,255,255': 'White',
            '0,151,54': 'Green'
        };
        return colorMap[rgb.join(',')];
    }
    
    function adjustColorRatios(data, colorCounts, totalPixels) {
        // Desired ratios
        var targetRatios = { 'Red': 0.1324, 'Black': 0.4288, 'White': 0.1924, 'Green': 0.2354 };
    
        // Calculate the target number of pixels for each color
        for (var color in targetRatios) {
            var targetCount = Math.round(targetRatios[color] * totalPixels);
            targetRatios[color] = targetCount - colorCounts[color]; // Positive or negative delta
        }
    
        for (var i = 0; i < data.length; i += 4) {
            var largestDifference = 0;
            var colorToChange = null;
    
            // Determine the color with the largest deviation from the target ratio
            for (var color in targetRatios) {
                var difference = Math.abs(targetRatios[color]);
                if (difference > largestDifference) {
                    largestDifference = difference;
                    colorToChange = color;
                }
            }
    
            // Apply the most needed color adjustment
            if (colorToChange && targetRatios[colorToChange] !== 0) {
                var newColor = colorToRGB(colorToChange);
                data[i] = newColor[0];
                data[i + 1] = newColor[1];
                data[i + 2] = newColor[2];
    
                // Update the ratio counters
                if (targetRatios[colorToChange] > 0) {
                    targetRatios[colorToChange]--;
                } else {
                    targetRatios[colorToChange]++;
                }
            }
        }
    }
    
    function colorToRGB(color) {
        var rgbMap = {
            'Red': [238, 42, 53],
            'Black': [0, 0, 0],
            'White': [255, 255, 255],
            'Green': [0, 151, 54]
        };
        return rgbMap[color];
    }
    ctx.putImageData(imageData, 0, 0);
    document.getElementById('outputImage').src = canvas.toDataURL();
    document.getElementById('outputImage').style.display = 'block';
}

function closestColor(r, g, b) {
    // Define the four colors
    var colors = [
        [238, 42, 53], // Red
        [0, 0, 0],     // Black
        [255, 255, 255], // White
        [0, 151, 54]   // Green
    ];

    var closest = colors[0];
    var closestDistance = Infinity;

    // Find the closest color
    for (var i = 0; i < colors.length; i++) {
        var d = distance(r, g, b, colors[i][0], colors[i][1], colors[i][2]);
        if (d < closestDistance) {
            closestDistance = d;
            closest = colors[i];
        }
    }

    return closest;
}

function distance(r1, g1, b1, r2, g2, b2) {
    // Euclidean distance in RGB space
    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}
