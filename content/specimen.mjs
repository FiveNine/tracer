/*
 * The specimen's 3D direction: where things sit on the bench and the scroll keys (one per chapter state).
 * Why each key exists: see the reasoning table in README.md ("Why everything moves").
 * Keys use chapter ids from content/site.mjs (home.chapters). 'narrow' overrides apply on phones (<= 820 px).
 */
export const specimen = {
 "colors": {
  "bg": "#ebe7de",
  "ink": "#16140f",
  "accent": "#0657ff",
  "laser": "#3f7dff"
 },
 "look": {
  "preset": "product",
  "vignette": 0.12,
  "grain": 0.03,
  "bloom": 0.22,
  "threshold": 1.15
 },
 "coreRot": -0.3,
 "sliceAt": [
  6.0,
  0.55,
  1.0
 ],
 "ledgerWall": [
  6.0,
  0.35,
  -1.6
 ],
 "rabbitAt": [
  9.6,
  0,
  0.9
 ],
 "archiveX0": -1.6,
 "archiveTag": [
  10.4,
  0.4,
  -2.2
 ],
 "faceAngle": 0.38,
 "inlayRot": 1.5708,
 "rabbitLabel": "RABBIT #0042 · RETIRED",
 "keys": [
  {
   "at": "#hero",
   "set": {
    "laser.on": 1,
    "laser.pos": 0,
    "laser.cut": 0,
    "engrave": 0,
    "cut.open": 0,
    "slice.turn": 0,
    "ledger.mix": 0,
    "ledger.alpha": 1,
    "slice.rabbit": 0,
    "rabbit.seal": 0,
    "archive.show": 0,
    "post.tilt": 0,
    "cam.px": 1.0,
    "cam.py": 2.7,
    "cam.pz": 12.2,
    "cam.tx": 0.4,
    "cam.ty": 0.4,
    "cam.tz": 0,
    "cam.fov": 22,
    "cam.shiftX": 0.15,
    "cam.shiftY": -0.07
   },
   "narrow": {
    "cam.px": 0.6, "cam.py": 4.6, "cam.pz": 20.5, "cam.tx": 0.5, "cam.ty": 0.4, "cam.tz": 0, "cam.fov": 28, "cam.shiftX": 0, "cam.shiftY": -0.22
   }
  },
  {
   "at": "#endorse",
   "shift": "-20vh",
   "set": {
    "cam.px": 6.6,
    "cam.py": 1.25,
    "cam.pz": 2.25,
    "cam.tx": 2.1,
    "cam.ty": 0.55,
    "cam.tz": 0.65,
    "cam.fov": 26,
    "cam.shiftX": 0.2,
    "cam.shiftY": 0
   },
   "narrow": {
    "cam.px": 4.9, "cam.py": 2.2, "cam.pz": 6.2, "cam.tx": 2.0, "cam.ty": 0.55, "cam.tz": 0.6, "cam.fov": 30, "cam.shiftX": 0, "cam.shiftY": -0.27
   }
  },
  {
   "at": "#endorse",
   "offset": 0.25,
   "set": {
    "engrave": 0
   }
  },
  {
   "at": "#endorse",
   "offset": 0.6,
   "set": {
    "engrave": 1
   }
  },
  {
   "at": "#slice",
   "shift": "-20vh",
   "set": {
    "cam.px": 1.6,
    "cam.py": 3.4,
    "cam.pz": 10.4,
    "cam.tx": 0.6,
    "cam.ty": 0.45,
    "cam.tz": 0,
    "cam.fov": 22,
    "cam.shiftX": 0.2,
    "cam.shiftY": 0,
    "laser.cut": 1
   },
   "narrow": {
    "cam.px": 1.2,
    "cam.py": 4.6,
    "cam.pz": 16,
    "cam.tx": 0.4,
    "cam.ty": 0.45,
    "cam.tz": 0,
    "cam.fov": 28,
    "cam.shiftX": 0,
    "cam.shiftY": -0.24
   }
  },
  {
   "at": "#ledger",
   "shift": "-20vh",
   "set": {
    "cam.px": 7.2,
    "cam.py": 2.3,
    "cam.pz": 9.4,
    "cam.tx": 6.0,
    "cam.ty": 1.2,
    "cam.tz": -0.2,
    "cam.fov": 26,
    "cam.shiftX": 0.2,
    "cam.shiftY": 0,
    "cut.open": 1,
    "slice.turn": 1
   },
   "narrow": {
    "cam.px": 6.4,
    "cam.py": 2.6,
    "cam.pz": 15.5,
    "cam.tx": 6.0,
    "cam.ty": 1.2,
    "cam.tz": -0.2,
    "cam.fov": 34,
    "cam.shiftX": 0,
    "cam.shiftY": -0.34
   }
  },
  {
   "at": "#ledger",
   "offset": 0.2,
   "set": {
    "ledger.mix": 0
   }
  },
  {
   "at": "#ledger",
   "offset": 0.62,
   "set": {
    "ledger.mix": 1
   }
  },
  {
   "at": "#retire",
   "shift": "-20vh",
   "set": {
    "cam.px": 10.8,
    "cam.py": 2.5,
    "cam.pz": 8.2,
    "cam.tx": 9.6,
    "cam.ty": 0.95,
    "cam.tz": 0.7,
    "cam.fov": 26,
    "cam.shiftX": 0.2,
    "cam.shiftY": 0,
    "ledger.alpha": 0.3
   },
   "narrow": {
    "cam.px": 10.0,
    "cam.py": 2.6,
    "cam.pz": 11.8,
    "cam.tx": 9.6,
    "cam.ty": 0.95,
    "cam.tz": 0.7,
    "cam.fov": 34,
    "cam.shiftX": 0,
    "cam.shiftY": -0.24
   }
  },
  {
   "at": "#retire",
   "offset": 0.3,
   "set": {
    "slice.rabbit": 0
   }
  },
  {
   "at": "#retire",
   "offset": 0.55,
   "set": {
    "slice.rabbit": 1,
    "rabbit.seal": 0
   }
  },
  {
   "at": "#retire",
   "offset": 0.72,
   "set": {
    "rabbit.seal": 1
   }
  },
  {
   "at": "#archive",
   "shift": "-20vh",
   "set": {
    "cam.px": 4.6,
    "cam.py": 23,
    "cam.pz": 3.0,
    "cam.tx": 4.6,
    "cam.ty": 0,
    "cam.tz": -3.4,
    "cam.fov": 30,
    "cam.shiftX": 0.18,
    "cam.shiftY": 0,
    "archive.show": 1,
    "ledger.alpha": 0
   },
   "narrow": {
    "cam.px": 4.4,
    "cam.py": 36,
    "cam.pz": 3.6,
    "cam.tx": 4.4,
    "cam.ty": 0,
    "cam.tz": -3.6,
    "cam.fov": 34,
    "cam.shiftX": 0,
    "cam.shiftY": -0.3
   }
  },
  {
   "at": "#hero",
   "offset": 0.55,
   "set": {}
  },
  {
   "at": "#lines",
   "offset": 0.72,
   "set": {}
  },
  {
   "at": "#endorse",
   "offset": 0.72,
   "set": {}
  },
  {
   "at": "#slice",
   "offset": 0.72,
   "set": {}
  },
  {
   "at": "#ledger",
   "offset": 0.72,
   "set": {}
  },
  {
   "at": "#retire",
   "offset": 0.72,
   "set": {}
  }
 ]
};
