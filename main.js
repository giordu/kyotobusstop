import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import GUI from 'lil-gui';

/* ----- Configurazione Renderer ----- */

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

//stats
const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);

Object.assign(stats.dom.style, {
    position: 'absolute',
    top: 'auto',
    left: 'auto',
    bottom: '20px',
    right: '20px',
    zIndex: '1000',
    height: '16px',          
    overflow: 'hidden',  
    borderRadius: '4px',
    boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
    opacity: '0.9'
});

// Pannello di benvenuto
createWelcomePanel();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0.5, 4, -40); 

/* ----- Illuminazione da Tramonto  ----- */

const ambientLight = new THREE.AmbientLight(0xffe4e6, 0.5); 
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xff9d5c, 2.2);
sunLight.position.set(-25, 4, -20); 
sunLight.castShadow = true;

sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.bias = -0.0005;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 100;
const d = 30;
sunLight.shadow.camera.left = -d;
sunLight.shadow.camera.right = d;
sunLight.shadow.camera.top = d;
sunLight.shadow.camera.bottom = -d;
scene.add(sunLight);

/* ---- Stato ed Elementi ---- */

let gattoMesh = null;
let gattoMixer = null;

const cuoriInScena = []; 
const luciLampioni = []; 

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const autobusState = {
    model: null,
    inMovimento: false,
    direzione: 1, 
    speed: 12.0,            
    posInizialeX: 13,      
    posFermataX: 0,         
    posFineX: -13,           
    timerFermata: 0,
    durataSosta: 4.0        
};

/* ----- Caricamento Modello e Sfondo Cielo ----- */

function loadModel() {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load('./assets/textures/sunset_sky.jpg', (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping; 
        texture.colorSpace = THREE.SRGBColorSpace;
        scene.background = texture;
    }, undefined, (err) => console.error("Errore nel caricamento del cielo:", err));

    return new GLTFLoader().loadAsync('./assets/models/japanese_street.glb').then(gltf => {
        const root = gltf.scene;
        
        const box = new THREE.Box3().setFromObject(root);
        const center = box.getCenter(new THREE.Vector3());
        root.position.sub(center);

        root.updateMatrixWorld(true); 

        root.traverse(obj => {
            if (obj.isMesh) {
                obj.castShadow = true;
                obj.receiveShadow = true;
            
                if (obj.name === 'SM_StreetLight__0' || obj.name === 'SM_StreetLight__0001') {
                    const luceLanterna = new THREE.PointLight(0xffaa44, 3, 5);
                    luceLanterna.position.set(0, 0, 0); 
                    luceLanterna.position.y += 0.5; 
                    obj.add(luceLanterna);
                    luciLampioni.push(luceLanterna);
                }

                if (obj.material) {
                    obj.material.roughness = Math.max(obj.material.roughness, 0.4);
                }

                if (obj.material && obj.material.map) {
                    obj.material.map.colorSpace = THREE.SRGBColorSpace;
                }
            }
        });

        const autobusMesh = root.getObjectByName('Autobus'); 
        if (autobusMesh) {
            autobusState.model = autobusMesh; 
            autobusMesh.position.x = autobusState.posInizialeX;
            autobusState.model.visible = false; 
        }

        gattoMesh = root.getObjectByName('Gatto');
        if (gattoMesh && gltf.animations && gltf.animations.length > 0) {
            gattoMixer = new THREE.AnimationMixer(gattoMesh);
            const action = gltf.animations[0];
            const clipAction = gattoMixer.clipAction(action);
            clipAction.setLoop(THREE.LoopRepeat, Infinity);
            clipAction.play();
        }

        return root;
    });
}

/* ----- Logica Animazione Autobus ----- */

function chiamaAutobus() {
    if (!autobusState.inMovimento) {
        if (autobusState.model) {
            autobusState.model.visible = true; 
        }
        autobusState.inMovimento = true;
        autobusState.direzione = 1;
    }
}

function coccolaGatto() {
    if (!gattoMesh) return;

    for (let i = 0; i < 6; i++) {
        const x = 0, y = 0;
        const heartShape = new THREE.Shape();
        heartShape.moveTo(x + 0.25, y + 0.25);
        heartShape.bezierCurveTo(x + 0.25, y + 0.25, x + 0.2, y, x, y);
        heartShape.bezierCurveTo(x - 0.3, y, x - 0.3, y + 0.35, x - 0.3, y + 0.35);
        heartShape.bezierCurveTo(x - 0.3, y + 0.55, x - 0.1, y + 0.77, x + 0.25, y + 0.95);
        heartShape.bezierCurveTo(x + 0.6, y + 0.77, x + 0.8, y + 0.55, x + 0.8, y + 0.35);
        heartShape.bezierCurveTo(x + 0.8, y + 0.35, x + 0.8, y, x + 0.5, y);
        heartShape.bezierCurveTo(x + 0.35, y, x + 0.25, y + 0.25, x + 0.25, y + 0.25);

        const extrudeSettings = { depth: 0.05, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.02, bevelThickness: 0.02 };
        const geometry = new THREE.ExtrudeGeometry(heartShape, extrudeSettings); 
        
        const material = new THREE.MeshPhongMaterial({ color: 0xff3b30, shininess: 100 }); 
        const cuore = new THREE.Mesh(geometry, material);

        cuore.scale.set(0.3, 0.3, 0.3);
        cuore.rotation.z = Math.PI; 

        cuore.position.x = -9.3 + (Math.random() - 0.5) * 0.4;
        cuore.position.y = -9.2 + (Math.random() * 0.2);
        cuore.position.z = 1.75 + (Math.random() - 0.5) * 0.4;
        
        cuore.userData = {
            velocity: new THREE.Vector3((Math.random() - 0.5) * 2, 2 + Math.random() * 2, (Math.random() - 0.5) * 2),
            life: 1.0 
        };

        scene.add(cuore);
        cuoriInScena.push(cuore);
    }
}

function updateAutobus(delta, t) {
    if (!autobusState.model || !autobusState.inMovimento) return;

    const bus = autobusState.model;

    if (autobusState.direzione === 1) {
        if (bus.position.x > autobusState.posFermataX) {
            bus.position.x -= autobusState.speed * delta;
        } else {
            bus.position.x = autobusState.posFermataX;
            autobusState.direzione = 0;
            autobusState.timerFermata = t + autobusState.durataSosta;
        }
    }

    if (autobusState.direzione === 0) {
        if (t > autobusState.timerFermata) {
            autobusState.direzione = 2;
        }
    }

    if (autobusState.direzione === 2) {
        if (bus.position.x > autobusState.posFineX) {
            bus.position.x -= autobusState.speed * delta;
        } else {
            bus.position.x = autobusState.posInizialeX;
            autobusState.inMovimento = false;
            autobusState.direzione = 1;
            bus.visible = false; 
        }
    }
}

/* ----- Interazione Raycaster (Click sul Gatto) ----- */

function onPointerDown(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    if (gattoMesh) {
        const intersects = raycaster.intersectObject(gattoMesh, true);
        if (intersects.length > 0) {
            coccolaGatto();
        }
    }
}

/* ----- Interfaccia Grafica (GUI) ----- */

function setupGUI() {
    const gui = new GUI({ title: 'Controlli Atmosfera' });
    
    // Ora la GUI gestisce solo le luci dell'ambiente
    const fLuce = gui.addFolder('Luci & Atmosfera');
    fLuce.add(sunLight, 'intensity', 0, 5, 0.1).name('Intensità Sole');
    
    const sunColorHelper = { color: '#' + sunLight.color.getHexString() };
    fLuce.addColor(sunColorHelper, 'color').name('Colore Sole').onChange(value => {
        sunLight.color.set(value);
    });

    fLuce.add(ambientLight, 'intensity', 0, 2, 0.1).name('Luce Ambiente');

    const lampioniHelper = { accesi: true };
    fLuce.add(lampioniHelper, 'accesi').name('Lampioni Accesi').onChange(value => {
        luciLampioni.forEach(luce => {
            luce.intensity = value ? 3 : 0; 
        });
    });

    gui.close();
}

/* ----- Creazione Dinamica Pannello di Benvenuto + Bottone ----- */

function createWelcomePanel() {
    const box = document.createElement('div');
    box.innerHTML = `
        <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #ff9d5c; font-weight: 600; letter-spacing: 0.5px;">🌅 Pomeriggio a Kyoto</h3>
        <p style="margin: 0 0 14px 0; font-size: 11.5px; line-height: 1.5; color: #cbd5e1;">
            Cinque di un pomeriggio qualunque a Kyoto. I distributori automatici iniziano a brillare e un gatto per strada aspetta che succeda qualcosa. Tipo che arrivi l'autobus...
        </p>
        
        <button id="btn-autobus" style="
            width: 100%;
            background: linear-gradient(135deg, #ff9d5c, #ff7a45);
            color: #0f172a;
            border: none;
            padding: 10px;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            border-radius: 6px;
            cursor: pointer;
            margin-bottom: 14px;
            box-shadow: 0 4px 10px rgba(255, 157, 92, 0.2);
            transition: all 0.2s ease;
        ">Chiama Autobus</button>

        <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;">
            <span style="font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: bold; display: block; margin-bottom: 4px;">Esplorazione:</span>
            <ul style="margin: 0; padding-left: 14px; font-size: 11px; line-height: 1.5; color: #94a3b8; list-style-type: '• ';">
                <li><b>Trascina:</b> Ruota o sposta la visuale</li>
                <li><b>Rotella/Trackpad:</b> Zoom avanti/indietro</li>
                <li><b>Gatto:</b> Cliccalo per lasciargli una coccola <3</li>
            </ul>
        </div>
    `;
    
    Object.assign(box.style, {
        position: 'absolute',
        top: '20px',
        left: '20px',
        width: '260px',
        backgroundColor: 'rgba(15, 23, 42, 0.70)', 
        backdropFilter: 'blur(10px)',               
        borderRadius: '10px',
        padding: '16px',
        fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        zIndex: '100'
    });

    document.body.appendChild(box);

    // Agganciamo l'evento click al bottone appena creato
    const btn = document.getElementById('btn-autobus');
    btn.addEventListener('click', chiamaAutobus);

    // Effetti animati di hover sul pulsante
    btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'translateY(-1px)';
        btn.style.boxShadow = '0 6px 15px rgba(255, 157, 92, 0.4)';
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translateY(0)';
        btn.style.boxShadow = '0 4px 10px rgba(255, 157, 92, 0.2)';
    });
}

/* ----- Loop Principale di Animazione ----- */

const clock = new THREE.Clock();

function animate(orbitControls) {
    requestAnimationFrame(() => animate(orbitControls));

    stats.update()

    const delta = clock.getDelta(); 
    const t = clock.elapsedTime;

    if (gattoMixer) gattoMixer.update(delta);

    updateAutobus(delta, t);

    for (let i = cuoriInScena.length - 1; i >= 0; i--) {
        const cuore = cuoriInScena[i];
        
        cuore.position.x += cuore.userData.velocity.x * delta;
        cuore.position.y += cuore.userData.velocity.y * delta;
        cuore.position.z += cuore.userData.velocity.z * delta;

        cuore.rotation.y += 2 * delta;
        cuore.userData.life -= delta * 0.8; 

        const scale = cuore.userData.life * 0.3;
        if (scale > 0) {
            cuore.scale.set(scale, scale, scale);
        }

        if (cuore.userData.life <= 0) {
            scene.remove(cuore);
            cuoriInScena.splice(i, 1);
        }
    }

    orbitControls.update();
    renderer.render(scene, camera);
}

/* ----- Inizializzazione Applicazione ----- */

loadModel().then(root => {
    scene.add(root);

    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;

    // Impedisce alla telecamera di scendere sotto il livello del suolo
    orbitControls.maxPolarAngle = Math.PI / 2 - 0.05;

    // Impedisce di zoomare troppo all'indietro
    orbitControls.maxDistance = 50;

    //Spostamento del punto focale verso x per centrare la scena
    orbitControls.target.set(-0.5, 0, 0);

    setupGUI();
    animate(orbitControls);
}).catch(err => console.error('Errore di bootstrap:', err));

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('pointerdown', onPointerDown);