"use client";

import { useEffect, useRef } from "react";

type RhythmType = "NSR" | "VT" | "VF" | "AVB3";

export default function DynamicECG() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Configuration
        let speed = 2; // px per frame
        let x = 0;

        // Rhythm State
        let currentRhythm: RhythmType = "NSR";
        let rhythmTimer = 0;

        // Waveform Data Buffers
        const points: number[] = [];
        const maxPoints = Math.ceil(canvas.width / speed) + 100;

        // Resize Handler
        const handleResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = 300; // Fixed height for the strip
            x = 0;
            points.length = 0; // Clear buffer
        };
        window.addEventListener("resize", handleResize);
        handleResize();

        // RHYTHM GENERATORS
        // Returns y-offset (0 is baseline) based on 't' (time/step counter)

        // 1. Normal Sinus Rhythm (NSR)
        // P-QRS-T complex every ~60-100 frames
        let nsrStep = 0;
        const generateNSR = () => {
            nsrStep++;
            if (nsrStep > 80) nsrStep = 0; // Reset cycle

            const baseline = 0;

            // P wave (small bump at 10-20)
            if (nsrStep >= 10 && nsrStep < 20) return baseline - Math.sin((nsrStep - 10) * Math.PI / 10) * 5;

            // PR segment (flat)

            // QRS Complex (sharp spike at 25-30)
            if (nsrStep >= 25 && nsrStep < 26) return baseline + 5; // Q
            if (nsrStep >= 26 && nsrStep < 29) return baseline - 80; // R (sharp up means neg Y)
            if (nsrStep >= 29 && nsrStep < 31) return baseline + 15; // S

            // ST segment (flat)

            // T wave (medium bump at 45-65)
            if (nsrStep >= 45 && nsrStep < 65) return baseline - Math.sin((nsrStep - 45) * Math.PI / 20) * 10;

            return baseline + (Math.random() - 0.5) * 2; // Noise
        };

        // 2. Ventricular Tachycardia (VT)
        // Large, regular, wide complex waves (sine-ish but sharper)
        let vtStep = 0;
        const generateVT = () => {
            vtStep++;
            // Fast cycle ~30 frames
            const val = Math.sin(vtStep * 0.3) * 60;
            // Add some sharpness
            return val + (Math.random() - 0.5) * 5;
        };

        // 3. Ventricular Fibrillation (VF)
        // Chaotic, irregular, smaller amplitude than VT
        let vfStep = 0;
        const generateVF = () => {
            vfStep += 0.1;
            // Perlin-noise like chaos (simplified here with multiple sines)
            return (Math.sin(vfStep) * 20) + (Math.sin(vfStep * 3.4) * 15) + (Math.cos(vfStep * 1.5) * 10) + (Math.random() - 0.5) * 5;
        };

        // 4. 3rd Degree AV Block (AVB3)
        // P wavs march regularly, QRS march regularly but slower, independent.
        let avbP = 0;
        let avbQRS = 0;
        const generateAVB3 = () => {
            avbP++;
            avbQRS++;

            if (avbP > 60) avbP = 0; // P wave rate ~100bpm equivalent
            if (avbQRS > 130) avbQRS = 0; // QRS rate ~40bpm equivalent

            let y = 0;

            // P wave logic
            if (avbP >= 10 && avbP < 20) y -= Math.sin((avbP - 10) * Math.PI / 10) * 5;

            // QRS logic (wide escape rhythm)
            if (avbQRS >= 10 && avbQRS < 15) y += 5; // Q
            if (avbQRS >= 15 && avbQRS < 20) y -= 60; // R
            if (avbQRS >= 20 && avbQRS < 25) y += 10; // S
            // T wave for escape beat
            if (avbQRS >= 40 && avbQRS < 70) y -= Math.sin((avbQRS - 40) * Math.PI / 30) * 12;

            return y + (Math.random() - 0.5) * 2;
        };

        // Animation Loop
        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Rhythm Controller
            rhythmTimer++;
            if (rhythmTimer > 0 && rhythmTimer < 300) currentRhythm = "NSR"; // 5s
            else if (rhythmTimer < 600) currentRhythm = "VT"; // 5s
            else if (rhythmTimer < 900) currentRhythm = "VF"; // 5s
            else if (rhythmTimer < 1200) currentRhythm = "AVB3"; // 5s
            else rhythmTimer = 0; // Loop

            // Get next point
            let yOffset = 0;
            switch (currentRhythm) {
                case "NSR": yOffset = generateNSR(); break;
                case "VT": yOffset = generateVT(); break;
                case "VF": yOffset = generateVF(); break;
                case "AVB3": yOffset = generateAVB3(); break;
            }

            // Screen wrap logic (Simulate scrolling paper)
            // Actually, better to shift array? No, simpler to just draw 'x' moving right.

            // Let's implement correct scrolling strip style:
            // We draw the whole history. New points added to right, old shifted left.

            points.push(yOffset);
            if (points.length > canvas.width / speed) {
                points.shift();
            }

            // Draw Grid
            ctx.strokeStyle = "#E2E8F0";
            ctx.lineWidth = 1;
            ctx.beginPath();

            // Draw ECG Line
            ctx.strokeStyle = "#10B981"; // Emerald Green
            ctx.lineWidth = 2.5;
            ctx.lineJoin = "round";
            ctx.shadowBlur = 4;
            ctx.shadowColor = "#10B981";

            ctx.beginPath();
            const centerY = canvas.height / 2;

            for (let i = 0; i < points.length; i++) {
                const px = i * speed;
                const py = centerY + points[i];
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.stroke();

            // Scan bar / Write head
            const headX = (points.length - 1) * speed;
            ctx.fillStyle = "#0891B2"; // Teal dot
            ctx.shadowBlur = 8;
            ctx.shadowColor = "#0891B2";
            ctx.beginPath();
            ctx.arc(headX, centerY + points[points.length - 1], 4, 0, Math.PI * 2);
            ctx.fill();



            requestAnimationFrame(render);
        };

        const animationId = requestAnimationFrame(render);
        return () => {
            cancelAnimationFrame(animationId);
            window.removeEventListener("resize", handleResize);
        };
    }, []);

    return (
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-60 z-0">
            <canvas ref={canvasRef} className="w-full h-full" />
        </div>
    );
}
