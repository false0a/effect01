import * as THREE from "https://cdn.skypack.dev/three@0.136.0";
import {OrbitControls} from "https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/OrbitControls";
import * as BufferGeometryUtils from "https://cdn.skypack.dev/three@0.136.0/examples/jsm/utils/BufferGeometryUtils";

import { EffectComposer } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/postprocessing/RenderPass';
import { ShaderPass } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/postprocessing/ShaderPass';
import { UnrealBloomPass } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/postprocessing/UnrealBloomPass';

import { RoomEnvironment } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/environments/RoomEnvironment';

console.clear();
let bg = {
  on: new THREE.Color(0x201030),
  off: new THREE.Color(0x000000)
}


let scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 1, 1000);
camera.position.set(0, 0, 10);
let renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.toneMappingExposure = Math.pow( 1.1, 4.0 );
document.body.appendChild(renderer.domElement);
window.addEventListener("resize", event => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  bloomComposer.setSize(innerWidth, innerHeight);
	finalComposer.setSize(innerWidth, innerHeight);
})

const pmremGenerator = new THREE.PMREMGenerator( renderer );
scene.environment = pmremGenerator.fromScene( new RoomEnvironment(), 0.04 ).texture;

let controls = new OrbitControls(camera, renderer.domElement);
//controls.autoRotate = true;
//controls.autoRotateSpeed *= -1;
controls.enablePan = false;
controls.enableDamping = true;
controls.minDistance = 10;
controls.maxDistance = 10;

let gu = {
  time: {value: 0},
  globalBloom: {value: 0}
}

let light = new THREE.DirectionalLight(0xffffff, 0.9);
light.position.set(1, 1, 1);
scene.add(new THREE.AmbientLight(0xffffff, 0.1));

// RUNES
let runes = makeRunes();
////////

let blob = new THREE.Mesh(
  new THREE.IcosahedronGeometry(1, 3), 
  new THREE.MeshStandardMaterial({
    roughness: 0.1,
    metalness: 0.9,
    color: 0x000088,
    //wireframe:true,
    onBeforeCompile: shader => {
      shader.uniforms.time = gu.time;
      shader.uniforms.globalBloom = gu.globalBloom;
      shader.vertexShader = `
        uniform float time;
        attribute vec3 position2;
        attribute vec3 position3;
        varying vec3 vPos;
        
        attribute vec3 center;
			  varying vec3 vCenter;
        
        ${noise}
        
        vec3 noisePos(vec3 pos){
          float t = time * 0.125;
          vec3 pn = normalize(pos);
          float n = snoise(vec4(pn * 1.5, t));
          n = n * 0.5 + 0.5;
          return pn * (1.5 + n * 4.);
        }
        
        ${shader.vertexShader}
      `.replace(
        `#include <beginnormal_vertex>`,
        `#include <beginnormal_vertex>
          vec3 a = noisePos(position);
          vec3 b = noisePos(position2);
          vec3 c = noisePos(position3);
          
          vec3 ab = normalize(a - b);
          vec3 cb = normalize(c - b);
          objectNormal = normalize(cross(cb, ab));
          
        `
      ).replace(
        `#include <begin_vertex>`,
        `#include <begin_vertex>
          transformed = a;
          vPos = a;
          vCenter = center;
        `
      );
      shader.fragmentShader = `
        uniform float globalBloom;
        varying vec3 vPos;
        varying vec3 vCenter;
        ${shader.fragmentShader}
      `.replace(
        `#include <dithering_fragment>`,
        `#include <dithering_fragment>
          float f = 1. - smoothstep(5., 1.5, length(vPos));
          f = pow(f, 2.);
          vec3 col = gl_FragColor.rgb + vec3(0, 0, 0.1);
          
          // wireframe
          float thickness = 1.0 + f * 0.5;
          vec3 afwidth = fwidth( vCenter.xyz );
          vec3 edge3 = smoothstep( ( thickness - 1.0 ) * afwidth, thickness * afwidth, vCenter.xyz );
          float edge = 1.0 - min( min( edge3.x, edge3.y ), edge3.z );
          //col = mix(col, vec3(1, 0, 0.5), edge);
          ////////////
          
          gl_FragColor.rgb = mix(vec3(0, 1, 0.75) * 0.875, col, f);
          
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0), globalBloom);
          
          gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(vec3(1), vec3(1, 0, 0.5), globalBloom), edge * f);
          
        `
      );
      //console.log(shader.vertexShader);
      //console.log(shader.fragmentShader);
    }
  })
);
setAttributes(blob.geometry);
blob.add(runes);
scene.add(blob);

// calibrated scale
let calibratedScale = makeCalibratedScale();
///////////////////

let uvs = [];
let backPoints = new THREE.Points(
  new THREE.BufferGeometry().setFromPoints(new Array(20000).fill().map(p => {
    let v3 = new THREE.Vector3().random();
    uvs.push(v3.x, v3.y);
    v3.subScalar(0.5).multiplyScalar(300).setZ((Math.random() - 0.5) * 2);
    return v3;
  })).rotateZ(Math.PI * -0.2).translate(0, 140, -10).rotateX(-Math.PI * 0.325).setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)), 
  new THREE.PointsMaterial({
    size: 0.5,
    //transparent: true,
    onBeforeCompile: shader => {
      shader.uniforms.time = gu.time;
      shader.uniforms.globalBloom = gu.globalBloom;
      shader.vertexShader = `
        uniform float time;
        varying vec2 vUv;
        ${noise}
        ${shader.vertexShader}
      `.replace(
        `#include <begin_vertex>`,
        `#include <begin_vertex>
          float t = time * 0.25;
          vUv = uv;
          float n = snoise(vec4((uv + vec2(0., t * 0.25)) * 2.5, 0.1, 0.123));
          transformed.y += n * 10.;
        `
      );
      shader.fragmentShader = `
        uniform float globalBloom;
        varying vec2 vUv;
        ${shader.fragmentShader}
      `.replace(
        `#include <color_fragment>`,
        `#include <color_fragment>
          if(length(gl_PointCoord - 0.5) > 0.5) discard;
          diffuseColor.rgb = mix(vec3(0, 0, 1), vec3(0, 1, 1), smoothstep(0.5, 0.1, length(vUv - 0.5))) * 0.5;
          vec3 c = diffuseColor.rgb;
          float f = length(gl_PointCoord - 0.5);
          float ss =  smoothstep(0.1, 0.5, f);
          diffuseColor.rgb = mix(c + 0.25, c,ss);
          diffuseColor.a = smoothstep(0.5, 0.2, f);
        `
      ).replace(
        `#include <premultiplied_alpha_fragment>`,
        `#include <premultiplied_alpha_fragment>
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0), globalBloom);
        `
      );
      //console.log(shader.vertexShader);
      //console.log(shader.fragmentShader);
    }
  })
);
backPoints.geometry.index = null;
backPoints.add(light);
backPoints.add(calibratedScale);
scene.add(backPoints);

// postprocessing
const params = {
  bloomStrength: 5,
  bloomThreshold: 0,
  bloomRadius: 0.875
};
const renderScene = new RenderPass( scene, camera );

const bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ));
bloomPass.threshold = params.bloomThreshold;
bloomPass.strength = params.bloomStrength;
bloomPass.radius = params.bloomRadius;

const bloomComposer = new EffectComposer( renderer );
bloomComposer.renderToScreen = false;
bloomComposer.addPass( renderScene );
bloomComposer.addPass( bloomPass );

const finalPass = new ShaderPass(
  new THREE.ShaderMaterial( {
    uniforms: {
      baseTexture: { value: null },
      bloomTexture: { value: bloomComposer.renderTarget2.texture }
    },
    vertexShader: document.getElementById( 'vertexshader' ).textContent,
    fragmentShader: document.getElementById( 'fragmentshader' ).textContent,
    defines: {}
  } ), 'baseTexture'
);
finalPass.needsSwap = true;

const finalComposer = new EffectComposer( renderer );
finalComposer.addPass( renderScene );
finalComposer.addPass( finalPass );
/////////////////

let clock = new THREE.Clock();
let t = 0;
let scaleRot = new THREE.Vector3();

renderer.setAnimationLoop(() => {
  controls.update();
  t = clock.getElapsedTime();
  gu.time.value = t;
  scaleRot.set(0.27, 0.31, 0.21).multiplyScalar(t);
  calibratedScale.rotation.setFromVector3(scaleRot);
  backPoints.quaternion.copy(camera.quaternion);
  
  blob.rotation.y = -t * 0.1;
  
  gu.globalBloom.value = 1;
  scene.background = bg.off;
  bloomComposer.render();
  gu.globalBloom.value = 0;
  scene.background = bg.on;
  finalComposer.render();
  
  //renderer.render(scene, camera);
});

function makeRunes(){
  let g = new THREE.IcosahedronGeometry(5, 3);
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  g = BufferGeometryUtils.mergeVertices(g);
  let runeData = []; // index (xy), time (z)
  for(let i = 0; i < g.attributes.position.count; i++){
    runeData.push(
      THREE.MathUtils.randInt(0, 1000),
      THREE.MathUtils.randInt(0, 1000),
      -100
    );
  }
  g.setAttribute("runeData", new THREE.Float32BufferAttribute(runeData, 3));
  let m = new THREE.PointsMaterial({
    color: 0x001166,
    size: 0.75,
    transparent: true,
    onBeforeCompile: shader => {
      shader.uniforms.time = gu.time;
      shader.uniforms.globalBloom = gu.globalBloom;
      shader.vertexShader = `
        uniform float time;
        attribute vec3 runeData;
        varying vec3 vRuneData;
        varying float vRuneTime;
        ${noise}
        vec3 noisePos(vec3 pos){
          float t = time * 0.125;
          vec3 pn = normalize(pos);
          float n = snoise(vec4(pn * 1.5, t));
          n = n * 0.5 + 0.5;
          return pn * (5.5 - (1. - n) * 3.);
        }
        
        ${shader.vertexShader}
      `.replace(
        `#include <begin_vertex>`,
        `#include <begin_vertex>
          float t = time;
          float runeTime = clamp((t - runeData.z) * 0.5, 0., 1.);
          vRuneTime = runeTime;
          float jumpShift = pow(runeTime, 2.);
          vec3 runeJumpShift = normalize(position) * jumpShift * 0.5;
          transformed = noisePos(position) + runeJumpShift;
          vRuneData = runeData;
          
        `
      ).replace(
        `gl_PointSize = size;`,
        `gl_PointSize = size * (1. + jumpShift * 0.25);`
      );
      console.log(shader.vertexShader);
      shader.fragmentShader = `
        uniform float time;
        uniform float globalBloom;
        
        varying vec3 vRuneData;
        varying float vRuneTime;
        
        ${Rune}
        
        ${shader.fragmentShader}
      `.replace(
        `#include <premultiplied_alpha_fragment>`,
        `#include <premultiplied_alpha_fragment>
          float t = time;
          float rune = Rune(gl_PointCoord.xy + vRuneData.xy,4,0.8,vec2(2.0,3.0));
          vec3 col = diffuse * rune;
          if (rune < 0.5) discard;
          col = mix(vec3(1), col, globalBloom);
          float runeTime = vRuneTime;
          float rt = smoothstep(0., 0.1, runeTime) - smoothstep(0.1, 1., runeTime);
          if (runeTime > 0.99) discard; // make invisible at the end of animation
          gl_FragColor = vec4(col, rune * rt);
        `
      );
      //console.log(shader.fragmentShader);
    }
  })
  let p = new THREE.Points(g, m);

  setTimeout( function tick(){
    let rd = g.attributes.runeData;
    rd.setXYZ(
      THREE.MathUtils.randInt(0, rd.count - 1),
      THREE.MathUtils.randInt(0, 1000),
      THREE.MathUtils.randInt(0, 1000),
      t
    );
    rd.needsUpdate = true;
    setTimeout(tick, THREE.MathUtils.randInt(50, 100));
  }, 0);
  
  return p;
}

function makeCalibratedScale(r = 5) {
  let v3 = new THREE.Vector3();
  let pts = [];
  let stepCount = 360;
  let step = 2.5;
  for(let i = 0; i < stepCount; i += step){
    let a = THREE.MathUtils.degToRad(i);
    let len = (i % 90) == 0 ? 4 : (i % 10) == 0 ? 2 : (i % 5) == 0 ? 1.5 : 1;
    v3.set(Math.cos(a), Math.sin(a), 0);
    pts.push(
      v3.clone().setLength((i % 90) == 0 ? r - 4 : r),
      v3.clone().setLength(r + len * 0.25)
    );
  }
  let baseg = new THREE.BufferGeometry().setFromPoints(pts).rotateZ(Math.PI * 0.25);
  let g = BufferGeometryUtils.mergeBufferGeometries([
    baseg.clone(), 
    baseg.clone().rotateX(Math.PI * 0.5), 
    baseg.clone().rotateY(Math.PI * 0.5)
  ])
  let m = new THREE.LineBasicMaterial({
    color: new THREE.Color(0.25, 1, 1),
    transparent: true,
    onBeforeCompile: shader => {
      shader.uniforms.globalBloom = gu.globalBloom;
      shader.vertexShader = `
        varying float vDist;
        ${shader.vertexShader}
      `.replace(
        `#include <project_vertex>`,
        `#include <project_vertex>
          vec3 objPos = vec3(modelViewMatrix * vec4(0., 0., 0., 1.));
          vec3 pos = vec3(modelViewMatrix * vec4(position, 1));
          float dist = dot(vec3(0, 0, 1), normalize(pos - objPos));
          vDist = dist;
        `
      );
      //console.log(shader.vertexShader);
      shader.fragmentShader = `
        uniform float globalBloom;
        varying float vDist;
        ${shader.fragmentShader}
      `.replace(
        `vec4 diffuseColor = vec4( diffuse, opacity );`,
        `
        float f = smoothstep(-0.25, 0.25, vDist);
        vec3 col = diffuse; //mix(diffuse, vec3(0), globalBloom);
        vec4 diffuseColor = vec4( col, opacity * f );
        `
      );
      //console.log(shader.fragmentShader);
    }
  });
  //m.isShaderMaterial = true;
  let l = new THREE.LineSegments(g, m);
  return l;
}

function setAttributes(g) {

  let pos = g.attributes.position;
  let faces = pos.count / 3;
  let faceVerts = [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3()
  ];
  let position2 = [];
  let position3 = [];
  
  for (let i = 0; i < faces; i++) {
    faceVerts[0].fromBufferAttribute(pos, i * 3 + 0);
    faceVerts[1].fromBufferAttribute(pos, i * 3 + 1);
    faceVerts[2].fromBufferAttribute(pos, i * 3 + 2);
    for (let v = 0; v < 3; v++) {
      let v2 = faceVerts[(v + 1) % 3];
      let v3 = faceVerts[(v + 2) % 3];
      position2.push(v2.x, v2.y, v2.z);
      position3.push(v3.x, v3.y, v3.z);
    }
  }

  g.setAttribute("position2", new THREE.Float32BufferAttribute(position2, 3));
  g.setAttribute("position3", new THREE.Float32BufferAttribute(position3, 3));
  
  const vectors = [
    new THREE.Vector3( 1, 0, 0 ),
    new THREE.Vector3( 0, 1, 0 ),
    new THREE.Vector3( 0, 0, 1 )
  ];
  const centers = new Float32Array( pos.count * 3 );
  
  for ( let i = 0, l = pos.count; i < l; i ++ ) {

    vectors[ i % 3 ].toArray( centers, i * 3 );

  }

  g.setAttribute( 'center', new THREE.BufferAttribute( centers, 3 ) );
}