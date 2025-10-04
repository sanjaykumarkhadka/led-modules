// led-placement.js - Core LED placement algorithm for inner stroke placement

class LEDPlacer {
    constructor() {
        this.ledSize = 12; // Size of LED modules (increased for better visibility)
        this.ledSpacing = 0.75; // Spacing factor between LEDs
    }

    /**
     * Place LEDs on the inside of letter strokes
     * @param {SVGPathElement} pathElement - The path element representing the letter outline
     * @param {SVGGElement} charGroup - The group containing the character
     * @param {number} ledCount - Number of LEDs to place
     * @param {Object} options - Additional options for LED placement
     */
    placeLEDsInside(pathElement, charGroup, ledCount, options = {}) {
        const {
            color = '#666666',
            brightness = 100,
            effect = 'none'
        } = options;

        console.log('placeLEDsInside called with:', { pathElement, charGroup, ledCount, options });

        if (!pathElement || ledCount <= 0) {
            console.log('Early return - invalid parameters');
            return;
        }

        // Determine a reference filled path to test inside/outside
        const fillPath = charGroup.querySelector('.letter-fill') || pathElement;

        // Calculate offset distance so LEDs sit inside the stroke band
        const bbox = pathElement.getBBox();
        console.log('Letter bbox:', bbox);

        const strokeFromPath = parseFloat(pathElement.getAttribute('stroke-width') || '0');
        console.log('Stroke width:', strokeFromPath);

        // LEDs should be placed along the path but offset inward into the stroke band
        // The stroke is centered on the path, so we need to offset inward
        // Use a larger offset to ensure LEDs are well inside the stroke area
        const letterSize = Math.max(bbox.width, bbox.height);
        const offsetDistance = Math.max(letterSize * 0.12, 10);

        console.log('LED inward offset:', offsetDistance);

        // Place LEDs along the stroke path with inward offset
        const leds = this.createStrokeDistributedLEDs(pathElement, charGroup, ledCount, offsetDistance);

        console.log('Created LEDs:', leds);

        // Add LEDs to the character group
        leds.forEach((ledData, index) => {
            const led = this.createLEDElement(ledData, color, brightness, effect, index);
            console.log('Adding LED element:', led);
            charGroup.appendChild(led);
        });

        console.log('Final charGroup children:', charGroup.children.length);
    }

    /**
     * Create LEDs distributed in the stroke band with proper spacing
     * Samples the stroke band area and ensures minimum spacing between LEDs
     */
    createStrokeDistributedLEDs(pathElement, charGroup, ledCount, offsetDistance) {
        const leds = [];
        const fillPath = charGroup.querySelector('.letter-fill') || pathElement;
        const bbox = pathElement.getBBox();

        try {
            const pathLength = pathElement.getTotalLength();
            console.log('Path length:', pathLength, 'LED count:', ledCount, 'bbox:', bbox);

            if (pathLength <= 0 || ledCount <= 0) {
                return leds;
            }

            // Calculate minimum spacing between LEDs based on available area
            const letterArea = bbox.width * bbox.height;
            const minSpacing = Math.sqrt(letterArea / ledCount) * 0.8;
            console.log('Minimum spacing between LEDs:', minSpacing);

            // Generate many candidate positions along the path at various offsets
            const candidates = [];
            const samplesPerLED = 50; // Generate many candidates
            const totalSamples = ledCount * samplesPerLED;

            for (let i = 0; i < totalSamples; i++) {
                const distance = (pathLength * i) / totalSamples;

                try {
                    const point = pathElement.getPointAtLength(distance);
                    const normal = this.calculateNormal(pathElement, distance);

                    // Try different offset distances from the path
                    const offsets = [
                        offsetDistance * 0.5,
                        offsetDistance * 0.7,
                        offsetDistance * 0.9
                    ];

                    for (const offset of offsets) {
                        const ledX = point.x - normal.x * offset;
                        const ledY = point.y - normal.y * offset;

                        // Check if point is inside the letter
                        if (this.isPointInside(fillPath, ledX, ledY)) {
                            candidates.push({ x: ledX, y: ledY, angle: 0 });
                        }
                    }
                } catch (error) {
                    // Skip this sample point
                }
            }

            console.log('Generated', candidates.length, 'candidate positions');

            // Select well-spaced LEDs using maximin with minimum spacing constraint
            if (candidates.length > 0) {
                const selected = this.selectWellSpacedPoints(candidates, ledCount, minSpacing);
                leds.push(...selected);
            }

        } catch (error) {
            console.error('Error in createStrokeDistributedLEDs:', error);
        }

        console.log('Created', leds.length, 'well-spaced LEDs in stroke band');
        return leds;
    }

    /**
     * Select well-spaced points with minimum spacing constraint
     */
    selectWellSpacedPoints(candidates, count, minSpacing) {
        if (candidates.length <= count) {
            return candidates;
        }

        const selected = [];
        const available = [...candidates];

        // Start with center point
        const centerX = candidates.reduce((sum, p) => sum + p.x, 0) / candidates.length;
        const centerY = candidates.reduce((sum, p) => sum + p.y, 0) / candidates.length;

        let firstIndex = 0;
        let minDistToCenter = Infinity;
        for (let i = 0; i < available.length; i++) {
            const dist = Math.hypot(available[i].x - centerX, available[i].y - centerY);
            if (dist < minDistToCenter) {
                minDistToCenter = dist;
                firstIndex = i;
            }
        }

        selected.push(available[firstIndex]);
        available.splice(firstIndex, 1);

        // Select remaining points that are well-spaced
        while (selected.length < count && available.length > 0) {
            let bestCandidate = null;
            let bestCandidateIndex = -1;
            let maxMinDist = -1;

            for (let i = 0; i < available.length; i++) {
                const candidate = available[i];

                // Calculate minimum distance to any selected point
                let minDist = Infinity;
                for (const selectedPoint of selected) {
                    const dist = Math.hypot(candidate.x - selectedPoint.x, candidate.y - selectedPoint.y);
                    minDist = Math.min(minDist, dist);
                }

                // Keep candidate with maximum minimum distance
                if (minDist > maxMinDist) {
                    maxMinDist = minDist;
                    bestCandidate = candidate;
                    bestCandidateIndex = i;
                }
            }

            if (bestCandidate && maxMinDist >= minSpacing * 0.7) {
                selected.push(bestCandidate);
                available.splice(bestCandidateIndex, 1);
            } else if (bestCandidate) {
                // Accept even if spacing is less than ideal
                selected.push(bestCandidate);
                available.splice(bestCandidateIndex, 1);
            } else {
                break;
            }
        }

        return selected;
    }

    /**
     * Create LEDs distributed inside the letter area (stroke band)
     * This matches the example.png where LEDs are placed within the letter body
     */
    createInnerAreaLEDs(pathElement, charGroup, ledCount, margin) {
        const bbox = pathElement.getBBox();
        const leds = [];
        const fillPath = charGroup.querySelector('.letter-fill') || pathElement;

        console.log('Creating inner area LEDs for bbox:', bbox, 'margin:', margin);

        // Sample points in a dense grid pattern and keep only those inside the letter
        const usableWidth = bbox.width - (margin * 2);
        const usableHeight = bbox.height - (margin * 2);

        if (usableWidth <= 0 || usableHeight <= 0) {
            console.warn('Usable area too small');
            return leds;
        }

        // Generate candidate positions in a very dense grid
        const gridDensity = Math.max(10, Math.ceil(Math.sqrt(ledCount * 8))); // Higher density
        const candidates = [];

        for (let row = 0; row < gridDensity; row++) {
            for (let col = 0; col < gridDensity; col++) {
                const x = bbox.x + margin + (col + 0.5) * (usableWidth / gridDensity);
                const y = bbox.y + margin + (row + 0.5) * (usableHeight / gridDensity);

                // Check if point is inside the filled letter
                if (this.isPointInside(fillPath, x, y)) {
                    candidates.push({ x, y, angle: 0 });
                }
            }
        }

        console.log('Found', candidates.length, 'candidate positions inside letter');

        // Use maximin algorithm to select well-distributed positions
        if (candidates.length > 0) {
            const selected = this.selectWellDistributedPoints(candidates, ledCount);
            leds.push(...selected);
        }

        console.log('Selected', leds.length, 'well-distributed LED positions');
        return leds;
    }

    /**
     * Select well-distributed points using a greedy maximin algorithm
     * Ensures LEDs are evenly spaced throughout the letter area
     */
    selectWellDistributedPoints(candidates, count) {
        if (candidates.length <= count) {
            return candidates;
        }

        const selected = [];

        // Start with a random point (or center-most point)
        const centerX = candidates.reduce((sum, p) => sum + p.x, 0) / candidates.length;
        const centerY = candidates.reduce((sum, p) => sum + p.y, 0) / candidates.length;

        // Find point closest to center as first point
        let firstIndex = 0;
        let minDistToCenter = Infinity;
        for (let i = 0; i < candidates.length; i++) {
            const dist = Math.hypot(candidates[i].x - centerX, candidates[i].y - centerY);
            if (dist < minDistToCenter) {
                minDistToCenter = dist;
                firstIndex = i;
            }
        }

        selected.push(candidates[firstIndex]);

        // Greedily select remaining points that maximize minimum distance to already selected points
        for (let i = 1; i < count; i++) {
            let bestCandidate = null;
            let maxMinDist = -1;

            for (const candidate of candidates) {
                // Skip if already selected
                if (selected.some(s => s.x === candidate.x && s.y === candidate.y)) {
                    continue;
                }

                // Find minimum distance to any selected point
                let minDist = Infinity;
                for (const selectedPoint of selected) {
                    const dist = Math.hypot(candidate.x - selectedPoint.x, candidate.y - selectedPoint.y);
                    minDist = Math.min(minDist, dist);
                }

                // Keep track of candidate with maximum minimum distance
                if (minDist > maxMinDist) {
                    maxMinDist = minDist;
                    bestCandidate = candidate;
                }
            }

            if (bestCandidate) {
                selected.push(bestCandidate);
            }
        }

        return selected;
    }

    /**
     * Check if a point is inside the filled path
     */
    isPointInside(pathElement, x, y) {
        try {
            if (typeof pathElement.isPointInFill === 'function') {
                const svg = pathElement.ownerSVGElement;
                const point = svg.createSVGPoint();
                point.x = x;
                point.y = y;
                return pathElement.isPointInFill(point);
            }
        } catch (e) {
            console.warn('isPointInFill failed:', e);
        }
        return true; // Fallback - assume inside
    }

    /**
     * Create LED positions along the inner path
     */
    createInnerLEDs(pathElement, fillPath, ledCount, offsetDistance) {
        const pathLength = pathElement.getTotalLength();
        const leds = [];
        
        // Calculate even distribution along the path
        const segmentLength = pathLength / ledCount;
        
        for (let i = 0; i < ledCount; i++) {
            // Position along the path
            const distance = (i + 0.5) * segmentLength;
            const point = pathElement.getPointAtLength(distance);
            
            // Calculate the normal vector (perpendicular to the path)
            const normal = this.calculateNormal(pathElement, distance);
            
            // Choose a normal direction that points into the filled region.
            // Test a candidate point using isPointInFill when available.
            let nx = -normal.x;
            let ny = -normal.y;

            const testPoint = (tx, ty) => {
                if (typeof fillPath.isPointInFill === 'function') {
                    const svg = fillPath.ownerSVGElement;
                    // Create an SVGPoint to test
                    const p = svg.createSVGPoint();
                    p.x = tx;
                    p.y = ty;
                    return fillPath.isPointInFill(p);
                }
                // Fallback: assume negative normal points inward
                return true;
            };

            // If the first offset isn't inside, flip the normal direction
            let candidateX = point.x + nx * offsetDistance;
            let candidateY = point.y + ny * offsetDistance;
            if (!testPoint(candidateX, candidateY)) {
                nx = -nx;
                ny = -ny;
                candidateX = point.x + nx * offsetDistance;
                candidateY = point.y + ny * offsetDistance;
            }

            // If still not inside (thin strokes/cusps), step further inward a bit
            let attempts = 0;
            const step = this.ledSize * 0.4;
            while (!testPoint(candidateX, candidateY) && attempts < 4) {
                attempts++;
                candidateX = point.x + nx * (offsetDistance + step * attempts);
                candidateY = point.y + ny * (offsetDistance + step * attempts);
            }

            const ledPosition = {
                x: candidateX,
                y: candidateY,
                angle: Math.atan2(ny, nx) * (180 / Math.PI)
            };
            
            leds.push(ledPosition);
        }
        
        return leds;
    }

    /**
     * Create systematically distributed LEDs inside the letter area like in example.png
     * Places LEDs in vertical columns, distributed evenly from top to bottom
     */
    createEvenlyDistributedLEDs(pathElement, charGroup, ledCount, margin) {
        const bbox = pathElement.getBBox();
        const leds = [];

        console.log('Creating systematically distributed LEDs for bbox:', bbox, 'with margin:', margin);

        // Calculate usable area inside the letter
        const usableWidth = Math.max(0, bbox.width - (margin * 2));
        const usableHeight = Math.max(0, bbox.height - (margin * 2));

        if (usableWidth <= 0 || usableHeight <= 0) {
            console.log('Usable area too small:', { usableWidth, usableHeight });
            return leds;
        }

        // For systematic vertical distribution like in example.png
        // Prefer vertical columns - most letters are taller than wide
        const aspectRatio = usableHeight / usableWidth;

        let cols, rows;

        if (ledCount <= 4) {
            // For small counts, use single column
            cols = 1;
            rows = ledCount;
        } else if (aspectRatio > 1.5) {
            // Tall letters - prefer vertical arrangement
            cols = Math.max(1, Math.floor(Math.sqrt(ledCount / aspectRatio)));
            rows = Math.ceil(ledCount / cols);
        } else {
            // Wider letters - use more balanced grid
            cols = Math.ceil(Math.sqrt(ledCount * (usableWidth / usableHeight)));
            rows = Math.ceil(ledCount / cols);
        }

        // Ensure we have valid values
        cols = Math.max(1, cols);
        rows = Math.max(1, rows);

        console.log('Systematic vertical layout:', { cols, rows, ledCount, aspectRatio: aspectRatio.toFixed(2) });

        // Calculate spacing between LEDs
        const spacingX = cols > 1 ? usableWidth / (cols + 1) : usableWidth / 2;
        const spacingY = rows > 1 ? usableHeight / (rows + 1) : usableHeight / 2;

        // Start positions with even margins
        const startX = bbox.x + margin + spacingX;
        const startY = bbox.y + margin + spacingY;

        // Place LEDs in systematic grid pattern, filling column by column
        let ledIndex = 0;
        for (let col = 0; col < cols && ledIndex < ledCount; col++) {
            for (let row = 0; row < rows && ledIndex < ledCount; row++) {
                const x = startX + (col * spacingX);
                const y = startY + (row * spacingY);

                leds.push({
                    x: x,
                    y: y,
                    angle: 0 // No rotation for systematic placement
                });

                console.log(`LED ${ledIndex + 1}: (${x.toFixed(1)}, ${y.toFixed(1)})`);
                ledIndex++;
            }
        }

        console.log('Created', leds.length, 'systematically distributed LEDs in vertical columns');
        return leds;
    }

    /**
     * Place LEDs along the stroke path, following the letter outline like in the example
     * Uses equal spacing between LEDs along the path
     */
    createStrokePathLEDs(pathElement, ledCount, offsetDistance) {
        const leds = [];

        if (!pathElement || ledCount <= 0) {
            console.log('Invalid path or LED count');
            return leds;
        }

        try {
            const pathLength = pathElement.getTotalLength();
            console.log('Path length:', pathLength, 'LEDs to place:', ledCount);

            if (pathLength <= 0) {
                console.log('Path has no length');
                return leds;
            }

            // Calculate equal spacing between LEDs
            // Place them evenly with gaps at both ends
            const totalGaps = ledCount + 1;
            const spacing = pathLength / totalGaps;
            console.log('Equal LED spacing:', spacing);

            // Place LEDs evenly along the path with equal spacing
            for (let i = 0; i < ledCount; i++) {
                // Position along the path with equal spacing from start
                const distance = spacing * (i + 1);

                try {
                    const point = pathElement.getPointAtLength(distance);

                    // Calculate normal vector pointing inward
                    const normal = this.calculateNormal(pathElement, distance);

                    // Offset inward to sit between the stroke lines
                    // Use the full offsetDistance to position LEDs inside the stroke band
                    const ledX = point.x - normal.x * offsetDistance;
                    const ledY = point.y - normal.y * offsetDistance;

                    // Calculate rotation angle to align with path direction
                    const angle = Math.atan2(normal.y, normal.x) * (180 / Math.PI);

                    leds.push({
                        x: ledX,
                        y: ledY,
                        angle: angle
                    });

                    console.log(`LED ${i + 1}: (${ledX.toFixed(1)}, ${ledY.toFixed(1)}) offset: ${offsetDistance.toFixed(1)}`);

                } catch (pointError) {
                    console.warn('Error getting point at distance', distance, pointError);
                }
            }

        } catch (error) {
            console.error('Error in createStrokePathLEDs:', error);
        }

        console.log('Total LEDs created:', leds.length, 'with equal spacing');
        return leds;
    }

    /**
     * Calculate the normal vector at a point on the path
     */
    calculateNormal(pathElement, distance) {
        const delta = 0.1;
        const point1 = pathElement.getPointAtLength(Math.max(0, distance - delta));
        const point2 = pathElement.getPointAtLength(Math.min(pathElement.getTotalLength(), distance + delta));
        
        // Calculate tangent vector
        const tangent = {
            x: point2.x - point1.x,
            y: point2.y - point1.y
        };
        
        // Normalize the tangent
        const length = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y);
        tangent.x /= length;
        tangent.y /= length;
        
        // Calculate normal (perpendicular to tangent)
        // Rotate 90 degrees clockwise for inner normal
        const normal = {
            x: tangent.y,
            y: -tangent.x
        };
        
        return normal;
    }

    /**
     * Create an LED SVG element
     */
    createLEDElement(ledData, color, brightness, effect, index) {
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");

        // Create rectangular LED modules like in example.png
        const ledWidth = this.ledSize * 1.2;
        const ledHeight = this.ledSize * 0.7;

        rect.setAttribute("x", ledData.x - ledWidth / 2);
        rect.setAttribute("y", ledData.y - ledHeight / 2);
        rect.setAttribute("width", ledWidth);
        rect.setAttribute("height", ledHeight);
        rect.setAttribute("rx", 2); // Slight rounding
        rect.setAttribute("class", "led-strip");

        // Rotate if needed
        if (ledData.angle !== 0) {
            rect.setAttribute("transform", `rotate(${ledData.angle}, ${ledData.x}, ${ledData.y})`);
        }

        // Store LED properties as data attributes
        rect.setAttribute("data-color", color);
        rect.setAttribute("data-brightness", brightness);
        rect.setAttribute("data-effect", effect);
        rect.setAttribute("data-index", index);

        // Apply styling - gray rectangular modules like example
        rect.style.fill = "#888888"; // Gray color like in example
        rect.style.stroke = "#555";
        rect.style.strokeWidth = "1";
        rect.style.opacity = brightness / 100;

        if (effect !== 'none') {
            rect.classList.add(`led-effect-${effect}`);
            if (effect === 'chase') {
                rect.style.animationDelay = `${index * 0.1}s`;
            }
        }

        console.log(`Created rectangular LED element at (${ledData.x}, ${ledData.y})`);

        return rect;
    }

    /**
     * Update LED colors for a character group
     */
    updateLEDColors(charGroup, color) {
        const leds = charGroup.querySelectorAll('.led-strip');
        leds.forEach(led => {
            led.style.fill = color;
            led.setAttribute('data-color', color);
        });
    }

    /**
     * Update LED brightness for a character group
     */
    updateLEDBrightness(charGroup, brightness) {
        const leds = charGroup.querySelectorAll('.led-strip');
        leds.forEach(led => {
            led.style.opacity = brightness / 100;
            led.setAttribute('data-brightness', brightness);
        });
    }

    /**
     * Apply effect to LEDs
     */
    applyLEDEffect(charGroup, effect) {
        const leds = charGroup.querySelectorAll('.led-strip');
        leds.forEach((led, index) => {
            // Remove existing effects
            led.classList.remove('led-effect-blink', 'led-effect-pulse', 'led-effect-chase');
            led.style.animationDelay = '';
            
            if (effect !== 'none') {
                led.classList.add(`led-effect-${effect}`);
                if (effect === 'chase') {
                    led.style.animationDelay = `${index * 0.1}s`;
                }
            }
            led.setAttribute('data-effect', effect);
        });
    }

    /**
     * Calculate the number of LEDs needed based on letter dimensions
     */
    calculateOptimalLEDCount(pathElement, moduleSpacing) {
        const pathLength = pathElement.getTotalLength();
        const pixelsPerInch = 96; // Standard screen DPI
        const inchesLength = pathLength / pixelsPerInch;
        
        // Calculate based on module spacing
        const optimalCount = Math.round(inchesLength / moduleSpacing);
        
        return Math.max(3, optimalCount); // Minimum 3 LEDs per character
    }

    /**
     * Create measurement annotations
     */
    createMeasurementAnnotation(charGroup, pathElement) {
        const bbox = pathElement.getBBox();
        const measurement = document.createElementNS("http://www.w3.org/2000/svg", "text");
        
        measurement.setAttribute("x", bbox.x + bbox.width / 2);
        measurement.setAttribute("y", bbox.y + bbox.height + 15);
        measurement.setAttribute("text-anchor", "middle");
        measurement.setAttribute("class", "measurement-text");
        measurement.setAttribute("font-size", "10");
        measurement.setAttribute("fill", "#666");
        
        const heightInches = (bbox.height / 96).toFixed(1);
        measurement.textContent = `${heightInches}"`;
        
        charGroup.appendChild(measurement);
    }
}

// Export for use in other modules
window.LEDPlacer = LEDPlacer;