/* GUION — Olla Gitana 3D: GIRA MUNDIAL
   Todo el texto narrativo del juego (bocadillos, sin voces).
   Tono: murciano, rumbero y con gracia. Solo cosas de Murcia y de la banda. */

export const PERSONAJES = {
  olla: 'La Olla',
  cacharro: 'El Cacharro',
  fermin: 'Fermín Cascabel',
  banda: 'La Banda'
};

/* ---------- INTRO CINEMÁTICA (primer arranque y botón "Ver intro") ---------- */
export const INTRO = {
  duracion: 72,
  planos: [
    { id: 'luces', t: 8.5, camara: 'paneoEscenario' },
    { id: 'concierto', t: 11.0, camara: 'lateralEscenario' },
    { id: 'silencio', t: 8.0, camara: 'zoomPantalla' },
    { id: 'cacharro', t: 15.0, camara: 'frenteCacharro' },
    { id: 'huida', t: 13.0, camara: 'seguimientoOlla' },
    { id: 'titulo', t: 7.0, camara: 'titulo' }
  ],
  dialogos: {
    luces: [
      { t: 'Murcia. Sábado noche. El escenario está montao.', tone: 'normal', hold: 2.2 }
    ],
    concierto: [
      { t: '¡La banda suena que se sale!', tone: 'grito', hold: 1.8 },
      { t: 'Mira cómo brillan las notas… 🎵', tone: 'normal', hold: 2.0 }
    ],
    silencio: [
      { t: '…', tone: 'pensamiento', hold: 1.2 },
      { t: '¿Y el sonido?', tone: 'grito', hold: 1.6 }
    ],
    cacharro: [
      { t: '¡JA, JA, JA!', tone: 'grito', hold: 1.4 },
      { t: 'Os he robao las SIETE notas de la banda.', tone: 'radio', hold: 2.4 },
      { t: 'Las he escondío por toa Murcia. ¡Ya nunca sonaréis!', tone: 'radio', hold: 2.6 },
      { t: 'Y esto… ¿qué es? ¿Una olla? ¡JUA, JUA!', tone: 'grito', hold: 2.2 }
    ],
    huida: [
      { t: 'Pues mira, sí. Y voy a por ti. 🔥', tone: 'grito', hold: 2.4 },
      { t: '¡Que no pare la rumba!', tone: 'grito', hold: 2.0 }
    ]
  },
  titulo: { linea1: 'OLLA GITANA 3D', linea2: 'GIRA MUNDIAL' }
};

/* ---------- CUTSCENES ENTRE NIVELES (al ganar cada mundo) ---------- */
export const ENTRE_NIVELES = {
  1: [
    { t: '¡Primera nota recuperada! 🎵', tone: 'exito', gap: 0.2 },
    { t: 'El Cacharro la escondió entre los altavoces del ensayo.', tone: 'radio', gap: 0.2 },
    { t: 'Quedan seis. ¡Al festi!', tone: 'grito' }
  ],
  2: [
    { t: '¡Segunda nota! Esto marcha. 🎶', tone: 'exito', gap: 0.2 },
    { t: 'Menudo lío tienen montao en los andamios…', tone: 'normal', gap: 0.2 },
    { t: 'Cuidado con los focos y con las ondas, zagal.', tone: 'radio' }
  ],
  3: [
    { t: '¡Tercera! Casi me pilla esa furgo. 🚐💨', tone: 'exito', gap: 0.2 },
    { t: 'Al Cacharro le he oído: «¡me voy pa la Procesión, con velas y to!».', tone: 'normal', gap: 0.2 },
    { t: '¡Allá que vamos!', tone: 'grito' }
  ],
  4: [
    { t: '¡Cuarta nota, con cirios y todo! 🕯️', tone: 'exito', gap: 0.2 },
    { t: 'Oye… ¿eso del fondo no suena a sevillanas?', tone: 'pensamiento', gap: 0.3 },
    { t: '¡Fermín Cascabel! El jefe del Cacharro.', tone: 'grito' }
  ],
  5: [
    { t: '¡Le ganamos a Fermín! 🎺', tone: 'exito', gap: 0.2 },
    { t: 'Cacharro: ¡No vale, no vale! ¡Mis notas!', tone: 'radio', gap: 0.2 },
    { t: 'Se ha llevao las que quedan a la huerta.', tone: 'normal' }
  ],
  6: [
    { t: '¡Sexta nota entre alcachofas! 🌱', tone: 'exito', gap: 0.2 },
    { t: 'El muy pillo se ha metío en el Casino.', tone: 'normal', gap: 0.2 },
    { t: 'Dicen que allí los suelos brillan y los espejos engañan…', tone: 'pensamiento' }
  ],
  7: [
    { t: '¡SEPTIMA! ¡Las tenemos todas! 🎉', tone: 'exito', gap: 0.25 },
    { t: 'Cacharro: ¡AL ESCENARIO! ¡Aquí acaba vuestra rumba!', tone: 'radio', gap: 0.2 },
    { t: 'Eso lo veremos. ¡Vamos allá! 🎸', tone: 'grito' }
  ]
};

/* ---------- CUTSCENE DE JEFE (al entrar en la arena) ---------- */
export const JEFE = {
  entrada: [
    { t: 'Así que tú eres la ollita…', tone: 'radio', hold: 2.0 },
    { t: '¡Aquí no gana nadie sin mi permiso!', tone: 'grito', hold: 2.0 },
    { t: '¡Y menos una olla con patas! ⚡', tone: 'grito', hold: 1.6 }
  ],
  fases: {
    2: [{ t: '¡Te vas a enterar! ¡Fase dos! ⚡⚡', tone: 'grito', hold: 1.4 }],
    3: [{ t: '¡ESTO ES EL FINAL, OLLITA! 💀', tone: 'grito', hold: 1.6 }]
  },
  derrota: [
    { t: 'No… mi… sonido… 🎛️💥', tone: 'radio', hold: 2.2 },
    { t: 'La banda vuelve a sonar. ¡GRACIAS, ZAGAL! 🎸', tone: 'exito', hold: 2.6 }
  ]
};

export const JEFE_INTERMEDIO = {
  entrada: [
    { t: '¿Y tú adónde vas con esa olla? 🎺', tone: 'grito', hold: 2.0 },
    { t: '¡Nadie pasa por mi desfile!', tone: 'radio', hold: 1.8 },
    { t: '¡Toma sevillanas! 💥', tone: 'grito', hold: 1.5 }
  ],
  derrota: [
    { t: '¡Ay mi ampli! ¡Mi ritmo! 🎺💔', tone: 'radio', hold: 2.0 },
    { t: 'Tú ganas… pero el Cacharro te espera.', tone: 'normal', hold: 2.2 }
  ]
};

/* ---------- FINAL ---------- */
export const FINAL = [
  { t: '¡¡LO HEMOS CONSEGUIDO!! 🎉🎸', tone: 'exito', hold: 2.4 },
  { t: 'Las siete notas vuelven a casa y el patio se viene abajo. 🎉', tone: 'normal', hold: 2.4 },
  { t: 'La banda toca como nunca. Y tú, en primera fila.', tone: 'normal', hold: 2.4 },
  { t: '¡Que no pare la rumba, zagal! 🥘🔥', tone: 'grito', hold: 2.6 }
];

/* ---------- FRASES CORTAS DE JUEGO (toasts hablados) ---------- */
export const FRASES = {
  nota: ['¡Esa es!', '¡Toma nota!', '¡Suena bien!', '¡Pa la saca!', '¡Otra más!'],
  caja: ['¡Pum!', '¡Crac!', '¡A tomar por… el cajón!', '¡Madera va!'],
  mask: ['¡Máscara!', '¡Rumba pura!'],
  aura: ['¡¡AURA RUMBERA!! 🎸', '¡IMPARABLE!'],
  dano: ['¡Ay!', '¡Uy uy uy!', '¡Cagüen…!', '¡Eso ha dolido!'],
  meta: ['¡Escenario!', '¡A tocar!', '¡Lo logramos!'],
  secreto: ['¡Zona secreta! 🤫', '¡Aquí hay tesoro!']
};

export function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
