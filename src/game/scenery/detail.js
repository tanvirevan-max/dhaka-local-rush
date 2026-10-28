// Global scenery detail factor: 1 = full, ~0.6 on low-end devices (fewer pedestrians, trees, stalls, wires).
let detail = 1;
export const getDetail = () => detail;
export const setDetail = (v) => { detail = v; };
