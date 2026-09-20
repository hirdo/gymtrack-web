import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

const BACKGROUND = '#030306';

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

// The shader body below is copied verbatim from the source component's WebGL fragment/vertex
// shaders. Everything else (Tailwind CDN, Iconify, GSAP, Google Fonts, grain/grid texture divs)
// from the original scraped page is dropped: the source component's own isolation script hides
// every element except #bg-canvas, so none of that markup ever actually renders — only the
// canvas + three.js shader do.
const FLUID_DOCUMENT = `<!doctype html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: ${BACKGROUND}; }
  canvas { display: block; width: 100%; height: 100%; }
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
</head>
<body>
<canvas id="bg-canvas"></canvas>
<script>
  const canvas = document.querySelector('#bg-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const scene = new THREE.Scene();
  const geometry = new THREE.PlaneGeometry(2, 2);

  const vertexShader = \`
    void main() {
      gl_Position = vec4(position, 1.0);
    }
  \`;

  const fragmentShader = \`
    uniform float u_time;
    uniform vec2 u_resolution;

    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy));
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m;
      m = m*m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution.xy;
      uv.x *= u_resolution.x / u_resolution.y;

      vec3 baseColor = vec3(0.012, 0.012, 0.02);
      vec2 st = uv * 0.7;
      st += vec2(snoise(st + u_time * 0.05), snoise(st - u_time * 0.05)) * 0.3;

      float beam = smoothstep(0.1, 0.8, snoise(vec2(st.x + st.y * 1.5 - u_time * 0.15, u_time * 0.02)));
      // --color-primary-dark (#ea580c) -> --color-primary-light (#fb923c): warm orange glow
      // matching the app's brand palette, replacing the source shader's blue/purple mix.
      vec3 glow = mix(vec3(0.918, 0.345, 0.047), vec3(0.984, 0.573, 0.235), snoise(uv * 1.5 + u_time * 0.1) * 0.5 + 0.5);

      gl_FragColor = vec4(baseColor + (glow * beam * 0.7), 1.0);
    }
  \`;

  const uniforms = {
    u_time: { value: 0.0 },
    u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
  };

  const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  const clock = new THREE.Clock();
  function animate() {
    uniforms.u_time.value = clock.getElapsedTime();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
  });
</script>
</body></html>`;

// Fixed, negative-z WebGL layer meant to sit behind a page's normal-flow content —
// drop it in as the first element of a route component's template.
@Component({
  selector: 'app-fluid-field-background',
  standalone: true,
  template: `
    <iframe
      class="fluid-field-frame"
      title="Fluid field background"
      [srcdoc]="safeDocument"
      sandbox="allow-scripts"
      loading="eager"
      [style.filter]="filter()"
    ></iframe>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: -1;
      display: block;
      overflow: hidden;
      pointer-events: none;
      background-color: #030306;
    }

    .fluid-field-frame {
      display: block;
      width: 100%;
      height: 100%;
      border: 0;
    }
  `
})
export class FluidFieldBackgroundComponent {
  readonly hue = input(0);
  readonly saturation = input(1);
  readonly brightness = input(1);

  private readonly sanitizer = inject(DomSanitizer);
  readonly safeDocument = this.sanitizer.bypassSecurityTrustHtml(FLUID_DOCUMENT);

  readonly filter = computed(() => {
    const safeHue = clamp(this.hue(), -180, 180);
    const safeSaturation = clamp(this.saturation(), 0, 2);
    const safeBrightness = clamp(this.brightness(), 0.35, 1.65);

    if (safeHue === 0 && safeSaturation === 1 && safeBrightness === 1) return null;
    return `hue-rotate(${safeHue}deg) saturate(${safeSaturation}) brightness(${safeBrightness})`;
  });
}
