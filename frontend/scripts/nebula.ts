// Generated with AI assist to handle low-level pixel math

export const canvas = document.getElementById("nebulaCanvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

let width = 0, height = 0;

// Flat optimized array of primitive objects to prevent Garbage Collector overhead
let objects: Array<{
    x: number; y: number; speed: number;
    type: "dot" | "asset"; spriteIdx: number;
    phase: number; scale: number;
}> = [];

// Fully mutable configuration object accessible from other scripts/console
let _paused = false;
export const CONFIG = {
    scale: 3,
    timeScale: 1.0,

    get paused() {
        return _paused;
    },

    // Setter intercepts assignments: CONFIG.paused = false
    set paused(value: boolean) {
        if (_paused === value) return; // Skip if state hasn't changed
        _paused = value;

        // If unpaused and the RAF loop was dead, safely resurrect it
        if (!value) requestAnimationFrame(animate);
    }
};

const SPRITES: HTMLCanvasElement[] = [];

// Solid retro purple-magenta palette matrix (no alpha transparency blending bugs)
const PALETTES = [
    { outer: "#2e0854", mid: "#4b0082", inner: "#9400d3" },
    { outer: "#4b0082", mid: "#9400d3", inner: "#ff00ff" },
    { outer: "#1a0033", mid: "#4b0082", inner: "#ff00ff" },
    { outer: "#2e0854", mid: "#9400d3", inner: "#ffffff" }
];

// Helper to draw clean retro sharp rounded rectangles
function drawRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string) {
    c.fillStyle = color;
    c.beginPath();
    c.roundRect(x, y, w, h, r);
    c.fill();
}

// Pre-render procedural assets once to eliminate runtime GPU calculation lag
function initSprites() {
    SPRITES.length = 0;

    // Generate 16 solid asset variations (4 styles x 4 color schemes)
    for (let i = 0; i < 4; i++) {
        PALETTES.forEach((pal) => {
            const s = document.createElement("canvas");
            s.width = s.height = 32;
            const c = s.getContext("2d")!;

            c.clearRect(0, 0, 32, 32);
            c.save();

            if (i === 0) {
                // 1. Floppy Disk Style
                drawRect(c, 4, 4, 24, 24, 3, pal.outer);
                drawRect(c, 8, 16, 16, 12, 1, "#ffffff");
                drawRect(c, 10, 4, 12, 6, 0, pal.mid);
            } else if (i === 1) {
                // 2. File Folder Style
                drawRect(c, 8, 4, 16, 20, 1, "#ffffff");
                drawRect(c, 4, 10, 24, 16, 3, pal.outer);
                drawRect(c, 4, 6, 10, 6, 2, pal.outer);
                drawRect(c, 14, 14, 4, 4, 1, pal.inner);
            } else if (i === 2) {
                // 3. Retro Star / Cross Style
                c.translate(16, 16);
                if (Math.random() > 0.5) c.rotate(Math.PI / 4); // Randomly shift + into X cross
                c.fillStyle = "#ffffff";
                c.fillRect(-1, -10, 2, 20);
                c.fillRect(-10, -1, 20, 2);
                c.fillStyle = pal.inner;
                c.fillRect(-1, -1, 2, 2);
            } else {
                // 4. Planet with Ring Style
                c.fillStyle = pal.mid;
                c.beginPath();
                c.ellipse(16, 16, 14, 3, Math.PI / 6, 0, Math.PI * 2);
                c.fill();
                drawRect(c, 10, 10, 12, 12, 6, pal.outer);
                drawRect(c, 12, 12, 6, 6, 3, pal.inner);
            }

            c.restore();
            SPRITES.push(s);
        });
    }
}

// Object factory utilizing low-overhead flat tracking objects
function createObject(type: "dot" | "asset", init = false) {
    const isDot = type === "dot";
    return {
        x: Math.random() * width,
        // Distribute vertically on load, spawn below boundary during gameplay
        y: init ? Math.random() * height : height + 32,
        speed: isDot ? Math.random() * 0.08 + 0.02 : Math.random() * 0.05 + 0.03,
        type,
        spriteIdx: isDot ? 0 : Math.floor(Math.random() * SPRITES.length),
        phase: Math.random() * 100, // Randomized phase offset for independent movement sine-waves
        scale: isDot ? 1 : Math.random() * 0.2 + 0.75
    };
}

// Unified fast handler for rendering stars and files
function drawSprite(obj: typeof objects[0], time: number) {
    if (obj.type === "dot") {
        // Fast strict binary blinking effect for background micro-stars
        if (Math.sin(time * 0.005 + obj.phase) < 0.1) return;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(~~obj.x, ~~obj.y, 1, 1); // ~~ maps strictly on physical pixel grid
        return;
    }

    const sprite = SPRITES[obj.spriteIdx];
    if (!sprite) return;

    const w = sprite.width * obj.scale;
    const h = sprite.height * obj.scale;

    ctx.save();
    ctx.globalCompositeOperation = "screen"; // Vivid retro neon glow layering
    ctx.drawImage(sprite, ~~(obj.x - w / 2), ~~(obj.y - h / 2), w, h);
    ctx.restore();
}

// Main 60 FPS animation loop
function animate() {
    if (CONFIG.paused) return;
    ctx.clearRect(0, 0, width, height); // Fully transparent background clear pass
    const time = Date.now();

    for (let i = 0; i < objects.length; i++) {
        const o = objects[i];

        o.y -= o.speed * CONFIG.timeScale; // Apply global animation multiplier

        // Lava lamp waving horizontal motion effect via pure trigonometry
        if (o.type === "asset") {
            o.x += Math.sin(time * 0.0008 + o.phase) * 0.04 * CONFIG.timeScale;
        }

        // Recycle offscreen elements instantly instead of deleting to save CPU cycles
        if (o.y < -32) {
            objects[i] = createObject(o.type, false);
        } else {
            drawSprite(o, time);
        }
    }

    requestAnimationFrame(animate);
}

// Hard recalculation anchor to completely freeze visual dimensions against layout zoom alterations
function resizeCanvas() {
    const parent = canvas.parentElement!;
    const dpr = window.devicePixelRatio || 1;

    // Read hardware device pixels directly to bypass relative browser virtualization
    const physicalWidth = parent.clientWidth * dpr;
    const physicalHeight = parent.clientHeight * dpr;

    // Apply strict rendering grid setup based on target hardware limits
    width = ~~(physicalWidth / CONFIG.scale);
    height = ~~(physicalHeight / CONFIG.scale);

    canvas.width = width;
    canvas.height = height;

    initSprites();

    // Density balanced: 6 file variants floating on top of 65 distant stars
    objects = [
        ...Array.from({ length: 6 }, () => createObject("asset", true)),
        ...Array.from({ length: 65 }, () => createObject("dot", true))
    ];
}

export { animate, resizeCanvas };
