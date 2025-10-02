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

        // Calculate offset distance so LEDs sit between the double lines (stroke band)
        const bbox = pathElement.getBBox();
        console.log('Letter bbox:', bbox);

        const strokeFromPath = parseFloat(pathElement.getAttribute('stroke-width') || '0');
        const halfStroke = isNaN(strokeFromPath) ? 0 : strokeFromPath / 2;
        // Center the LED body in the stroke band with an extra padding so the rect doesn't touch borders
        const paddingFromLed = this.ledSize * 0.6;
        const baseInset = halfStroke + paddingFromLed;
        const minInset = Math.min(bbox.width, bbox.height) * 0.04; // keep some inset on very thin strokes
        const offsetDistance = Math.max(baseInset, minInset);

        // Place LEDs along the stroke path like in the example
        const leds = this.createStrokePathLEDs(pathElement, ledCount, offsetDistance);

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
     * Place LEDs along the stroke path, following the letter outline like in the example
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

            // Calculate spacing between LEDs along the path
            const spacing = pathLength / ledCount;
            console.log('LED spacing along path:', spacing);

            // Place LEDs evenly along the path with slight inward offset
            for (let i = 0; i < ledCount; i++) {
                // Position along the path (offset slightly to avoid clustering at start)
                const distance = (i + 0.5) * spacing;

                try {
                    const point = pathElement.getPointAtLength(distance);

                    // Calculate normal vector pointing inward
                    const normal = this.calculateNormal(pathElement, distance);

                    // Offset slightly inward from the stroke
                    const inwardOffset = Math.min(offsetDistance, this.ledSize * 0.8);
                    const ledX = point.x - normal.x * inwardOffset;
                    const ledY = point.y - normal.y * inwardOffset;

                    // Calculate rotation angle to align with path direction
                    const angle = Math.atan2(normal.y, normal.x) * (180 / Math.PI);

                    leds.push({
                        x: ledX,
                        y: ledY,
                        angle: angle
                    });

                    console.log(`LED ${i + 1}: (${ledX.toFixed(1)}, ${ledY.toFixed(1)}) angle: ${angle.toFixed(1)}°`);

                } catch (pointError) {
                    console.warn('Error getting point at distance', distance, pointError);
                }
            }

        } catch (error) {
            console.error('Error in createStrokePathLEDs:', error);
        }

        console.log('Total LEDs created:', leds.length);
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
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");

        circle.setAttribute("cx", ledData.x);
        circle.setAttribute("cy", ledData.y);
        circle.setAttribute("r", this.ledSize / 2);
        circle.setAttribute("class", "led-strip");

        // Store LED properties as data attributes
        circle.setAttribute("data-color", color);
        circle.setAttribute("data-brightness", brightness);
        circle.setAttribute("data-effect", effect);
        circle.setAttribute("data-index", index);

        // Apply initial styling with border for visibility
        circle.style.fill = color;
        circle.style.stroke = "#333";
        circle.style.strokeWidth = "1";
        circle.style.opacity = brightness / 100;

        if (effect !== 'none') {
            circle.classList.add(`led-effect-${effect}`);
            if (effect === 'chase') {
                circle.style.animationDelay = `${index * 0.1}s`;
            }
        }

        console.log(`Created LED element at (${ledData.x}, ${ledData.y}) with color ${color}`);

        return circle;
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