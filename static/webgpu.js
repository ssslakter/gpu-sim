/**
 * @param {HTMLCanvasElement} canvas
 */
async function init(canvas) {
    let adapter = await navigator.gpu.requestAdapter()
    let device = await adapter.requestDevice()
    let context = canvas.getContext("webgpu")
    // context.configure({
    //     device: device,
    //     format: navigator.gpu.getPreferredCanvasFormat(),
    // })
}

class Point {
    damping = 0.7;
    g = 0.000;
    constructor(x, y, vx = 0, vy = 0, radius = 0.05) {
        this.x = x;  // Position
        this.y = y;
        this.vx = vx; // Velocity
        this.vy = vy;
        this.radius = radius;
    }

    updatePosition(deltaTime) {
        this.vy += this.g * deltaTime;

        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;

        // Check for boundary collision
        if (this.x - this.radius < 0) {
            this.x = this.radius;  // Prevent going out of bounds
            this.vx *= -1 * this.damping;  // Invert velocity to bounce back
        } else if (this.x + this.radius > 1) {
            this.x = 1 - this.radius;  // Prevent going out of bounds
            this.vx *= -1 * this.damping;  // Invert velocity to bounce back
        }

        if (this.y - this.radius < 0) {
            this.y = this.radius;  // Prevent going out of bounds
            this.vy *= -1 * this.damping;  // Invert velocity to bounce back
        } else if (this.y + this.radius > 1) {
            this.y = 1 - this.radius;  // Prevent going out of bounds
            this.vy *= -1 * this.damping;  // Invert velocity to bounce back
        }
    }

    detectCollision(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < this.radius + other.radius;
    }

    // Collision resolution: resolves collision between this point and another point
    resolveCollision(other, deltaTime) {
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Normalized collision vector
        const nx = dx / distance;
        const ny = dy / distance;

        // Relative velocity
        const rvx = other.vx - this.vx;
        const rvy = other.vy - this.vy;

        // Relative velocity along the normal
        const velAlongNormal = rvx * nx + rvy * ny;

        // Prevent objects from sticking
        if (velAlongNormal > 0) return;

        // Coefficient of restitution (elasticity) and damping factor
        const restitution = 1;  // Coefficient of restitution (elastic)

        // Calculate the impulse
        let impulse = -(1 + restitution) * velAlongNormal;

        // Apply damping to the impulse
        impulse *= this.damping;

        // Clamp the impulse to prevent runaway velocities
        const maxImpulse = 0.1; // Maximum impulse value (adjustable)
        impulse = Math.max(Math.min(impulse, maxImpulse), -maxImpulse);

        // Update velocities based on the impulse
        const impulseX = impulse * nx;
        const impulseY = impulse * ny;

        this.vx -= impulseX * deltaTime;
        this.vy -= impulseY * deltaTime;
        other.vx += impulseX * deltaTime;
        other.vy += impulseY * deltaTime;
    }

}


class Points {
    constructor(n = 1000, radius = 0.05) {
        this.points = Array.from({ length: n }, () =>
            new Point(Math.random(), Math.random(), Math.random() * 0.01, Math.random() * 0.01, radius)
        );
    }

    toGPU() {
        return new Float32Array(this.points.flatMap(p => [p.x, p.y, p.vx, p.vy]));
    }

    updatePoints(deltaTime) {
        const resolvedPairs = new Set();

        // First, resolve all collisions
        this.points.forEach((point1, i) => {
            this.points.slice(i + 1).forEach((point2, j) => {
                // Create unique pair ID (sorted to avoid double resolution)
                const pairId = `${Math.min(i, j)}-${Math.max(i, j)}`;
                if (resolvedPairs.has(pairId)) return;

                if (point1.detectCollision(point2)) {
                    point1.resolveCollision(point2, deltaTime);
                    resolvedPairs.add(pairId);
                }
            });
        });

        // Then, update positions after all collisions are resolved
        this.points.forEach((point) => point.updatePosition(deltaTime));
    }
}

function generateHSVColorsInArc(numColors, startHue=0., endHue=180., saturation=0.6, lightness=1) {
    const colors = [];
    const interval = (endHue - startHue) / (numColors - 1.);  // Calculate interval based on the specified arc
    for (let i = 0; i < numColors; i++) {
        const hue = startHue + i * interval;  // Generate hue within the specified arc
        colors.push(hsvToRgb(hue, saturation, lightness));
    }

    return colors;
}

function hsvToRgb(h, s, v) {
    // Ensure the input hue is within 0-360, saturation and value are between 0 and 1
    s = Math.max(0, Math.min(1, s));
    v = Math.max(0, Math.min(1, v));
    h = h % 360;

    // Chroma calculation
    const c = v * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = v - c;

    let rPrime, gPrime, bPrime;

    if (h >= 0 && h < 60) {
        rPrime = c; gPrime = x; bPrime = 0;
    } else if (h >= 60 && h < 120) {
        rPrime = x; gPrime = c; bPrime = 0;
    } else if (h >= 120 && h < 180) {
        rPrime = 0; gPrime = c; bPrime = x;
    } else if (h >= 180 && h < 240) {
        rPrime = 0; gPrime = x; bPrime = c;
    } else if (h >= 240 && h < 300) {
        rPrime = x; gPrime = 0; bPrime = c;
    } else {
        rPrime = c; gPrime = 0; bPrime = x;
    }

    // Apply the offset and return RGB values (clamped to [0, 255])
    const r = Math.round((rPrime + m) * 255);
    const g = Math.round((gPrime + m) * 255);
    const b = Math.round((bPrime + m) * 255);

    return {r: r, g: g, b: b};
}


/**
 * @param {HTMLCanvasElement} canvas
 * @param {Points} points
 */
async function init_pixi(canvas, points) {
    const app = new PIXI.Application();
    await app.init({
        canvas: canvas,
        width: canvas.width,
        height: canvas.height,
        resolution: 2
    });
    document.body.appendChild(app.canvas);
    const colors = generateHSVColorsInArc(points.points.length);
    const particleGraphics = points.points.map((point, i) => {
        console.log(colors[i])
        const circle = new PIXI.Graphics()
            .circle(0, 0, point.radius * app.renderer.width) // Radius of 2
            .fill(colors[i]); // White color
        app.stage.addChild(circle);
        return circle;
    });

    app.ticker.add((tick) => {
        points.updatePoints(tick.deltaTime);
        points.points.forEach((point, i) => {

            const gfx = particleGraphics[i];
            gfx.x = point.x * app.renderer.width;
            gfx.y = point.y * app.renderer.height;
        });
    });

    window.__PIXI_DEVTOOLS__ = { app };
}



let canvas = document.getElementById("canvas")
// @ts-ignore
// init(canvas);
let points = new Points(50, 0.01);
init_pixi(canvas, points);
