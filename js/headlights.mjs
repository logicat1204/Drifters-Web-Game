// Both shader programs use the same pair of overlapping beams.
export const HEADLIGHT_GLSL=`
  float headlightBeam(vec3 position,vec3 car,vec2 forward,float slope){
    vec2 delta=position.xz-car.xz;
    float ahead=dot(delta,forward);
    float depth=max(0.,ahead);
    float across=abs(delta.x*forward.y-delta.y*forward.x);
    // For symmetric falloff, the closer lamp is enough to find the stronger beam.
    float fromLamp=abs(across-(.65+depth*.10));
    float spread=1.-smoothstep(1.35+depth*.105,3.75+depth*.36,fromLamp);
    float range=smoothstep(.5,3.5,ahead)*(1.-smoothstep(48.,140.,ahead));
    float height=1.-smoothstep(1.5,6.,abs(position.y-car.y-ahead*slope));
    return spread*range*height;
  }
`;
