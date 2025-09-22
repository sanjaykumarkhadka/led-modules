// led-placement.js - Core LED placement algorithm for inner stroke placement

class LEDPlacer {
    constructor() {
        this.ledSize = 8; // Size of LED modules
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

        if (!pathElement || ledCount <= 0) return;

        // Get the path data and create an offset path for inner placement
        const bbox = pathElement.getBBox();
        const pathLength = pathElement.getTotalLength();
        
        // Calculate offset distance based on letter size
        const offsetDistance = Math.min(bbox.width, bbox.height) * 0.08; // 8% inset
        
        // Create LEDs along the path but offset inward
        const leds = this.createInnerLEDs(pathElement, ledCount, offsetDistance);
        
        // Add LEDs to the character group
        leds.forEach((ledData, index) => {
            const led = this.createLEDElement(ledData, color, brightness, effect, index);
            charGroup.appendChild(led);
        });
    }

    /**
     * Create LED positions along the inner path
     */
    createInnerLEDs(pathElement, ledCount, offsetDistance) {
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
            
            // Offset the LED position inward
            const ledPosition = {
                x: point.x - normal.x * offsetDistance,
                y: point.y - normal.y * offsetDistance,
                angle: Math.atan2(normal.y, normal.x) * (180 / Math.PI) + 90
            };
            
            leds.push(ledPosition);
        }
        
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
        
        rect.setAttribute("x", ledData.x - this.ledSize / 2);
        rect.setAttribute("y", ledData.y - this.ledSize / 2);
        rect.setAttribute("width", this.ledSize);
        rect.setAttribute("height", this.ledSize * 0.6); // Rectangular LEDs
        rect.setAttribute("rx", 1); // Slight rounding
        rect.setAttribute("class", "led-strip");
        rect.setAttribute("transform", `rotate(${ledData.angle}, ${ledData.x}, ${ledData.y})`);
        
        // Store LED properties as data attributes
        rect.setAttribute("data-color", color);
        rect.setAttribute("data-brightness", brightness);
        rect.setAttribute("data-effect", effect);
        rect.setAttribute("data-index", index);
        
        // Apply initial styling
        rect.style.fill = color;
        rect.style.opacity = brightness / 100;
        
        if (effect !== 'none') {
            rect.classList.add(`led-effect-${effect}`);
            if (effect === 'chase') {
                rect.style.animationDelay = `${index * 0.1}s`;
            }
        }
        
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