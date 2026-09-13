/** Shared normalized pointer position, smoothed per consumer. */
const pointer = { x: 0, y: 0 };

window.addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
});

export default pointer;
