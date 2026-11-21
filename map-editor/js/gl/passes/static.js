// Stage 'static': starts every frame from the baked ground (Ground.bake's picture), which GpuWorld keeps as a texture.
GlFrame.register({
  stage: 'static',
  draw() { GlFrame.copyInto(GpuWorld.staticTex()); },
});
