function isConstrainedDevice() {
  const compact = window.matchMedia?.('(max-width: 720px)').matches ?? false;
  const saveData = navigator.connection?.saveData === true;
  const lowMemory = Number(navigator.deviceMemory || 8) <= 4;
  const lowCpu = Number(navigator.hardwareConcurrency || 8) <= 4;
  return saveData || (compact && (lowMemory || lowCpu));
}

function shouldSkipThree() {
  return isConstrainedDevice()
    || (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
    || !('WebGLRenderingContext' in window);
}

export function mountWeafThreeHero(container) {
  if (!container || shouldSkipThree()) {
    container?.classList.add('three-hero-fallback');
    return () => {};
  }

  let disposed = false;
  let idleId = null;
  let timeoutId = null;
  let destroyScene = () => {};

  const start = async () => {
    try {
      const [core, rendererModule] = await Promise.all([
        import('./threeHeroCore.js'),
        import('./threeHeroRenderer.js'),
      ]);
      const THREE = { ...core, ...rendererModule };
      if (disposed) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      camera.position.set(0, 0, 7.2);

      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: false,
        powerPreference: 'low-power',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.setAttribute('aria-hidden', 'true');
      renderer.domElement.tabIndex = -1;
      container.append(renderer.domElement);

      const particleCount = window.matchMedia('(max-width: 900px)').matches ? 54 : 96;
      const positions = new Float32Array(particleCount * 3);
      for (let index = 0; index < particleCount; index += 1) {
        positions[index * 3] = (Math.random() - 0.5) * 11;
        positions[index * 3 + 1] = (Math.random() - 0.5) * 7;
        positions[index * 3 + 2] = (Math.random() - 0.5) * 5;
      }

      const particlesGeometry = new THREE.BufferGeometry();
      particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const particlesMaterial = new THREE.PointsMaterial({
        color: 0xd99a4d,
        opacity: 0.48,
        size: 0.035,
        sizeAttenuation: true,
        transparent: true,
        depthWrite: false,
      });
      const particles = new THREE.Points(particlesGeometry, particlesMaterial);
      scene.add(particles);

      const forgeGeometry = new THREE.BufferGeometry();
      forgeGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        0, 1.58, 0, -1.2, 0, 0, 0, 0, 1.2,
        0, 1.58, 0, 0, 0, 1.2, 1.2, 0, 0,
        0, 1.58, 0, 1.2, 0, 0, 0, 0, -1.2,
        0, 1.58, 0, 0, 0, -1.2, -1.2, 0, 0,
        0, -1.58, 0, 0, 0, 1.2, -1.2, 0, 0,
        0, -1.58, 0, 1.2, 0, 0, 0, 0, 1.2,
        0, -1.58, 0, 0, 0, -1.2, 1.2, 0, 0,
        0, -1.58, 0, -1.2, 0, 0, 0, 0, -1.2,
      ]), 3));
      const forgeMaterial = new THREE.PointsMaterial({
        color: 0x467998,
        opacity: 0.12,
        size: 0.045,
        transparent: true,
        depthWrite: false,
      });
      const forge = new THREE.Points(forgeGeometry, forgeMaterial);
      forge.position.set(2.7, -0.25, -1.1);
      forge.rotation.set(0.28, -0.4, 0.12);
      scene.add(forge);

      const orbitPositions = new Float32Array(84 * 3);
      for (let index = 0; index < 84; index += 1) {
        const angle = (index / 84) * Math.PI * 2;
        orbitPositions[index * 3] = Math.cos(angle) * 2.08;
        orbitPositions[index * 3 + 1] = Math.sin(angle) * 2.08;
      }
      const orbitGeometry = new THREE.BufferGeometry();
      orbitGeometry.setAttribute('position', new THREE.BufferAttribute(orbitPositions, 3));
      const orbitMaterial = new THREE.PointsMaterial({
        color: 0xd99a4d,
        opacity: 0.16,
        size: 0.02,
        transparent: true,
        depthWrite: false,
      });
      const orbit = new THREE.Points(orbitGeometry, orbitMaterial);
      orbit.position.copy(forge.position);
      orbit.rotation.set(1.12, 0.2, -0.35);
      scene.add(orbit);

      let pointerX = 0;
      let pointerY = 0;
      let raf = null;
      let inView = true;
      const startedAt = performance.now();

      const resize = () => {
        const { width, height } = container.getBoundingClientRect();
        if (!width || !height) return;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      };

      const tick = (now) => {
        raf = null;
        if (disposed || document.hidden || !inView) return;
        const elapsed = (now - startedAt) / 1000;
        particles.rotation.y = elapsed * 0.018 + pointerX * 0.035;
        particles.rotation.x = pointerY * 0.02;
        forge.rotation.y = -0.4 + elapsed * 0.045 + pointerX * 0.08;
        forge.rotation.x = 0.28 + Math.sin(elapsed * 0.35) * 0.04 + pointerY * 0.04;
        orbit.rotation.z = -0.35 + elapsed * 0.025 + pointerX * 0.025;
        renderer.render(scene, camera);
        raf = window.requestAnimationFrame(tick);
      };

      const resume = () => {
        if (raf === null && !document.hidden && inView && !disposed) raf = window.requestAnimationFrame(tick);
      };

      const pause = () => {
        if (raf !== null) window.cancelAnimationFrame(raf);
        raf = null;
      };

      const onPointerMove = (event) => {
        pointerX = (event.clientX / window.innerWidth - 0.5) * 2;
        pointerY = (event.clientY / window.innerHeight - 0.5) * 2;
      };

      const onVisibilityChange = () => (document.hidden ? pause() : resume());
      const resizeObserver = new ResizeObserver(resize);
      const visibilityObserver = new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        if (inView) resume(); else pause();
      }, { threshold: 0.02 });

      resizeObserver.observe(container);
      visibilityObserver.observe(container);
      document.addEventListener('pointermove', onPointerMove, { passive: true });
      document.addEventListener('visibilitychange', onVisibilityChange);
      resize();
      container.classList.add('three-hero-ready');
      resume();

      destroyScene = () => {
        pause();
        resizeObserver.disconnect();
        visibilityObserver.disconnect();
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        particlesGeometry.dispose();
        particlesMaterial.dispose();
        forgeGeometry.dispose();
        forgeMaterial.dispose();
        orbitGeometry.dispose();
        orbitMaterial.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    } catch {
      container.classList.add('three-hero-fallback');
    }
  };

  const schedule = () => {
    if (disposed || document.hidden) return;
    if ('requestIdleCallback' in window) idleId = window.requestIdleCallback(start, { timeout: 2600 });
    else timeoutId = window.setTimeout(start, 900);
  };

  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });

  return () => {
    disposed = true;
    if (idleId !== null) window.cancelIdleCallback?.(idleId);
    if (timeoutId !== null) window.clearTimeout(timeoutId);
    window.removeEventListener('load', schedule);
    destroyScene();
  };
}
