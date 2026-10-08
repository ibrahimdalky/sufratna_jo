/* Touch interaction is isolated from menu, cart, and sheet logic. */
(function () {
  'use strict';

  var target = document.getElementById('interactiveLogo');
  if (!target) return;
  var motion = target.querySelector('.logo-motion');
  if (!motion) return;

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var pointerId = null;
  var startX = 0, startY = 0, startOffsetX = 0, startOffsetY = 0;
  var x = 0, y = 0, vx = 0, vy = 0;
  var limitX = 84, limitY = 64;
  var frame = 0, lastTime = 0;

  // Follow directly near the center, then add resistance toward the edges.
  function resist(value, limit) {
    var distance = Math.abs(value);
    var free = limit * 0.65;
    if (distance <= free) return value;
    var space = limit - free;
    var extra = distance - free;
    return Math.sign(value) * (free + space * extra / (space + extra));
  }

  function unresist(value, limit) {
    var distance = Math.abs(value);
    var free = limit * 0.65;
    if (distance <= free) return value;
    var space = limit - free;
    var ratio = Math.min(0.999, (distance - free) / space);
    return Math.sign(value) * (free + space * ratio / (1 - ratio));
  }

  function paint() {
    var dragging = pointerId !== null;
    var energy = Math.min(1, Math.hypot(x / limitX, y / limitY));
    motion.style.setProperty('--logo-x', x.toFixed(3) + 'px');
    motion.style.setProperty('--logo-y', y.toFixed(3) + 'px');
    motion.style.setProperty('--logo-rotate', (x * 0.055).toFixed(3) + 'deg');
    motion.style.setProperty('--logo-scale', dragging ? '1.035' : (1 + energy * 0.012).toFixed(4));
    motion.style.setProperty('--logo-energy', (dragging ? 0.45 + energy * 0.55 : energy * 0.7).toFixed(3));
    motion.style.setProperty('--logo-light-x', (50 + x / limitX * 25).toFixed(2) + '%');
    motion.style.setProperty('--logo-light-y', (50 + y / limitY * 25).toFixed(2) + '%');
  }

  function stopFrame() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  function releaseCapture() {
    var releasedId = pointerId;
    pointerId = null;
    target.classList.remove('is-dragging');
    if (releasedId !== null && target.hasPointerCapture && target.hasPointerCapture(releasedId)) {
      target.releasePointerCapture(releasedId);
    }
  }

  function reset() {
    stopFrame();
    releaseCapture();
    x = y = vx = vy = 0;
    paint();
  }

  function spring(time) {
    frame = 0;
    // Substeps keep the spring stable even when the device drops frames.
    var dt = Math.min(0.032, Math.max(0.001, (time - lastTime) / 1000));
    lastTime = time;
    var steps = Math.ceil(dt / 0.008);
    var step = dt / steps;
    for (var i = 0; i < steps; i++) {
      vx += (-260 * x - 25 * vx) * step;
      vy += (-260 * y - 25 * vy) * step;
      x += vx * step;
      y += vy * step;
    }
    if (Math.hypot(x, y) < 0.12 && Math.hypot(vx, vy) < 0.8) {
      x = y = vx = vy = 0;
      paint();
      return;
    }
    paint();
    frame = requestAnimationFrame(spring);
  }

  function returnHome() {
    stopFrame();
    releaseCapture();
    vx = vy = 0;
    if (reducedMotion.matches || Math.hypot(x, y) < 0.12) {
      reset();
      return;
    }
    lastTime = performance.now();
    paint();
    frame = requestAnimationFrame(spring);
  }

  target.addEventListener('pointerdown', function (event) {
    if (pointerId !== null || event.isPrimary === false || event.button !== 0) return;
    var bounds = target.getBoundingClientRect();
    limitX = Math.max(24, Math.min(84, bounds.left - 12, window.innerWidth - bounds.right - 12));
    limitY = Math.max(24, Math.min(64, bounds.top - 8));
    stopFrame();
    vx = vy = 0;
    startX = event.clientX;
    startY = event.clientY;
    startOffsetX = unresist(x, limitX);
    startOffsetY = unresist(y, limitY);
    pointerId = event.pointerId;
    try { target.setPointerCapture(pointerId); } catch (e) { reset(); return; }
    target.classList.add('is-dragging');
    if (event.cancelable) event.preventDefault();
    paint();
  });

  target.addEventListener('pointermove', function (event) {
    if (event.pointerId !== pointerId) return;
    x = resist(startOffsetX + event.clientX - startX, limitX);
    y = resist(startOffsetY + event.clientY - startY, limitY);
    if (event.cancelable) event.preventDefault();
    if (!frame) {
      frame = requestAnimationFrame(function () { frame = 0; paint(); });
    }
  });

  function endPointer(event) {
    if (event.pointerId === pointerId) returnHome();
  }
  target.addEventListener('pointerup', endPointer);
  target.addEventListener('pointercancel', endPointer);
  target.addEventListener('lostpointercapture', endPointer);
  target.addEventListener('dragstart', function (event) { event.preventDefault(); });
  target.addEventListener('contextmenu', function (event) { event.preventDefault(); });

  target.addEventListener('keydown', function (event) {
    if (pointerId !== null || event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    stopFrame();
    x = 10;
    y = -4;
    returnHome();
  });

  window.addEventListener('blur', reset);
  window.addEventListener('resize', reset);
  document.addEventListener('visibilitychange', function () { if (document.hidden) reset(); });
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', reset);
})();
